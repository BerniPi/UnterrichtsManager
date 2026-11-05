import { db, sqlite } from '../db';
import * as schema from '../db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';

export interface StudentNote {
	id: string;
	studentId: string;
	courseId: string | null;
	courseSubject: string | null;
	authorId: string | null;
	date: string;
	category: 'elterngespraech' | 'auffaelligkeit' | 'foerderung' | 'allgemein';
	title: string;
	content: string;
}

export const noteRepository = {
	getByStudent(studentId: string, authorId?: string): StudentNote[] {
		const whereClause = authorId
			? 'WHERE n.student_id = ? AND n.author_id = ?'
			: 'WHERE n.student_id = ?';
		const args = authorId ? [studentId, authorId] : [studentId];

		return sqlite
			.prepare(
				`
			SELECT 
				n.id,
				n.student_id as studentId,
				n.course_id as courseId,
				c.subject as courseSubject,
				n.author_id as authorId,
				n.date,
				n.category,
				n.title,
				n.content
			FROM notes n
			LEFT JOIN courses c ON n.course_id = c.id
			${whereClause}
			ORDER BY n.date DESC
		`
			)
			.all(...args) as StudentNote[];
	},

	create(data: {
		studentId: string;
		courseId?: string | null;
		authorId?: string | null;
		date: string;
		category: 'elterngespraech' | 'auffaelligkeit' | 'foerderung' | 'allgemein';
		title: string;
		content: string;
	}): string {
		const id = crypto.randomUUID();
		db.insert(schema.notes)
			.values({
				id,
				studentId: data.studentId,
				courseId: data.courseId || null,
				authorId: data.authorId || null,
				date: data.date,
				category: data.category,
				title: data.title,
				content: data.content
			})
			.run();
		return id;
	},

	delete(id: string, authorId?: string): void {
		if (authorId) {
			db.delete(schema.notes)
				.where(and(eq(schema.notes.id, id), eq(schema.notes.authorId, authorId)))
				.run();
		} else {
			db.delete(schema.notes).where(eq(schema.notes.id, id)).run();
		}
	}
};
