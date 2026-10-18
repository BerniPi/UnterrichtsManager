import { db, sqlite } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import type { GradingScaleTemplate, GradingThreshold } from '../../services/grading';

function ensureDefault(): void {
	const has = sqlite.prepare('SELECT 1 FROM grading_scale_templates WHERE is_default = 1').get();
	if (!has) {
		sqlite.prepare(
			'UPDATE grading_scale_templates SET is_default = 1 WHERE id = (SELECT id FROM grading_scale_templates ORDER BY created_at ASC LIMIT 1)'
		).run();
	}
}

export const gradingTemplateRepository = {
	getAll(): GradingScaleTemplate[] {
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
			ORDER BY is_default DESC, created_at ASC
		`
			)
			.all() as any[];

		return rows.map((r) => ({
			id: r.id,
			name: r.name,
			description: r.description,
			scale: JSON.parse(r.scaleJson) as GradingThreshold[],
			isDefault: Boolean(r.isDefault),
			createdAt: r.createdAt
		}));
	},

	getById(id: string): GradingScaleTemplate | null {
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
			WHERE id = ?
		`
			)
			.get(id) as any;

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

	getDefault(): GradingScaleTemplate | null {
		const templates = this.getAll();
		if (templates.length === 0) return null;
		return templates.find((t) => t.isDefault) || templates[0];
	},

	create(data: {
		name: string;
		description?: string | null;
		scale: GradingThreshold[];
		isDefault?: boolean;
	}): string {
		return sqlite.transaction(() => {
			const id = crypto.randomUUID();

			if (data.isDefault) {
				sqlite.prepare('UPDATE grading_scale_templates SET is_default = 0').run();
			}

			db.insert(schema.gradingScaleTemplates)
				.values({
					id,
					name: data.name,
					description: data.description || null,
					scaleJson: JSON.stringify(data.scale),
					isDefault: Boolean(data.isDefault),
					createdAt: Date.now()
				})
				.run();

			ensureDefault();
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
		}
	): void {
		sqlite.transaction(() => {
			if (data.isDefault) {
				sqlite.prepare('UPDATE grading_scale_templates SET is_default = 0 WHERE id != ?').run(id);
			}

			db.update(schema.gradingScaleTemplates)
				.set({
					name: data.name,
					description: data.description || null,
					scaleJson: JSON.stringify(data.scale),
					isDefault: Boolean(data.isDefault)
				})
				.where(eq(schema.gradingScaleTemplates.id, id))
				.run();

			ensureDefault();
		})();
	},

	delete(id: string): void {
		sqlite.transaction(() => {
			db.delete(schema.gradingScaleTemplates)
				.where(eq(schema.gradingScaleTemplates.id, id))
				.run();

			ensureDefault();
		})();
	},

	setDefault(id: string): void {
		sqlite.transaction(() => {
			const target = sqlite.prepare('SELECT id FROM grading_scale_templates WHERE id = ?').get(id);
			if (!target) throw new Error('Vorlage nicht gefunden');

			sqlite.prepare('UPDATE grading_scale_templates SET is_default = 0').run();
			sqlite.prepare('UPDATE grading_scale_templates SET is_default = 1 WHERE id = ?').run(id);
			ensureDefault();
		})();
	}
};
