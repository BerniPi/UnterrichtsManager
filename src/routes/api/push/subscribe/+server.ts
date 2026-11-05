import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
import { requireTeacher } from '$lib/server/auth/access';
import crypto from 'node:crypto';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireTeacher(locals);
	const body = await request.json();
	const { endpoint, keys } = body;

	if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
		throw error(400, 'Ungültige Push-Subscription Daten');
	}

	db.insert(schema.pushSubscriptions)
		.values({
			id: crypto.randomUUID(),
			endpoint,
			p256dh: keys.p256dh,
			auth: keys.auth,
			createdAt: Date.now(),
			userAgent: request.headers.get('user-agent') || null,
			userId: user.id
		})
		.onConflictDoUpdate({
			target: schema.pushSubscriptions.endpoint,
			set: {
				p256dh: sql`excluded.p256dh`,
				auth: sql`excluded.auth`,
				userAgent: sql`excluded.user_agent`,
				userId: user.id
			}
		})
		.run();

	return new Response(JSON.stringify({ success: true }), {
		headers: { 'Content-Type': 'application/json' }
	});
};
