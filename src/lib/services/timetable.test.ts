import { describe, it, expect } from 'vitest';
import { parseICalendar, ICalParseError, toVienna } from './ical';
import {
	interpretSummary,
	subjectMatches,
	sameClass,
	suggestCourseLinks,
	validateIcsUrl,
	reconcileTimetable,
	groupExams,
	computeLessonStats,
	pickCurrentLesson,
	type CourseTimetableEvent
} from './timetable';

// Gekürzter, anonymisierter Aufbau eines WebUntis-Exports (fiktive Kürzel)
const SAMPLE = [
	'BEGIN:VCALENDAR',
	'PRODID:-//Ben Fortuna//iCal4j 1.0//EN',
	'VERSION:2.0',
	'BEGIN:VTIMEZONE',
	'TZID:Europe/Vienna',
	'BEGIN:STANDARD',
	'DTSTART:19961027T030000',
	'END:STANDARD',
	'END:VTIMEZONE',
	'BEGIN:VEVENT',
	'DTSTAMP:20261105T202117Z',
	'UID:1001-2001',
	'STATUS:CONFIRMED',
	'DTSTART;TZID=Europe/Vienna:20261103T095500',
	'DTEND;TZID=Europe/Vienna:20261103T104500',
	'SUMMARY:7b PH',
	'LOCATION:ph1',
	'DESCRIPTION:abcd',
	'END:VEVENT',
	'BEGIN:VEVENT',
	'UID:1002-2002',
	'STATUS:CONFIRMED',
	'DTSTART;TZID=Europe/Vienna:20261113T095500',
	'DTEND;TZID=Europe/Vienna:20261113T104500',
	'SUMMARY:[Test] 7a PH Test PH',
	'LOCATION:ph1',
	'DESCRIPTION:[PH] abcd',
	'END:VEVENT',
	'BEGIN:VEVENT',
	'UID:3000-4000',
	'STATUS:CONFIRMED',
	'DTSTART;TZID=Europe/Vienna:20261209T080000',
	'DTEND;TZID=Europe/Vienna:20261209T180500',
	'SUMMARY:8a\\; 8b\\; 8c Besichtigung',
	'DESCRIPTION:abcd\\; efgh',
	'END:VEVENT',
	'BEGIN:VEVENT',
	'UID:5000-1',
	'STATUS:CANCELLED',
	'DTSTART:20261110T070000Z',
	'DTEND:20261110T075000Z',
	'SUMMARY:6a M',
	'LOCATION:20',
	' 5',
	'END:VEVENT',
	'END:VCALENDAR',
	''
].join('\r\n');

describe('parseICalendar', () => {
	it('liest WebUntis-Termine mit Ortszeit, Escapes und Zeilenumbrüchen', () => {
		const events = parseICalendar(SAMPLE);
		expect(events).toHaveLength(4);
		expect(events[0]).toEqual({
			uid: '1001-2001',
			status: 'CONFIRMED',
			date: '2026-11-03',
			startTime: '09:55',
			endTime: '10:45',
			endDate: '2026-11-03',
			summary: '7b PH',
			location: 'ph1',
			description: 'abcd'
		});
		expect(events[2].summary).toBe('8a; 8b; 8c Besichtigung');
		// UTC wird nach Wien umgerechnet (MEZ = UTC+1), gefaltete Zeile wird zusammengesetzt
		expect(events[3]).toMatchObject({ status: 'CANCELLED', startTime: '08:00', endTime: '08:50', location: '205' });
	});

	it('lehnt Antworten ohne VCALENDAR ab (z. B. HTML-Fehlerseite)', () => {
		expect(() => parseICalendar('<html>Login</html>')).toThrow(ICalParseError);
	});

	it('rechnet Sommerzeit korrekt um', () => {
		expect(toVienna(new Date('2026-06-01T06:00:00Z'))).toEqual({ date: '2026-06-01', time: '08:00' });
	});
});

describe('interpretSummary', () => {
	it('erkennt Stunden', () => {
		expect(interpretSummary('7b PH')).toMatchObject({ kind: 'lesson', classCode: '7b', subjectCode: 'PH' });
	});

	it('erkennt Prüfungen und ihren Typ', () => {
		expect(interpretSummary('[Test] 7a PH Test PH')).toMatchObject({
			kind: 'exam',
			classCode: '7a',
			subjectCode: 'PH',
			examType: 'test',
			examTitle: 'Test PH'
		});
		expect(interpretSummary('[Schularbeit] 6a M Schularbeit M').examType).toBe('schularbeit');
		expect(interpretSummary('[schriftliche Wdh.] 6a M schriftliche Wdh. M').examType).toBe('wiederholung');
		expect(interpretSummary('[Prüfung] 6a M').examType).toBeNull();
	});

	it('ordnet Sprechstunden und Veranstaltungen keinem Kurs zu', () => {
		expect(interpretSummary('S Sprechstunde').kind).toBe('other');
		expect(interpretSummary('8a; 8b; 8c Besichtigung Kernkraftwerk').kind).toBe('other');
	});
});

describe('Kurs-Zuordnung', () => {
	it('vergleicht Fächer und Klassen tolerant', () => {
		expect(subjectMatches('Mathematik', 'M')).toBe(true);
		expect(subjectMatches('Physik', 'PH')).toBe(true);
		expect(subjectMatches('Physik', 'M')).toBe(false);
		expect(subjectMatches('Biologie und Umweltbildung', 'BIU')).toBe(true);
		expect(subjectMatches('Werken', 'werken')).toBe(true);
		expect(sameClass('3B', '3b')).toBe(true);
		expect(sameClass('3B', '3a')).toBe(false);
	});

	it('schlägt nur eindeutige, freie Kombinationen vor', () => {
		const courses = [
			{ id: 'c1', className: '7B', subject: 'Physik' },
			{ id: 'c2', className: '6A', subject: 'Mathematik' },
			{ id: 'c3', className: '8A', subject: 'Chemie' }
		];
		const combos = [
			{ classCode: '7b', subjectCode: 'PH' },
			{ classCode: '6a', subjectCode: 'M' },
			{ classCode: '8a', subjectCode: 'PH' }
		];
		const result = suggestCourseLinks(courses, combos, new Set(['6a|M']));
		expect([...result.entries()]).toEqual([['c1', { classCode: '7b', subjectCode: 'PH' }]]);
	});
});

describe('validateIcsUrl', () => {
	it('akzeptiert WebUntis-Links', () => {
		const r = validateIcsUrl(' https://schule.webuntis.com/WebUntis/ical_export?school=x&token=abc ');
		expect(r.ok).toBe(true);
	});

	it('lehnt fremde Hosts, http und Zugangsdaten ab', () => {
		expect(validateIcsUrl('http://schule.webuntis.com/x').ok).toBe(false);
		expect(validateIcsUrl('https://webuntis.com.evil.at/x').ok).toBe(false);
		expect(validateIcsUrl('https://evilwebuntis.com/x').ok).toBe(false);
		expect(validateIcsUrl('https://a:b@schule.webuntis.com/x').ok).toBe(false);
		expect(validateIcsUrl('https://schule.webuntis.com:8080/x').ok).toBe(false);
		expect(validateIcsUrl('kein link').ok).toBe(false);
	});
});

describe('reconcileTimetable', () => {
	const feed = parseICalendar(SAMPLE);
	const now = { date: '2026-11-05', time: '12:00' };

	it('markiert fehlende künftige Termine im Feed-Zeitraum als entfallen, Vergangenes bleibt', () => {
		const stored = [
			{ uid: 'past', date: '2026-11-04', startTime: '08:00', status: 'scheduled' as const },
			{ uid: 'future', date: '2026-11-20', startTime: '08:00', status: 'scheduled' as const },
			{ uid: 'beyond', date: '2027-06-01', startTime: '08:00', status: 'scheduled' as const },
			{ uid: '1001-2001', date: '2026-11-03', startTime: '09:55', status: 'scheduled' as const }
		];
		const result = reconcileTimetable(stored, feed, now);
		expect(result.cancelUids).toEqual(['future']);
		expect(result.upserts.find((u) => u.uid === '5000-1')?.status).toBe('cancelled');
		expect(result.upserts.find((u) => u.uid === '1002-2002')?.interpreted.kind).toBe('exam');
	});

	it('storniert bei leerem Feed nichts', () => {
		const stored = [{ uid: 'future', date: '2026-11-20', startTime: '08:00', status: 'scheduled' as const }];
		expect(reconcileTimetable(stored, [], now).cancelUids).toEqual([]);
	});
});

function ev(partial: Partial<CourseTimetableEvent>): CourseTimetableEvent {
	return {
		uid: Math.random().toString(),
		date: '2026-11-03',
		startTime: '08:00',
		endTime: '08:50',
		location: null,
		kind: 'lesson',
		examType: null,
		examTitle: null,
		status: 'scheduled',
		examDismissed: false,
		...partial
	};
}

describe('groupExams', () => {
	it('fasst eine Doppelstunden-Schularbeit zusammen', () => {
		const groups = groupExams([
			ev({ uid: 'b', kind: 'exam', examType: 'schularbeit', examTitle: 'Schularbeit M', startTime: '09:55', endTime: '10:45', date: '2026-11-23' }),
			ev({ uid: 'a', kind: 'exam', examType: 'schularbeit', examTitle: 'Schularbeit M', startTime: '08:55', endTime: '09:45', date: '2026-11-23' }),
			ev({ uid: 'c', kind: 'exam', examType: 'test', examTitle: 'Test', date: '2026-12-01' }),
			ev({ uid: 'd', kind: 'exam', examType: 'test', status: 'cancelled', date: '2026-12-02' }),
			ev({ uid: 'e' })
		]);
		expect(groups).toHaveLength(2);
		expect(groups[0]).toMatchObject({ uid: 'a', uids: ['a', 'b'], startTime: '08:55', endTime: '10:45', periods: 2 });
		expect(groups[1]).toMatchObject({ uid: 'c', examType: 'test' });
	});
});

describe('computeLessonStats', () => {
	it('zählt gehaltene Stunden und findet Tage ohne Eintrag', () => {
		const now = { date: '2026-11-05', time: '09:00' };
		const stats = computeLessonStats(
			[
				ev({ date: '2026-11-03' }),
				ev({ date: '2026-11-03', startTime: '08:55', endTime: '09:45' }),
				ev({ date: '2026-11-04' }),
				ev({ date: '2026-11-05', startTime: '08:00', endTime: '08:50' }),
				ev({ date: '2026-11-05', startTime: '09:55', endTime: '10:45' }),
				ev({ date: '2026-11-02', kind: 'exam' }),
				ev({ date: '2026-11-06', status: 'cancelled' }),
				ev({ date: '2026-11-01', kind: 'other' })
			],
			new Set(['2026-11-04']),
			now
		);
		expect(stats).toEqual({
			held: 5,
			upcoming: 1,
			cancelled: 1,
			trackedSince: '2026-11-02',
			gapDates: ['2026-11-05', '2026-11-03']
		});
	});
});

describe('pickCurrentLesson', () => {
	const today = [
		ev({ uid: '1', date: '2026-11-05', startTime: '08:00', endTime: '08:50' }),
		ev({ uid: '2', date: '2026-11-05', startTime: '08:55', endTime: '09:45' }),
		ev({ uid: '3', date: '2026-11-05', startTime: '13:45', endTime: '14:35' })
	];
	const at = (time: string) => pickCurrentLesson(today, { date: '2026-11-05', time })?.uid ?? null;

	it('wählt laufende, bald beginnende oder nächste Stunde', () => {
		expect(at('08:20')).toBe('1');
		expect(at('08:52')).toBe('2'); // Pause: die nächste Stunde hat Vorrang
		expect(at('09:50')).toBe('2'); // knapp nach Ende: noch die eben beendete Stunde
		expect(at('10:00')).toBe('3');
		expect(at('07:50')).toBe('1');
		expect(at('15:00')).toBeNull();
	});
});
