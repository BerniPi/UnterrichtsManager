import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { invalidateSession, SESSION_COOKIE_NAME } from '$lib/server/auth';

const performLogout: RequestHandler = async ({ locals, cookies }) => {
	if (locals.session) {
		invalidateSession(locals.session.id);
	}
	cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
	throw redirect(303, '/login');
};

export const POST: RequestHandler = performLogout;
export const GET: RequestHandler = performLogout;
