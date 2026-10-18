export interface RawStudentImport {
	firstName: string;
	lastName: string;
	webuntisId?: string;
	catalogNumber?: number;
}

export interface ExistingStudent {
	id: string;
	firstName: string;
	lastName: string;
	webuntisId?: string | null;
	catalogNumber?: number | null;
	status: string; // 'active' | 'inactive'
}

export interface ReconciliationResult {
	unchanged: Array<{ existing: ExistingStudent; incoming: RawStudentImport }>;
	updated: Array<{ existing: ExistingStudent; incoming: RawStudentImport; changes: string[] }>;
	added: RawStudentImport[];
	left: ExistingStudent[]; // in class, but missing in new roster
	reactivated: Array<{ existing: ExistingStudent; incoming: RawStudentImport }>;
}

export function normalizeName(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');
}

/**
 * Reconciles incoming imported student list against existing students in class.
 */
export function reconcileStudentRoster(
	incoming: RawStudentImport[],
	existing: ExistingStudent[]
): ReconciliationResult {
	const result: ReconciliationResult = {
		unchanged: [],
		updated: [],
		added: [],
		left: [],
		reactivated: []
	};

	const matchedExistingIds = new Set<string>();

	for (const inc of incoming) {
		const incFirst = normalizeName(inc.firstName);
		const incLast = normalizeName(inc.lastName);

		// Match priority 1: WebUntis ID
		let match = inc.webuntisId
			? existing.find((e) => e.webuntisId && e.webuntisId.trim() === inc.webuntisId?.trim())
			: undefined;

		// Match priority 2: Exact Name
		if (!match) {
			match = existing.find(
				(e) =>
					!matchedExistingIds.has(e.id) &&
					normalizeName(e.lastName) === incLast &&
					normalizeName(e.firstName) === incFirst
			);
		}

		if (match) {
			matchedExistingIds.add(match.id);
			const changes: string[] = [];

			if (inc.catalogNumber !== undefined && inc.catalogNumber !== match.catalogNumber) {
				changes.push(`Katalognummer: ${match.catalogNumber ?? '-'} -> ${inc.catalogNumber}`);
			}
			if (inc.webuntisId && inc.webuntisId !== match.webuntisId) {
				changes.push(`WebUntis-ID: ${match.webuntisId ?? '-'} -> ${inc.webuntisId}`);
			}

			if (match.status === 'inactive') {
				result.reactivated.push({ existing: match, incoming: inc });
			} else if (changes.length > 0) {
				result.updated.push({ existing: match, incoming: inc, changes });
			} else {
				result.unchanged.push({ existing: match, incoming: inc });
			}
		} else {
			result.added.push(inc);
		}
	}

	// Any active existing student not found in incoming is marked as left
	for (const ex of existing) {
		if (!matchedExistingIds.has(ex.id) && ex.status === 'active') {
			result.left.push(ex);
		}
	}

	return result;
}

/**
 * Automatically assigns catalog numbers 1, 2, 3... sorted alphabetically
 * by last name, then first name (using German collation rules).
 */
export function assignAlphabeticalCatalogNumbers<
	T extends { firstName: string; lastName: string; catalogNumber?: number | null }
>(students: T[]): T[] {
	const sorted = [...students].sort((a, b) => {
		const lastCmp = a.lastName.localeCompare(b.lastName, 'de', { sensitivity: 'base' });
		if (lastCmp !== 0) return lastCmp;
		return a.firstName.localeCompare(b.firstName, 'de', { sensitivity: 'base' });
	});

	return sorted.map((student, idx) => ({
		...student,
		catalogNumber: idx + 1
	}));
}
