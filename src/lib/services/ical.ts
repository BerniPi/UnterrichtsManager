/**
 * Minimaler iCalendar-Parser (RFC 5545) für den Stundenplan-Export von WebUntis.
 * Unterstützt nur, was WebUntis liefert: einzelne VEVENTs ohne Wiederholungsregeln,
 * Zeiten mit TZID (Europe/Vienna), in UTC (…Z) oder als ganztägiges Datum.
 */

export interface ICalEvent {
	uid: string;
	status: string | null; // z.B. CONFIRMED, CANCELLED
	date: string; // YYYY-MM-DD (Wiener Ortszeit)
	startTime: string | null; // HH:MM (Wiener Ortszeit), null bei ganztägigen Terminen
	endTime: string | null;
	endDate: string; // YYYY-MM-DD
	summary: string;
	location: string | null;
	description: string | null;
}

export class ICalParseError extends Error {}

/** Entfaltet umgebrochene Zeilen (CRLF + Leerzeichen/Tab). */
function unfold(text: string): string[] {
	return text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

export function unescapeText(value: string): string {
	return value.replace(/\\([\\;,nN])/g, (_, ch: string) => (ch === 'n' || ch === 'N' ? '\n' : ch));
}

interface ParsedLine {
	name: string;
	params: Record<string, string>;
	value: string;
}

function parseLine(line: string): ParsedLine | null {
	// Name und Parameter enden am ersten Doppelpunkt außerhalb von Anführungszeichen
	let inQuotes = false;
	let colon = -1;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') inQuotes = !inQuotes;
		else if (ch === ':' && !inQuotes) {
			colon = i;
			break;
		}
	}
	if (colon < 0) return null;
	const head = line.slice(0, colon);
	const value = line.slice(colon + 1);
	const [rawName, ...rawParams] = head.split(';');
	const params: Record<string, string> = {};
	for (const p of rawParams) {
		const eq = p.indexOf('=');
		if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
	}
	return { name: rawName.toUpperCase(), params, value };
}

const viennaFormatter = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'Europe/Vienna',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

/** Wandelt einen UTC-Zeitpunkt in Wiener Datum + Uhrzeit um. */
export function toVienna(d: Date): { date: string; time: string } {
	const parts = Object.fromEntries(viennaFormatter.formatToParts(d).map((p) => [p.type, p.value]));
	return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/**
 * Liest einen DATE-TIME/DATE-Wert. Lokale Zeiten (mit TZID oder ohne Zone) werden als Wiener
 * Ortszeit übernommen; WebUntis exportiert ausschließlich Europe/Vienna.
 */
function parseDateValue(value: string, params: Record<string, string>): { date: string; time: string | null } {
	const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
	if (!m) throw new ICalParseError(`Ungültiges Datum: ${value}`);
	const [, y, mo, d, h, mi, s, z] = m;
	if (h === undefined || params.VALUE === 'DATE') {
		return { date: `${y}-${mo}-${d}`, time: null };
	}
	if (z) {
		return toVienna(new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0))));
	}
	return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
}

export function parseICalendar(text: string): ICalEvent[] {
	const lines = unfold(text);
	const first = lines.find((l) => l.trim() !== '');
	if (!first || first.trim().toUpperCase() !== 'BEGIN:VCALENDAR') {
		throw new ICalParseError('Die Antwort ist kein iCalendar (BEGIN:VCALENDAR fehlt).');
	}

	const events: ICalEvent[] = [];
	let current: Map<string, ParsedLine> | null = null;
	let depth = 0; // verschachtelte Komponenten innerhalb eines VEVENT (z.B. VALARM)

	for (const raw of lines) {
		if (!raw) continue;
		const line = parseLine(raw);
		if (!line) continue;

		if (line.name === 'BEGIN') {
			if (line.value.toUpperCase() === 'VEVENT' && !current) {
				current = new Map();
				depth = 0;
			} else if (current) {
				depth++;
			}
			continue;
		}
		if (line.name === 'END') {
			if (!current) continue;
			if (depth > 0) {
				depth--;
				continue;
			}
			if (line.value.toUpperCase() === 'VEVENT') {
				const ev = buildEvent(current);
				if (ev) events.push(ev);
				current = null;
			}
			continue;
		}
		if (current && depth === 0 && !current.has(line.name)) {
			current.set(line.name, line);
		}
	}

	return events;
}

function buildEvent(props: Map<string, ParsedLine>): ICalEvent | null {
	const uid = props.get('UID')?.value.trim();
	const dtstart = props.get('DTSTART');
	if (!uid || !dtstart) return null;

	const start = parseDateValue(dtstart.value, dtstart.params);
	const dtend = props.get('DTEND');
	const end = dtend ? parseDateValue(dtend.value, dtend.params) : start;

	const text = (name: string) => {
		const v = props.get(name)?.value;
		return v === undefined ? null : unescapeText(v).trim();
	};

	return {
		uid,
		status: props.get('STATUS')?.value.trim().toUpperCase() || null,
		date: start.date,
		startTime: start.time,
		endTime: end.time,
		endDate: end.date,
		summary: text('SUMMARY') || '',
		location: text('LOCATION') || null,
		description: text('DESCRIPTION') || null
	};
}
