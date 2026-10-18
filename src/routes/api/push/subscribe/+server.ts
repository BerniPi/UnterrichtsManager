import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import crypto from 'node:crypto';

export const POST: RequestHandler = async ({ request }) => {
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
			userAgent: request.headers.get('user-agent') || null
		})
		.onConflictDoNothing()
		.run();

	return new Response(JSON.stringify({ success: true }), {
		headers: { 'Content-Type': 'application/json' }
	});
};
