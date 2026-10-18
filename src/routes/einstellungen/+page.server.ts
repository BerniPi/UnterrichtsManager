import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, sqlite } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hash, verify } from '@node-rs/argon2';
import { generateTotpSecret, verifyTotpToken } from '$lib/server/auth';
import { seedDatabase } from '$lib/server/db/seed';
import { gradingTemplateRepository } from '$lib/server/repositories/grading-template.repository';
import { settingsRepository } from '$lib/server/repositories/settings.repository';
import { validateScale, type GradingThreshold } from '$lib/services/grading';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	const settings = settingsRepository.getAll();

	const userRow = db.select().from(schema.users).where(eq(schema.users.id, user.id)).get()!;

	const subCount = (
		sqlite.prepare('SELECT COUNT(*) as count FROM push_subscriptions').get() as { count: number }
	).count;

	const gradingTemplates = gradingTemplateRepository.getAll();

	return {
		username: user.username,
		totpEnabled: userRow.totpEnabled,
		teacherName: settings.teacherName,
		defaultReturnDays: settings.defaultReturnDays,
		earlyWarningThreshold: settings.earlyWarningThreshold,
		emailSummaryEnabled: settings.emailSummaryEnabled,
		pushSubscriptionsCount: subCount,
		gradingTemplates
	};
};

export const actions: Actions = {
	updateSettings: async ({ request }) => {
		const form = await request.formData();
		const teacherName = form.get('teacherName')?.toString().trim() || '';
		const defaultReturnDays = parseInt(form.get('defaultReturnDays')?.toString() || '7', 10);
		const earlyWarningThreshold = parseFloat(form.get('earlyWarningThreshold')?.toString() || '4.5');
		const emailSummaryEnabled = form.get('emailSummaryEnabled') ? true : false;

		settingsRepository.updateAll({
			teacherName,
			defaultReturnDays,
			earlyWarningThreshold,
			emailSummaryEnabled
		});

		return { success: true, message: 'Einstellungen gespeichert!' };
	},

	changePassword: async ({ request, locals }) => {
		const form = await request.formData();
		const currentPassword = form.get('currentPassword')?.toString();
		const newPassword = form.get('newPassword')?.toString();

		if (!currentPassword || !newPassword) {
			return fail(400, { passwordError: 'Bitte aktuelles und neues Passwort eingeben.' });
		}

		const user = db.select().from(schema.users).where(eq(schema.users.id, locals.user!.id)).get()!;
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
		const secret = generateTotpSecret(locals.user!.username);
		db.update(schema.users)
			.set({ totpSecret: secret.secret, totpEnabled: false })
			.where(eq(schema.users.id, locals.user!.id))
			.run();

		return {
			totpSetup: true,
			secret: secret.secret,
			uri: secret.uri
		};
	},

	enableTotp: async ({ request, locals }) => {
		const form = await request.formData();
		const code = form.get('code')?.toString().trim();

		const user = db.select().from(schema.users).where(eq(schema.users.id, locals.user!.id)).get()!;
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
		db.update(schema.users)
			.set({ totpEnabled: false, totpSecret: null })
			.where(eq(schema.users.id, locals.user!.id))
			.run();

		return { totpDisabled: true };
	},

	resetFictionalData: async () => {
		if (process.env.NODE_ENV === 'production') {
			return fail(403, { resetError: 'Das Zurücksetzen auf Testdaten ist in Produktionsumgebungen gesperrt.' });
		}
		await seedDatabase(true);
		return { resetSuccess: 'Datenbank mit fiktiven Testdaten neu initialisiert!' };
	},

	saveTemplate: async ({ request }) => {
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
			gradingTemplateRepository.update(id, { name, description, scale, isDefault });
			return { templateSuccess: `Vorlage „${name}“ erfolgreich aktualisiert!` };
		} else {
			gradingTemplateRepository.create({ name, description, scale, isDefault });
			return { templateSuccess: `Neue Vorlage „${name}“ erfolgreich angelegt!` };
		}
	},

	setDefaultTemplate: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id')?.toString();
		if (!id) return fail(400, { templateError: 'Ungültige Vorlagen-ID.' });
		gradingTemplateRepository.setDefault(id);
		return { templateSuccess: 'Standard-Vorlage erfolgreich geändert!' };
	},

	deleteTemplate: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id')?.toString();
		if (!id) return fail(400, { templateError: 'Ungültige Vorlagen-ID.' });
		const all = gradingTemplateRepository.getAll();
		if (all.length <= 1) {
			return fail(400, { templateError: 'Mindestens eine Vorlage muss im System verbleiben.' });
		}
		gradingTemplateRepository.delete(id);
		return { templateSuccess: 'Vorlage erfolgreich gelöscht!' };
	}
};
