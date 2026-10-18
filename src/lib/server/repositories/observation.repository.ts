import { db, sqlite } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

export interface ObservationWithScores {
	id: string;
	courseId: string;
	title: string;
	date: string;
	maxPoints: number;
	description: string | null;
	scores: Array<{
		studentId: string;
		firstName: string;
		lastName: string;
		catalogNumber: number | null;
		points: number;
		note: string | null;
	}>;
}

export const observationRepository = {
	getByCourse(courseId: string) {
		const observations = sqlite
			.prepare(
				`
			SELECT id, course_id as courseId, title, date, max_points as maxPoints, description
			FROM observations
			WHERE course_id = ?
			ORDER BY date DESC
		`
			)
			.all(courseId) as Array<{
			id: string;
			courseId: string;
			title: string;
			date: string;
			maxPoints: number;
			description: string | null;
		}>;

		return observations.map((obs) => {
			const scores = sqlite
				.prepare(
					`
				SELECT 
					s.id as studentId,
					s.first_name as firstName,
					s.last_name as lastName,
					s.catalog_number as catalogNumber,
					os.points,
					os.note
				FROM students s
				JOIN classes cl ON s.class_id = cl.id
				JOIN courses c ON c.class_id = cl.id AND c.id = ?
				LEFT JOIN observation_scores os ON os.observation_id = ? AND os.student_id = s.id
				WHERE s.status = 'active'
				ORDER BY COALESCE(s.catalog_number, 999) ASC, s.last_name ASC, s.first_name ASC
			`
				)
				.all(courseId, obs.id) as any[];

			return {
				...obs,
				scores
			};
		});
	},

	create(data: {
		courseId: string;
		title: string;
		date: string;
		maxPoints: number;
		description?: string | null;
	}): string {
		const id = crypto.randomUUID();
		db.insert(schema.observations)
			.values({
				id,
				courseId: data.courseId,
				title: data.title,
				date: data.date,
				maxPoints: data.maxPoints,
				description: data.description || null
			})
			.run();
		return id;
	},

	saveScores(
		observationId: string,
		scores: Array<{ studentId: string; points: number; note?: string | null }>
	): void {
		for (const item of scores) {
			const existing = sqlite
				.prepare(
					'SELECT id FROM observation_scores WHERE observation_id = ? AND student_id = ?'
				)
				.get(observationId, item.studentId) as { id: string } | undefined;

			if (existing) {
				db.update(schema.observationScores)
					.set({ points: item.points, note: item.note || null })
					.where(eq(schema.observationScores.id, existing.id))
					.run();
			} else {
				db.insert(schema.observationScores)
					.values({
						id: crypto.randomUUID(),
						observationId,
						studentId: item.studentId,
						points: item.points,
						note: item.note || null
					})
					.run();
			}
		}
	},

	deleteScore(observationId: string, studentId: string): void {
		sqlite
			.prepare('DELETE FROM observation_scores WHERE observation_id = ? AND student_id = ?')
			.run(observationId, studentId);
	},

	delete(id: string): void {
		sqlite.transaction(() => {
			sqlite.prepare('DELETE FROM observation_scores WHERE observation_id = ?').run(id);
			sqlite.prepare('DELETE FROM observations WHERE id = ?').run(id);
		})();
	}
};
