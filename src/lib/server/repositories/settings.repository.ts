import { db, sqlite } from '../db';
import * as schema from '../db/schema';
import { sql } from 'drizzle-orm';

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
	getAll(): AppSettings {
		const rows = sqlite.prepare('SELECT key, value FROM settings').all() as Array<{
			key: string;
			value: string;
		}>;
		const map = new Map(rows.map((r) => [r.key, r.value]));

		return {
			teacherName: map.get('teacher_name') || DEFAULT_SETTINGS.teacherName,
			defaultReturnDays: parseInt(map.get('default_return_days') || String(DEFAULT_SETTINGS.defaultReturnDays), 10),
			earlyWarningThreshold: parseFloat(map.get('early_warning_threshold') || String(DEFAULT_SETTINGS.earlyWarningThreshold)),
			emailSummaryEnabled: map.get('email_summary_enabled') === 'true'
		};
	},

	get<K extends keyof AppSettings>(key: K): AppSettings[K] {
		return this.getAll()[key];
	},

	updateAll(settings: Partial<AppSettings>): void {
		const entries: Array<{ key: string; value: string }> = [];

		if (settings.teacherName !== undefined) {
			entries.push({ key: 'teacher_name', value: settings.teacherName.trim() });
		}
		if (settings.defaultReturnDays !== undefined) {
			entries.push({ key: 'default_return_days', value: String(settings.defaultReturnDays) });
		}
		if (settings.earlyWarningThreshold !== undefined) {
			entries.push({ key: 'early_warning_threshold', value: String(settings.earlyWarningThreshold) });
		}
		if (settings.emailSummaryEnabled !== undefined) {
			entries.push({ key: 'email_summary_enabled', value: settings.emailSummaryEnabled ? 'true' : 'false' });
		}

		if (entries.length === 0) return;

		db.insert(schema.settings)
			.values(entries)
			.onConflictDoUpdate({
				target: schema.settings.key,
				set: { value: sql`excluded.value` }
			})
			.run();
	}
};
