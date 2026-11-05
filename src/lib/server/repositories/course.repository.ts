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
	teacherId: string | null;
	studentCount: number;
}

export const courseRepository = {
	getBySchoolYear(schoolYearId: string, teacherId?: string): CourseWithDetails[] {
		const whereClause = teacherId
			? 'WHERE c.school_year_id = ? AND c.teacher_id = ?'
			: 'WHERE c.school_year_id = ?';
		const args = teacherId ? [schoolYearId, teacherId] : [schoolYearId];

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
				c.teacher_id as teacherId,
				COUNT(DISTINCT s.id) as studentCount
			FROM courses c
			JOIN classes cl ON c.class_id = cl.id
			LEFT JOIN students s ON s.class_id = cl.id AND s.status = 'active'
			${whereClause}
			GROUP BY c.id
			ORDER BY cl.name ASC, c.subject ASC
		`
			)
			.all(...args) as CourseWithDetails[];
	},

	getAll(teacherId?: string): CourseWithDetails[] {
		const whereClause = teacherId ? 'WHERE c.teacher_id = ?' : '';
		const args = teacherId ? [teacherId] : [];

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
				c.teacher_id as teacherId,
				COUNT(DISTINCT s.id) as studentCount
			FROM courses c
			JOIN classes cl ON c.class_id = cl.id
			LEFT JOIN students s ON s.class_id = cl.id AND s.status = 'active'
			${whereClause}
			GROUP BY c.id
			ORDER BY cl.name ASC, c.subject ASC
		`
			)
			.all(...args) as CourseWithDetails[];
	},

	getById(id: string, teacherId?: string): CourseWithDetails | null {
		const whereClause = teacherId ? 'WHERE c.id = ? AND c.teacher_id = ?' : 'WHERE c.id = ?';
		const args = teacherId ? [id, teacherId] : [id];

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
				c.teacher_id as teacherId,
				COUNT(DISTINCT s.id) as studentCount
			FROM courses c
			JOIN classes cl ON c.class_id = cl.id
			LEFT JOIN students s ON s.class_id = cl.id AND s.status = 'active'
			${whereClause}
			GROUP BY c.id
		`
			)
			.get(...args) as CourseWithDetails | undefined;

		return row || null;
	},

	create(data: {
		classId: string;
		schoolYearId: string;
		subject: string;
		teacherId: string;
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
				weightHomework: data.weightHomework ?? 5,
				teacherId: data.teacherId
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
	},

	transferCourse(courseId: string, newTeacherId: string): void {
		db.update(schema.courses)
			.set({ teacherId: newTeacherId })
			.where(eq(schema.courses.id, courseId))
			.run();
	}
};
