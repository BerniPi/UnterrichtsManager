import type { PageServerLoad, Actions } from './$types';
import { db, sqlite } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import crypto from 'node:crypto';
import * as XLSX from 'xlsx';
import { fail } from '@sveltejs/kit';
import { assignAlphabeticalCatalogNumbers, type RawStudentImport } from '$lib/services/reconciliation';
import { studentRepository } from '$lib/server/repositories/student.repository';
import { BgbbError, fetchBgbbClasses, fetchBgbbRoster, getBgbbConfig } from '$lib/server/bgbb/client';
import { requireTeacher, requireAdmin } from '$lib/server/auth/access';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const user = requireTeacher(locals);
	const isAdmin = user.role === 'admin';
	const layoutData = await parent();
	const sy = layoutData.currentSchoolYear;

	const bgbb = isAdmin ? getBgbbConfig() : { apiUrl: '', apiKey: '', fromEnv: false };
	const bgbbConfigured = Boolean(bgbb.apiUrl && bgbb.apiKey);

	if (!sy) {
		return { classes: [], activeSchoolYear: null, bgbbConfigured, isAdmin };
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
		classes: classesWithStudentCounts,
		bgbbConfigured,
		isAdmin
	};
};

export const actions: Actions = {
	createClass: async ({ request, locals }) => {
		requireAdmin(locals);
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

	parseUpload: async ({ request, locals }) => {
		requireAdmin(locals);
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

		// Guess column mapping accurately (avoiding matching Vorname as Nachname or Katalog-Nr as ID)
		let firstNameCol = headers.find((h) => /(?:^|[\s_-])(vorname|rufname|first(?:_?name)?)(?:$|[\s_-])/i.test(h)) || '';
		let lastNameCol = headers.find((h) => !/vorname/i.test(h) && /(?:^|[\s_-])(nachname|familienname|zuname|surname|last(?:_?name)?|name)(?:$|[\s_-])/i.test(h)) || '';
		let catCol = headers.find((h) => /katalog|kat(?:_?nr|\.?)/i.test(h)) || '';
		let idCol = headers.find((h) => !/katalog|kat/i.test(h) && /(?:webuntis|schueler(?:_?id|_?nummer|nr)|student_?id|untis_?id|^id$)/i.test(h)) || '';

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

	commitImport: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const classId = form.get('classId')?.toString();
		const rawDataJson = form.get('studentsJson')?.toString();

		if (!classId || !rawDataJson) {
			return { success: false, message: 'Ungültige Importdaten' };
		}

		let incoming: RawStudentImport[] = JSON.parse(rawDataJson);
		const hasImportedCat = incoming.some(
			(s) => s.catalogNumber != null && !isNaN(Number(s.catalogNumber))
		);
		if (!hasImportedCat) {
			incoming = assignAlphabeticalCatalogNumbers(incoming);
		}

		const { stats } = studentRepository.importRoster(classId, incoming);

		return {
			success: true,
			imported: true,
			stats
		};
	},

	// --- Import aus BGBB Admin ---

	bgbbLoadClasses: async ({ locals }) => {
		requireAdmin(locals);
		try {
			const bgbbClasses = await fetchBgbbClasses();
			const sy = getCurrentSchoolYear();
			const existingNames = sy ? classNamesBySchoolYear(sy.id) : new Map<string, string>();
			return {
				bgbbClasses: bgbbClasses.map((c) => ({
					...c,
					existsInNotenmanager: existingNames.has(c.klasse.toLowerCase())
				}))
			};
		} catch (e) {
			return fail(502, { bgbbError: bgbbErrorMessage(e) });
		}
	},

	bgbbPreview: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const klassen = form.getAll('klassen').map(String).filter(Boolean);
		const sy = getCurrentSchoolYear();
		if (!sy) return fail(400, { bgbbError: 'Kein Schuljahr angelegt.' });
		if (klassen.length === 0) return fail(400, { bgbbError: 'Bitte mindestens eine Klasse auswählen.' });

		try {
			const existingNames = classNamesBySchoolYear(sy.id);
			const preview = [];
			for (const klasse of klassen) {
				const roster = await fetchBgbbRoster(klasse);
				const classId = existingNames.get(klasse.toLowerCase()) ?? null;
				const { diff, stats } = classId
					? studentRepository.importRoster(classId, roster, { dryRun: true })
					: { diff: null, stats: { added: roster.length, reactivated: 0, updated: 0, left: 0, unchanged: 0 } };

				const fullName = (s: { firstName: string; lastName: string }) => `${s.lastName} ${s.firstName}`;
				preview.push({
					klasse,
					isNewClass: classId === null,
					stats,
					added: (diff ? diff.added : roster).map(fullName),
					reactivated: diff ? diff.reactivated.map((r) => fullName(r.incoming)) : [],
					updated: diff ? diff.updated.map((u) => ({ name: fullName(u.existing), changes: u.changes })) : [],
					left: diff ? diff.left.map(fullName) : []
				});
			}
			return { bgbbPreview: preview };
		} catch (e) {
			return fail(502, { bgbbError: bgbbErrorMessage(e) });
		}
	},

	bgbbCommit: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const klassen = form.getAll('klassen').map(String).filter(Boolean);
		const sy = getCurrentSchoolYear();
		if (!sy) return fail(400, { bgbbError: 'Kein Schuljahr angelegt.' });
		if (klassen.length === 0) return fail(400, { bgbbError: 'Bitte mindestens eine Klasse auswählen.' });

		try {
			// Erst alle Listen holen, damit ein Verbindungsfehler nicht zu einem halben Import führt
			const rosters = [];
			for (const klasse of klassen) {
				rosters.push({ klasse, roster: await fetchBgbbRoster(klasse) });
			}

			const existingNames = classNamesBySchoolYear(sy.id);
			const total = { added: 0, reactivated: 0, updated: 0, left: 0, unchanged: 0 };
			let createdClasses = 0;

			for (const { klasse, roster } of rosters) {
				let classId = existingNames.get(klasse.toLowerCase());
				if (!classId) {
					classId = crypto.randomUUID();
					db.insert(schema.classes).values({ id: classId, name: klasse, room: null, schoolYearId: sy.id }).run();
					createdClasses++;
				}
				const { stats } = studentRepository.importRoster(classId, roster);
				for (const k of Object.keys(total) as Array<keyof typeof total>) total[k] += stats[k];
			}

			return { imported: true, stats: total, bgbbImported: { classes: klassen.length, createdClasses } };
		} catch (e) {
			return fail(502, { bgbbError: bgbbErrorMessage(e) });
		}
	}
};

function getCurrentSchoolYear() {
	return sqlite
		.prepare('SELECT id, name FROM school_years ORDER BY is_current DESC, start_date DESC LIMIT 1')
		.get() as { id: string; name: string } | undefined;
}

/** Klassenname (klein geschrieben) -> Klassen-ID im Schuljahr */
function classNamesBySchoolYear(schoolYearId: string): Map<string, string> {
	const rows = sqlite.prepare('SELECT id, name FROM classes WHERE school_year_id = ?').all(schoolYearId) as Array<{
		id: string;
		name: string;
	}>;
	return new Map(rows.map((r) => [r.name.trim().toLowerCase(), r.id]));
}

function bgbbErrorMessage(e: unknown): string {
	if (e instanceof BgbbError) return e.message;
	console.error('BGBB-Import fehlgeschlagen', e);
	return 'Import aus BGBB Admin fehlgeschlagen.';
}
