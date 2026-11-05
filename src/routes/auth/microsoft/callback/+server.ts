import { redirect, type RequestHandler } from '@sveltejs/kit';
import {
	handleCallback,
	authenticateWithEntra,
	isEntraEnabled,
	ENTRA_FLOW_COOKIE,
	EntraAuthError
} from '$lib/server/auth/entra';
import { generateSessionToken, createSession, SESSION_COOKIE_NAME } from '$lib/server/auth';

export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!isEntraEnabled()) {
		throw redirect(303, '/login');
	}

	const flowCookie = cookies.get(ENTRA_FLOW_COOKIE);
	cookies.delete(ENTRA_FLOW_COOKIE, { path: '/auth/microsoft' });

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');
	const errorDescription = url.searchParams.get('error_description');

	try {
		const identity = await handleCallback(
			{ code, state, error, error_description: errorDescription },
			flowCookie,
			url.origin
		);

		const user = await authenticateWithEntra(identity);

		const token = generateSessionToken();
		createSession(token, user.id);

		cookies.set(SESSION_COOKIE_NAME, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 60 * 60 * 24 * 30 // 30 days
		});

		throw redirect(303, user.role === 'student' ? '/meine-noten' : '/');
	} catch (err) {
		if (err instanceof Response || (typeof err === 'object' && err !== null && 'status' in err)) {
			throw err;
		}
		const message =
			err instanceof EntraAuthError
				? err.userMessage
				: 'Die Anmeldung mit Microsoft ist fehlgeschlagen.';
		console.error('[M365 Auth Callback Error]:', err);
		throw redirect(303, '/login?error=' + encodeURIComponent(message));
	}
};
