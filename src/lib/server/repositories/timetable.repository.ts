import { sqlite } from '../db';
import crypto from 'node:crypto';
import type {
	CourseTimetableEvent,
	ExamType,
	ReconcileResult,
	StoredEvent,
	TimetableCombo,
	TimetableKind
} from '$lib/services/timetable';

const KEY_URL = 'webuntis_ics_url';
const KEY_LAST_SYNC = 'webuntis_last_sync';
const KEY_LAST_ERROR = 'webuntis_last_error';

export interface TimetableSyncState {
	configured: boolean;
	lastSync: number | null;
	lastError: string | null;
	eventCount: number;
	firstDate: string | null;
	lastDate: string | null;
}

export interface TimetableComboInfo extends TimetableCombo {
	lessonCount: number;
	examCount: number;
}

export interface TimetableCourseLink {
	courseId: string;
	classCode: string;
	subjectCode: string;
}

export interface LinkedTimetableEvent extends CourseTimetableEvent {
	courseId: string;
}

function getUserSetting(userId: string, key: string): string | null {
	const row = sqlite
		.prepare('SELECT value FROM user_settings WHERE user_id = ? AND key = ?')
		.get(userId, key) as { value: string } | undefined;
	return row?.value ?? null;
}

function setUserSetting(userId: string, key: string, value: string | null): void {
	if (value === null) {
		sqlite.prepare('DELETE FROM user_settings WHERE user_id = ? AND key = ?').run(userId, key);
	} else {
		sqlite
			.prepare(
				`INSERT INTO user_settings (user_id, key, value) VALUES (?, ?, ?)
				 ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`
			)
			.run(userId, key, value);
	}
}

const EVENT_COLUMNS = `
	e.uid,
	e.date,
	e.start_time as startTime,
	e.end_time as endTime,
	e.location,
	e.kind,
	e.exam_type as examType,
	e.exam_title as examTitle,
	e.status,
	e.exam_dismissed as examDismissed
`;

type EventRow = Omit<CourseTimetableEvent, 'examDismissed'> & { examDismissed: number; courseId?: string };

function mapEvent<T extends EventRow>(r: T) {
	return { ...r, examDismissed: r.examDismissed === 1 };
}

export const timetableRepository = {
	/** Der Link enthält ein persönliches Token: nur serverseitig verwenden, nie an den Browser senden. */
	getIcsUrl(userId: string): string | null {
		return getUserSetting(userId, KEY_URL);
	},

	setIcsUrl(userId: string, url: string): void {
		const previous = getUserSetting(userId, KEY_URL);
		setUserSetting(userId, KEY_URL, url);
		if (previous !== url) {
			setUserSetting(userId, KEY_LAST_SYNC, null);
			setUserSetting(userId, KEY_LAST_ERROR, null);
		}
	},

	/** Entfernt Link, abgeglichene Termine und Kurs-Zuordnungen der Lehrkraft. */
	disconnect(userId: string): void {
		sqlite.transaction(() => {
			for (const key of [KEY_URL, KEY_LAST_SYNC, KEY_LAST_ERROR]) setUserSetting(userId, key, null);
			sqlite.prepare('DELETE FROM timetable_events WHERE user_id = ?').run(userId);
			sqlite.prepare('DELETE FROM timetable_course_links WHERE user_id = ?').run(userId);
		})();
	},

	getSyncState(userId: string): TimetableSyncState {
		const lastSync = getUserSetting(userId, KEY_LAST_SYNC);
		const stats = sqlite
			.prepare(
				`SELECT COUNT(*) as count, MIN(date) as firstDate, MAX(date) as lastDate
				 FROM timetable_events WHERE user_id = ?`
			)
			.get(userId) as { count: number; firstDate: string | null; lastDate: string | null };
		return {
			configured: Boolean(getUserSetting(userId, KEY_URL)),
			lastSync: lastSync ? Number(lastSync) : null,
			lastError: getUserSetting(userId, KEY_LAST_ERROR),
			eventCount: stats.count,
			firstDate: stats.firstDate,
			lastDate: stats.lastDate
		};
	},

	recordSyncResult(userId: string, at: number, errorMessage: string | null): void {
		if (errorMessage === null) setUserSetting(userId, KEY_LAST_SYNC, String(at));
		setUserSetting(userId, KEY_LAST_ERROR, errorMessage);
	},

	/** Aktive Lehrkräfte mit hinterlegtem Link und Zeitpunkt des letzten erfolgreichen Abgleichs. */
	usersWithIcs(): Array<{ userId: string; lastSync: number | null }> {
		const rows = sqlite
			.prepare(
				`SELECT us.user_id as userId,
					(SELECT value FROM user_settings x WHERE x.user_id = us.user_id AND x.key = ?) as lastSync
				 FROM user_settings us
				 JOIN users u ON u.id = us.user_id
				 WHERE us.key = ? AND u.is_active = 1 AND u.role IN ('teacher', 'admin')`
			)
			.all(KEY_LAST_SYNC, KEY_URL) as Array<{ userId: string; lastSync: string | null }>;
		return rows.map((r) => ({ userId: r.userId, lastSync: r.lastSync ? Number(r.lastSync) : null }));
	},

	getStoredForReconcile(userId: string): StoredEvent[] {
		return sqlite
			.prepare('SELECT uid, date, start_time as startTime, status FROM timetable_events WHERE user_id = ?')
			.all(userId) as StoredEvent[];
	},

	applyReconcile(userId: string, result: ReconcileResult, at: number): void {
		const upsert = sqlite.prepare(`
			INSERT INTO timetable_events (
				id, user_id, uid, date, start_time, end_time, summary, location, kind,
				class_code, subject_code, exam_type, exam_title, status, exam_dismissed, first_seen, last_seen
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
			ON CONFLICT(user_id, uid) DO UPDATE SET
				date = excluded.date,
				start_time = excluded.start_time,
				end_time = excluded.end_time,
				summary = excluded.summary,
				location = excluded.location,
				kind = excluded.kind,
				class_code = excluded.class_code,
				subject_code = excluded.subject_code,
				exam_type = excluded.exam_type,
				exam_title = excluded.exam_title,
				status = excluded.status,
				last_seen = excluded.last_seen
		`);
		const cancel = sqlite.prepare(
			"UPDATE timetable_events SET status = 'cancelled' WHERE user_id = ? AND uid = ?"
		);

		sqlite.transaction(() => {
			for (const ev of result.upserts) {
				const i = ev.interpreted;
				upsert.run(
					crypto.randomUUID(),
					userId,
					ev.uid,
					ev.date,
					ev.startTime,
					ev.endTime,
					ev.summary,
					ev.location,
					i.kind,
					i.classCode?.toLowerCase() ?? null,
					i.subjectCode?.toUpperCase() ?? null,
					i.examType,
					i.examTitle,
					ev.status,
					at,
					at
				);
			}
			for (const uid of result.cancelUids) cancel.run(userId, uid);
		})();
	},

	getCombos(userId: string): TimetableComboInfo[] {
		return sqlite
			.prepare(
				`SELECT class_code as classCode, subject_code as subjectCode,
					SUM(CASE WHEN kind = 'lesson' THEN 1 ELSE 0 END) as lessonCount,
					SUM(CASE WHEN kind = 'exam' THEN 1 ELSE 0 END) as examCount
				 FROM timetable_events
				 WHERE user_id = ? AND kind IN ('lesson', 'exam') AND class_code IS NOT NULL
				 GROUP BY class_code, subject_code
				 ORDER BY class_code, subject_code`
			)
			.all(userId) as TimetableComboInfo[];
	},

	getLinks(userId: string): TimetableCourseLink[] {
		return sqlite
			.prepare(
				`SELECT course_id as courseId, class_code as classCode, subject_code as subjectCode
				 FROM timetable_course_links WHERE user_id = ?`
			)
			.all(userId) as TimetableCourseLink[];
	},

	/** Ordnet einem eigenen Kurs eine Kombination zu (null = Zuordnung entfernen). */
	setLink(userId: string, courseId: string, combo: TimetableCombo | null): void {
		sqlite.transaction(() => {
			sqlite.prepare('DELETE FROM timetable_course_links WHERE course_id = ?').run(courseId);
			if (!combo) return;
			const classCode = combo.classCode.toLowerCase();
			const subjectCode = combo.subjectCode.toUpperCase();
			// Eine Kombination gehört höchstens einem Kurs
			sqlite
				.prepare('DELETE FROM timetable_course_links WHERE user_id = ? AND class_code = ? AND subject_code = ?')
				.run(userId, classCode, subjectCode);
			sqlite
				.prepare(
					'INSERT INTO timetable_course_links (course_id, user_id, class_code, subject_code) VALUES (?, ?, ?, ?)'
				)
				.run(courseId, userId, classCode, subjectCode);
		})();
	},

	getCourseEvents(courseId: string, userId: string): CourseTimetableEvent[] {
		const rows = sqlite
			.prepare(
				`SELECT ${EVENT_COLUMNS}
				 FROM timetable_events e
				 JOIN timetable_course_links l
				   ON l.user_id = e.user_id AND l.class_code = e.class_code AND l.subject_code = e.subject_code
				 WHERE l.course_id = ? AND e.user_id = ?
				 ORDER BY e.date, e.start_time`
			)
			.all(courseId, userId) as EventRow[];
		return rows.map(mapEvent);
	},

	/** Termine aller zugeordneten Kurse in einem Datumsbereich (inklusive). */
	getLinkedEvents(userId: string, fromDate: string, toDate: string): LinkedTimetableEvent[] {
		const rows = sqlite
			.prepare(
				`SELECT ${EVENT_COLUMNS}, l.course_id as courseId
				 FROM timetable_events e
				 JOIN timetable_course_links l
				   ON l.user_id = e.user_id AND l.class_code = e.class_code AND l.subject_code = e.subject_code
				 WHERE e.user_id = ? AND e.date BETWEEN ? AND ?
				 ORDER BY e.date, e.start_time`
			)
			.all(userId, fromDate, toDate) as Array<EventRow & { courseId: string }>;
		return rows.map(mapEvent);
	},

	/** Blendet einen Prüfungsvorschlag aus (nur eigene Termine). */
	dismissExam(userId: string, uids: string[]): void {
		const stmt = sqlite.prepare('UPDATE timetable_events SET exam_dismissed = 1 WHERE user_id = ? AND uid = ?');
		sqlite.transaction(() => {
			for (const uid of uids) stmt.run(userId, uid);
		})();
	}
};

export type { ExamType, TimetableKind };
