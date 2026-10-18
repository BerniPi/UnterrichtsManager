import type { PageServerLoad, Actions } from './$types';
import { db, sqlite } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import { calculateSnoozeDate } from '$lib/services/reminders';
import { getIsoWeekAndYear } from '$lib/services/dates';

export const load: PageServerLoad = async ({ url, parent }) => {
	const layoutData = await parent();
	const courses = layoutData.coursesList || [];

	const selectedCourseId = url.searchParams.get('courseId') || courses[0]?.id;
	const selectedCourse = courses.find((c) => c.id === selectedCourseId) || courses[0];

	if (!selectedCourse) {
		return {
			courses,
			selectedCourse: null,
			studentsWithDetails: [],
			activeHomework: null
		};
	}

	const todayStr = new Date().toISOString().slice(0, 10);
	const { week: weekNumber, year } = getIsoWeekAndYear();

	// 1. Get all active students in class
	const studentsList = sqlite
		.prepare(
			`
		SELECT s.id, s.first_name, s.last_name, s.catalog_number, s.webuntis_id
		FROM students s
		WHERE s.class_id = ? AND s.status = 'active'
		ORDER BY COALESCE(s.catalog_number, 999) ASC, s.last_name ASC, s.first_name ASC
	`
		)
		.all(selectedCourse.classId) as Array<{
		id: string;
		first_name: string;
		last_name: string;
		catalog_number: number | null;
		webuntis_id: string | null;
	}>;

	// 2. Get participation entry for each student for this week
	const participationEntries = sqlite
		.prepare(
			`
		SELECT pe.id, pe.student_id, pe.value, pe.comment
		FROM participation_entries pe
		WHERE pe.course_id = ? AND pe.week_number = ? AND pe.year = ?
	`
		)
		.all(selectedCourse.id, weekNumber, year) as Array<{
		id: string;
		student_id: string;
		value: 'plus' | 'tilde' | 'minus';
		comment: string | null;
	}>;
	const partMap = new Map(participationEntries.map((p) => [p.student_id, p]));

	// 3. Get active homework for course (most recent due)
	const activeHomework = sqlite
		.prepare(
			`
		SELECT h.id, h.title, h.due_date
		FROM homeworks h
		WHERE h.course_id = ?
		ORDER BY h.due_date DESC
		LIMIT 1
	`
		)
		.get(selectedCourse.id) as { id: string; title: string; due_date: string } | undefined;

	const homeworkStatuses = activeHomework
		? (sqlite
				.prepare(
					`
			SELECT hs.student_id, hs.status
			FROM homework_statuses hs
			WHERE hs.homework_id = ?
		`
				)
				.all(activeHomework.id) as Array<{ student_id: string; status: 'done' | 'partial' | 'forgotten' }>)
		: [];
	const hwMap = new Map(homeworkStatuses.map((h) => [h.student_id, h.status]));

	// 4. Overdue items for this specific student:
	// Unsigned test returns in this course
	const overdueReturns = sqlite
		.prepare(
			`
		SELECT 
			ar.id,
			ar.student_id,
			a.title as assessment_title,
			ar.due_date,
			CAST(julianday(?) - julianday(ar.due_date) AS INTEGER) as days_overdue
		FROM assessment_returns ar
		JOIN assessments a ON ar.assessment_id = a.id
		WHERE a.course_id = ?
		  AND ar.is_signed = 0
		  AND ar.due_date < ?
		  AND (ar.snoozed_until IS NULL OR ar.snoozed_until <= ?)
	`
		)
		.all(todayStr, selectedCourse.id, todayStr, todayStr) as Array<{
		id: string;
		student_id: string;
		assessment_title: string;
		due_date: string;
		days_overdue: number;
	}>;

	// Unsigned early warnings for this student & course
	const overdueEarlyWarnings = sqlite
		.prepare(
			`
		SELECT 
			ew.id,
			ew.student_id,
			ew.reason,
			ew.due_date,
			CAST(julianday(?) - julianday(ew.due_date) AS INTEGER) as days_overdue
		FROM early_warnings ew
		WHERE ew.course_id = ?
		  AND ew.is_signed = 0
		  AND ew.due_date < ?
		  AND (ew.snoozed_until IS NULL OR ew.snoozed_until <= ?)
	`
		)
		.all(todayStr, selectedCourse.id, todayStr, todayStr) as Array<{
		id: string;
		student_id: string;
		reason: string;
		due_date: string;
		days_overdue: number;
	}>;

	// Group overdue items by student
	const overdueByStudent = new Map<
		string,
		Array<{
			id: string;
			type: 'assessment_return' | 'early_warning';
			title: string;
			dueDate: string;
			daysOverdue: number;
		}>
	>();

	for (const r of overdueReturns) {
		const list = overdueByStudent.get(r.student_id) || [];
		list.push({
			id: r.id,
			type: 'assessment_return',
			title: `Test: ${r.assessment_title}`,
			dueDate: r.due_date,
			daysOverdue: Math.max(0, r.days_overdue)
		});
		overdueByStudent.set(r.student_id, list);
	}

	for (const ew of overdueEarlyWarnings) {
		const list = overdueByStudent.get(ew.student_id) || [];
		list.push({
			id: ew.id,
			type: 'early_warning',
			title: `Frühwarnung (${ew.reason})`,
			dueDate: ew.due_date,
			daysOverdue: Math.max(0, ew.days_overdue)
		});
		overdueByStudent.set(ew.student_id, list);
	}

	const studentsWithDetails = studentsList.map((s) => ({
		id: s.id,
		firstName: s.first_name,
		lastName: s.last_name,
		catalogNumber: s.catalog_number,
		webuntisId: s.webuntis_id,
		participation: partMap.get(s.id) || null,
		homeworkStatus: hwMap.get(s.id) || null,
		overdueItems: overdueByStudent.get(s.id) || []
	}));

	return {
		courses,
		selectedCourse,
		currentWeekNumber: weekNumber,
		currentYear: year,
		activeHomework,
		studentsWithDetails
	};
};

export const actions: Actions = {
	setParticipation: async ({ request }) => {
		const form = await request.formData();
		const courseId = form.get('courseId')?.toString();
		const studentId = form.get('studentId')?.toString();
		const value = form.get('value')?.toString() as 'plus' | 'tilde' | 'minus';
		const weekNumber = parseInt(form.get('weekNumber')?.toString() || '0', 10);
		const year = parseInt(form.get('year')?.toString() || '0', 10);
		const todayStr = new Date().toISOString().slice(0, 10);

		if (!courseId || !studentId || !value) {
			return { success: false };
		}

		// Check if exists
		const existing = sqlite
			.prepare(
				'SELECT id, value FROM participation_entries WHERE course_id = ? AND student_id = ? AND week_number = ? AND year = ?'
			)
			.get(courseId, studentId, weekNumber, year) as { id: string; value: string } | undefined;

		if (existing) {
			if (existing.value === value) {
				// Toggle off if tapping same value again
				db.delete(schema.participationEntries)
					.where(eq(schema.participationEntries.id, existing.id))
					.run();
			} else {
				db.update(schema.participationEntries)
					.set({ value, date: todayStr })
					.where(eq(schema.participationEntries.id, existing.id))
					.run();
			}
		} else {
			db.insert(schema.participationEntries)
				.values({
					id: crypto.randomUUID(),
					courseId,
					studentId,
					date: todayStr,
					weekNumber,
					year,
					value,
					createdAt: Date.now()
				})
				.run();
		}

		return { success: true };
	},

	setHomeworkStatus: async ({ request }) => {
		const form = await request.formData();
		const homeworkId = form.get('homeworkId')?.toString();
		const studentId = form.get('studentId')?.toString();
		const status = form.get('status')?.toString() as 'done' | 'partial' | 'forgotten';

		if (!homeworkId || !studentId || !status) {
			return { success: false };
		}

		const existing = sqlite
			.prepare('SELECT id, status FROM homework_statuses WHERE homework_id = ? AND student_id = ?')
			.get(homeworkId, studentId) as { id: string; status: string } | undefined;

		if (existing) {
			db.update(schema.homeworkStatuses)
				.set({ status })
				.where(eq(schema.homeworkStatuses.id, existing.id))
				.run();
		} else {
			db.insert(schema.homeworkStatuses)
				.values({
					id: crypto.randomUUID(),
					homeworkId,
					studentId,
					status
				})
				.run();
		}

		return { success: true };
	},

	quickNote: async ({ request }) => {
		const form = await request.formData();
		const studentId = form.get('studentId')?.toString();
		const courseId = form.get('courseId')?.toString() || null;
		const category = form.get('category')?.toString() || 'allgemein';
		const title = form.get('title')?.toString().trim();
		const content = form.get('content')?.toString().trim();
		const todayStr = new Date().toISOString().slice(0, 10);

		if (!studentId || !title || !content) {
			return { success: false, message: 'Titel und Inhalt erforderlich' };
		}

		db.insert(schema.notes)
			.values({
				id: crypto.randomUUID(),
				studentId,
				courseId,
				date: todayStr,
				category,
				title,
				content
			})
			.run();

		return { success: true, noteCreated: true };
	},

	markSigned: async ({ request }) => {
		const form = await request.formData();
		const type = form.get('type')?.toString();
		const id = form.get('id')?.toString();
		const todayStr = new Date().toISOString().slice(0, 10);

		if (type === 'assessment_return' && id) {
			db.update(schema.assessmentReturns)
				.set({ isSigned: true, signedDate: todayStr })
				.where(eq(schema.assessmentReturns.id, id))
				.run();
		} else if (type === 'early_warning' && id) {
			db.update(schema.earlyWarnings)
				.set({ isSigned: true, signedDate: todayStr, status: 'resolved' })
				.where(eq(schema.earlyWarnings.id, id))
				.run();
		}

		return { success: true };
	},

	recordAsked: async ({ request }) => {
		const form = await request.formData();
		const type = form.get('type')?.toString() as 'assessment_return' | 'early_warning';
		const id = form.get('id')?.toString();
		const todayStr = new Date().toISOString().slice(0, 10);

		if (type && id) {
			db.insert(schema.reminderLogs)
				.values({
					id: crypto.randomUUID(),
					entityType: type,
					entityId: id,
					date: todayStr,
					type: 'asked',
					note: 'In der Unterrichtsstunde nachgefragt'
				})
				.run();
		}

		return { success: true, asked: true };
	},

	snooze: async ({ request }) => {
		const form = await request.formData();
		const type = form.get('type')?.toString();
		const id = form.get('id')?.toString();
		const days = parseInt(form.get('days')?.toString() || '3', 10);
		const snoozeUntil = calculateSnoozeDate(days);

		if (type === 'assessment_return' && id) {
			db.update(schema.assessmentReturns)
				.set({ snoozedUntil: snoozeUntil })
				.where(eq(schema.assessmentReturns.id, id))
				.run();
		} else if (type === 'early_warning' && id) {
			db.update(schema.earlyWarnings)
				.set({ snoozedUntil: snoozeUntil })
				.where(eq(schema.earlyWarnings.id, id))
				.run();
		}

		return { success: true };
	}
};
