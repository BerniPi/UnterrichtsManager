import webpush from 'web-push';
import { db, sqlite } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

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

/**
 * Checks for overdue items and dispatches Web Push notifications if there are any.
 */
export async function runReminderCheck(referenceDateStr: string = new Date().toISOString().slice(0, 10)) {
	const summary = getOverdueItems(referenceDateStr);
	if (summary.totalOverdue === 0) {
		return { dispatched: false, count: 0 };
	}

	const title = `⚠️ ${summary.totalOverdue} überfällige Unterschrift(en)`;
	const body = `${summary.overdueReturns.length} Test(s) und ${summary.overdueEarlyWarnings.length} Frühwarnung(en) sind überfällig.`;

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

	return { dispatched: true, count: summary.totalOverdue };
}
