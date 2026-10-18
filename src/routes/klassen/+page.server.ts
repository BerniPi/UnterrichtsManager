import type { PageServerLoad, Actions } from './$types';
import { db, sqlite } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import * as XLSX from 'xlsx';
import { reconcileStudentRoster, type RawStudentImport, type ExistingStudent } from '$lib/services/reconciliation';

export const load: PageServerLoad = async ({ parent }) => {
	const layoutData = await parent();
	const sy = layoutData.currentSchoolYear;

	if (!sy) {
		return { classes: [], activeSchoolYear: null };
	}

	const classesWithStudentCounts = sqlite
		.prepare(
			`
		SELECT 
			c.id, 
			c.name, 
			c.room,
			COUNT(CASE WHEN s.status = 'active' THEN 1 END) as active_student_count,
			COUNT(CASE WHEN s.status = 'inactive' THEN 1 END) as inactive_student_count
		FROM classes c
		LEFT JOIN students s ON s.class_id = c.id
		WHERE c.school_year_id = ?
		GROUP BY c.id
		ORDER BY c.name ASC
	`
		)
		.all(sy.id) as Array<{
		id: string;
		name: string;
		room: string | null;
		active_student_count: number;
		inactive_student_count: number;
	}>;

	return {
		activeSchoolYear: sy,
		classes: classesWithStudentCounts
	};
};

export const actions: Actions = {
	createClass: async ({ request, locals }) => {
		const form = await request.formData();
		const name = form.get('name')?.toString().trim();
		const room = form.get('room')?.toString().trim() || null;
		const schoolYearId = form.get('schoolYearId')?.toString();

		if (!name || !schoolYearId) {
			return { success: false, message: 'Klassenname erforderlich' };
		}

		db.insert(schema.classes)
			.values({
				id: crypto.randomUUID(),
				name,
				room,
				schoolYearId
			})
			.run();

		return { success: true };
	},

	parseUpload: async ({ request }) => {
		const form = await request.formData();
		const file = form.get('file') as File;
		const classId = form.get('classId')?.toString();

		if (!file || !classId) {
			return { success: false, message: 'Datei und Klasse erforderlich' };
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const workbook = XLSX.read(buffer, { type: 'buffer' });
		const firstSheetName = workbook.SheetNames[0];
		const worksheet = workbook.Sheets[firstSheetName];
		const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

		if (rows.length === 0) {
			return { success: false, message: 'Die Datei enthält keine Datenzeilen.' };
		}

		// Available headers
		const headers = Object.keys(rows[0]);

		// Guess column mapping
		let firstNameCol = headers.find((h) => /vorname|rufname|first/i.test(h)) || '';
		let lastNameCol = headers.find((h) => /nachname|familienname|last|name/i.test(h)) || '';
		let idCol = headers.find((h) => /webuntis|schuelernummer|id|nr/i.test(h)) || '';
		let catCol = headers.find((h) => /katalog|kat/i.test(h)) || '';

		return {
			success: true,
			parsed: true,
			classId,
			headers,
			rowCount: rows.length,
			previewRows: rows.slice(0, 5),
			allRows: rows,
			suggestedMapping: {
				firstNameCol,
				lastNameCol,
				idCol,
				catCol
			}
		};
	},

	commitImport: async ({ request }) => {
		const form = await request.formData();
		const classId = form.get('classId')?.toString();
		const rawDataJson = form.get('studentsJson')?.toString();

		if (!classId || !rawDataJson) {
			return { success: false, message: 'Ungültige Importdaten' };
		}

		const incoming: RawStudentImport[] = JSON.parse(rawDataJson);
		const existing = sqlite
			.prepare(
				'SELECT id, first_name as firstName, last_name as lastName, webuntis_id as webuntisId, catalog_number as catalogNumber, status FROM students WHERE class_id = ?'
			)
			.all(classId) as ExistingStudent[];

		const diff = reconcileStudentRoster(incoming, existing);

		// 1. Insert added students
		for (const add of diff.added) {
			db.insert(schema.students)
				.values({
					id: crypto.randomUUID(),
					classId,
					firstName: add.firstName,
					lastName: add.lastName,
					webuntisId: add.webuntisId || null,
					catalogNumber: add.catalogNumber || null,
					status: 'active'
				})
				.run();
		}

		// 2. Reactivate students
		for (const react of diff.reactivated) {
			db.update(schema.students)
				.set({
					status: 'active',
					catalogNumber: react.incoming.catalogNumber || react.existing.catalogNumber,
					webuntisId: react.incoming.webuntisId || react.existing.webuntisId
				})
				.where(eq(schema.students.id, react.existing.id))
				.run();
		}

		// 3. Update existing
		for (const up of diff.updated) {
			db.update(schema.students)
				.set({
					catalogNumber: up.incoming.catalogNumber ?? up.existing.catalogNumber,
					webuntisId: up.incoming.webuntisId ?? up.existing.webuntisId
				})
				.where(eq(schema.students.id, up.existing.id))
				.run();
		}

		// 4. Mark left students as inactive
		for (const left of diff.left) {
			db.update(schema.students)
				.set({ status: 'inactive' })
				.where(eq(schema.students.id, left.id))
				.run();
		}

		return {
			success: true,
			imported: true,
			stats: {
				added: diff.added.length,
				reactivated: diff.reactivated.length,
				updated: diff.updated.length,
				left: diff.left.length,
				unchanged: diff.unchanged.length
			}
		};
	}
};
