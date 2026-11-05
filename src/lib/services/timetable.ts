/**
 * Fachlogik für den WebUntis-Stundenplan (ICS-Abo): Termine deuten, Kursen zuordnen,
 * Abgleich mit dem gespeicherten Bestand, Prüfungen und Lücken ermitteln.
 */
import type { ICalEvent } from './ical';

export type TimetableKind = 'lesson' | 'exam' | 'other';
export type ExamType = 'schularbeit' | 'test' | 'wiederholung';

export interface InterpretedSummary {
	kind: TimetableKind;
	classCode: string | null; // z.B. "7b"
	subjectCode: string | null; // z.B. "PH"
	examType: ExamType | null;
	examTitle: string | null; // z.B. "Test PH"
}

const CLASS_TOKEN = /^\d[a-z0-9]{0,5}$/i;

export function mapExamLabel(label: string): ExamType | null {
	const l = label.toLowerCase().replace(/\s+/g, ' ').trim();
	if (l.includes('schularbeit')) return 'schularbeit';
	if (l.includes('wdh') || l.includes('wiederholung')) return 'wiederholung';
	if (l.includes('test')) return 'test';
	return null;
}

/**
 * Deutet SUMMARY eines WebUntis-Termins:
 * - Stunde: "7b PH"
 * - Prüfung: "[Test] 7a PH Test PH", "[Schularbeit] 6a M Schularbeit M", "[schriftliche Wdh.] 6a M …"
 * - alles andere (Sprechstunde, Veranstaltungen mehrerer Klassen) → "other"
 */
export function interpretSummary(summary: string): InterpretedSummary {
	let rest = summary.trim();
	let examLabel: string | null = null;
	const bracket = /^\[([^\]]+)\]\s*/.exec(rest);
	if (bracket) {
		examLabel = bracket[1].trim();
		rest = rest.slice(bracket[0].length);
	}

	const tokens = rest.split(/\s+/).filter(Boolean);
	const other: InterpretedSummary = {
		kind: 'other',
		classCode: null,
		subjectCode: null,
		examType: null,
		examTitle: null
	};
	if (tokens.length < 2 || !CLASS_TOKEN.test(tokens[0]) || !/^[A-Za-zÄÖÜäöü][\wÄÖÜäöü-]*$/.test(tokens[1])) {
		return other;
	}

	const classCode = tokens[0];
	const subjectCode = tokens[1];
	if (examLabel) {
		const title = tokens.slice(2).join(' ').trim() || examLabel;
		return {
			kind: 'exam',
			classCode,
			subjectCode,
			examType: mapExamLabel(examLabel),
			examTitle: title
		};
	}
	return { kind: 'lesson', classCode, subjectCode, examType: null, examTitle: null };
}

/** Gängige Fachkürzel (AHS) → Wortanfänge des Fachnamens, wie er in der App steht. */
const SUBJECT_ALIASES: Record<string, string[]> = {
	M: ['mathematik'],
	AM: ['angewandte mathematik', 'mathematik'],
	PH: ['physik'],
	CH: ['chemie'],
	BIU: ['biologie'],
	BU: ['biologie'],
	BIO: ['biologie'],
	D: ['deutsch'],
	E: ['englisch'],
	L: ['latein'],
	F: ['französisch', 'franzoesisch'],
	SP: ['spanisch'],
	SPA: ['spanisch'],
	I: ['italienisch'],
	IT: ['italienisch'],
	GSP: ['geschichte'],
	GS: ['geschichte'],
	GWB: ['geographie', 'geografie'],
	GW: ['geographie', 'geografie'],
	GWK: ['geographie', 'geografie'],
	INF: ['informatik'],
	INFO: ['informatik'],
	DG: ['darstellende geometrie'],
	GZ: ['geometrisches zeichnen'],
	ME: ['musik'],
	MU: ['musik'],
	BE: ['bildnerische', 'kunst'],
	KUG: ['kunst'],
	PP: ['psychologie', 'philosophie'],
	PUP: ['psychologie', 'philosophie'],
	R: ['religion'],
	RK: ['religion'],
	REV: ['religion'],
	ETH: ['ethik'],
	BSP: ['bewegung', 'sport'],
	BSPM: ['bewegung', 'sport'],
	BSPK: ['bewegung', 'sport'],
	TEW: ['technisches werken', 'werken'],
	TXW: ['textiles werken', 'werken']
};

function normalize(s: string): string {
	return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/** Passt ein WebUntis-Fachkürzel zum Fachnamen eines Kurses? */
export function subjectMatches(courseSubject: string, subjectCode: string): boolean {
	const subject = normalize(courseSubject);
	const code = subjectCode.toUpperCase();
	if (subject === normalize(subjectCode)) return true;
	const aliases = SUBJECT_ALIASES[code] || [];
	return aliases.some((a) => subject.startsWith(normalize(a)));
}

export function sameClass(appClassName: string, classCode: string): boolean {
	return normalize(appClassName).replace(/\s+/g, '') === normalize(classCode);
}

export interface CourseForMatching {
	id: string;
	className: string;
	subject: string;
}

export interface TimetableCombo {
	classCode: string;
	subjectCode: string;
}

/**
 * Schlägt für Kurse ohne Zuordnung eine eindeutige Kombination aus Klasse + Fachkürzel vor.
 * Nur wenn genau eine Kombination passt und sie keinem anderen Kurs schon gehört.
 */
export function suggestCourseLinks(
	courses: CourseForMatching[],
	combos: TimetableCombo[],
	taken: Set<string>
): Map<string, TimetableCombo> {
	const result = new Map<string, TimetableCombo>();
	const used = new Set(taken);
	for (const c of courses) {
		const candidates = combos.filter(
			(x) => !used.has(comboKey(x)) && sameClass(c.className, x.classCode) && subjectMatches(c.subject, x.subjectCode)
		);
		if (candidates.length === 1) {
			result.set(c.id, candidates[0]);
			used.add(comboKey(candidates[0]));
		}
	}
	return result;
}

export function comboKey(c: TimetableCombo): string {
	return `${c.classCode.toLowerCase()}|${c.subjectCode.toUpperCase()}`;
}

// --- URL-Prüfung ---

export type IcsUrlCheck = { ok: true; url: string } | { ok: false; error: string };

/** Nur https-Links auf *.webuntis.com (Schutz vor Server-Side Request Forgery). */
export function validateIcsUrl(input: string): IcsUrlCheck {
	const raw = input.trim();
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return { ok: false, error: 'Das ist kein gültiger Link.' };
	}
	if (url.protocol !== 'https:') {
		return { ok: false, error: 'Der Link muss mit https:// beginnen.' };
	}
	if (url.username || url.password || (url.port && url.port !== '443')) {
		return { ok: false, error: 'Der Link darf keine Zugangsdaten oder Ports enthalten.' };
	}
	const host = url.hostname.toLowerCase();
	if (!host.endsWith('.webuntis.com')) {
		return { ok: false, error: 'Es werden nur Links von WebUntis (…webuntis.com) unterstützt.' };
	}
	return { ok: true, url: url.toString() };
}

// --- Abgleich ---

export interface StoredEvent {
	uid: string;
	date: string;
	startTime: string | null;
	status: 'scheduled' | 'cancelled';
}

export interface ReconcileResult {
	upserts: Array<ICalEvent & { interpreted: InterpretedSummary; status: 'scheduled' | 'cancelled' }>;
	cancelUids: string[];
}

function eventKey(date: string, time: string | null): string {
	return `${date}T${time ?? '00:00'}`;
}

/**
 * Vergleicht den Feed mit dem gespeicherten Bestand.
 * Der Feed enthält keine Vergangenheit: gespeicherte, bereits vergangene Termine bleiben erhalten.
 * Zukünftige Termine innerhalb des Feed-Zeitraums, die im Feed fehlen, gelten als entfallen.
 * Ein leerer Feed storniert nichts (könnte Ferien oder ein Fehler sein).
 */
export function reconcileTimetable(
	stored: StoredEvent[],
	feed: ICalEvent[],
	now: { date: string; time: string }
): ReconcileResult {
	const upserts = feed.map((ev) => ({
		...ev,
		interpreted: interpretSummary(ev.summary),
		status: (ev.status === 'CANCELLED' ? 'cancelled' : 'scheduled') as 'scheduled' | 'cancelled'
	}));

	if (feed.length === 0) return { upserts, cancelUids: [] };

	const feedUids = new Set(feed.map((e) => e.uid));
	let minDate = feed[0].date;
	let maxDate = feed[0].date;
	for (const e of feed) {
		if (e.date < minDate) minDate = e.date;
		if (e.date > maxDate) maxDate = e.date;
	}
	const nowKey = eventKey(now.date, now.time);

	const cancelUids = stored
		.filter(
			(s) =>
				s.status === 'scheduled' &&
				!feedUids.has(s.uid) &&
				s.date >= minDate &&
				s.date <= maxDate &&
				eventKey(s.date, s.startTime) > nowKey
		)
		.map((s) => s.uid);

	return { upserts, cancelUids };
}

// --- Auswertung je Kurs ---

export interface CourseTimetableEvent {
	uid: string;
	date: string;
	startTime: string | null;
	endTime: string | null;
	location: string | null;
	kind: TimetableKind;
	examType: ExamType | null;
	examTitle: string | null;
	status: 'scheduled' | 'cancelled';
	examDismissed: boolean;
}

export interface ExamGroup {
	uid: string; // UID des ersten Termins (für „Ausblenden“)
	uids: string[];
	date: string;
	startTime: string | null;
	endTime: string | null;
	examType: ExamType | null;
	title: string;
	periods: number;
	dismissed: boolean;
}

/** Fasst Prüfungstermine eines Kurses je Tag zusammen (Doppelstunde = eine Schularbeit). */
export function groupExams(events: CourseTimetableEvent[]): ExamGroup[] {
	const groups = new Map<string, ExamGroup>();
	const sorted = events
		.filter((e) => e.kind === 'exam' && e.status === 'scheduled')
		.sort((a, b) => eventKey(a.date, a.startTime).localeCompare(eventKey(b.date, b.startTime)));
	for (const e of sorted) {
		const key = `${e.date}|${e.examType ?? ''}|${e.examTitle ?? ''}`;
		const g = groups.get(key);
		if (g) {
			g.uids.push(e.uid);
			g.endTime = e.endTime;
			g.periods++;
			g.dismissed = g.dismissed || e.examDismissed;
		} else {
			groups.set(key, {
				uid: e.uid,
				uids: [e.uid],
				date: e.date,
				startTime: e.startTime,
				endTime: e.endTime,
				examType: e.examType,
				title: e.examTitle || 'Prüfung',
				periods: 1,
				dismissed: e.examDismissed
			});
		}
	}
	return [...groups.values()];
}

export function hasEnded(e: { date: string; endTime: string | null }, now: { date: string; time: string }): boolean {
	if (e.date !== now.date) return e.date < now.date;
	return (e.endTime ?? '23:59') <= now.time;
}

export interface LessonStats {
	held: number; // gehaltene Stunden (inkl. Prüfungsstunden)
	upcoming: number;
	cancelled: number; // entfallene Stunden (vergangen und künftig)
	trackedSince: string | null; // erster bekannter Termin
	gapDates: string[]; // Tage mit gehaltenem Unterricht, aber ohne Stundeneintrag (neueste zuerst)
}

/**
 * Gehaltene Stunden und Lücken: Ein Tag gilt als erfasst, sobald es für den Kurs an diesem Tag
 * mindestens einen Stundeneintrag gibt. Tage, an denen nur eine Prüfung stattfand, sind keine Lücke.
 */
export function computeLessonStats(
	events: CourseTimetableEvent[],
	lessonEntryDates: Set<string>,
	now: { date: string; time: string }
): LessonStats {
	let held = 0;
	let upcoming = 0;
	let cancelled = 0;
	let trackedSince: string | null = null;
	const lessonDays = new Set<string>();

	for (const e of events) {
		if (e.kind === 'other') continue;
		if (!trackedSince || e.date < trackedSince) trackedSince = e.date;
		if (e.status === 'cancelled') {
			cancelled++;
			continue;
		}
		if (hasEnded(e, now)) {
			held++;
			if (e.kind === 'lesson') lessonDays.add(e.date);
		} else {
			upcoming++;
		}
	}

	const gapDates = [...lessonDays].filter((d) => !lessonEntryDates.has(d)).sort((a, b) => b.localeCompare(a));
	return { held, upcoming, cancelled, trackedSince, gapDates };
}

/**
 * Wählt die Stunde, die gerade läuft, sonst die nächste des Tages (ab 15 Minuten vor Beginn
 * bzw. bis 10 Minuten nach Ende gilt eine Stunde noch als „aktuell“).
 */
export function pickCurrentLesson<T extends { date: string; startTime: string | null; endTime: string | null }>(
	todaysLessons: T[],
	now: { date: string; time: string }
): T | null {
	const toMin = (t: string) => {
		const [h, m] = t.split(':').map(Number);
		return h * 60 + m;
	};
	const nowMin = toMin(now.time);
	const candidates = todaysLessons
		.filter((l) => l.date === now.date && l.startTime && l.endTime)
		.sort((a, b) => a.startTime!.localeCompare(b.startTime!));

	const start = (l: T) => toMin(l.startTime!);
	const end = (l: T) => toMin(l.endTime!);
	return (
		candidates.find((l) => start(l) <= nowMin && nowMin <= end(l)) ??
		candidates.find((l) => start(l) > nowMin && start(l) - 15 <= nowMin) ??
		candidates.find((l) => end(l) < nowMin && nowMin <= end(l) + 10) ??
		candidates.find((l) => start(l) > nowMin) ??
		null
	);
}
