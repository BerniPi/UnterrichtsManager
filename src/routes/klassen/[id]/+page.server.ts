import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, sqlite } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

export const load: PageServerLoad = async ({ params }) => {
	const classId = params.id;

	const cls = db.select().from(schema.classes).where(eq(schema.classes.id, classId)).get();
	if (!cls) {
		throw error(404, 'Klasse nicht gefunden');
	}

	const students = sqlite
		.prepare(
			`
		SELECT id, first_name, last_name, catalog_number, webuntis_id, status, notes
		FROM students
		WHERE class_id = ?
		ORDER BY status ASC, COALESCE(catalog_number, 999) ASC, last_name ASC, first_name ASC
	`
		)
		.all(classId) as Array<{
		id: string;
		first_name: string;
		last_name: string;
		catalog_number: number | null;
		webuntis_id: string | null;
		status: string;
		notes: string | null;
	}>;

	const courses = sqlite
		.prepare('SELECT id, subject FROM courses WHERE class_id = ?')
		.all(classId) as Array<{ id: string; subject: string }>;

	return {
		cls,
		students,
		courses
	};
};

export const actions: Actions = {
	addStudent: async ({ request, params }) => {
		const form = await request.formData();
		const firstName = form.get('firstName')?.toString().trim();
		const lastName = form.get('lastName')?.toString().trim();
		const catalogNumber = form.get('catalogNumber') ? parseInt(form.get('catalogNumber')!.toString(), 10) : null;
		const webuntisId = form.get('webuntisId')?.toString().trim() || null;

		if (!firstName || !lastName) {
			return { success: false, message: 'Vorname und Nachname erforderlich' };
		}

		db.insert(schema.students)
			.values({
				id: crypto.randomUUID(),
				classId: params.id,
				firstName,
				lastName,
				catalogNumber,
				webuntisId,
				status: 'active'
			})
			.run();

		return { success: true };
	},

	toggleStatus: async ({ request }) => {
		const form = await request.formData();
		const studentId = form.get('studentId')?.toString();
		const currentStatus = form.get('currentStatus')?.toString();

		if (studentId) {
			const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
			db.update(schema.students)
				.set({ status: newStatus })
				.where(eq(schema.students.id, studentId))
				.run();
		}

		return { success: true };
	},

	renumberAlphabetically: async ({ params }) => {
		const classId = params.id;
		const students = sqlite
			.prepare(
				`SELECT id, first_name, last_name FROM students WHERE class_id = ? AND status = 'active'`
			)
			.all(classId) as Array<{ id: string; first_name: string; last_name: string }>;

		students.sort((a, b) => {
			const lastCmp = a.last_name.localeCompare(b.last_name, 'de', { sensitivity: 'base' });
			if (lastCmp !== 0) return lastCmp;
			return a.first_name.localeCompare(b.first_name, 'de', { sensitivity: 'base' });
		});

		for (let i = 0; i < students.length; i++) {
			db.update(schema.students)
				.set({ catalogNumber: i + 1 })
				.where(eq(schema.students.id, students[i].id))
				.run();
		}

		return { success: true };
	}
};
