import { redirect, type RequestHandler } from '@sveltejs/kit';
import { getAuthUrl, isEntraEnabled, ENTRA_FLOW_COOKIE } from '$lib/server/auth/entra';

export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!isEntraEnabled()) {
		throw redirect(303, '/login?error=' + encodeURIComponent('Microsoft-Login ist nicht eingerichtet.'));
	}

	try {
		const { url: authUrl, flowToken } = await getAuthUrl(url.origin);
		cookies.set(ENTRA_FLOW_COOKIE, flowToken, {
			path: '/auth/microsoft',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: 60 * 10 // 10 minutes
		});

		throw redirect(303, authUrl);
	} catch (err) {
		if (err instanceof Response || (typeof err === 'object' && err !== null && 'status' in err)) {
			throw err;
		}
		const message = err instanceof Error ? err.message : 'Microsoft-Login konnte nicht gestartet werden.';
		throw redirect(303, '/login?error=' + encodeURIComponent(message));
	}
};
