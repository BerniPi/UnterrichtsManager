import { db, sqlite } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

export interface HomeworkWithStats {
	id: string;
	courseId: string;
	title: string;
	dueDate: string;
	description: string | null;
	doneCount: number;
	partialCount: number;
	forgottenCount: number;
	totalStudents: number;
}

export const homeworkRepository = {
	getByCourse(courseId: string): HomeworkWithStats[] {
		const rows = sqlite
			.prepare(
				`
			SELECT 
				h.id,
				h.course_id as courseId,
				h.title,
				h.due_date as dueDate,
				h.description,
				COUNT(CASE WHEN hs.status = 'done' THEN 1 END) as doneCount,
				COUNT(CASE WHEN hs.status = 'partial' THEN 1 END) as partialCount,
				COUNT(CASE WHEN hs.status = 'forgotten' THEN 1 END) as forgottenCount,
				COUNT(hs.student_id) as totalStudents
			FROM homeworks h
			LEFT JOIN homework_statuses hs ON hs.homework_id = h.id
			WHERE h.course_id = ?
			GROUP BY h.id
			ORDER BY h.due_date DESC
		`
			)
			.all(courseId) as HomeworkWithStats[];
		return rows;
	},

	getStudentCounts(studentId: string, courseId?: string) {
		const query = `
			SELECT 
				COUNT(CASE WHEN hs.status = 'done' THEN 1 END) as done,
				COUNT(CASE WHEN hs.status = 'partial' THEN 1 END) as partial,
				COUNT(CASE WHEN hs.status = 'forgotten' THEN 1 END) as forgotten
			FROM homework_statuses hs
			JOIN homeworks h ON hs.homework_id = h.id
			WHERE hs.student_id = ? ${courseId ? 'AND h.course_id = ?' : ''}
		`;
		const args = courseId ? [studentId, courseId] : [studentId];
		const res = sqlite.prepare(query).get(...args) as { done: number; partial: number; forgotten: number };
		return {
			done: res?.done || 0,
			partial: res?.partial || 0,
			forgotten: res?.forgotten || 0
		};
	},

	create(data: {
		courseId: string;
		title: string;
		dueDate: string;
		description?: string | null;
	}): string {
		const id = crypto.randomUUID();
		db.insert(schema.homeworks)
			.values({
				id,
				courseId: data.courseId,
				title: data.title,
				dueDate: data.dueDate,
				description: data.description || null
			})
			.run();

		// Populate default 'done' status for all active students in class
		const course = sqlite.prepare('SELECT class_id FROM courses WHERE id = ?').get(data.courseId) as {
			class_id: string;
		};
		const students = sqlite
			.prepare("SELECT id FROM students WHERE class_id = ? AND status = 'active'")
			.all(course.class_id) as Array<{ id: string }>;

		for (const s of students) {
			db.insert(schema.homeworkStatuses)
				.values({
					id: crypto.randomUUID(),
					homeworkId: id,
					studentId: s.id,
					status: 'done'
				})
				.run();
		}

		return id;
	},

	setStatus(homeworkId: string, studentId: string, status: 'done' | 'partial' | 'forgotten', note?: string | null): void {
		const existing = sqlite
			.prepare('SELECT id FROM homework_statuses WHERE homework_id = ? AND student_id = ?')
			.get(homeworkId, studentId) as { id: string } | undefined;

		if (existing) {
			db.update(schema.homeworkStatuses)
				.set({ status, note: note || null })
				.where(eq(schema.homeworkStatuses.id, existing.id))
				.run();
		} else {
			db.insert(schema.homeworkStatuses)
				.values({
					id: crypto.randomUUID(),
					homeworkId,
					studentId,
					status,
					note: note || null
				})
				.run();
		}
	}
};
