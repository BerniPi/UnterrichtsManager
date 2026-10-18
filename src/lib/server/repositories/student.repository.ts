import { db, sqlite } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

export interface StudentWithClass {
	id: string;
	classId: string;
	className: string;
	firstName: string;
	lastName: string;
	catalogNumber: number | null;
	webuntisId: string | null;
	status: string;
	notes: string | null;
}

export const studentRepository = {
	getById(id: string): StudentWithClass | null {
		const row = sqlite
			.prepare(
				`
			SELECT 
				s.id,
				s.class_id as classId,
				cl.name as className,
				s.first_name as firstName,
				s.last_name as lastName,
				s.catalog_number as catalogNumber,
				s.webuntis_id as webuntisId,
				s.status,
				s.notes
			FROM students s
			JOIN classes cl ON s.class_id = cl.id
			WHERE s.id = ?
		`
			)
			.get(id) as StudentWithClass | undefined;
		return row || null;
	},

	getByClassId(classId: string, onlyActive = true): StudentWithClass[] {
		const query = `
			SELECT 
				s.id,
				s.class_id as classId,
				cl.name as className,
				s.first_name as firstName,
				s.last_name as lastName,
				s.catalog_number as catalogNumber,
				s.webuntis_id as webuntisId,
				s.status,
				s.notes
			FROM students s
			JOIN classes cl ON s.class_id = cl.id
			WHERE s.class_id = ? ${onlyActive ? "AND s.status = 'active'" : ''}
			ORDER BY COALESCE(s.catalog_number, 999) ASC, s.last_name ASC, s.first_name ASC
		`;
		return sqlite.prepare(query).all(classId) as StudentWithClass[];
	},

	create(data: {
		classId: string;
		firstName: string;
		lastName: string;
		catalogNumber?: number | null;
		webuntisId?: string | null;
		notes?: string | null;
	}): string {
		const id = crypto.randomUUID();
		db.insert(schema.students)
			.values({
				id,
				classId: data.classId,
				firstName: data.firstName,
				lastName: data.lastName,
				catalogNumber: data.catalogNumber || null,
				webuntisId: data.webuntisId || null,
				status: 'active',
				notes: data.notes || null
			})
			.run();
		return id;
	},

	update(
		id: string,
		data: {
			firstName?: string;
			lastName?: string;
			catalogNumber?: number | null;
			webuntisId?: string | null;
			notes?: string | null;
		}
	): void {
		db.update(schema.students)
			.set(data)
			.where(eq(schema.students.id, id))
			.run();
	},

	toggleStatus(id: string): string {
		const current = sqlite.prepare('SELECT status FROM students WHERE id = ?').get(id) as
			| { status: string }
			| undefined;
		const newStatus = current?.status === 'active' ? 'inactive' : 'active';
		db.update(schema.students)
			.set({ status: newStatus })
			.where(eq(schema.students.id, id))
			.run();
		return newStatus;
	}
};
