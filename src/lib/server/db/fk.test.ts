import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { sqlite, initDb, migrateOwnerForeignKeys } from './index';

describe('Database Schema & Foreign Key Constraints', () => {
	it('ensures courses.teacher_id and notes.author_id use ON DELETE SET NULL', () => {
		initDb();

		const coursesFk = sqlite.prepare('PRAGMA foreign_key_list(courses)').all() as Array<{
			from: string;
			table: string;
			on_delete: string;
		}>;
		const teacherFk = coursesFk.find((f) => f.from === 'teacher_id' && f.table === 'users');
		expect(teacherFk).toBeDefined();
		expect(teacherFk?.on_delete.toUpperCase()).toBe('SET NULL');

		const notesFk = sqlite.prepare('PRAGMA foreign_key_list(notes)').all() as Array<{
			from: string;
			table: string;
			on_delete: string;
		}>;
		const authorFk = notesFk.find((f) => f.from === 'author_id' && f.table === 'users');
		expect(authorFk).toBeDefined();
		expect(authorFk?.on_delete.toUpperCase()).toBe('SET NULL');

		// Ensure push_subscriptions and grading_scale_templates use ON DELETE CASCADE
		const pushFk = sqlite.prepare('PRAGMA foreign_key_list(push_subscriptions)').all() as Array<{
			from: string;
			table: string;
			on_delete: string;
		}>;
		const pushUserFk = pushFk.find((f) => f.from === 'user_id' && f.table === 'users');
		expect(pushUserFk).toBeDefined();
		expect(pushUserFk?.on_delete.toUpperCase()).toBe('CASCADE');

		const templatesFk = sqlite.prepare('PRAGMA foreign_key_list(grading_scale_templates)').all() as Array<{
			from: string;
			table: string;
			on_delete: string;
		}>;
		const templatesUserFk = templatesFk.find((f) => f.from === 'user_id' && f.table === 'users');
		expect(templatesUserFk).toBeDefined();
		expect(templatesUserFk?.on_delete.toUpperCase()).toBe('CASCADE');
	});
});

describe('migrateOwnerForeignKeys (bestehende DBs mit ON DELETE CASCADE)', () => {
	function createLegacyDb(options: { brokenCourses?: boolean } = {}) {
		const conn = new Database(':memory:');
		conn.pragma('foreign_keys = ON');
		conn.exec(`
			CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL);
			CREATE TABLE school_years (id TEXT PRIMARY KEY);
			CREATE TABLE classes (id TEXT PRIMARY KEY, school_year_id TEXT NOT NULL REFERENCES school_years(id) ON DELETE CASCADE);
			CREATE TABLE students (id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE);
			CREATE TABLE courses (
				id TEXT PRIMARY KEY,
				class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
				school_year_id TEXT NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
				subject TEXT NOT NULL,
				weight_schularbeiten REAL NOT NULL DEFAULT 40,
				weight_tests REAL NOT NULL DEFAULT 20,
				weight_participation REAL NOT NULL DEFAULT 25,
				weight_observations REAL NOT NULL DEFAULT 10,
				${options.brokenCourses ? '' : 'weight_homework REAL NOT NULL DEFAULT 5,'}
				teacher_id TEXT REFERENCES users(id) ON DELETE CASCADE
			);
			CREATE TABLE assessments (id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE);
			CREATE TABLE notes (
				id TEXT PRIMARY KEY,
				student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
				course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
				date TEXT NOT NULL,
				category TEXT NOT NULL,
				title TEXT NOT NULL,
				content TEXT NOT NULL,
				author_id TEXT REFERENCES users(id) ON DELETE CASCADE
			);
			INSERT INTO users VALUES ('u1', 'lehrer'), ('u2', 'lehrer2');
			INSERT INTO school_years VALUES ('sy');
			INSERT INTO classes VALUES ('c', 'sy');
			INSERT INTO students VALUES ('s', 'c');
			INSERT INTO courses (id, class_id, school_year_id, subject, teacher_id) VALUES ('k1', 'c', 'sy', 'Mathematik', 'u1'), ('k2', 'c', 'sy', 'Physik', 'u2');
			INSERT INTO assessments VALUES ('a1', 'k2');
			INSERT INTO notes VALUES ('n1', 's', 'k2', '2026-11-05', 'allgemein', 'T', 'I', 'u2');
		`);
		return conn;
	}

	const onDelete = (conn: InstanceType<typeof Database>, table: string, column: string) =>
		(
			conn.prepare(`PRAGMA foreign_key_list(${table})`).all() as Array<{ from: string; on_delete: string }>
		).find((f) => f.from === column)?.on_delete.toUpperCase();

	it('baut courses und notes auf SET NULL um, ohne Daten zu verlieren', () => {
		const conn = createLegacyDb();
		migrateOwnerForeignKeys(conn);

		expect(onDelete(conn, 'courses', 'teacher_id')).toBe('SET NULL');
		expect(onDelete(conn, 'notes', 'author_id')).toBe('SET NULL');
		expect(conn.prepare('SELECT COUNT(*) AS n FROM courses').get()).toEqual({ n: 2 });
		expect(conn.pragma('foreign_key_check')).toEqual([]);
		expect(conn.pragma('foreign_keys', { simple: true })).toBe(1);

		// Löschen eines Lehrers behält Kurs, Test und Notiz
		conn.prepare("DELETE FROM users WHERE id = 'u2'").run();
		expect(conn.prepare("SELECT teacher_id FROM courses WHERE id = 'k2'").get()).toEqual({ teacher_id: null });
		expect(conn.prepare('SELECT COUNT(*) AS n FROM assessments').get()).toEqual({ n: 1 });
		expect(conn.prepare("SELECT author_id FROM notes WHERE id = 'n1'").get()).toEqual({ author_id: null });
	});

	it('rollt bei einem Fehler zurück und hinterlässt keine offene Transaktion', () => {
		const conn = createLegacyDb({ brokenCourses: true });
		migrateOwnerForeignKeys(conn);

		expect(conn.inTransaction).toBe(false);
		expect(onDelete(conn, 'courses', 'teacher_id')).toBe('CASCADE');
		expect(conn.prepare('SELECT COUNT(*) AS n FROM courses').get()).toEqual({ n: 2 });
		expect(
			conn.prepare("SELECT name FROM sqlite_master WHERE name = 'courses_new'").get()
		).toBeUndefined();
		expect(conn.pragma('foreign_keys', { simple: true })).toBe(1);
		// notes wird unabhängig davon trotzdem migriert
		expect(onDelete(conn, 'notes', 'author_id')).toBe('SET NULL');
	});
});
