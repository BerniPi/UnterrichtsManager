import { db, sqlite } from '../db';
import * as schema from '../db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';

export interface LessonWithScores {
	id: string;
	courseId: string;
	date: string;
	topic: string | null;
	note: string | null;
	createdAt: number;
	studentNotesCount: number;
	scores: Array<{
		studentId: string;
		firstName: string;
		lastName: string;
		catalogNumber: number | null;
		note: string | null;
	}>;
}

export const lessonRepository = {
	getByCourse(courseId: string): LessonWithScores[] {
		const lessons = sqlite
			.prepare(
				`
			SELECT 
				l.id, 
				l.course_id as courseId, 
				l.date, 
				l.topic, 
				l.note, 
				l.created_at as createdAt,
				(SELECT COUNT(*) FROM lesson_student_notes lsn WHERE lsn.lesson_id = l.id) as studentNotesCount
			FROM lesson_entries l
			WHERE l.course_id = ?
			ORDER BY l.date DESC, l.created_at DESC
		`
			)
			.all(courseId) as Array<{
			id: string;
			courseId: string;
			date: string;
			topic: string | null;
			note: string | null;
			createdAt: number;
			studentNotesCount: number;
		}>;

		return lessons.map((l) => {
			const scores = sqlite
				.prepare(
					`
				SELECT 
					s.id as studentId,
					s.first_name as firstName,
					s.last_name as lastName,
					s.catalog_number as catalogNumber,
					lsn.note
				FROM students s
				JOIN classes cl ON s.class_id = cl.id
				JOIN courses c ON c.class_id = cl.id AND c.id = ?
				LEFT JOIN lesson_student_notes lsn ON lsn.lesson_id = ? AND lsn.student_id = s.id
				WHERE s.status = 'active'
				ORDER BY COALESCE(s.catalog_number, 999) ASC, s.last_name ASC, s.first_name ASC
			`
				)
				.all(courseId, l.id) as Array<{
				studentId: string;
				firstName: string;
				lastName: string;
				catalogNumber: number | null;
				note: string | null;
			}>;

			return {
				...l,
				scores
			};
		});
	},

	getById(id: string): LessonWithScores | null {
		const lesson = sqlite
			.prepare(
				`
			SELECT 
				l.id, 
				l.course_id as courseId, 
				l.date, 
				l.topic, 
				l.note, 
				l.created_at as createdAt,
				(SELECT COUNT(*) FROM lesson_student_notes lsn WHERE lsn.lesson_id = l.id) as studentNotesCount
			FROM lesson_entries l
			WHERE l.id = ?
		`
			)
			.get(id) as {
			id: string;
			courseId: string;
			date: string;
			topic: string | null;
			note: string | null;
			createdAt: number;
			studentNotesCount: number;
		} | undefined;

		if (!lesson) return null;

		const scores = sqlite
			.prepare(
				`
			SELECT 
				s.id as studentId,
				s.first_name as firstName,
				s.last_name as lastName,
				s.catalog_number as catalogNumber,
				lsn.note
			FROM students s
			JOIN classes cl ON s.class_id = cl.id
			JOIN courses c ON c.class_id = cl.id AND c.id = ?
			LEFT JOIN lesson_student_notes lsn ON lsn.lesson_id = ? AND lsn.student_id = s.id
			WHERE s.status = 'active'
			ORDER BY COALESCE(s.catalog_number, 999) ASC, s.last_name ASC, s.first_name ASC
		`
			)
			.all(lesson.courseId, lesson.id) as Array<{
			studentId: string;
			firstName: string;
			lastName: string;
			catalogNumber: number | null;
			note: string | null;
		}>;

		return {
			...lesson,
			scores
		};
	},

	getOrCreateForDate(courseId: string, date: string, topic?: string): LessonWithScores {
		const existing = sqlite
			.prepare('SELECT id FROM lesson_entries WHERE course_id = ? AND date = ? ORDER BY created_at DESC LIMIT 1')
			.get(courseId, date) as { id: string } | undefined;

		if (existing) {
			const res = this.getById(existing.id);
			if (res) return res;
		}

		const id = this.create({
			courseId,
			date,
			topic: topic || `Unterrichtseinheit vom ${date}`,
			note: null
		});

		return this.getById(id)!;
	},

	create(data: {
		courseId: string;
		date: string;
		topic?: string | null;
		note?: string | null;
	}): string {
		const id = crypto.randomUUID();
		db.insert(schema.lessonEntries)
			.values({
				id,
				courseId: data.courseId,
				date: data.date,
				topic: data.topic || null,
				note: data.note || null,
				createdAt: Date.now()
			})
			.run();
		return id;
	},

	updateGlobal(
		id: string,
		data: { topic?: string | null; note?: string | null; date?: string }
	): void {
		const updates: Record<string, any> = {};
		if (data.topic !== undefined) updates.topic = data.topic ? data.topic.trim() : null;
		if (data.note !== undefined) updates.note = data.note ? data.note.trim() : null;
		if (data.date !== undefined) updates.date = data.date;

		if (Object.keys(updates).length > 0) {
			db.update(schema.lessonEntries)
				.set(updates)
				.where(eq(schema.lessonEntries.id, id))
				.run();
		}
	},

	saveStudentNote(lessonId: string, studentId: string, noteText: string | null): void {
		const cleanNote = noteText ? noteText.trim() : '';

		const existing = sqlite
			.prepare('SELECT id FROM lesson_student_notes WHERE lesson_id = ? AND student_id = ?')
			.get(lessonId, studentId) as { id: string } | undefined;

		if (!cleanNote) {
			if (existing) {
				db.delete(schema.lessonStudentNotes)
					.where(eq(schema.lessonStudentNotes.id, existing.id))
					.run();
			}
			return;
		}

		if (existing) {
			db.update(schema.lessonStudentNotes)
				.set({ note: cleanNote })
				.where(eq(schema.lessonStudentNotes.id, existing.id))
				.run();
		} else {
			db.insert(schema.lessonStudentNotes)
				.values({
					id: crypto.randomUUID(),
					lessonId,
					studentId,
					note: cleanNote,
					createdAt: Date.now()
				})
				.run();
		}
	},

	delete(id: string): void {
		sqlite.transaction(() => {
			sqlite.prepare('DELETE FROM lesson_student_notes WHERE lesson_id = ?').run(id);
			sqlite.prepare('DELETE FROM lesson_entries WHERE id = ?').run(id);
		})();
	},

	getStudentHistory(studentId: string, courseId?: string) {
		const query = `
			SELECT 
				lsn.id,
				lsn.note as studentNote,
				l.id as lessonId,
				l.date as lessonDate,
				l.topic as lessonTopic,
				l.note as lessonGlobalNote,
				c.id as courseId,
				c.subject as courseSubject,
				cl.name as className
			FROM lesson_student_notes lsn
			JOIN lesson_entries l ON lsn.lesson_id = l.id
			JOIN courses c ON l.course_id = c.id
			JOIN classes cl ON c.class_id = cl.id
			WHERE lsn.student_id = ? ${courseId ? 'AND c.id = ?' : ''}
			ORDER BY l.date DESC, l.created_at DESC
		`;
		const args = courseId ? [studentId, courseId] : [studentId];
		return sqlite.prepare(query).all(...args) as Array<{
			id: string;
			studentNote: string;
			lessonId: string;
			lessonDate: string;
			lessonTopic: string | null;
			lessonGlobalNote: string | null;
			courseId: string;
			courseSubject: string;
			className: string;
		}>;
	}
};
