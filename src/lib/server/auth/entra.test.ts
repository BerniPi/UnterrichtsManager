import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
	isEntraEnabled,
	getEntraConfig,
	saveEntraConfig,
	getAuthUrl,
	authenticateWithEntra,
	EntraAuthError
} from './entra';
import { db, sqlite } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

describe('Microsoft 365 / Entra ID Authentication', () => {
	const syId = crypto.randomUUID();
	const classId = crypto.randomUUID();
	const teacherId = crypto.randomUUID();
	const studentId = crypto.randomUUID();

	beforeAll(() => {
		// Clean up previous test entries if any
		sqlite.exec(`DELETE FROM settings WHERE key LIKE 'entra_%'`);

		db.insert(schema.schoolYears)
			.values({
				id: syId,
				name: '2098/99',
				startDate: '2098-09-01',
				endDate: '2099-07-01',
				firstSemesterEnd: '2099-02-01',
				secondSemesterEnd: '2099-07-01',
				gradingDeadline1: '2099-01-20',
				gradingDeadline2: '2099-06-20',
				earlyWarningDeadline1: '2098-12-01',
				earlyWarningDeadline2: '2099-05-01',
				isCurrent: false
			})
			.run();

		db.insert(schema.classes)
			.values({
				id: classId,
				name: '4C',
				schoolYearId: syId
			})
			.run();

		// Teacher created manually beforehand
		db.insert(schema.users)
			.values({
				id: teacherId,
				username: 'berger',
				email: 'anna.berger@bgblumenstrasse.at',
				displayName: 'Prof. Mag. Anna Berger',
				passwordHash: 'dummy_hash',
				role: 'teacher',
				isActive: true,
				createdAt: Date.now()
			})
			.run();

		// Student imported into roster
		db.insert(schema.students)
			.values({
				id: studentId,
				classId,
				firstName: 'Felix',
				lastName: 'Glaser',
				schkz: '998877',
				email: 'felix.glaser@bgblumenstrasse.at',
				status: 'active'
			})
			.run();
	});

	afterAll(() => {
		db.delete(schema.users).where(eq(schema.users.id, teacherId)).run();
		db.delete(schema.users).where(eq(schema.users.email, 'felix.glaser@bgblumenstrasse.at')).run();
		db.delete(schema.students).where(eq(schema.students.id, studentId)).run();
		db.delete(schema.classes).where(eq(schema.classes.id, classId)).run();
		db.delete(schema.schoolYears).where(eq(schema.schoolYears.id, syId)).run();
		sqlite.exec(`DELETE FROM settings WHERE key LIKE 'entra_%'`);
	});

	it('correctly reports enabled/disabled state via saveEntraConfig and isEntraEnabled', () => {
		saveEntraConfig('tenant-123', 'client-abc', 'secret-xyz');
		expect(isEntraEnabled()).toBe(true);
		const cfg = getEntraConfig();
		expect(cfg.tenantId).toBe('tenant-123');
		expect(cfg.clientId).toBe('client-abc');
		expect(cfg.clientSecret).toBe('secret-xyz');
	});

	it('generates an authorization URL with PKCE parameters and flow cookie token', async () => {
		saveEntraConfig('tenant-123', 'client-abc', 'secret-xyz');
		const { url, flowToken } = await getAuthUrl('http://localhost:5173');

		expect(url).toContain('https://login.microsoftonline.com/tenant-123/oauth2/v2.0/authorize');
		expect(url).toContain('client_id=client-abc');
		expect(url).toContain('code_challenge=');
		expect(url).toContain('code_challenge_method=S256');
		expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fmicrosoft%2Fcallback');
		expect(flowToken).toBeTruthy();
	});

	it('authenticates and links an existing teacher by email', async () => {
		const identity = {
			oid: 'entra-teacher-oid-001',
			email: 'anna.berger@bgblumenstrasse.at',
			name: 'Anna Berger'
		};

		const user = await authenticateWithEntra(identity);
		expect(user.id).toBe(teacherId);
		expect(user.role).toBe('teacher');
		expect(user.entraOid).toBe('entra-teacher-oid-001');

		// Check that user in DB now has entra_oid saved
		const inDb = sqlite.prepare('SELECT entra_oid FROM users WHERE id = ?').get(teacherId) as any;
		expect(inDb.entra_oid).toBe('entra-teacher-oid-001');
	});

	it('authenticates an imported student and auto-provisions user account', async () => {
		const identity = {
			oid: 'entra-student-oid-002',
			email: 'felix.glaser@bgblumenstrasse.at',
			name: 'Felix Glaser',
			givenName: 'Felix',
			familyName: 'Glaser'
		};

		const user = await authenticateWithEntra(identity);
		expect(user.role).toBe('student');
		expect(user.studentId).toBe(studentId);
		expect(user.displayName).toBe('Felix Glaser');
		expect(user.entraOid).toBe('entra-student-oid-002');

		// Calling it again returns the same newly created user
		const secondLogin = await authenticateWithEntra(identity);
		expect(secondLogin.id).toBe(user.id);
	});

	it('rejects an unknown user when neither teacher nor in student roster', async () => {
		const identity = {
			oid: 'entra-unknown-oid-999',
			email: 'unbekannt@bgblumenstrasse.at',
			name: 'Unbekannte Person'
		};

		let caught: any = null;
		try {
			await authenticateWithEntra(identity);
		} catch (e) {
			caught = e;
		}

		expect(caught).toBeInstanceOf(EntraAuthError);
		expect(caught.userMessage).toContain('kein Zugang');
	});

	it('does NOT allow teacher takeover via username or prefix matching alone', async () => {
		// Create a teacher account with a specific username but no email configured
		const specialTeacherId = crypto.randomUUID();
		db.insert(schema.users)
			.values({
				id: specialTeacherId,
				username: 'bosslehrer',
				email: null,
				displayName: 'Boss Lehrer',
				passwordHash: 'dummy_hash',
				role: 'admin',
				isActive: true,
				createdAt: Date.now()
			})
			.run();

		try {
			// External/unverified account with matching prefix bosslehrer@...
			const identity = {
				oid: 'entra-malicious-oid',
				email: 'bosslehrer@bgblumenstrasse.at',
				name: 'Attacker'
			};

			let caught: any = null;
			try {
				await authenticateWithEntra(identity);
			} catch (e) {
				caught = e;
			}

			expect(caught).toBeInstanceOf(EntraAuthError);
			expect(caught.userMessage).toContain('kein Zugang');

			// Verify the original user was NOT claimed
			const checkUser = sqlite.prepare('SELECT entra_oid FROM users WHERE id = ?').get(specialTeacherId) as any;
			expect(checkUser.entra_oid).toBeNull();
		} finally {
			db.delete(schema.users).where(eq(schema.users.id, specialTeacherId)).run();
		}
	});

	it('does NOT match student solely by name when email and schkz do not match', async () => {
		// Existing student has name Felix Glaser and email felix.glaser@bgblumenstrasse.at
		// Another identity with same name Felix Glaser but different email
		const impostorIdentity = {
			oid: 'entra-other-felix-oid',
			email: 'felix.glaser.other@bgblumenstrasse.at',
			name: 'Felix Glaser',
			givenName: 'Felix',
			familyName: 'Glaser'
		};

		let caught: any = null;
		try {
			await authenticateWithEntra(impostorIdentity);
		} catch (e) {
			caught = e;
		}

		expect(caught).toBeInstanceOf(EntraAuthError);
		expect(caught.userMessage).toContain('kein Zugang');
	});

	it('matches student by s<schkz>@... pattern', async () => {
		const secondStudentId = crypto.randomUUID();
		db.insert(schema.students)
			.values({
				id: secondStudentId,
				classId,
				firstName: 'Lisa',
				lastName: 'Muster',
				schkz: '554433',
				email: null,
				status: 'active'
			})
			.run();

		try {
			const identity = {
				oid: 'entra-student-lisa-oid',
				email: 's554433@bgblumenstrasse.at',
				name: 'Lisa Muster'
			};

			const user = await authenticateWithEntra(identity);
			expect(user.role).toBe('student');
			expect(user.studentId).toBe(secondStudentId);
		} finally {
			db.delete(schema.users).where(eq(schema.users.studentId, secondStudentId)).run();
			db.delete(schema.students).where(eq(schema.students.id, secondStudentId)).run();
		}
	});
});
