import { db, sqlite } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import {
	reconcileStudentRoster,
	normalizeName,
	type ExistingStudent,
	type RawStudentImport,
	type ReconciliationResult
} from '../../services/reconciliation';

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
	schkz?: string | null;
	email?: string | null;
}

export interface RosterImportResult {
	diff: ReconciliationResult;
	stats: {
		added: number;
		reactivated: number;
		updated: number;
		left: number;
		unchanged: number;
	};
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
				s.notes,
				s.schkz,
				s.email
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
				s.notes,
				s.schkz,
				s.email
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
		schkz?: string | null;
		email?: string | null;
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
				notes: data.notes || null,
				schkz: data.schkz || null,
				email: data.email || null
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
			schkz?: string | null;
			email?: string | null;
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
	},

	/**
	 * Gleicht eine importierte Schülerliste mit der Klasse ab (neu, aktualisiert, reaktiviert, ausgetreten).
	 * Mit dryRun wird nur der Abgleich berechnet, ohne zu speichern.
	 */
	importRoster(classId: string, incoming: RawStudentImport[], options: { dryRun?: boolean } = {}): RosterImportResult {
		const existing = sqlite
			.prepare(
				'SELECT id, first_name as firstName, last_name as lastName, webuntis_id as webuntisId, catalog_number as catalogNumber, schkz, email, status FROM students WHERE class_id = ?'
			)
			.all(classId) as ExistingStudent[];

		const diff = reconcileStudentRoster(incoming, existing);
		const stats = {
			added: diff.added.length,
			reactivated: diff.reactivated.length,
			updated: diff.updated.length,
			left: diff.left.length,
			unchanged: diff.unchanged.length
		};

		if (options.dryRun) return { diff, stats };

		// Names are only replaced on a real change, so a lowercase import file does not overwrite them
		const pickName = (incName: string, exName: string) =>
			incName.trim() && normalizeName(incName) !== normalizeName(exName) ? incName.trim() : exName;
		const matchedFields = (inc: RawStudentImport, ex: ExistingStudent) => ({
			firstName: pickName(inc.firstName, ex.firstName),
			lastName: pickName(inc.lastName, ex.lastName),
			catalogNumber: inc.catalogNumber ?? ex.catalogNumber ?? null,
			webuntisId: inc.webuntisId || ex.webuntisId || null,
			schkz: inc.schkz?.trim() || ex.schkz || null,
			email: inc.email?.trim() || ex.email || null
		});

		sqlite.transaction(() => {
			for (const add of diff.added) {
				db.insert(schema.students)
					.values({
						id: crypto.randomUUID(),
						classId,
						firstName: add.firstName.trim(),
						lastName: add.lastName.trim(),
						webuntisId: add.webuntisId || null,
						catalogNumber: add.catalogNumber || null,
						schkz: add.schkz?.trim() || null,
						email: add.email?.trim() || null,
						status: 'active'
					})
					.run();
			}

			for (const react of diff.reactivated) {
				db.update(schema.students)
					.set({ ...matchedFields(react.incoming, react.existing), status: 'active' })
					.where(eq(schema.students.id, react.existing.id))
					.run();
			}

			for (const up of diff.updated) {
				db.update(schema.students)
					.set(matchedFields(up.incoming, up.existing))
					.where(eq(schema.students.id, up.existing.id))
					.run();
			}

			for (const left of diff.left) {
				db.update(schema.students)
					.set({ status: 'inactive' })
					.where(eq(schema.students.id, left.id))
					.run();
			}
		})();

		return { diff, stats };
	}
};
