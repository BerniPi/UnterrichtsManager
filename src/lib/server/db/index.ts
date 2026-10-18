import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_TEMPLATES } from '../../services/grading';

const dbPath = process.env.DATABASE_URL || path.resolve(process.cwd(), 'data', 'notenmanager.db');

// Ensure parent directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
	fs.mkdirSync(dbDir, { recursive: true });
}

export const sqlite = new Database(dbPath);

// Enable WAL mode & foreign keys for performance and data integrity
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

/**
 * Initializes database tables if not already created.
 * This guarantees zero-friction deployment and testing.
 */
export function initDb() {
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			totp_secret TEXT,
			totp_enabled INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS school_years (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			start_date TEXT NOT NULL,
			end_date TEXT NOT NULL,
			first_semester_end TEXT NOT NULL,
			second_semester_end TEXT NOT NULL,
			grading_deadline_1 TEXT NOT NULL,
			grading_deadline_2 TEXT NOT NULL,
			early_warning_deadline_1 TEXT NOT NULL,
			early_warning_deadline_2 TEXT NOT NULL,
			is_current INTEGER NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS classes (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			school_year_id TEXT NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
			room TEXT
		);

		CREATE TABLE IF NOT EXISTS students (
			id TEXT PRIMARY KEY,
			class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
			first_name TEXT NOT NULL,
			last_name TEXT NOT NULL,
			webuntis_id TEXT,
			catalog_number INTEGER,
			status TEXT NOT NULL DEFAULT 'active',
			notes TEXT
		);

		CREATE TABLE IF NOT EXISTS courses (
			id TEXT PRIMARY KEY,
			class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
			school_year_id TEXT NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
			subject TEXT NOT NULL,
			weight_schularbeiten REAL NOT NULL DEFAULT 40,
			weight_tests REAL NOT NULL DEFAULT 20,
			weight_participation REAL NOT NULL DEFAULT 25,
			weight_observations REAL NOT NULL DEFAULT 10,
			weight_homework REAL NOT NULL DEFAULT 5
		);

		CREATE TABLE IF NOT EXISTS participation_entries (
			id TEXT PRIMARY KEY,
			course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
			student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
			date TEXT NOT NULL,
			week_number INTEGER NOT NULL,
			year INTEGER NOT NULL,
			value TEXT NOT NULL,
			comment TEXT,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS observations (
			id TEXT PRIMARY KEY,
			course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
			title TEXT NOT NULL,
			date TEXT NOT NULL,
			max_points REAL NOT NULL,
			description TEXT
		);

		CREATE TABLE IF NOT EXISTS observation_scores (
			id TEXT PRIMARY KEY,
			observation_id TEXT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
			student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
			points REAL NOT NULL,
			note TEXT
		);

		CREATE TABLE IF NOT EXISTS assessments (
			id TEXT PRIMARY KEY,
			course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
			title TEXT NOT NULL,
			type TEXT NOT NULL,
			date TEXT NOT NULL,
			max_points REAL NOT NULL,
			grading_scale TEXT NOT NULL,
			is_counted INTEGER NOT NULL DEFAULT 1
		);

		CREATE TABLE IF NOT EXISTS assessment_results (
			id TEXT PRIMARY KEY,
			assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
			student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
			points REAL,
			grade INTEGER,
			is_absent INTEGER NOT NULL DEFAULT 0,
			is_made_up INTEGER NOT NULL DEFAULT 0,
			note TEXT
		);

		CREATE TABLE IF NOT EXISTS assessment_returns (
			id TEXT PRIMARY KEY,
			assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
			student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
			returned_date TEXT,
			due_date TEXT NOT NULL,
			is_signed INTEGER NOT NULL DEFAULT 0,
			signed_date TEXT,
			snoozed_until TEXT
		);

		CREATE TABLE IF NOT EXISTS early_warnings (
			id TEXT PRIMARY KEY,
			student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
			course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
			semester INTEGER NOT NULL DEFAULT 1,
			issued_date TEXT NOT NULL,
			reason TEXT NOT NULL,
			due_date TEXT NOT NULL,
			is_signed INTEGER NOT NULL DEFAULT 0,
			signed_date TEXT,
			snoozed_until TEXT,
			status TEXT NOT NULL DEFAULT 'issued'
		);

		CREATE TABLE IF NOT EXISTS reminder_logs (
			id TEXT PRIMARY KEY,
			entity_type TEXT NOT NULL,
			entity_id TEXT NOT NULL,
			date TEXT NOT NULL,
			type TEXT NOT NULL,
			note TEXT
		);

		CREATE TABLE IF NOT EXISTS push_subscriptions (
			id TEXT PRIMARY KEY,
			endpoint TEXT NOT NULL UNIQUE,
			p256dh TEXT NOT NULL,
			auth TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			user_agent TEXT
		);

		CREATE TABLE IF NOT EXISTS homeworks (
			id TEXT PRIMARY KEY,
			course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
			title TEXT NOT NULL,
			due_date TEXT NOT NULL,
			description TEXT
		);

		CREATE TABLE IF NOT EXISTS homework_statuses (
			id TEXT PRIMARY KEY,
			homework_id TEXT NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
			student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
			status TEXT NOT NULL DEFAULT 'done',
			note TEXT
		);

		CREATE TABLE IF NOT EXISTS notes (
			id TEXT PRIMARY KEY,
			student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
			course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
			date TEXT NOT NULL,
			category TEXT NOT NULL,
			title TEXT NOT NULL,
			content TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS course_final_grades (
			id TEXT PRIMARY KEY,
			course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
			student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
			semester INTEGER NOT NULL DEFAULT 1,
			suggested_grade REAL,
			manual_grade INTEGER,
			note TEXT
		);

		CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS grading_scale_templates (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			scale_json TEXT NOT NULL,
			is_default INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL
		);
	`);

	// Auto-seed default templates if none exist
	try {
		const countRow = sqlite
			.prepare('SELECT COUNT(*) as count FROM grading_scale_templates')
			.get() as { count: number } | undefined;

		if (!countRow || countRow.count === 0) {
			const insertStmt = sqlite.prepare(`
				INSERT INTO grading_scale_templates (id, name, description, scale_json, is_default, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`);

			for (const t of DEFAULT_TEMPLATES) {
				insertStmt.run(
					t.id,
					t.name,
					t.description || null,
					JSON.stringify(t.scale),
					t.isDefault ? 1 : 0,
					Date.now()
				);
			}
		}
	} catch (e) {
		// Table might not exist or error during migration
	}
}

// Auto-initialize tables
initDb();
