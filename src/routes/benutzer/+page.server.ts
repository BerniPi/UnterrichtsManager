import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, sqlite } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';
import { invalidateAllUserSessions } from '$lib/server/auth';
import { requireAdmin } from '$lib/server/auth/access';
import { gradingTemplateRepository } from '$lib/server/repositories/grading-template.repository';
import { courseRepository } from '$lib/server/repositories/course.repository';
import { settingsRepository } from '$lib/server/repositories/settings.repository';
import crypto from 'node:crypto';

export interface UserWithStats {
	id: string;
	username: string;
	displayName: string | null;
	email: string | null;
	entraOid: string | null;
	role: 'admin' | 'teacher' | 'student';
	isActive: boolean;
	totpEnabled: boolean;
	createdAt: number;
	courseCount: number;
	studentId: string | null;
	studentName: string | null;
	studentClassName: string | null;
}

export const load: PageServerLoad = async ({ locals }) => {
	const currentUser = requireAdmin(locals);

	const rawUsers = sqlite
		.prepare(
			`
		SELECT
			u.id,
			u.username,
			u.display_name as displayName,
			u.email,
			u.entra_oid as entraOid,
			u.role,
			u.is_active as isActive,
			u.totp_enabled as totpEnabled,
			u.created_at as createdAt,
			u.student_id as studentId,
			s.first_name || ' ' || s.last_name as studentName,
			cl.name as studentClassName,
			(SELECT COUNT(*) FROM courses c WHERE c.teacher_id = u.id) as courseCount
		FROM users u
		LEFT JOIN students s ON u.student_id = s.id
		LEFT JOIN classes cl ON s.class_id = cl.id
		ORDER BY
			CASE u.role WHEN 'admin' THEN 0 WHEN 'teacher' THEN 1 ELSE 2 END,
			u.username ASC
	`
		)
		.all() as Array<{
		id: string;
		username: string;
		displayName: string | null;
		email: string | null;
		entraOid: string | null;
		role: 'admin' | 'teacher' | 'student';
		isActive: number;
		totpEnabled: number;
		createdAt: number;
		studentId: string | null;
		studentName: string | null;
		studentClassName: string | null;
		courseCount: number;
	}>;

	const users: UserWithStats[] = rawUsers.map((u) => ({
		...u,
		isActive: Boolean(u.isActive),
		totpEnabled: Boolean(u.totpEnabled)
	}));

	const allCourses = sqlite
		.prepare(
			`
		SELECT
			c.id,
			c.subject,
			cl.name as className,
			sy.name as schoolYearName,
			c.teacher_id as teacherId,
			COALESCE(u.display_name, u.username, '–') as teacherName
		FROM courses c
		JOIN classes cl ON c.class_id = cl.id
		JOIN school_years sy ON c.school_year_id = sy.id
		LEFT JOIN users u ON c.teacher_id = u.id
		ORDER BY sy.start_date DESC, cl.name ASC, c.subject ASC
	`
		)
		.all() as Array<{
		id: string;
		subject: string;
		className: string;
		schoolYearName: string;
		teacherId: string | null;
		teacherName: string;
	}>;

	const students = sqlite
		.prepare(
			`
		SELECT
			s.id,
			s.first_name as firstName,
			s.last_name as lastName,
			s.schkz,
			cl.name as className,
			u.id as linkedUserId
		FROM students s
		JOIN classes cl ON s.class_id = cl.id
		LEFT JOIN users u ON u.student_id = s.id
		WHERE s.status = 'active'
		ORDER BY cl.name ASC, s.last_name ASC, s.first_name ASC
	`
		)
		.all() as Array<{
		id: string;
		firstName: string;
		lastName: string;
		schkz: string | null;
		className: string;
		linkedUserId: string | null;
	}>;

	return {
		currentUserId: currentUser.id,
		users,
		allCourses,
		students
	};
};

function countActiveAdmins(): number {
	const row = sqlite
		.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = 1")
		.get() as { count: number };
	return row.count;
}

export const actions: Actions = {
	createUser: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const username = form.get('username')?.toString().trim();
		const emailRaw = form.get('email')?.toString().trim().toLowerCase() || null;
		const displayNameRaw = form.get('displayName')?.toString().trim() || null;
		const password = form.get('password')?.toString();
		const role = (form.get('role')?.toString() || 'teacher') as 'admin' | 'teacher' | 'student';
		const studentId = form.get('studentId')?.toString().trim() || null;

		if (!username || !password) {
			return fail(400, { error: 'Benutzername und Startpasswort sind erforderlich.' });
		}

		if (password.length < 6) {
			return fail(400, { error: 'Das Startpasswort muss mindestens 6 Zeichen lang sein.' });
		}

		if (!['admin', 'teacher', 'student'].includes(role)) {
			return fail(400, { error: 'Ungültige Rolle.' });
		}

		const existing = sqlite
			.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)')
			.get(username);
		if (existing) {
			return fail(400, { error: `Benutzername „${username}“ ist bereits vergeben.` });
		}

		if (emailRaw) {
			const existingEmail = sqlite
				.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)')
				.get(emailRaw);
			if (existingEmail) {
				return fail(400, { error: `E-Mail „${emailRaw}“ ist bereits vergeben.` });
			}
		}

		let displayName = displayNameRaw;

		if (role === 'student') {
			if (!studentId) {
				return fail(400, { error: 'Für einen Schüler-Account muss ein Schüler ausgewählt werden.' });
			}
			const student = sqlite
				.prepare('SELECT id, first_name, last_name FROM students WHERE id = ?')
				.get(studentId) as { id: string; first_name: string; last_name: string } | undefined;
			if (!student) {
				return fail(400, { error: 'Ausgewählter Schüler nicht gefunden.' });
			}
			const alreadyLinked = sqlite
				.prepare('SELECT username FROM users WHERE student_id = ?')
				.get(studentId) as { username: string } | undefined;
			if (alreadyLinked) {
				return fail(400, {
					error: `Dieser Schüler ist bereits mit dem Konto „${alreadyLinked.username}“ verknüpft.`
				});
			}
			if (!displayName) {
				displayName = `${student.first_name} ${student.last_name}`;
			}
		}

		const id = crypto.randomUUID();
		const passwordHash = await hash(password);

		sqlite.transaction(() => {
			db.insert(schema.users)
				.values({
					id,
					username,
					email: emailRaw,
					passwordHash,
					totpEnabled: false,
					createdAt: Date.now(),
					role,
					displayName,
					isActive: true,
					studentId: role === 'student' ? studentId : null
				})
				.run();

			if (role === 'teacher' || role === 'admin') {
				gradingTemplateRepository.seedForUser(id);
				if (displayName) {
					settingsRepository.updateAll({ teacherName: displayName }, id);
				}
			}
		})();

		return { success: true, message: `Benutzer „${username}“ erfolgreich angelegt.` };
	},

	updateEmail: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const userId = form.get('userId')?.toString().trim();
		const emailRaw = form.get('email')?.toString().trim().toLowerCase() || null;

		if (!userId) {
			return fail(400, { error: 'Benutzer-ID fehlt.' });
		}
		if (emailRaw) {
			const existingEmail = sqlite
				.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?')
				.get(emailRaw, userId);
			if (existingEmail) {
				return fail(400, { error: `E-Mail „${emailRaw}“ ist bereits vergeben.` });
			}
		}

		db.update(schema.users)
			.set({ email: emailRaw })
			.where(eq(schema.users.id, userId))
			.run();

		return { success: true, message: 'E-Mail-Adresse aktualisiert.' };
	},

	toggleActive: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const form = await request.formData();
		const userId = form.get('userId')?.toString();

		if (!userId) return fail(400, { error: 'Benutzer-ID fehlt.' });

		if (userId === admin.id) {
			return fail(400, { error: 'Du kannst dein eigenes Konto nicht deaktivieren.' });
		}

		const target = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
		if (!target) return fail(404, { error: 'Benutzer nicht gefunden.' });

		const newActive = !target.isActive;

		if (!newActive && target.role === 'admin' && countActiveAdmins() <= 1) {
			return fail(400, { error: 'Der letzte aktive Administrator kann nicht deaktiviert werden.' });
		}

		db.update(schema.users)
			.set({ isActive: newActive })
			.where(eq(schema.users.id, userId))
			.run();

		if (!newActive) {
			invalidateAllUserSessions(userId);
		}

		return {
			success: true,
			message: newActive
				? `Benutzer „${target.username}“ wurde reaktiviert.`
				: `Benutzer „${target.username}“ wurde deaktiviert und abgemeldet.`
		};
	},

	updateRole: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const form = await request.formData();
		const userId = form.get('userId')?.toString();
		const newRole = form.get('role')?.toString() as 'admin' | 'teacher' | 'student';
		const displayName = form.get('displayName')?.toString().trim() || null;
		const emailRaw = form.get('email')?.toString().trim().toLowerCase() || null;
		const studentId = form.get('studentId')?.toString().trim() || null;

		if (!userId || !['admin', 'teacher', 'student'].includes(newRole)) {
			return fail(400, { error: 'Ungültige Parameter.' });
		}

		const target = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
		if (!target) return fail(404, { error: 'Benutzer nicht gefunden.' });

		if (emailRaw) {
			const existingEmail = sqlite
				.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?')
				.get(emailRaw, userId);
			if (existingEmail) {
				return fail(400, { error: `E-Mail „${emailRaw}“ ist bereits vergeben.` });
			}
		}

		if (userId === admin.id && newRole !== 'admin') {
			return fail(400, { error: 'Du kannst deine eigene Administrator-Rolle nicht entfernen.' });
		}

		if (target.role === 'admin' && newRole !== 'admin' && target.isActive && countActiveAdmins() <= 1) {
			return fail(400, { error: 'Der letzte aktive Administrator muss erhalten bleiben.' });
		}

		if (newRole === 'student') {
			if (!studentId) {
				return fail(400, { error: 'Für einen Schüler-Account muss ein Schüler verknüpft sein.' });
			}
			const student = sqlite
				.prepare('SELECT id FROM students WHERE id = ?')
				.get(studentId) as { id: string } | undefined;
			if (!student) {
				return fail(400, { error: 'Ausgewählter Schüler existiert nicht.' });
			}
			const alreadyLinked = sqlite
				.prepare('SELECT id, username FROM users WHERE student_id = ? AND id != ?')
				.get(studentId, userId) as { id: string; username: string } | undefined;
			if (alreadyLinked) {
				return fail(400, {
					error: `Dieser Schüler ist bereits mit dem Konto „${alreadyLinked.username}“ verknüpft.`
				});
			}

			const courseCountRow = sqlite
				.prepare('SELECT COUNT(*) as count FROM courses WHERE teacher_id = ?')
				.get(userId) as { count: number };
			if (courseCountRow.count > 0) {
				return fail(400, {
					error: `Dieser Benutzer besitzt noch ${courseCountRow.count} Kurs(e). Bitte diese vor dem Wechsel zur Schüler-Rolle auf eine andere Lehrkraft übertragen.`
				});
			}
		}

		db.update(schema.users)
			.set({
				role: newRole,
				displayName,
				email: emailRaw,
				studentId: newRole === 'student' ? studentId : null
			})
			.where(eq(schema.users.id, userId))
			.run();

		if (newRole === 'teacher' || newRole === 'admin') {
			gradingTemplateRepository.seedForUser(userId);
		}

		return { success: true, message: `Benutzer „${target.username}“ aktualisiert.` };
	},

	resetPassword: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const userId = form.get('userId')?.toString();
		const newPassword = form.get('newPassword')?.toString();

		if (!userId || !newPassword || newPassword.length < 6) {
			return fail(400, { error: 'Neues Passwort muss mindestens 6 Zeichen lang sein.' });
		}

		const target = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
		if (!target) return fail(404, { error: 'Benutzer nicht gefunden.' });

		const passwordHash = await hash(newPassword);
		db.update(schema.users)
			.set({ passwordHash })
			.where(eq(schema.users.id, userId))
			.run();

		invalidateAllUserSessions(userId);

		return {
			success: true,
			message: `Passwort für „${target.username}“ zurückgesetzt und bestehende Sitzungen beendet.`
		};
	},

	resetTotp: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const userId = form.get('userId')?.toString();

		if (!userId) return fail(400, { error: 'Benutzer-ID fehlt.' });

		const target = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
		if (!target) return fail(404, { error: 'Benutzer nicht gefunden.' });

		db.update(schema.users)
			.set({ totpEnabled: false, totpSecret: null })
			.where(eq(schema.users.id, userId))
			.run();

		return {
			success: true,
			message: `2FA (TOTP) für „${target.username}“ wurde zurückgesetzt.`
		};
	},

	transferCourse: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const courseId = form.get('courseId')?.toString();
		const targetTeacherId = form.get('targetTeacherId')?.toString();

		if (!courseId || !targetTeacherId) {
			return fail(400, { error: 'Kurs und Ziel-Lehrkraft müssen ausgewählt werden.' });
		}

		const targetUser = db
			.select()
			.from(schema.users)
			.where(eq(schema.users.id, targetTeacherId))
			.get();

		if (!targetUser || !targetUser.isActive || (targetUser.role !== 'teacher' && targetUser.role !== 'admin')) {
			return fail(400, { error: 'Ziel-Lehrkraft ist ungültig oder inaktiv.' });
		}

		courseRepository.transferCourse(courseId, targetTeacherId);
		return {
			success: true,
			message: `Kurs erfolgreich an „${targetUser.displayName || targetUser.username}“ übertragen.`
		};
	}
};
