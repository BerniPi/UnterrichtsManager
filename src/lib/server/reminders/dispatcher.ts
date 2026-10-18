import webpush from 'web-push';
import { db, sqlite } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { todayVienna } from '../../services/dates';

// Setup VAPID keys from settings or generate them
export function getOrCreateVapidKeys() {
	const pubKeyRow = sqlite.prepare('SELECT value FROM settings WHERE key = ?').get('vapid_public_key') as
		| { value: string }
		| undefined;
	const privKeyRow = sqlite
		.prepare('SELECT value FROM settings WHERE key = ?')
		.get('vapid_private_key') as { value: string } | undefined;

	if (pubKeyRow && privKeyRow) {
		return {
			publicKey: pubKeyRow.value,
			privateKey: privKeyRow.value
		};
	}

	const keys = webpush.generateVAPIDKeys();
	db.insert(schema.settings)
		.values([
			{ key: 'vapid_public_key', value: keys.publicKey },
			{ key: 'vapid_private_key', value: keys.privateKey }
		])
		.onConflictDoNothing()
		.run();

	return keys;
}

export function initWebPush() {
	const keys = getOrCreateVapidKeys();
	webpush.setVapidDetails(
		'mailto:lehrer@notenmanager.local',
		keys.publicKey,
		keys.privateKey
	);
	return keys.publicKey;
}

export async function sendPushToAll(title: string, body: string, url: string = '/') {
	initWebPush();
	const subscriptions = db.select().from(schema.pushSubscriptions).all();
	const payload = JSON.stringify({ title, body, url });

	const results = await Promise.allSettled(
		subscriptions.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{
						endpoint: sub.endpoint,
						keys: {
							p256dh: sub.p256dh,
							auth: sub.auth
						}
					},
					payload
				);
			} catch (err: any) {
				// If subscription is 404 or 410 Gone, remove it
				if (err.statusCode === 404 || err.statusCode === 410) {
					db.delete(schema.pushSubscriptions)
						.where(eq(schema.pushSubscriptions.endpoint, sub.endpoint))
						.run();
				}
				throw err;
			}
		})
	);

	return results;
}

export interface OverdueSummary {
	overdueReturns: Array<{
		id: string;
		studentName: string;
		courseSubject: string;
		className: string;
		assessmentTitle: string;
		dueDate: string;
		daysOverdue: number;
	}>;
	overdueEarlyWarnings: Array<{
		id: string;
		studentName: string;
		courseSubject: string;
		className: string;
		reason: string;
		dueDate: string;
		daysOverdue: number;
	}>;
	totalOverdue: number;
}

/**
 * Scans SQLite database for overdue items.
 */
export function getOverdueItems(referenceDateStr: string = new Date().toISOString().slice(0, 10)): OverdueSummary {
	// Overdue Assessment Returns
	const returns = sqlite
		.prepare(
			`
		SELECT 
			ar.id,
			s.first_name || ' ' || s.last_name as student_name,
			co.subject as course_subject,
			cl.name as class_name,
			a.title as assessment_title,
			ar.due_date,
			CAST(julianday(?) - julianday(ar.due_date) AS INTEGER) as days_overdue
		FROM assessment_returns ar
		JOIN students s ON ar.student_id = s.id
		JOIN assessments a ON ar.assessment_id = a.id
		JOIN courses co ON a.course_id = co.id
		JOIN classes cl ON co.class_id = cl.id
		WHERE ar.is_signed = 0
		  AND ar.due_date < ?
		  AND (ar.snoozed_until IS NULL OR ar.snoozed_until <= ?)
		ORDER BY ar.due_date ASC
	`
		)
		.all(referenceDateStr, referenceDateStr, referenceDateStr) as Array<{
		id: string;
		student_name: string;
		course_subject: string;
		class_name: string;
		assessment_title: string;
		due_date: string;
		days_overdue: number;
	}>;

	// Overdue Early Warnings
	const warnings = sqlite
		.prepare(
			`
		SELECT 
			ew.id,
			s.first_name || ' ' || s.last_name as student_name,
			co.subject as course_subject,
			cl.name as class_name,
			ew.reason,
			ew.due_date,
			CAST(julianday(?) - julianday(ew.due_date) AS INTEGER) as days_overdue
		FROM early_warnings ew
		JOIN students s ON ew.student_id = s.id
		JOIN courses co ON ew.course_id = co.id
		JOIN classes cl ON co.class_id = cl.id
		WHERE ew.is_signed = 0
		  AND ew.due_date < ?
		  AND (ew.snoozed_until IS NULL OR ew.snoozed_until <= ?)
		ORDER BY ew.due_date ASC
	`
		)
		.all(referenceDateStr, referenceDateStr, referenceDateStr) as Array<{
		id: string;
		student_name: string;
		course_subject: string;
		class_name: string;
		reason: string;
		due_date: string;
		days_overdue: number;
	}>;

	return {
		overdueReturns: returns.map((r) => ({
			id: r.id,
			studentName: r.student_name,
			courseSubject: r.course_subject,
			className: r.class_name,
			assessmentTitle: r.assessment_title,
			dueDate: r.due_date,
			daysOverdue: Math.max(0, r.days_overdue)
		})),
		overdueEarlyWarnings: warnings.map((w) => ({
			id: w.id,
			studentName: w.student_name,
			courseSubject: w.course_subject,
			className: w.class_name,
			reason: w.reason,
			dueDate: w.due_date,
			daysOverdue: Math.max(0, w.days_overdue)
		})),
		totalOverdue: returns.length + warnings.length
	};
}

export interface AssessmentEarlyWarningReminder {
	assessmentId: string;
	assessmentTitle: string;
	assessmentType: string;
	assessmentDate: string;
	courseId: string;
	courseSubject: string;
	className: string;
	studentId: string;
	studentName: string;
	grade: number;
	daysSinceAssessment: number;
}

/**
 * Finds students who received a grade 5 on an assessment 1 week or more ago,
 * but do not yet have an early warning issued in that course for the semester.
 */
export function getAssessmentEarlyWarningReminders(
	referenceDateStr: string = todayVienna()
): AssessmentEarlyWarningReminder[] {
	const rows = sqlite
		.prepare(
			`
		SELECT 
			a.id as assessment_id,
			a.title as assessment_title,
			a.type as assessment_type,
			a.date as assessment_date,
			c.id as course_id,
			c.subject as course_subject,
			cl.name as class_name,
			s.id as student_id,
			s.first_name || ' ' || s.last_name as student_name,
			ar.grade,
			CAST(julianday(?) - julianday(a.date) AS INTEGER) as days_since_assessment
		FROM assessment_results ar
		JOIN assessments a ON ar.assessment_id = a.id
		JOIN courses c ON a.course_id = c.id
		JOIN classes cl ON c.class_id = cl.id
		JOIN students s ON ar.student_id = s.id
		JOIN school_years sy ON c.school_year_id = sy.id
		WHERE ar.grade = 5
		  AND a.is_counted = 1
		  AND s.status = 'active'
		  AND CAST(julianday(?) - julianday(a.date) AS INTEGER) >= 7
		  AND CAST(julianday(?) - julianday(a.date) AS INTEGER) <= 60
		  AND NOT EXISTS (
			  SELECT 1 FROM early_warnings ew
			  WHERE ew.student_id = s.id
			    AND ew.course_id = c.id
			    AND ew.semester = CASE WHEN a.date <= sy.first_semester_end THEN 1 ELSE 2 END
		  )
		  AND NOT EXISTS (
			  SELECT 1 FROM reminder_logs rl
			  WHERE rl.entity_type = 'assessment_ew_reminder'
			    AND rl.entity_id = (a.id || ':' || s.id)
			    AND (
			        rl.type = 'dismissed' 
			        OR (rl.type = 'snoozed' AND rl.note > ?)
			    )
		  )
		ORDER BY a.date DESC, s.last_name ASC
	`
		)
		.all(referenceDateStr, referenceDateStr, referenceDateStr, referenceDateStr) as Array<{
		assessment_id: string;
		assessment_title: string;
		assessment_type: string;
		assessment_date: string;
		course_id: string;
		course_subject: string;
		class_name: string;
		student_id: string;
		student_name: string;
		grade: number;
		days_since_assessment: number;
	}>;

	return rows.map((r) => ({
		assessmentId: r.assessment_id,
		assessmentTitle: r.assessment_title,
		assessmentType: r.assessment_type,
		assessmentDate: r.assessment_date,
		courseId: r.course_id,
		courseSubject: r.course_subject,
		className: r.class_name,
		studentId: r.student_id,
		studentName: r.student_name,
		grade: r.grade,
		daysSinceAssessment: Math.max(0, r.days_since_assessment)
	}));
}

/**
 * Checks for overdue items & early warning reminders and dispatches Web Push notifications if there are any.
 */
export async function runReminderCheck(referenceDateStr: string = todayVienna()) {
	const summary = getOverdueItems(referenceDateStr);
	const assessmentReminders = getAssessmentEarlyWarningReminders(referenceDateStr);
	const totalItems = summary.totalOverdue + assessmentReminders.length;
	if (totalItems === 0) {
		return { dispatched: false, count: 0 };
	}

	const parts: string[] = [];
	if (summary.overdueReturns.length > 0) parts.push(`${summary.overdueReturns.length} Test-Rücklauf(e)`);
	if (summary.overdueEarlyWarnings.length > 0) parts.push(`${summary.overdueEarlyWarnings.length} Frühwarnungs-Rücklauf(e)`);
	if (assessmentReminders.length > 0) parts.push(`${assessmentReminders.length} Frühwarn-Erinnerung(en) nach Tests`);

	const title = `⚠️ ${totalItems} Benachrichtigung(en)`;
	const body = `${parts.join(', ')} stehen aus bzw. sind überfällig.`;

	await sendPushToAll(title, body, '/');

	// Log that reminder was sent
	for (const ret of summary.overdueReturns) {
		db.insert(schema.reminderLogs)
			.values({
				id: crypto.randomUUID(),
				entityType: 'assessment_return',
				entityId: ret.id,
				date: new Date().toISOString(),
				type: 'push_sent',
				note: `${ret.daysOverdue} Tage überfällig`
			})
			.run();
	}

	for (const ew of summary.overdueEarlyWarnings) {
		db.insert(schema.reminderLogs)
			.values({
				id: crypto.randomUUID(),
				entityType: 'early_warning',
				entityId: ew.id,
				date: new Date().toISOString(),
				type: 'push_sent',
				note: `${ew.daysOverdue} Tage überfällig`
			})
			.run();
	}

	return { dispatched: true, count: totalItems };
}
