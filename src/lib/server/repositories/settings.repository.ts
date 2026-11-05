import { db, sqlite } from '../db';
import * as schema from '../db/schema';
import { eq, sql } from 'drizzle-orm';

export interface AppSettings {
	teacherName: string;
	defaultReturnDays: number;
	earlyWarningThreshold: number;
	emailSummaryEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
	teacherName: 'Prof. Mag. Bernhard',
	defaultReturnDays: 7,
	earlyWarningThreshold: 4.5,
	emailSummaryEnabled: false
};

export const settingsRepository = {
	getAll(userId?: string): AppSettings {
		const rows = sqlite.prepare('SELECT key, value FROM settings').all() as Array<{
			key: string;
			value: string;
		}>;
		const map = new Map(rows.map((r) => [r.key, r.value]));

		if (userId) {
			const userRows = sqlite
				.prepare('SELECT key, value FROM user_settings WHERE user_id = ?')
				.all(userId) as Array<{ key: string; value: string }>;

			for (const r of userRows) {
				map.set(r.key, r.value);
			}

			if (!userRows.some((r) => r.key === 'teacher_name')) {
				const userRow = sqlite
					.prepare('SELECT display_name FROM users WHERE id = ?')
					.get(userId) as { display_name: string | null } | undefined;
				if (userRow?.display_name) {
					map.set('teacher_name', userRow.display_name);
				}
			}
		}

		return {
			teacherName: map.get('teacher_name') || DEFAULT_SETTINGS.teacherName,
			defaultReturnDays: parseInt(
				map.get('default_return_days') || String(DEFAULT_SETTINGS.defaultReturnDays),
				10
			),
			earlyWarningThreshold: parseFloat(
				map.get('early_warning_threshold') || String(DEFAULT_SETTINGS.earlyWarningThreshold)
			),
			emailSummaryEnabled: map.get('email_summary_enabled') === 'true'
		};
	},

	get<K extends keyof AppSettings>(key: K, userId?: string): AppSettings[K] {
		return this.getAll(userId)[key];
	},

	updateAll(settings: Partial<AppSettings>, userId?: string): void {
		const entries: Array<{ key: string; value: string }> = [];

		if (settings.teacherName !== undefined) {
			entries.push({ key: 'teacher_name', value: settings.teacherName.trim() });
		}
		if (settings.defaultReturnDays !== undefined) {
			entries.push({ key: 'default_return_days', value: String(settings.defaultReturnDays) });
		}
		if (settings.earlyWarningThreshold !== undefined) {
			entries.push({
				key: 'early_warning_threshold',
				value: String(settings.earlyWarningThreshold)
			});
		}
		if (settings.emailSummaryEnabled !== undefined) {
			entries.push({
				key: 'email_summary_enabled',
				value: settings.emailSummaryEnabled ? 'true' : 'false'
			});
		}

		if (entries.length === 0) return;

		if (userId) {
			db.insert(schema.userSettings)
				.values(entries.map((e) => ({ userId, key: e.key, value: e.value })))
				.onConflictDoUpdate({
					target: [schema.userSettings.userId, schema.userSettings.key],
					set: { value: sql`excluded.value` }
				})
				.run();

			if (settings.teacherName !== undefined && settings.teacherName.trim()) {
				db.update(schema.users)
					.set({ displayName: settings.teacherName.trim() })
					.where(eq(schema.users.id, userId))
					.run();
			}
			return;
		}

		db.insert(schema.settings)
			.values(entries)
			.onConflictDoUpdate({
				target: schema.settings.key,
				set: { value: sql`excluded.value` }
			})
			.run();
	}
};
