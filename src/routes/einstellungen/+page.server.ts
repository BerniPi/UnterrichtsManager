import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, sqlite } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hash, verify } from '@node-rs/argon2';
import { generateTotpSecret, verifyTotpToken } from '$lib/server/auth';
import { requireTeacher, requireAdmin } from '$lib/server/auth/access';
import { seedDatabase } from '$lib/server/db/seed';
import { gradingTemplateRepository } from '$lib/server/repositories/grading-template.repository';
import { settingsRepository } from '$lib/server/repositories/settings.repository';
import { validateScale } from '$lib/services/grading';
import { BgbbError, fetchBgbbClasses, getBgbbConfig, saveBgbbConfig } from '$lib/server/bgbb/client';
import { getEntraConfig, saveEntraConfig } from '$lib/server/auth/entra';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireTeacher(locals);
	const isAdmin = user.role === 'admin';
	const settings = settingsRepository.getAll(user.id);

	const userRow = db.select().from(schema.users).where(eq(schema.users.id, user.id)).get()!;

	const subCount = (
		sqlite
			.prepare('SELECT COUNT(*) as count FROM push_subscriptions WHERE user_id = ?')
			.get(user.id) as { count: number }
	).count;

	const gradingTemplates = gradingTemplateRepository.getAll(user.id);
	// Der API-Key selbst geht nie an den Browser
	const bgbb = isAdmin
		? getBgbbConfig()
		: { apiUrl: '', apiKey: '', fromEnv: false };
	const entra = isAdmin
		? getEntraConfig()
		: { tenantId: '', clientId: '', clientSecret: '', fromEnv: false };

	return {
		username: user.username,
		isAdmin,
		totpEnabled: userRow.totpEnabled,
		teacherName: settings.teacherName,
		defaultReturnDays: settings.defaultReturnDays,
		earlyWarningThreshold: settings.earlyWarningThreshold,
		emailSummaryEnabled: settings.emailSummaryEnabled,
		pushSubscriptionsCount: subCount,
		gradingTemplates,
		bgbb: {
			apiUrl: bgbb.apiUrl,
			apiKeySet: Boolean(bgbb.apiKey),
			fromEnv: bgbb.fromEnv
		},
		entra: {
			tenantId: entra.tenantId,
			clientId: entra.clientId,
			clientSecretSet: Boolean(entra.clientSecret),
			fromEnv: entra.fromEnv,
			enabled: Boolean(entra.tenantId && entra.clientId && entra.clientSecret)
		}
	};
};

export const actions: Actions = {
	updateSettings: async ({ request, locals }) => {
		const user = requireTeacher(locals);
		const form = await request.formData();
		const teacherName = form.get('teacherName')?.toString().trim() || '';
		const defaultReturnDays = parseInt(form.get('defaultReturnDays')?.toString() || '7', 10);
		const earlyWarningThreshold = parseFloat(form.get('earlyWarningThreshold')?.toString() || '4.5');
		const emailSummaryEnabled = form.get('emailSummaryEnabled') ? true : false;

		settingsRepository.updateAll(
			{
				teacherName,
				defaultReturnDays,
				earlyWarningThreshold,
				emailSummaryEnabled
			},
			user.id
		);

		return { success: true, message: 'Einstellungen gespeichert!' };
	},

	updateBgbbSettings: async ({ request, locals }) => {
		requireAdmin(locals);
		if (getBgbbConfig().fromEnv) {
			return fail(400, { bgbbError: 'BGBB Admin ist über Umgebungsvariablen eingerichtet und hier nicht änderbar.' });
		}
		const form = await request.formData();
		const apiUrl = form.get('bgbbApiUrl')?.toString().trim() || '';
		const apiKey = form.get('bgbbApiKey')?.toString() || '';

		if (apiUrl && !/^https?:\/\/[^\s]+$/i.test(apiUrl)) {
			return fail(400, { bgbbError: 'Bitte eine gültige URL mit http:// oder https:// angeben.' });
		}

		saveBgbbConfig(apiUrl, apiKey);
		return { success: true, bgbbMessage: 'BGBB-Admin-Anbindung gespeichert.' };
	},

	testBgbbConnection: async ({ locals }) => {
		requireAdmin(locals);
		try {
			const classes = await fetchBgbbClasses();
			const students = classes.reduce((sum, c) => sum + c.studentCount, 0);
			return {
				success: true,
				bgbbMessage: `Verbindung zu BGBB Admin OK: ${classes.length} Klassen, ${students} Schüler:innen.`
			};
		} catch (e) {
			if (!(e instanceof BgbbError)) console.error('BGBB-Verbindungstest fehlgeschlagen', e);
			return fail(502, { bgbbError: e instanceof BgbbError ? e.message : 'Verbindungstest fehlgeschlagen.' });
		}
	},

	changePassword: async ({ request, locals }) => {
		const userLocals = requireTeacher(locals);
		const form = await request.formData();
		const currentPassword = form.get('currentPassword')?.toString();
		const newPassword = form.get('newPassword')?.toString();

		if (!currentPassword || !newPassword) {
			return fail(400, { passwordError: 'Bitte aktuelles und neues Passwort eingeben.' });
		}

		const user = db.select().from(schema.users).where(eq(schema.users.id, userLocals.id)).get()!;
		const valid = await verify(user.passwordHash, currentPassword);
		if (!valid) {
			return fail(400, { passwordError: 'Das aktuelle Passwort ist nicht korrekt.' });
		}

		const newHash = await hash(newPassword);
		db.update(schema.users)
			.set({ passwordHash: newHash })
			.where(eq(schema.users.id, user.id))
			.run();

		return { passwordSuccess: 'Passwort erfolgreich geändert!' };
	},

	setupTotp: async ({ locals }) => {
		const user = requireTeacher(locals);
		const secret = generateTotpSecret(user.username);
		db.update(schema.users)
			.set({ totpSecret: secret.secret, totpEnabled: false })
			.where(eq(schema.users.id, user.id))
			.run();

		return {
			totpSetup: true,
			secret: secret.secret,
			uri: secret.uri
		};
	},

	enableTotp: async ({ request, locals }) => {
		const userLocals = requireTeacher(locals);
		const form = await request.formData();
		const code = form.get('code')?.toString().trim();

		const user = db.select().from(schema.users).where(eq(schema.users.id, userLocals.id)).get()!;
		if (!user.totpSecret || !code) {
			return fail(400, { totpError: 'Code erforderlich.' });
		}

		const valid = verifyTotpToken(user.totpSecret, code);
		if (!valid) {
			return fail(400, { totpError: 'Der eingegebene 2FA-Code ist ungültig.' });
		}

		db.update(schema.users)
			.set({ totpEnabled: true })
			.where(eq(schema.users.id, user.id))
			.run();

		return { totpEnabledSuccess: '2FA erfolgreich aktiviert!' };
	},

	disableTotp: async ({ locals }) => {
		const user = requireTeacher(locals);
		db.update(schema.users)
			.set({ totpEnabled: false, totpSecret: null })
			.where(eq(schema.users.id, user.id))
			.run();

		return { totpDisabled: true };
	},

	resetFictionalData: async ({ locals }) => {
		requireAdmin(locals);
		if (process.env.NODE_ENV === 'production') {
			return fail(403, { resetError: 'Das Zurücksetzen auf Testdaten ist in Produktionsumgebungen gesperrt.' });
		}
		await seedDatabase(true);
		return { resetSuccess: 'Datenbank mit fiktiven Testdaten neu initialisiert!' };
	},

	saveTemplate: async ({ request, locals }) => {
		const user = requireTeacher(locals);
		const form = await request.formData();
		const id = form.get('id')?.toString();
		const name = form.get('name')?.toString().trim();
		const description = form.get('description')?.toString().trim() || null;
		const isDefault = form.get('isDefault') === 'true' || form.get('isDefault') === 'on';
		const scaleJson = form.get('scaleJson')?.toString();

		if (!name || !scaleJson) {
			return fail(400, { templateError: 'Name und Notenstufen sind erforderlich.' });
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(scaleJson);
		} catch (e) {
			return fail(400, { templateError: 'Ungültiges Notenstufen-Format.' });
		}

		const validation = validateScale(parsed);
		if (!validation.valid || !validation.normalizedScale) {
			return fail(400, { templateError: validation.error || 'Ungültige Notenstufen.' });
		}
		const scale = validation.normalizedScale;

		if (id) {
			gradingTemplateRepository.update(id, { name, description, scale, isDefault }, user.id);
			return { templateSuccess: `Vorlage „${name}“ erfolgreich aktualisiert!` };
		} else {
			gradingTemplateRepository.create({ name, description, scale, isDefault }, user.id);
			return { templateSuccess: `Neue Vorlage „${name}“ erfolgreich angelegt!` };
		}
	},

	setDefaultTemplate: async ({ request, locals }) => {
		const user = requireTeacher(locals);
		const form = await request.formData();
		const id = form.get('id')?.toString();
		if (!id) return fail(400, { templateError: 'Ungültige Vorlagen-ID.' });
		const existing = gradingTemplateRepository.getById(id, user.id);
		if (!existing) {
			throw error(404, 'Vorlage nicht gefunden');
		}
		gradingTemplateRepository.setDefault(id, user.id);
		return { templateSuccess: 'Standard-Vorlage erfolgreich geändert!' };
	},

	deleteTemplate: async ({ request, locals }) => {
		const user = requireTeacher(locals);
		const form = await request.formData();
		const id = form.get('id')?.toString();
		if (!id) return fail(400, { templateError: 'Ungültige Vorlagen-ID.' });
		const existing = gradingTemplateRepository.getById(id, user.id);
		if (!existing) {
			throw error(404, 'Vorlage nicht gefunden');
		}
		const all = gradingTemplateRepository.getAll(user.id);
		if (all.length <= 1) {
			return fail(400, { templateError: 'Mindestens eine Vorlage muss im System verbleiben.' });
		}
		gradingTemplateRepository.delete(id, user.id);
		return { templateSuccess: 'Vorlage erfolgreich gelöscht!' };
	},

	updateEntraSettings: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const tenantId = form.get('tenantId')?.toString().trim() || '';
		const clientId = form.get('clientId')?.toString().trim() || '';
		const clientSecret = form.get('clientSecret')?.toString() || '';

		const current = getEntraConfig();
		if (current.fromEnv) {
			return fail(400, {
				entraError:
					'Die Microsoft-Zugangsdaten sind über Umgebungsvariablen (.env) definiert und können hier nicht geändert werden.'
			});
		}

		saveEntraConfig(tenantId, clientId, clientSecret);
		return { entraUpdated: true };
	}
};
