import { describe, it, expect } from 'vitest';
import {
	reconcileStudentRoster,
	type ExistingStudent,
	type RawStudentImport
} from './reconciliation';

describe('Student Roster Reconciliation', () => {
	const existing: ExistingStudent[] = [
		{ id: '1', firstName: 'Max', lastName: 'Mustermann', webuntisId: 'WU-01', catalogNumber: 1, status: 'active' },
		{ id: '2', firstName: 'Anna', lastName: 'Huber', webuntisId: 'WU-02', catalogNumber: 2, status: 'active' },
		{ id: '3', firstName: 'Lukas', lastName: 'Gruber', webuntisId: 'WU-03', catalogNumber: 3, status: 'active' },
		{ id: '4', firstName: 'Klaus', lastName: 'Ehemalig', webuntisId: 'WU-04', catalogNumber: 4, status: 'inactive' }
	];

	it('detects unchanged, added, updated, and left students accurately', () => {
		const incoming: RawStudentImport[] = [
			// Max unchanged
			{ firstName: 'Max', lastName: 'Mustermann', webuntisId: 'WU-01', catalogNumber: 1 },
			// Anna catalogNumber changed
			{ firstName: 'Anna', lastName: 'Huber', webuntisId: 'WU-02', catalogNumber: 5 },
			// New student Felix
			{ firstName: 'Felix', lastName: 'Hofer', webuntisId: 'WU-05', catalogNumber: 4 },
			// Klaus reactivated
			{ firstName: 'Klaus', lastName: 'Ehemalig', webuntisId: 'WU-04', catalogNumber: 6 }
			// Lukas is missing in incoming -> marked as left
		];

		const result = reconcileStudentRoster(incoming, existing);

		expect(result.unchanged.length).toBe(1);
		expect(result.unchanged[0].existing.id).toBe('1');

		expect(result.updated.length).toBe(1);
		expect(result.updated[0].existing.id).toBe('2');
		expect(result.updated[0].changes[0]).toContain('Katalognummer');

		expect(result.added.length).toBe(1);
		expect(result.added[0].lastName).toBe('Hofer');

		expect(result.left.length).toBe(1);
		expect(result.left[0].id).toBe('3'); // Lukas Gruber

		expect(result.reactivated.length).toBe(1);
		expect(result.reactivated[0].existing.id).toBe('4'); // Klaus Ehemalig
	});

	it('matches by normalized names when WebUntis ID is missing', () => {
		const incomingWithoutIds: RawStudentImport[] = [
			{ firstName: 'max', lastName: 'mustermann' },
			{ firstName: 'Sophie', lastName: 'Neu' }
		];

		const result = reconcileStudentRoster(incomingWithoutIds, existing);
		expect(result.unchanged.length).toBe(1);
		expect(result.unchanged[0].existing.id).toBe('1');
		expect(result.added.length).toBe(1);
		expect(result.added[0].lastName).toBe('Neu');
	});
});
