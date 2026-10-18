import type { Handle } from '@sveltejs/kit/hooks';
import { validateSessionToken, SESSION_COOKIE_NAME } from '$lib/server/auth';
import { seedDatabase } from '$lib/server/db/seed';

// Ensure database has default admin & seed data on startup
seedDatabase().catch(console.error);

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE_NAME);

	if (!token) {
		event.locals.user = null;
		event.locals.session = null;
	} else {
		const { session, user } = validateSessionToken(token);
		event.locals.user = user;
		event.locals.session = session;
	}

	const url = event.url.pathname;

	// Public paths
	const isPublic =
		url.startsWith('/login') ||
		url === '/manifest.json' ||
		url === '/sw.js' ||
		url === '/icon.svg' ||
		url.startsWith('/api/push/public-key');

	if (!event.locals.user && !isPublic) {
		return new Response(null, {
			status: 303,
			headers: { Location: '/login' }
		});
	}

	if (event.locals.user && url === '/login' && event.request.method === 'GET') {
		return new Response(null, {
			status: 303,
			headers: { Location: '/' }
		});
	}

	return resolve(event);
};
