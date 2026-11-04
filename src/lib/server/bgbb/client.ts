import { sqlite, db } from '../db';
import * as schema from '../db/schema';
import { sql } from 'drizzle-orm';
import { assignAlphabeticalCatalogNumbers, type RawStudentImport } from '../../services/reconciliation';

/**
 * Anbindung an die Bot-API von BGBB Admin (`/api/v1/bot`, Header `x-api-key`, Recht "read").
 * Übernommen werden nur Vorname, Familienname und SchKz – keine weiteren Schülerdaten.
 */

const REQUEST_TIMEOUT_MS = 10_000;

export interface BgbbConfig {
	apiUrl: string;
	apiKey: string;
	/** true, wenn die Werte aus Umgebungsvariablen kommen (dann in der Oberfläche nicht änderbar) */
	fromEnv: boolean;
}

export interface BgbbClass {
	klasse: string;
	studentCount: number;
}

export class BgbbError extends Error {}

function readSetting(key: string): string {
	const row = sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
	return row?.value ?? '';
}

export function getBgbbConfig(): BgbbConfig {
	const envUrl = process.env.BGBB_API_URL?.trim();
	const envKey = process.env.BGBB_API_KEY?.trim();
	if (envUrl && envKey) {
		return { apiUrl: normalizeBaseUrl(envUrl), apiKey: envKey, fromEnv: true };
	}
	return {
		apiUrl: normalizeBaseUrl(readSetting('bgbb_api_url')),
		apiKey: readSetting('bgbb_api_key'),
		fromEnv: false
	};
}

/** Speichert URL und Key; ein leerer Key lässt den gespeicherten Key unverändert. */
export function saveBgbbConfig(apiUrl: string, apiKey: string): void {
	const entries = [{ key: 'bgbb_api_url', value: normalizeBaseUrl(apiUrl) }];
	if (apiKey.trim()) entries.push({ key: 'bgbb_api_key', value: apiKey.trim() });

	db.insert(schema.settings)
		.values(entries)
		.onConflictDoUpdate({ target: schema.settings.key, set: { value: sql`excluded.value` } })
		.run();
}

export function normalizeBaseUrl(url: string): string {
	return url.trim().replace(/\/+$/, '');
}

async function bgbbGet<T>(path: string): Promise<T> {
	const { apiUrl, apiKey } = getBgbbConfig();
	if (!apiUrl || !apiKey) {
		throw new BgbbError('BGBB Admin ist nicht eingerichtet. Bitte URL und API-Key in den Einstellungen eintragen.');
	}
	if (!/^https?:\/\//i.test(apiUrl)) {
		throw new BgbbError('Die BGBB-Admin-URL muss mit http:// oder https:// beginnen.');
	}

	let res: Response;
	try {
		res = await fetch(`${apiUrl}/api/v1/bot${path}`, {
			headers: { 'x-api-key': apiKey, accept: 'application/json' },
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
		});
	} catch (e) {
		const reason = e instanceof Error && e.name === 'TimeoutError' ? 'Zeitüberschreitung' : 'nicht erreichbar';
		throw new BgbbError(`BGBB Admin unter ${apiUrl} ist ${reason}.`);
	}

	if (!res.ok) {
		let message = '';
		try {
			message = ((await res.json()) as { error?: string }).error ?? '';
		} catch {}
		if (res.status === 401 || res.status === 403) {
			throw new BgbbError(`BGBB Admin hat den API-Key abgelehnt${message ? `: ${message}` : '.'}`);
		}
		throw new BgbbError(`BGBB Admin antwortete mit Fehler ${res.status}${message ? `: ${message}` : ''}.`);
	}

	try {
		return (await res.json()) as T;
	} catch {
		throw new BgbbError('BGBB Admin lieferte keine gültige JSON-Antwort. Stimmt die URL?');
	}
}

export async function fetchBgbbClasses(): Promise<BgbbClass[]> {
	const data = await bgbbGet<{ classes?: Array<{ klasse: string; student_count: number }> }>('/classes');
	return (data.classes ?? [])
		.filter((c) => c.klasse)
		.map((c) => ({ klasse: c.klasse, studentCount: Number(c.student_count) || 0 }))
		.sort((a, b) => a.klasse.localeCompare(b.klasse, 'de', { numeric: true }));
}

/** Schülerliste einer BGBB-Klasse, mit alphabetisch vergebenen Katalognummern. */
export async function fetchBgbbRoster(klasse: string): Promise<RawStudentImport[]> {
	const data = await bgbbGet<{ students?: Array<{ schkz?: string | number | null; vorname?: string; familienname?: string }> }>(
		`/classes/${encodeURIComponent(klasse)}`
	);
	const students = (data.students ?? [])
		.map((s) => ({
			firstName: String(s.vorname ?? '').trim(),
			lastName: String(s.familienname ?? '').trim(),
			schkz: s.schkz != null && String(s.schkz).trim() ? String(s.schkz).trim() : undefined
		}))
		.filter((s) => s.firstName && s.lastName);
	return assignAlphabeticalCatalogNumbers(students);
}
