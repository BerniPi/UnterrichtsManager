import { db, sqlite, seedTemplatesForUser } from '../db';
import * as schema from '../db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import type { GradingScaleTemplate, GradingThreshold } from '../../services/grading';

function resolveUserId(userId?: string): string {
	if (userId) return userId;
	const row = sqlite
		.prepare("SELECT id FROM users WHERE role IN ('admin', 'teacher') ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, created_at ASC LIMIT 1")
		.get() as { id: string } | undefined;
	if (row) return row.id;
	throw new Error('Kein Benutzer für Notenschlüssel-Vorlagen gefunden');
}

function ensureDefault(userId: string): void {
	const has = sqlite
		.prepare('SELECT 1 FROM grading_scale_templates WHERE user_id = ? AND is_default = 1')
		.get(userId);
	if (!has) {
		sqlite
			.prepare(
				'UPDATE grading_scale_templates SET is_default = 1 WHERE id = (SELECT id FROM grading_scale_templates WHERE user_id = ? ORDER BY created_at ASC LIMIT 1)'
			)
			.run(userId);
	}
}

export const gradingTemplateRepository = {
	seedForUser(userId: string): void {
		seedTemplatesForUser(userId);
		ensureDefault(userId);
	},

	getAll(userId?: string): GradingScaleTemplate[] {
		const uid = resolveUserId(userId);
		seedTemplatesForUser(uid);

		const rows = sqlite
			.prepare(
				`
			SELECT 
				id,
				name,
				description,
				scale_json as scaleJson,
				is_default as isDefault,
				created_at as createdAt
			FROM grading_scale_templates
			WHERE user_id = ?
			ORDER BY is_default DESC, created_at ASC
		`
			)
			.all(uid) as any[];

		return rows.map((r) => ({
			id: r.id,
			name: r.name,
			description: r.description,
			scale: JSON.parse(r.scaleJson) as GradingThreshold[],
			isDefault: Boolean(r.isDefault),
			createdAt: r.createdAt
		}));
	},

	getById(id: string, userId?: string): GradingScaleTemplate | null {
		const whereClause = userId ? 'WHERE id = ? AND user_id = ?' : 'WHERE id = ?';
		const args = userId ? [id, userId] : [id];

		const row = sqlite
			.prepare(
				`
			SELECT 
				id,
				name,
				description,
				scale_json as scaleJson,
				is_default as isDefault,
				created_at as createdAt
			FROM grading_scale_templates
			${whereClause}
		`
			)
			.get(...args) as any;

		if (!row) return null;

		return {
			id: row.id,
			name: row.name,
			description: row.description,
			scale: JSON.parse(row.scaleJson) as GradingThreshold[],
			isDefault: Boolean(row.isDefault),
			createdAt: row.createdAt
		};
	},

	getDefault(userId?: string): GradingScaleTemplate | null {
		const templates = this.getAll(userId);
		if (templates.length === 0) return null;
		return templates.find((t) => t.isDefault) || templates[0];
	},

	create(
		data: {
			name: string;
			description?: string | null;
			scale: GradingThreshold[];
			isDefault?: boolean;
			userId?: string;
		},
		userId?: string
	): string {
		const uid = resolveUserId(userId ?? data.userId);
		return sqlite.transaction(() => {
			const id = crypto.randomUUID();

			if (data.isDefault) {
				sqlite
					.prepare('UPDATE grading_scale_templates SET is_default = 0 WHERE user_id = ?')
					.run(uid);
			}

			db.insert(schema.gradingScaleTemplates)
				.values({
					id,
					name: data.name,
					description: data.description || null,
					scaleJson: JSON.stringify(data.scale),
					isDefault: Boolean(data.isDefault),
					createdAt: Date.now(),
					userId: uid
				})
				.run();

			ensureDefault(uid);
			return id;
		})();
	},

	update(
		id: string,
		data: {
			name: string;
			description?: string | null;
			scale: GradingThreshold[];
			isDefault?: boolean;
		},
		userId?: string
	): void {
		const existing = sqlite
			.prepare('SELECT user_id FROM grading_scale_templates WHERE id = ?')
			.get(id) as { user_id: string | null } | undefined;
		const uid = resolveUserId(userId ?? existing?.user_id ?? undefined);

		sqlite.transaction(() => {
			if (data.isDefault) {
				sqlite
					.prepare(
						'UPDATE grading_scale_templates SET is_default = 0 WHERE user_id = ? AND id != ?'
					)
					.run(uid, id);
			}

			db.update(schema.gradingScaleTemplates)
				.set({
					name: data.name,
					description: data.description || null,
					scaleJson: JSON.stringify(data.scale),
					isDefault: Boolean(data.isDefault)
				})
				.where(
					and(
						eq(schema.gradingScaleTemplates.id, id),
						eq(schema.gradingScaleTemplates.userId, uid)
					)
				)
				.run();

			ensureDefault(uid);
		})();
	},

	delete(id: string, userId?: string): void {
		const existing = sqlite
			.prepare('SELECT user_id FROM grading_scale_templates WHERE id = ?')
			.get(id) as { user_id: string | null } | undefined;
		const uid = resolveUserId(userId ?? existing?.user_id ?? undefined);

		sqlite.transaction(() => {
			db.delete(schema.gradingScaleTemplates)
				.where(
					and(
						eq(schema.gradingScaleTemplates.id, id),
						eq(schema.gradingScaleTemplates.userId, uid)
					)
				)
				.run();

			ensureDefault(uid);
		})();
	},

	setDefault(id: string, userId?: string): void {
		const existing = sqlite
			.prepare('SELECT id, user_id FROM grading_scale_templates WHERE id = ?')
			.get(id) as { id: string; user_id: string | null } | undefined;
		if (!existing) throw new Error('Vorlage nicht gefunden');

		const uid = resolveUserId(userId ?? existing.user_id ?? undefined);
		if (userId && existing.user_id !== userId) {
			throw new Error('Vorlage nicht gefunden');
		}

		sqlite.transaction(() => {
			sqlite
				.prepare('UPDATE grading_scale_templates SET is_default = 0 WHERE user_id = ?')
				.run(uid);
			sqlite
				.prepare('UPDATE grading_scale_templates SET is_default = 1 WHERE id = ? AND user_id = ?')
				.run(id, uid);
			ensureDefault(uid);
		})();
	}
};
