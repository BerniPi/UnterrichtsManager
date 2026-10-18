import type { RequestHandler } from './$types';
import { initWebPush } from '$lib/server/reminders/dispatcher';

export const GET: RequestHandler = async () => {
	const publicKey = initWebPush();
	return new Response(JSON.stringify({ publicKey }), {
		headers: { 'Content-Type': 'application/json' }
	});
};
