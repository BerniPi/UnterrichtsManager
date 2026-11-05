import { describe, it, expect } from 'vitest';
import { sqlite, initDb } from './index';

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
