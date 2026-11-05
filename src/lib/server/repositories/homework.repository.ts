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
	totalClassStudents: number;
	pendingCount: number;
	statuses: Record<string, 'done' | 'partial' | 'forgotten'>;
}

export const homeworkRepository = {
	getByCourse(courseId: string): HomeworkWithStats[] {
		const course = sqlite.prepare('SELECT class_id FROM courses WHERE id = ?').get(courseId) as { class_id: string } | undefined;
		const totalClassStudents = course
			? ((sqlite.prepare("SELECT COUNT(*) as count FROM students WHERE class_id = ? AND status = 'active'").get(course.class_id) as { count: number })?.count ?? 0)
			: 0;

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
			.all(courseId) as Array<{
				id: string;
				courseId: string;
				title: string;
				dueDate: string;
				description: string | null;
				doneCount: number;
				partialCount: number;
				forgottenCount: number;
				totalStudents: number;
			}>;

		const allStatuses = sqlite
			.prepare(
				`
			SELECT hs.homework_id, hs.student_id, hs.status
			FROM homework_statuses hs
			JOIN homeworks h ON hs.homework_id = h.id
			WHERE h.course_id = ?
		`
			)
			.all(courseId) as Array<{ homework_id: string; student_id: string; status: 'done' | 'partial' | 'forgotten' }>;

		const statusMapByHw = new Map<string, Record<string, 'done' | 'partial' | 'forgotten'>>();
		for (const s of allStatuses) {
			if (!statusMapByHw.has(s.homework_id)) {
				statusMapByHw.set(s.homework_id, {});
			}
			statusMapByHw.get(s.homework_id)![s.student_id] = s.status;
		}

		return rows.map((r) => {
			const recordedCount = r.doneCount + r.partialCount + r.forgottenCount;
			const pendingCount = Math.max(0, totalClassStudents - recordedCount);
			return {
				...r,
				totalClassStudents,
				pendingCount,
				statuses: statusMapByHw.get(r.id) || {}
			};
		});
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

		// New homework starts in 'open' state (0 recorded, awaiting teacher check)
		return id;
	},

	toggleStatus(homeworkId: string, studentId: string, status: 'done' | 'partial' | 'forgotten'): 'done' | 'partial' | 'forgotten' | null {
		const existing = sqlite
			.prepare('SELECT id, status FROM homework_statuses WHERE homework_id = ? AND student_id = ?')
			.get(homeworkId, studentId) as { id: string; status: string } | undefined;

		if (existing) {
			if (existing.status === status) {
				// Toggle off -> remove status (returns to open/pending)
				db.delete(schema.homeworkStatuses)
					.where(eq(schema.homeworkStatuses.id, existing.id))
					.run();
				return null;
			}
			db.update(schema.homeworkStatuses)
				.set({ status })
				.where(eq(schema.homeworkStatuses.id, existing.id))
				.run();
			return status;
		} else {
			db.insert(schema.homeworkStatuses)
				.values({
					id: crypto.randomUUID(),
					homeworkId,
					studentId,
					status
				})
				.run();
			return status;
		}
	},

	markAllDone(homeworkId: string, courseId: string): boolean {
		const hw = sqlite.prepare('SELECT course_id FROM homeworks WHERE id = ?').get(homeworkId) as {
			course_id: string;
		} | undefined;
		if (!hw || hw.course_id !== courseId) return false;

		const course = sqlite.prepare('SELECT class_id FROM courses WHERE id = ?').get(courseId) as {
			class_id: string;
		} | undefined;
		if (!course) return false;

		const students = sqlite
			.prepare("SELECT id FROM students WHERE class_id = ? AND status = 'active'")
			.all(course.class_id) as Array<{ id: string }>;

		for (const s of students) {
			const existing = sqlite
				.prepare('SELECT id FROM homework_statuses WHERE homework_id = ? AND student_id = ?')
				.get(homeworkId, s.id) as { id: string } | undefined;

			if (existing) {
				db.update(schema.homeworkStatuses)
					.set({ status: 'done' })
					.where(eq(schema.homeworkStatuses.id, existing.id))
					.run();
			} else {
				db.insert(schema.homeworkStatuses)
					.values({
						id: crypto.randomUUID(),
						homeworkId,
						studentId: s.id,
						status: 'done'
					})
					.run();
			}
		}
		return true;
	},

	resetAll(homeworkId: string): void {
		db.delete(schema.homeworkStatuses)
			.where(eq(schema.homeworkStatuses.homeworkId, homeworkId))
			.run();
	},

	delete(homeworkId: string): void {
		db.delete(schema.homeworkStatuses)
			.where(eq(schema.homeworkStatuses.homeworkId, homeworkId))
			.run();
		db.delete(schema.homeworks)
			.where(eq(schema.homeworks.id, homeworkId))
			.run();
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
