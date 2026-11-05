/**
 * Abgleich des WebUntis-Stundenplans (ICS-Abo) je Lehrkraft.
 * Auslöser: Speichern des Links, Button „Jetzt abgleichen“, Seitenaufruf bei veraltetem Stand
 * (im Hintergrund) und ein stündlicher Timer, der jede Lehrkraft mindestens einmal täglich abgleicht.
 */
import { sqlite } from '../db';
import { timetableRepository } from '../repositories/timetable.repository';
import { parseICalendar, ICalParseError, toVienna } from '$lib/services/ical';
import { reconcileTimetable, suggestCourseLinks, validateIcsUrl, comboKey } from '$lib/services/timetable';

const FETCH_TIMEOUT_MS = 20_000;
const MAX_BYTES = 5 * 1024 * 1024;
/** Beim Öffnen einer Seite wird im Hintergrund abgeglichen, wenn der Stand älter ist. */
export const STALE_ON_VIEW_MS = 6 * 60 * 60 * 1000;
/** Der Timer gleicht ab, wenn der letzte Abgleich älter ist (→ mindestens täglich). */
const STALE_FOR_TIMER_MS = 20 * 60 * 60 * 1000;
const TIMER_INTERVAL_MS = 60 * 60 * 1000;

export class TimetableSyncError extends Error {}

const inFlight = new Map<string, Promise<TimetableSyncOutcome>>();

export interface TimetableSyncOutcome {
	ok: boolean;
	eventCount: number;
	cancelledCount: number;
	linkedCourses: number;
	error?: string;
}

async function fetchIcs(url: string): Promise<string> {
	let res: Response;
	try {
		res = await fetch(url, {
			redirect: 'manual', // keine Weiterleitung auf fremde Hosts
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			headers: { Accept: 'text/calendar' }
		});
	} catch (e) {
		throw new TimetableSyncError(
			e instanceof Error && e.name === 'TimeoutError'
				? 'WebUntis hat nicht rechtzeitig geantwortet.'
				: 'WebUntis ist nicht erreichbar.'
		);
	}
	if (res.status >= 300 && res.status < 400) {
		throw new TimetableSyncError('WebUntis leitet den Link um – ist er noch gültig?');
	}
	if (!res.ok) {
		throw new TimetableSyncError(`WebUntis antwortet mit Fehler ${res.status}. Ist der Link noch gültig?`);
	}
	const length = Number(res.headers.get('content-length') || 0);
	if (length > MAX_BYTES) throw new TimetableSyncError('Der Stundenplan ist ungewöhnlich groß.');

	const reader = res.body?.getReader();
	if (!reader) return '';
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > MAX_BYTES) {
			await reader.cancel();
			throw new TimetableSyncError('Der Stundenplan ist ungewöhnlich groß.');
		}
		chunks.push(value);
	}
	return Buffer.concat(chunks).toString('utf8');
}

/** Ordnet eigene Kurse des aktuellen Schuljahres ohne Zuordnung automatisch zu, wenn eindeutig. */
function autoLinkCourses(userId: string): number {
	const links = timetableRepository.getLinks(userId);
	const linkedCourseIds = new Set(links.map((l) => l.courseId));
	const courses = (
		sqlite
			.prepare(
				`SELECT c.id, cl.name as className, c.subject
				 FROM courses c
				 JOIN classes cl ON cl.id = c.class_id
				 WHERE c.teacher_id = ?
				   AND c.school_year_id = COALESCE(
					 (SELECT id FROM school_years WHERE is_current = 1 LIMIT 1),
					 (SELECT id FROM school_years ORDER BY start_date DESC LIMIT 1)
				   )`
			)
			.all(userId) as Array<{ id: string; className: string; subject: string }>
	).filter((c) => !linkedCourseIds.has(c.id));
	if (courses.length === 0) return 0;

	const taken = new Set(links.map((l) => comboKey(l)));
	const suggestions = suggestCourseLinks(courses, timetableRepository.getCombos(userId), taken);
	for (const [courseId, combo] of suggestions) timetableRepository.setLink(userId, courseId, combo);
	return suggestions.size;
}

async function runSync(userId: string): Promise<TimetableSyncOutcome> {
	const rawUrl = timetableRepository.getIcsUrl(userId);
	if (!rawUrl) return { ok: false, eventCount: 0, cancelledCount: 0, linkedCourses: 0, error: 'Kein Link hinterlegt.' };

	const at = Date.now();
	try {
		const check = validateIcsUrl(rawUrl);
		if (!check.ok) throw new TimetableSyncError(check.error);

		const text = await fetchIcs(check.url);
		const feed = parseICalendar(text);
		const now = toVienna(new Date(at));
		const result = reconcileTimetable(timetableRepository.getStoredForReconcile(userId), feed, now);
		timetableRepository.applyReconcile(userId, result, at);
		const linkedCourses = autoLinkCourses(userId);
		timetableRepository.recordSyncResult(userId, at, null);
		return { ok: true, eventCount: feed.length, cancelledCount: result.cancelUids.length, linkedCourses };
	} catch (e) {
		const message =
			e instanceof TimetableSyncError || e instanceof ICalParseError
				? e.message
				: 'Unerwarteter Fehler beim Abgleich.';
		if (!(e instanceof TimetableSyncError || e instanceof ICalParseError)) {
			console.error('[WebUntis] Abgleich fehlgeschlagen', e);
		}
		timetableRepository.recordSyncResult(userId, at, message);
		return { ok: false, eventCount: 0, cancelledCount: 0, linkedCourses: 0, error: message };
	}
}

/** Gleicht ab; läuft für dieselbe Lehrkraft schon ein Abgleich, wird dessen Ergebnis geteilt. */
export function syncTimetable(userId: string): Promise<TimetableSyncOutcome> {
	const running = inFlight.get(userId);
	if (running) return running;
	const p = runSync(userId).finally(() => inFlight.delete(userId));
	inFlight.set(userId, p);
	return p;
}

/** Startet einen Hintergrund-Abgleich, wenn ein Link hinterlegt und der Stand veraltet ist. */
export function syncTimetableIfStale(userId: string, maxAgeMs = STALE_ON_VIEW_MS): void {
	const state = timetableRepository.getSyncState(userId);
	if (!state.configured || inFlight.has(userId)) return;
	if (state.lastSync && Date.now() - state.lastSync < maxAgeMs) return;
	void syncTimetable(userId);
}

const TIMER_KEY = Symbol.for('notenmanager.timetableTimer');

/** Stündlicher Timer im Server: gleicht jede Lehrkraft ab, deren letzter Abgleich > 20 h her ist. */
export function startTimetableScheduler(): void {
	const g = globalThis as unknown as Record<symbol, NodeJS.Timeout | undefined>;
	if (g[TIMER_KEY]) return;

	const tick = async () => {
		for (const { userId, lastSync } of timetableRepository.usersWithIcs()) {
			if (lastSync && Date.now() - lastSync < STALE_FOR_TIMER_MS) continue;
			await syncTimetable(userId);
		}
	};
	const safeTick = () => tick().catch((e) => console.error('[WebUntis] Timer-Abgleich fehlgeschlagen', e));

	const first = setTimeout(safeTick, 60_000);
	first.unref?.();
	const timer = setInterval(safeTick, TIMER_INTERVAL_MS);
	timer.unref?.();
	g[TIMER_KEY] = timer;
}
