import type { PageServerLoad, Actions } from './$types';
import { db, sqlite } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
	getOverdueItems,
	getAssessmentEarlyWarningReminders,
	runReminderCheck
} from '$lib/server/reminders/dispatcher';
import { calculateSnoozeDate, isDeadlineApproaching } from '$lib/services/reminders';
import { getIsoWeekAndYear } from '$lib/services/dates';
import { requireTeacher, guardCourseActions } from '$lib/server/auth/access';
import crypto from 'node:crypto';
import { timetableRepository } from '$lib/server/repositories/timetable.repository';
import { syncTimetableIfStale } from '$lib/server/webuntis/timetable';
import { toVienna } from '$lib/services/ical';
import { addDays } from '$lib/services/dates';
import { groupExams } from '$lib/services/timetable';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const user = requireTeacher(locals);
	const layoutData = await parent();
	const sy = layoutData.currentSchoolYear;

	const todayStr = new Date().toISOString().slice(0, 10);
	const overdueSummary = getOverdueItems(todayStr, user.id);
	const assessmentEarlyWarningReminders = getAssessmentEarlyWarningReminders(todayStr, user.id);

	// Calculate current calendar week (ISO 8601)
	const { week: weekNumber, year } = getIsoWeekAndYear();

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

	// Deadlines check: real school calendar milestones (Notenschluss & Semesterende)
	const deadlines = sy
		? [
				{
					title: '1. Notenschluss',
					date: sy.gradingDeadline1,
					approaching: isDeadlineApproaching(sy.gradingDeadline1, 21, todayStr)
				},
				{
					title: '1. Semesterende',
					date: sy.firstSemesterEnd,
					approaching: isDeadlineApproaching(sy.firstSemesterEnd, 21, todayStr)
				},
				{
					title: '2. Notenschluss',
					date: sy.gradingDeadline2,
					approaching: isDeadlineApproaching(sy.gradingDeadline2, 21, todayStr)
				},
				{
					title: 'Schuljahresende',
					date: sy.secondSemesterEnd,
					approaching: isDeadlineApproaching(sy.secondSemesterEnd, 21, todayStr)
				}
		  ]
		: [];

	// Pre-Notenschluss warning check: are there open early warnings near Notenschluss?
	const isNearNotenschluss = deadlines.some(
		(d) => d.title.includes('Notenschluss') && d.approaching.isApproaching
	);
	const openEarlyWarningsCount = (
		sqlite
			.prepare(
				'SELECT COUNT(*) as count FROM early_warnings ew JOIN courses c ON ew.course_id = c.id WHERE ew.is_signed = 0 AND c.teacher_id = ?'
			)
			.get(user.id) as any
	).count;

	// WebUntis: Prüfungen der nächsten 14 Tage in eigenen Kursen
	syncTimetableIfStale(user.id);
	const today = toVienna(new Date()).date;
	const courseById = new Map(courses.map((c) => [c.id, c]));
	const linkedEvents = timetableRepository
		.getLinkedEvents(user.id, today, addDays(today, 14))
		.filter((e) => courseById.has(e.courseId));
	const assessmentKeys = new Set(
		(
			sqlite
				.prepare(
					`SELECT a.course_id as courseId, a.date FROM assessments a
					 JOIN courses c ON c.id = a.course_id
					 WHERE c.teacher_id = ? AND a.date >= ?`
				)
				.all(user.id, today) as Array<{ courseId: string; date: string }>
		).map((a) => `${a.courseId}|${a.date}`)
	);
	const upcomingExams = [...new Set(linkedEvents.map((e) => e.courseId))]
		.flatMap((courseId) =>
			groupExams(linkedEvents.filter((e) => e.courseId === courseId)).map((g) => {
				const c = courseById.get(courseId)!;
				return {
					courseId,
					courseLabel: `${c.className} ${c.subject}`,
					date: g.date,
					startTime: g.startTime,
					title: g.title,
					examType: g.examType,
					created: assessmentKeys.has(`${courseId}|${g.date}`),
					dismissed: g.dismissed
				};
			})
		)
		.filter((x) => x.created || !x.dismissed)
		.sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));

	return {
		upcomingExams,
		overdueSummary,
		assessmentEarlyWarningReminders,
		missingParticipationByCourse,
		currentWeekNumber: weekNumber,
		deadlines,
		isNearNotenschluss,
		openEarlyWarningsCount
	};
};

export const actions: Actions = guardCourseActions({
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

	snoozeAssessmentReminder: async ({ request }) => {
		const form = await request.formData();
		const assessmentId = form.get('assessmentId')?.toString();
		const studentId = form.get('studentId')?.toString();
		const days = parseInt(form.get('days')?.toString() || '7', 10);
		const todayStr = new Date().toISOString().slice(0, 10);
		const snoozeUntil = calculateSnoozeDate(days, todayStr);

		if (assessmentId && studentId) {
			db.insert(schema.reminderLogs)
				.values({
					id: crypto.randomUUID(),
					entityType: 'assessment_ew_reminder',
					entityId: `${assessmentId}:${studentId}`,
					date: todayStr,
					type: 'snoozed',
					note: snoozeUntil
				})
				.run();
		}
		return { success: true };
	},

	dismissAssessmentReminder: async ({ request }) => {
		const form = await request.formData();
		const assessmentId = form.get('assessmentId')?.toString();
		const studentId = form.get('studentId')?.toString();
		const todayStr = new Date().toISOString().slice(0, 10);

		if (assessmentId && studentId) {
			db.insert(schema.reminderLogs)
				.values({
					id: crypto.randomUUID(),
					entityType: 'assessment_ew_reminder',
					entityId: `${assessmentId}:${studentId}`,
					date: todayStr,
					type: 'dismissed',
					note: 'Manuell verworfen / Nicht nötig'
				})
				.run();
		}
		return { success: true };
	},

	triggerPushCheck: async () => {
		const result = await runReminderCheck();
		return { success: true, ...result };
	}
});
