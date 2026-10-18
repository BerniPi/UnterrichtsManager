import type { PageServerLoad, Actions } from './$types';
import { db, sqlite } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getOverdueItems, runReminderCheck } from '$lib/server/reminders/dispatcher';
import { calculateSnoozeDate, isDeadlineApproaching } from '$lib/services/reminders';
import crypto from 'node:crypto';

export const load: PageServerLoad = async ({ parent }) => {
	const layoutData = await parent();
	const sy = layoutData.currentSchoolYear;

	const todayStr = new Date().toISOString().slice(0, 10);
	const overdueSummary = getOverdueItems(todayStr);

	// Calculate current calendar week
	const now = new Date();
	const firstJan = new Date(now.getFullYear(), 0, 1);
	const weekNumber = Math.ceil(((now.getTime() - firstJan.getTime()) / 86400000 + firstJan.getDay() + 1) / 7);
	const year = now.getFullYear();

	// Find students with NO participation entry in their courses for the current week
	const courses = layoutData.coursesList || [];
	const missingParticipationByCourse: Array<{
		courseId: string;
		courseSubject: string;
		className: string;
		students: Array<{ id: string; name: string }>;
	}> = [];

	for (const c of courses) {
		const studentsWithoutEntry = sqlite
			.prepare(
				`
			SELECT s.id, s.first_name || ' ' || s.last_name as name
			FROM students s
			JOIN classes cl ON s.class_id = cl.id
			JOIN courses co ON co.class_id = cl.id
			WHERE co.id = ? AND s.status = 'active'
			  AND s.id NOT IN (
				  SELECT pe.student_id 
				  FROM participation_entries pe 
				  WHERE pe.course_id = ? AND pe.week_number = ? AND pe.year = ?
			  )
			ORDER BY s.last_name ASC, s.first_name ASC
		`
			)
			.all(c.id, c.id, weekNumber, year) as Array<{ id: string; name: string }>;

		if (studentsWithoutEntry.length > 0) {
			missingParticipationByCourse.push({
				courseId: c.id,
				courseSubject: c.subject,
				className: c.className,
				students: studentsWithoutEntry
			});
		}
	}

	// Deadlines check
	const deadlines = sy
		? [
				{
					title: '1. Frühwarnfrist',
					date: sy.earlyWarningDeadline1,
					approaching: isDeadlineApproaching(sy.earlyWarningDeadline1, 21, todayStr)
				},
				{
					title: '1. Notenschluss',
					date: sy.gradingDeadline1,
					approaching: isDeadlineApproaching(sy.gradingDeadline1, 21, todayStr)
				},
				{
					title: '2. Frühwarnfrist',
					date: sy.earlyWarningDeadline2,
					approaching: isDeadlineApproaching(sy.earlyWarningDeadline2, 21, todayStr)
				},
				{
					title: '2. Notenschluss',
					date: sy.gradingDeadline2,
					approaching: isDeadlineApproaching(sy.gradingDeadline2, 21, todayStr)
				}
		  ]
		: [];

	// Pre-Notenschluss warning check: are there open early warnings near Notenschluss?
	const isNearNotenschluss = deadlines.some((d) => d.title.includes('Notenschluss') && d.approaching.isApproaching);
	const openEarlyWarningsCount = (
		sqlite.prepare('SELECT COUNT(*) as count FROM early_warnings WHERE is_signed = 0').get() as any
	).count;

	return {
		overdueSummary,
		missingParticipationByCourse,
		currentWeekNumber: weekNumber,
		deadlines,
		isNearNotenschluss,
		openEarlyWarningsCount
	};
};

export const actions: Actions = {
	markReturnSigned: async ({ request }) => {
		const form = await request.formData();
		const returnId = form.get('returnId')?.toString();
		const todayStr = new Date().toISOString().slice(0, 10);

		if (returnId) {
			db.update(schema.assessmentReturns)
				.set({
					isSigned: true,
					signedDate: todayStr
				})
				.where(eq(schema.assessmentReturns.id, returnId))
				.run();
		}
		return { success: true };
	},

	markEarlyWarningSigned: async ({ request }) => {
		const form = await request.formData();
		const warningId = form.get('warningId')?.toString();
		const todayStr = new Date().toISOString().slice(0, 10);

		if (warningId) {
			db.update(schema.earlyWarnings)
				.set({
					isSigned: true,
					signedDate: todayStr,
					status: 'resolved'
				})
				.where(eq(schema.earlyWarnings.id, warningId))
				.run();
		}
		return { success: true };
	},

	recordAsked: async ({ request }) => {
		const form = await request.formData();
		const entityType = form.get('entityType')?.toString() as 'assessment_return' | 'early_warning';
		const entityId = form.get('entityId')?.toString();
		const todayStr = new Date().toISOString().slice(0, 10);

		if (entityType && entityId) {
			db.insert(schema.reminderLogs)
				.values({
					id: crypto.randomUUID(),
					entityType,
					entityId,
					date: todayStr,
					type: 'asked',
					note: 'In der Unterrichtsstunde nachgefragt'
				})
				.run();
		}
		return { success: true };
	},

	snooze: async ({ request }) => {
		const form = await request.formData();
		const entityType = form.get('entityType')?.toString();
		const entityId = form.get('entityId')?.toString();
		const days = parseInt(form.get('days')?.toString() || '3', 10);
		const snoozeUntil = calculateSnoozeDate(days);

		if (entityType === 'assessment_return' && entityId) {
			db.update(schema.assessmentReturns)
				.set({ snoozedUntil: snoozeUntil })
				.where(eq(schema.assessmentReturns.id, entityId))
				.run();
		} else if (entityType === 'early_warning' && entityId) {
			db.update(schema.earlyWarnings)
				.set({ snoozedUntil: snoozeUntil })
				.where(eq(schema.earlyWarnings.id, entityId))
				.run();
		}

		return { success: true };
	},

	triggerPushCheck: async () => {
		const result = await runReminderCheck();
		return { success: true, ...result };
	}
};
