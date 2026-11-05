import crypto from 'node:crypto';
import { db, sqlite } from '../db';
import * as schema from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { queryBgbbStudent } from '../bgbb/client';
import { normalizeName } from '../../services/reconciliation';

export const ENTRA_FLOW_COOKIE = 'm365_flow';
export const ENTRA_CALLBACK_PATH = '/auth/microsoft/callback';
const FLOW_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export interface EntraConfig {
	tenantId: string;
	clientId: string;
	clientSecret: string;
	fromEnv: boolean;
}

export interface EntraIdentity {
	oid: string;
	email: string;
	name: string;
	givenName?: string;
	familyName?: string;
}

export class EntraAuthError extends Error {
	userMessage: string;
	constructor(userMessage: string, detail?: string) {
		super(detail || userMessage);
		this.userMessage = userMessage;
	}
}

function readSetting(key: string): string {
	const row = sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
	return row?.value ?? '';
}

export function getEntraConfig(): EntraConfig {
	const envTenant = (process.env.ENTRA_TENANT_ID || process.env.MICROSOFT_TENANT_ID || '').trim();
	const envClient = (process.env.ENTRA_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || '').trim();
	const envSecret = (process.env.ENTRA_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET || '').trim();

	if (envTenant && envClient && envSecret) {
		return { tenantId: envTenant, clientId: envClient, clientSecret: envSecret, fromEnv: true };
	}

	return {
		tenantId: envTenant || readSetting('entra_tenant_id').trim(),
		clientId: envClient || readSetting('entra_client_id').trim(),
		clientSecret: envSecret || readSetting('entra_client_secret').trim(),
		fromEnv: false
	};
}

export function saveEntraConfig(tenantId: string, clientId: string, clientSecret: string): void {
	const entries = [
		{ key: 'entra_tenant_id', value: tenantId.trim() },
		{ key: 'entra_client_id', value: clientId.trim() }
	];
	if (clientSecret.trim()) {
		entries.push({ key: 'entra_client_secret', value: clientSecret.trim() });
	}

	db.insert(schema.settings)
		.values(entries)
		.onConflictDoUpdate({ target: schema.settings.key, set: { value: sql`excluded.value` } })
		.run();
}

export function isEntraEnabled(): boolean {
	const { tenantId, clientId, clientSecret } = getEntraConfig();
	return Boolean(tenantId && clientId && clientSecret);
}

function base64Url(buf: Buffer): string {
	return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getFlowSigningSecret(): string {
	let secret = readSetting('flow_signing_secret');
	if (!secret) {
		secret = crypto.randomBytes(32).toString('hex');
		db.insert(schema.settings)
			.values({ key: 'flow_signing_secret', value: secret })
			.onConflictDoNothing()
			.run();
	}
	return secret;
}

function signFlowPayload(payload: object): string {
	const secret = getFlowSigningSecret();
	const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
	const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
	return `${data}.${sig}`;
}

function verifyFlowPayload<T>(token: string): T | null {
	try {
		const parts = token.split('.');
		if (parts.length !== 2) return null;
		const [data, sig] = parts;
		const secret = getFlowSigningSecret();
		const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
		const sigBuf = Buffer.from(sig, 'utf8');
		const expBuf = Buffer.from(expectedSig, 'utf8');
		if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
			return null;
		}
		const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
		if (parsed.expiresAt && Date.now() > parsed.expiresAt) return null;
		return parsed as T;
	} catch {
		return null;
	}
}

export function getRedirectUri(origin: string): string {
	return `${origin.replace(/\/+$/, '')}${ENTRA_CALLBACK_PATH}`;
}

export async function getAuthUrl(origin: string): Promise<{ url: string; flowToken: string }> {
	const { tenantId, clientId } = getEntraConfig();
	if (!tenantId || !clientId) {
		throw new EntraAuthError('Microsoft-Login ist nicht konfiguriert.');
	}

	const verifier = base64Url(crypto.randomBytes(32));
	const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
	const state = crypto.randomUUID();
	const nonce = crypto.randomUUID();

	const flowToken = signFlowPayload({
		state,
		nonce,
		verifier,
		expiresAt: Date.now() + FLOW_MAX_AGE_MS
	});

	const redirectUri = getRedirectUri(origin);
	const params = new URLSearchParams({
		client_id: clientId,
		response_type: 'code',
		redirect_uri: redirectUri,
		response_mode: 'query',
		scope: 'openid profile email',
		state,
		nonce,
		code_challenge: challenge,
		code_challenge_method: 'S256',
		prompt: 'select_account'
	});

	const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
	return { url, flowToken };
}

export async function handleCallback(
	params: { code?: string | null; state?: string | null; error?: string | null; error_description?: string | null },
	flowCookie: string | undefined,
	origin: string
): Promise<EntraIdentity> {
	if (params.error) {
		throw new EntraAuthError(
			'Die Anmeldung bei Microsoft wurde abgebrochen oder ist fehlgeschlagen.',
			`${params.error}: ${params.error_description || ''}`
		);
	}

	if (!flowCookie) {
		throw new EntraAuthError('Die Anmeldung ist abgelaufen oder ungültig. Bitte versuchen Sie es erneut.', 'missing flow cookie');
	}

	const flow = verifyFlowPayload<{ state: string; nonce: string; verifier: string }>(flowCookie);
	if (!flow || !params.code || !params.state || params.state !== flow.state) {
		throw new EntraAuthError('Die Anmeldung ist abgelaufen oder ungültig. Bitte versuchen Sie es erneut.', 'state mismatch');
	}

	const { tenantId, clientId, clientSecret } = getEntraConfig();
	const redirectUri = getRedirectUri(origin);

	const body = new URLSearchParams({
		client_id: clientId,
		client_secret: clientSecret,
		grant_type: 'authorization_code',
		code: params.code,
		redirect_uri: redirectUri,
		code_verifier: flow.verifier
	});

	let res: Response;
	try {
		res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: body.toString()
		});
	} catch (e) {
		throw new EntraAuthError('Microsoft-Server konnte nicht erreicht werden.', e instanceof Error ? e.message : String(e));
	}

	if (!res.ok) {
		let detail = '';
		try {
			const errJson = await res.json();
			detail = errJson.error_description || errJson.error || '';
		} catch {}
		throw new EntraAuthError('Die Anmeldung bei Microsoft ist fehlgeschlagen.', detail);
	}

	const tokenData = (await res.json()) as { id_token?: string };
	if (!tokenData.id_token) {
		throw new EntraAuthError('Microsoft lieferte kein Identitäts-Token.', 'missing id_token');
	}

	let claims: Record<string, any>;
	try {
		const payload = tokenData.id_token.split('.')[1];
		claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
	} catch {
		throw new EntraAuthError('Identitäts-Token von Microsoft ist beschädigt.', 'invalid jwt payload');
	}

	if (claims.nonce !== flow.nonce) {
		throw new EntraAuthError('Ungültiges Anmelde-Token. Bitte erneut versuchen.', 'nonce mismatch');
	}

	if (claims.tid && tenantId.toLowerCase() !== 'common' && claims.tid.toLowerCase() !== tenantId.toLowerCase()) {
		throw new EntraAuthError('Dieses Microsoft-Konto gehört nicht zur Schule.', `unexpected tenant ${claims.tid}`);
	}

	const email = String(claims.email || claims.preferred_username || '').trim().toLowerCase();
	const oid = String(claims.oid || claims.sub || '').trim();

	if (!oid || !email) {
		throw new EntraAuthError('Das Microsoft-Konto liefert keine E-Mail-Adresse.', 'missing oid or email');
	}

	return {
		oid,
		email,
		name: String(claims.name || '').trim(),
		givenName: claims.given_name ? String(claims.given_name).trim() : undefined,
		familyName: claims.family_name ? String(claims.family_name).trim() : undefined
	};
}

/**
 * Maps an authenticated Microsoft identity to an existing teacher or an imported student.
 */
export async function authenticateWithEntra(identity: EntraIdentity): Promise<{
	id: string;
	username: string;
	role: 'admin' | 'teacher' | 'student';
	displayName: string | null;
	email: string | null;
	entraOid: string | null;
	isActive: boolean;
	studentId: string | null;
}> {
	const emailLower = identity.email.toLowerCase();
	const emailPrefix = emailLower.includes('@') ? emailLower.split('@')[0] : emailLower;

	// 1. Check teachers / admins (must be manually created prior)
	const teacher = sqlite
		.prepare(
			`
		SELECT id, username, role, display_name, email, entra_oid, is_active, student_id
		FROM users
		WHERE role IN ('teacher', 'admin')
		  AND (
		    entra_oid = ?
		    OR LOWER(COALESCE(email, '')) = ?
		    OR LOWER(username) = ?
		    OR LOWER(username) = ?
		  )
		LIMIT 1
	`
		)
		.get(identity.oid, emailLower, emailLower, emailPrefix) as
		| {
				id: string;
				username: string;
				role: 'admin' | 'teacher';
				display_name: string | null;
				email: string | null;
				entra_oid: string | null;
				is_active: number;
				student_id: string | null;
		  }
		| undefined;

	if (teacher) {
		if (!teacher.is_active) {
			throw new EntraAuthError('Dieses Benutzerkonto ist deaktiviert.');
		}
		// Link entra_oid and email if not yet set
		if (teacher.entra_oid !== identity.oid || teacher.email !== identity.email) {
			db.update(schema.users)
				.set({
					entraOid: identity.oid,
					email: identity.email
				})
				.where(eq(schema.users.id, teacher.id))
				.run();
		}
		return {
			id: teacher.id,
			username: teacher.username,
			role: teacher.role,
			displayName: teacher.display_name,
			email: identity.email,
			entraOid: identity.oid,
			isActive: true,
			studentId: null
		};
	}

	// 2. Check students
	// A. Match in local students table
	let student = sqlite
		.prepare(
			`
		SELECT id, class_id, first_name, last_name, schkz, email, status
		FROM students
		WHERE status = 'active'
		  AND (
		    LOWER(COALESCE(email, '')) = ?
		    OR LOWER(COALESCE(email, '')) = ?
		  )
		LIMIT 1
	`
		)
		.get(emailLower, emailPrefix) as
		| {
				id: string;
				class_id: string;
				first_name: string;
				last_name: string;
				schkz: string | null;
				email: string | null;
				status: string;
		  }
		| undefined;

	// B. Try matching by given name + family name from M365 claims
	if (!student && identity.givenName && identity.familyName) {
		const targetFirst = normalizeName(identity.givenName);
		const targetLast = normalizeName(identity.familyName);
		const activeStudents = sqlite
			.prepare('SELECT id, class_id, first_name, last_name, schkz, email, status FROM students WHERE status = "active"')
			.all() as Array<{
			id: string;
			class_id: string;
			first_name: string;
			last_name: string;
			schkz: string | null;
			email: string | null;
			status: string;
		}>;

		student = activeStudents.find(
			(s) => normalizeName(s.first_name) === targetFirst && normalizeName(s.last_name) === targetLast
		);
	}

	// C. Query BGBB Admin Bot API if student is not found locally yet
	if (!student) {
		const bgbbResults = await queryBgbbStudent(emailLower);
		const hit = bgbbResults[0] || (await queryBgbbStudent(emailPrefix))[0];
		if (hit && hit.schkz) {
			student = sqlite
				.prepare('SELECT id, class_id, first_name, last_name, schkz, email, status FROM students WHERE schkz = ? LIMIT 1')
				.get(hit.schkz) as any;
		}
	}

	if (student) {
		// Update student's email in students table if missing
		if (!student.email || student.email.toLowerCase() !== emailLower) {
			db.update(schema.students)
				.set({ email: identity.email })
				.where(eq(schema.students.id, student.id))
				.run();
		}

		// Find or create linked user account
		const existingUser = sqlite
			.prepare(
				`
			SELECT id, username, role, display_name, email, entra_oid, is_active, student_id
			FROM users
			WHERE student_id = ?
			   OR entra_oid = ?
			   OR LOWER(COALESCE(email, '')) = ?
			LIMIT 1
		`
			)
			.get(student.id, identity.oid, emailLower) as
			| {
					id: string;
					username: string;
					role: 'admin' | 'teacher' | 'student';
					display_name: string | null;
					email: string | null;
					entra_oid: string | null;
					is_active: number;
					student_id: string | null;
			  }
			| undefined;

		if (existingUser) {
			if (!existingUser.is_active) {
				throw new EntraAuthError('Dieses Benutzerkonto ist deaktiviert.');
			}
			if (existingUser.entra_oid !== identity.oid || existingUser.email !== identity.email || existingUser.student_id !== student.id) {
				db.update(schema.users)
					.set({
						entraOid: identity.oid,
						email: identity.email,
						studentId: student.id,
						role: 'student'
					})
					.where(eq(schema.users.id, existingUser.id))
					.run();
			}
			return {
				id: existingUser.id,
				username: existingUser.username,
				role: 'student',
				displayName: existingUser.display_name || `${student.first_name} ${student.last_name}`,
				email: identity.email,
				entraOid: identity.oid,
				isActive: true,
				studentId: student.id
			};
		}

		// Auto-provision student user
		const newUserId = crypto.randomUUID();
		const displayName = identity.name || `${student.first_name} ${student.last_name}`;
		db.insert(schema.users)
			.values({
				id: newUserId,
				username: identity.email,
				email: identity.email,
				passwordHash: 'ENTRA_SSO_NO_PASSWORD',
				displayName,
				role: 'student',
				studentId: student.id,
				entraOid: identity.oid,
				isActive: true,
				createdAt: Date.now()
			})
			.run();

		return {
			id: newUserId,
			username: identity.email,
			role: 'student',
			displayName,
			email: identity.email,
			entraOid: identity.oid,
			isActive: true,
			studentId: student.id
		};
	}

	throw new EntraAuthError(
		'Für dieses Microsoft-Konto existiert kein Zugang. Lehrkräfte müssen vorab angelegt werden; Schüler müssen im Klassenstamm vorhanden sein.'
	);
}
