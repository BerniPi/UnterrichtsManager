import { db, sqlite } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

export interface CourseWithDetails {
	id: string;
	classId: string;
	className: string;
	schoolYearId: string;
	subject: string;
	weightSchularbeiten: number;
	weightTests: number;
	weightParticipation: number;
	weightObservations: number;
	weightHomework: number;
	studentCount: number;
}

export const courseRepository = {
	getBySchoolYear(schoolYearId: string): CourseWithDetails[] {
		return sqlite
			.prepare(
				`
			SELECT 
				c.id,
				c.class_id as classId,
				cl.name as className,
				c.school_year_id as schoolYearId,
				c.subject,
				c.weight_schularbeiten as weightSchularbeiten,
				c.weight_tests as weightTests,
				c.weight_participation as weightParticipation,
				c.weight_observations as weightObservations,
				c.weight_homework as weightHomework,
				COUNT(DISTINCT s.id) as studentCount
			FROM courses c
			JOIN classes cl ON c.class_id = cl.id
			LEFT JOIN students s ON s.class_id = cl.id AND s.status = 'active'
			WHERE c.school_year_id = ?
			GROUP BY c.id
			ORDER BY cl.name ASC, c.subject ASC
		`
			)
			.all(schoolYearId) as CourseWithDetails[];
	},

	getAll(): CourseWithDetails[] {
		return sqlite
			.prepare(
				`
			SELECT 
				c.id,
				c.class_id as classId,
				cl.name as className,
				c.school_year_id as schoolYearId,
				c.subject,
				c.weight_schularbeiten as weightSchularbeiten,
				c.weight_tests as weightTests,
				c.weight_participation as weightParticipation,
				c.weight_observations as weightObservations,
				c.weight_homework as weightHomework,
				COUNT(DISTINCT s.id) as studentCount
			FROM courses c
			JOIN classes cl ON c.class_id = cl.id
			LEFT JOIN students s ON s.class_id = cl.id AND s.status = 'active'
			GROUP BY c.id
			ORDER BY cl.name ASC, c.subject ASC
		`
			)
			.all() as CourseWithDetails[];
	},

	getById(id: string): CourseWithDetails | null {
		const row = sqlite
			.prepare(
				`
			SELECT 
				c.id,
				c.class_id as classId,
				cl.name as className,
				c.school_year_id as schoolYearId,
				c.subject,
				c.weight_schularbeiten as weightSchularbeiten,
				c.weight_tests as weightTests,
				c.weight_participation as weightParticipation,
				c.weight_observations as weightObservations,
				c.weight_homework as weightHomework,
				COUNT(DISTINCT s.id) as studentCount
			FROM courses c
			JOIN classes cl ON c.class_id = cl.id
			LEFT JOIN students s ON s.class_id = cl.id AND s.status = 'active'
			WHERE c.id = ?
			GROUP BY c.id
		`
			)
			.get(id) as CourseWithDetails | undefined;

		return row || null;
	},

	create(data: {
		classId: string;
		schoolYearId: string;
		subject: string;
		weightSchularbeiten?: number;
		weightTests?: number;
		weightParticipation?: number;
		weightObservations?: number;
		weightHomework?: number;
	}): string {
		const id = crypto.randomUUID();
		db.insert(schema.courses)
			.values({
				id,
				classId: data.classId,
				schoolYearId: data.schoolYearId,
				subject: data.subject,
				weightSchularbeiten: data.weightSchularbeiten ?? 40,
				weightTests: data.weightTests ?? 20,
				weightParticipation: data.weightParticipation ?? 25,
				weightObservations: data.weightObservations ?? 10,
				weightHomework: data.weightHomework ?? 5
			})
			.run();
		return id;
	},

	updateWeights(
		id: string,
		weights: {
			weightSchularbeiten: number;
			weightTests: number;
			weightParticipation: number;
			weightObservations: number;
			weightHomework: number;
		}
	): void {
		db.update(schema.courses)
			.set(weights)
			.where(eq(schema.courses.id, id))
			.run();
	}
};
