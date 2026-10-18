import { db, sqlite } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import * as OTPAuth from 'otpauth';

const SESSION_COOKIE_NAME = 'notenmanager_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function generateSessionToken(): string {
	return crypto.randomBytes(32).toString('hex');
}

export function createSession(token: string, userId: string) {
	const sessionId = crypto.createHash('sha256').update(token).digest('hex');
	const expiresAt = Date.now() + SESSION_DURATION_MS;

	db.insert(schema.sessions)
		.values({
			id: sessionId,
			userId,
			expiresAt
		})
		.run();

	return { id: sessionId, expiresAt };
}

export function validateSessionToken(token: string) {
	const sessionId = crypto.createHash('sha256').update(token).digest('hex');

	const row = sqlite
		.prepare(
			`
		SELECT s.id as session_id, s.expires_at, u.id as user_id, u.username, u.totp_enabled
		FROM sessions s
		JOIN users u ON s.user_id = u.id
		WHERE s.id = ?
	`
		)
		.get(sessionId) as
		| {
				session_id: string;
				expires_at: number;
				user_id: string;
				username: string;
				totp_enabled: number;
		  }
		| undefined;

	if (!row) {
		return { session: null, user: null };
	}

	if (Date.now() >= row.expires_at) {
		db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run();
		return { session: null, user: null };
	}

	// Extend session if nearing halfway expiry
	if (Date.now() >= row.expires_at - SESSION_DURATION_MS / 2) {
		const newExpiresAt = Date.now() + SESSION_DURATION_MS;
		db.update(schema.sessions)
			.set({ expiresAt: newExpiresAt })
			.where(eq(schema.sessions.id, sessionId))
			.run();
		row.expires_at = newExpiresAt;
	}

	return {
		session: { id: row.session_id, expiresAt: new Date(row.expires_at) },
		user: { id: row.user_id, username: row.username, totpEnabled: Boolean(row.totp_enabled) }
	};
}

export function invalidateSession(sessionId: string) {
	db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run();
}

export function generateTotpSecret(username: string) {
	const totp = new OTPAuth.TOTP({
		issuer: 'Notenmanager',
		label: username,
		algorithm: 'SHA1',
		digits: 6,
		period: 30,
		secret: new OTPAuth.Secret({ size: 20 })
	});
	return {
		secret: totp.secret.base32,
		uri: totp.toString()
	};
}

export function verifyTotpToken(secret: string, token: string): boolean {
	const totp = new OTPAuth.TOTP({
		issuer: 'Notenmanager',
		algorithm: 'SHA1',
		digits: 6,
		period: 30,
		secret: OTPAuth.Secret.fromBase32(secret)
	});

	const delta = totp.validate({ token, window: 1 });
	return delta !== null;
}

export { SESSION_COOKIE_NAME };
