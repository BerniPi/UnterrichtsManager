import { db, sqlite } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

export interface ParticipationRecord {
	id: string;
	courseId: string;
	studentId: string;
	date: string;
	weekNumber: number;
	year: number;
	value: 'plus' | 'tilde' | 'minus';
	comment: string | null;
}

export const participationRepository = {
	getByCourseAndWeek(courseId: string, weekNumber: number, year: number): ParticipationRecord[] {
		return sqlite
			.prepare(
				`
			SELECT id, course_id as courseId, student_id as studentId, date, week_number as weekNumber, year, value, comment
			FROM participation_entries
			WHERE course_id = ? AND week_number = ? AND year = ?
		`
			)
			.all(courseId, weekNumber, year) as ParticipationRecord[];
	},

	getStudentCounts(studentId: string, courseId?: string) {
		const query = `
			SELECT 
				COUNT(CASE WHEN value = 'plus' THEN 1 END) as plus,
				COUNT(CASE WHEN value = 'tilde' THEN 1 END) as tilde,
				COUNT(CASE WHEN value = 'minus' THEN 1 END) as minus
			FROM participation_entries
			WHERE student_id = ? ${courseId ? 'AND course_id = ?' : ''}
		`;
		const args = courseId ? [studentId, courseId] : [studentId];
		const res = sqlite.prepare(query).get(...args) as { plus: number; tilde: number; minus: number };
		return {
			plus: res?.plus || 0,
			tilde: res?.tilde || 0,
			minus: res?.minus || 0
		};
	},

	getHistoryForStudent(studentId: string, courseId?: string): ParticipationRecord[] {
		const query = `
			SELECT id, course_id as courseId, student_id as studentId, date, week_number as weekNumber, year, value, comment
			FROM participation_entries
			WHERE student_id = ? ${courseId ? 'AND course_id = ?' : ''}
			ORDER BY date DESC, week_number DESC
		`;
		const args = courseId ? [studentId, courseId] : [studentId];
		return sqlite.prepare(query).all(...args) as ParticipationRecord[];
	},

	setEntry(data: {
		courseId: string;
		studentId: string;
		value: 'plus' | 'tilde' | 'minus';
		weekNumber: number;
		year: number;
		comment?: string | null;
	}): { action: 'inserted' | 'updated' | 'deleted' } {
		const existing = sqlite
			.prepare(
				`
			SELECT id, value 
			FROM participation_entries 
			WHERE course_id = ? AND student_id = ? AND week_number = ? AND year = ?
		`
			)
			.get(data.courseId, data.studentId, data.weekNumber, data.year) as { id: string; value: string } | undefined;

		const todayStr = new Date().toISOString().slice(0, 10);

		if (existing) {
			if (existing.value === data.value) {
				// Toggle off if tapping same value
				db.delete(schema.participationEntries)
					.where(eq(schema.participationEntries.id, existing.id))
					.run();
				return { action: 'deleted' };
			} else {
				db.update(schema.participationEntries)
					.set({ value: data.value, date: todayStr, comment: data.comment })
					.where(eq(schema.participationEntries.id, existing.id))
					.run();
				return { action: 'updated' };
			}
		} else {
			db.insert(schema.participationEntries)
				.values({
					id: crypto.randomUUID(),
					courseId: data.courseId,
					studentId: data.studentId,
					date: todayStr,
					weekNumber: data.weekNumber,
					year: data.year,
					value: data.value,
					comment: data.comment || null,
					createdAt: Date.now()
				})
				.run();
			return { action: 'inserted' };
		}
	}
};
