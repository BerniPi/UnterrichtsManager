import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, sqlite } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { timetableRepository } from './timetable.repository';
import { reconcileTimetable } from '$lib/services/timetable';
import type { ICalEvent } from '$lib/services/ical';

function feedEvent(uid: string, date: string, summary: string, startTime = '08:00', endTime = '08:50'): ICalEvent {
	return { uid, status: 'CONFIRMED', date, startTime, endTime, endDate: date, summary, location: 'r1', description: null };
}

describe('timetableRepository', () => {
	const syId = crypto.randomUUID();
	const classId = crypto.randomUUID();
	const t1 = crypto.randomUUID();
	const t2 = crypto.randomUUID();
	const course1 = crypto.randomUUID();
	const course2 = crypto.randomUUID();

	beforeAll(() => {
		db.insert(schema.schoolYears)
			.values({
				id: syId,
				name: '2098/99',
				startDate: '2098-09-01',
				endDate: '2099-07-01',
				firstSemesterEnd: '2099-02-01',
				secondSemesterEnd: '2099-07-01',
				gradingDeadline1: '2099-01-20',
				gradingDeadline2: '2099-06-20',
				earlyWarningDeadline1: '2098-12-15',
				earlyWarningDeadline2: '2099-05-15',
				isCurrent: false
			})
			.run();
		db.insert(schema.classes).values({ id: classId, name: '9Z-Test', schoolYearId: syId }).run();
		db.insert(schema.users)
			.values(
				[t1, t2].map((id) => ({
					id,
					username: `tt_${id.slice(0, 8)}`,
					passwordHash: 'h',
					totpEnabled: false,
					createdAt: Date.now(),
					role: 'teacher',
					isActive: true
				}))
			)
			.run();
		db.insert(schema.courses)
			.values([
				{ id: course1, classId, schoolYearId: syId, subject: 'Physik', teacherId: t1 },
				{ id: course2, classId, schoolYearId: syId, subject: 'Physik', teacherId: t2 }
			])
			.run();
	});

	afterAll(() => {
		db.delete(schema.schoolYears).where(eq(schema.schoolYears.id, syId)).run();
		db.delete(schema.users).where(eq(schema.users.id, t1)).run();
		db.delete(schema.users).where(eq(schema.users.id, t2)).run();
	});

	it('speichert Termine je Lehrkraft und ordnet sie nur dem eigenen Kurs zu', () => {
		const feed1 = [
			feedEvent('a-1', '2099-03-02', '9z PH'),
			feedEvent('a-2', '2099-03-09', '[Test] 9z PH Test PH'),
			feedEvent('a-3', '2099-03-16', '9z PH')
		];
		const now = { date: '2099-03-01', time: '12:00' };
		timetableRepository.applyReconcile(t1, reconcileTimetable([], feed1, now), 1);
		timetableRepository.applyReconcile(t2, reconcileTimetable([], [feedEvent('a-1', '2099-03-02', '9z PH')], now), 1);

		timetableRepository.setLink(t1, course1, { classCode: '9Z', subjectCode: 'ph' });
		timetableRepository.setLink(t2, course2, { classCode: '9z', subjectCode: 'PH' });

		const own = timetableRepository.getCourseEvents(course1, t1);
		expect(own.map((e) => e.uid)).toEqual(['a-1', 'a-2', 'a-3']);
		expect(own[1]).toMatchObject({ kind: 'exam', examType: 'test', examDismissed: false });
		expect(timetableRepository.getCourseEvents(course2, t2).map((e) => e.uid)).toEqual(['a-1']);
		// fremder Kurs liefert für diese Lehrkraft nichts
		expect(timetableRepository.getCourseEvents(course2, t1)).toEqual([]);
		expect(timetableRepository.getCombos(t1)).toEqual([
			{ classCode: '9z', subjectCode: 'PH', lessonCount: 2, examCount: 1 }
		]);
	});

	it('übernimmt Änderungen, storniert fehlende Termine und blendet nur eigene Vorschläge aus', () => {
		timetableRepository.dismissExam(t2, ['a-2']);
		expect(timetableRepository.getCourseEvents(course1, t1)[1].examDismissed).toBe(false);
		timetableRepository.dismissExam(t1, ['a-2']);

		const now = { date: '2099-03-01', time: '12:00' };
		const feed = [feedEvent('a-1', '2099-03-02', '9z PH', '09:00', '09:50'), feedEvent('a-2', '2099-03-09', '[Test] 9z PH Test PH')];
		const stored = timetableRepository.getStoredForReconcile(t1);
		timetableRepository.applyReconcile(t1, reconcileTimetable(stored, [...feed, feedEvent('a-9', '2099-03-20', '9z PH')], now), 2);

		const events = timetableRepository.getCourseEvents(course1, t1);
		expect(events.find((e) => e.uid === 'a-1')?.startTime).toBe('09:00');
		expect(events.find((e) => e.uid === 'a-2')?.examDismissed).toBe(true);
		expect(events.find((e) => e.uid === 'a-3')?.status).toBe('cancelled');
	});

	it('speichert den Link je Lehrkraft und entfernt beim Trennen alles', () => {
		timetableRepository.setIcsUrl(t1, 'https://x.webuntis.com/WebUntis/ical_export?token=t1');
		timetableRepository.recordSyncResult(t1, 123, null);
		expect(timetableRepository.getIcsUrl(t2)).toBeNull();
		expect(timetableRepository.getSyncState(t1)).toMatchObject({ configured: true, lastSync: 123, lastError: null });
		expect(timetableRepository.usersWithIcs().some((u) => u.userId === t1 && u.lastSync === 123)).toBe(true);

		timetableRepository.disconnect(t1);
		expect(timetableRepository.getSyncState(t1)).toMatchObject({ configured: false, eventCount: 0 });
		expect(timetableRepository.getLinks(t1)).toEqual([]);
		const remaining = sqlite.prepare('SELECT COUNT(*) as n FROM timetable_events WHERE user_id = ?').get(t2) as { n: number };
		expect(remaining.n).toBe(1);
	});
});
