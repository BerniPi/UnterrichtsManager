import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db, sqlite } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { verify } from '@node-rs/argon2';
import {
	generateSessionToken,
	createSession,
	SESSION_COOKIE_NAME,
	verifyTotpToken,
	invalidateSession
} from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/');
	}
	return {};
};

export const actions: Actions = {
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const username = data.get('username')?.toString().trim();
		const password = data.get('password')?.toString();
		const totpCode = data.get('totpCode')?.toString().trim();

		if (!username || !password) {
			return fail(400, { message: 'Bitte Benutzername und Passwort angeben.' });
		}

		const user = db.select().from(schema.users).where(eq(schema.users.username, username)).get();

		if (!user) {
			return fail(400, { message: 'Ungültige Anmeldedaten.' });
		}

		const validPassword = await verify(user.passwordHash, password);
		if (!validPassword) {
			return fail(400, { message: 'Ungültige Anmeldedaten.' });
		}

		if (user.totpEnabled && user.totpSecret) {
			if (!totpCode) {
				return fail(400, { message: '2FA-Code (TOTP) ist erforderlich.', needsTotp: true });
			}
			const validTotp = verifyTotpToken(user.totpSecret, totpCode);
			if (!validTotp) {
				return fail(400, { message: 'Ungültiger 2FA-Code.', needsTotp: true });
			}
		}

		const token = generateSessionToken();
		createSession(token, user.id);

		cookies.set(SESSION_COOKIE_NAME, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 30 // 30 days
		});

		throw redirect(303, '/');
	},

	logout: async ({ locals, cookies }) => {
		if (locals.session) {
			invalidateSession(locals.session.id);
		}
		cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
		throw redirect(303, '/login');
	}
};
