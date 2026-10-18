import { db, sqlite } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

export interface StudentNote {
	id: string;
	studentId: string;
	courseId: string | null;
	courseSubject: string | null;
	date: string;
	category: 'elterngespraech' | 'auffaelligkeit' | 'foerderung' | 'allgemein';
	title: string;
	content: string;
}

export const noteRepository = {
	getByStudent(studentId: string): StudentNote[] {
		return sqlite
			.prepare(
				`
			SELECT 
				n.id,
				n.student_id as studentId,
				n.course_id as courseId,
				c.subject as courseSubject,
				n.date,
				n.category,
				n.title,
				n.content
			FROM notes n
			LEFT JOIN courses c ON n.course_id = c.id
			WHERE n.student_id = ?
			ORDER BY n.date DESC
		`
			)
			.all(studentId) as StudentNote[];
	},

	create(data: {
		studentId: string;
		courseId?: string | null;
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
				date: data.date,
				category: data.category,
				title: data.title,
				content: data.content
			})
			.run();
		return id;
	},

	delete(id: string): void {
		db.delete(schema.notes).where(eq(schema.notes.id, id)).run();
	}
};
