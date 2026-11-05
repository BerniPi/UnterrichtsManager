import type { Handle } from '@sveltejs/kit/hooks';
import { validateSessionToken, SESSION_COOKIE_NAME } from '$lib/server/auth';
import { seedDatabase } from '$lib/server/db/seed';
import { startTimetableScheduler } from '$lib/server/webuntis/timetable';

// Ensure database has default admin & seed data on startup
seedDatabase().catch(console.error);

// WebUntis-Stundenpläne mindestens täglich abgleichen
startTimetableScheduler();

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE_NAME);

	if (!token) {
		event.locals.user = null;
		event.locals.session = null;
	} else {
		const { session, user } = validateSessionToken(token);
		if (!user) {
			event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
		}
		event.locals.user = user;
		event.locals.session = session;
	}

	const url = event.url.pathname;

	// Public paths
	const isPublic =
		url.startsWith('/login') ||
		url.startsWith('/auth/microsoft') ||
		url === '/manifest.json' ||
		url === '/sw.js' ||
		url === '/icon.svg' ||
		url.startsWith('/api/push/public-key');

	if (!event.locals.user && !isPublic) {
		if (url.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Nicht angemeldet' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		return new Response(null, {
			status: 303,
			headers: { Location: '/login' }
		});
	}

	if (event.locals.user) {
		const isStudent = event.locals.user.role === 'student';

		if (url === '/login' && event.request.method === 'GET') {
			return new Response(null, {
				status: 303,
				headers: { Location: isStudent ? '/meine-noten' : '/' }
			});
		}

		if (isStudent) {
			const isLogoutAction = url === '/login' && event.url.searchParams.has('/logout');
			const allowedForStudent =
				url.startsWith('/meine-noten') ||
				url.startsWith('/logout') ||
				isLogoutAction ||
				(isPublic && !url.startsWith('/login'));

			if (!allowedForStudent) {
				if (url.startsWith('/api/')) {
					return new Response(JSON.stringify({ error: 'Zugriff verweigert' }), {
						status: 403,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				return new Response(null, {
					status: 303,
					headers: { Location: '/meine-noten' }
				});
			}
		} else if (url.startsWith('/meine-noten')) {
			return new Response(null, {
				status: 303,
				headers: { Location: '/' }
			});
		}
	}

	return resolve(event);
};
