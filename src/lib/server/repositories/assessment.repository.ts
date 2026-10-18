import { db, sqlite } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { calculateGradeFromPoints, DEFAULT_AUSTRIAN_SCALE, type GradingThreshold } from '../../services/grading';

export interface AssessmentWithStats {
	id: string;
	courseId: string;
	title: string;
	type: 'schularbeit' | 'test' | 'wiederholung';
	date: string;
	maxPoints: number;
	gradingScale: string;
	isCounted: boolean;
	totalStudents: number;
	gradedCount: number;
	averagePoints: number | null;
	averageGrade: number | null;
	signedCount: number;
	overdueCount: number;
}

export const assessmentRepository = {
	getByCourse(courseId: string): AssessmentWithStats[] {
		const todayStr = new Date().toISOString().slice(0, 10);
		const rows = sqlite
			.prepare(
				`
			SELECT 
				a.id,
				a.course_id as courseId,
				a.title,
				a.type,
				a.date,
				a.max_points as maxPoints,
				a.grading_scale as gradingScale,
				a.is_counted as isCounted,
				COUNT(ar.student_id) as totalStudents,
				COUNT(CASE WHEN ar.points IS NOT NULL THEN 1 END) as gradedCount,
				AVG(ar.points) as averagePoints,
				AVG(ar.grade) as averageGrade,
				COUNT(CASE WHEN ret.is_signed = 1 THEN 1 END) as signedCount,
				COUNT(CASE WHEN ret.is_signed = 0 AND ret.due_date < ? AND (ret.snoozed_until IS NULL OR ret.snoozed_until <= ?) THEN 1 END) as overdueCount
			FROM assessments a
			LEFT JOIN assessment_results ar ON ar.assessment_id = a.id
			LEFT JOIN assessment_returns ret ON ret.assessment_id = a.id AND ret.student_id = ar.student_id
			WHERE a.course_id = ?
			GROUP BY a.id
			ORDER BY a.date DESC
		`
			)
			.all(todayStr, todayStr, courseId) as any[];

		return rows.map((r) => ({
			...r,
			isCounted: Boolean(r.isCounted),
			averagePoints: r.averagePoints ? Math.round(r.averagePoints * 10) / 10 : null,
			averageGrade: r.averageGrade ? Math.round(r.averageGrade * 100) / 100 : null
		}));
	},

	getById(id: string) {
		const assessment = sqlite
			.prepare(
				`
			SELECT 
				a.id,
				a.course_id as courseId,
				c.subject,
				cl.name as className,
				a.title,
				a.type,
				a.date,
				a.max_points as maxPoints,
				a.grading_scale as gradingScale,
				a.is_counted as isCounted
			FROM assessments a
			JOIN courses c ON a.course_id = c.id
			JOIN classes cl ON c.class_id = cl.id
			WHERE a.id = ?
		`
			)
			.get(id) as any;

		if (!assessment) return null;

		// Fetch all students in class with their result & return status
		const results = sqlite
			.prepare(
				`
			SELECT 
				s.id as studentId,
				s.first_name as firstName,
				s.last_name as lastName,
				s.catalog_number as catalogNumber,
				ar.id as resultId,
				ar.points,
				ar.grade,
				ar.is_absent as isAbsent,
				ar.is_made_up as isMadeUp,
				ar.note,
				ret.id as returnId,
				ret.returned_date as returnedDate,
				ret.due_date as dueDate,
				ret.is_signed as isSigned,
				ret.signed_date as signedDate,
				ret.snoozed_until as snoozedUntil
			FROM students s
			JOIN classes cl ON s.class_id = cl.id
			JOIN courses c ON c.class_id = cl.id AND c.id = ?
			LEFT JOIN assessment_results ar ON ar.assessment_id = ? AND ar.student_id = s.id
			LEFT JOIN assessment_returns ret ON ret.assessment_id = ? AND ret.student_id = s.id
			WHERE s.status = 'active'
			ORDER BY COALESCE(s.catalog_number, 999) ASC, s.last_name ASC, s.first_name ASC
		`
			)
			.all(assessment.courseId, assessment.id, assessment.id) as any[];

		return {
			...assessment,
			isCounted: Boolean(assessment.isCounted),
			scale: JSON.parse(assessment.gradingScale) as GradingThreshold[],
			results: results.map((r) => ({
				...r,
				isAbsent: Boolean(r.isAbsent),
				isMadeUp: Boolean(r.isMadeUp),
				isSigned: Boolean(r.isSigned)
			}))
		};
	},

	create(data: {
		courseId: string;
		title: string;
		type: 'schularbeit' | 'test' | 'wiederholung';
		date: string;
		maxPoints: number;
		gradingScale?: GradingThreshold[];
		dueDate?: string; // Standard-Rückgabefrist (z.B. 7 Tage später)
	}): string {
		return sqlite.transaction(() => {
			const course = sqlite.prepare('SELECT class_id FROM courses WHERE id = ?').get(data.courseId) as
				| { class_id: string }
				| undefined;
			if (!course) {
				throw new Error('Kurs nicht gefunden');
			}

			const id = crypto.randomUUID();
			const scaleJson = JSON.stringify(data.gradingScale || DEFAULT_AUSTRIAN_SCALE);

			db.insert(schema.assessments)
				.values({
					id,
					courseId: data.courseId,
					title: data.title,
					type: data.type,
					date: data.date,
					maxPoints: data.maxPoints,
					gradingScale: scaleJson,
					isCounted: true
				})
				.run();

			const students = sqlite
				.prepare("SELECT id FROM students WHERE class_id = ? AND status = 'active'")
				.all(course.class_id) as Array<{ id: string }>;

			const d = new Date(data.date);
			d.setDate(d.getDate() + 7); // Default 7 days
			const defaultDueDate = data.dueDate || d.toISOString().slice(0, 10);

			for (const s of students) {
				db.insert(schema.assessmentResults)
					.values({
						id: crypto.randomUUID(),
						assessmentId: id,
						studentId: s.id,
						points: null,
						grade: null,
						isAbsent: false,
						isMadeUp: false
					})
					.run();

				db.insert(schema.assessmentReturns)
					.values({
						id: crypto.randomUUID(),
						assessmentId: id,
						studentId: s.id,
						returnedDate: data.date,
						dueDate: defaultDueDate,
						isSigned: false,
						signedDate: null,
						snoozedUntil: null
					})
					.run();
			}

			return id;
		})();
	},

	updateResult(
		assessmentId: string,
		studentId: string,
		points: number | null,
		isAbsent: boolean,
		isMadeUp: boolean,
		note?: string | null
	): void {
		const assessment = sqlite
			.prepare('SELECT max_points, grading_scale FROM assessments WHERE id = ?')
			.get(assessmentId) as { max_points: number; grading_scale: string };

		const scale = JSON.parse(assessment.grading_scale) as GradingThreshold[];
		const grade = isAbsent ? null : calculateGradeFromPoints(points, assessment.max_points, scale);

		const existing = sqlite
			.prepare('SELECT id FROM assessment_results WHERE assessment_id = ? AND student_id = ?')
			.get(assessmentId, studentId) as { id: string } | undefined;

		if (existing) {
			db.update(schema.assessmentResults)
				.set({
					points,
					grade,
					isAbsent,
					isMadeUp,
					note
				})
				.where(eq(schema.assessmentResults.id, existing.id))
				.run();
		} else {
			db.insert(schema.assessmentResults)
				.values({
					id: crypto.randomUUID(),
					assessmentId,
					studentId,
					points,
					grade,
					isAbsent,
					isMadeUp,
					note
				})
				.run();
		}
	},

	updateGradingScale(assessmentId: string, scale: GradingThreshold[]): void {
		sqlite.transaction(() => {
			const scaleJson = JSON.stringify(scale);
			db.update(schema.assessments)
				.set({ gradingScale: scaleJson })
				.where(eq(schema.assessments.id, assessmentId))
				.run();

			// Recalculate grades for all existing student scores on this assessment
			const assessment = sqlite
				.prepare('SELECT max_points FROM assessments WHERE id = ?')
				.get(assessmentId) as { max_points: number } | undefined;

			if (!assessment) return;

			const results = sqlite
				.prepare(
					'SELECT id, points, is_absent FROM assessment_results WHERE assessment_id = ? AND points IS NOT NULL'
				)
				.all(assessmentId) as Array<{ id: string; points: number; is_absent: number }>;

			for (const r of results) {
				if (!r.is_absent) {
					const grade = calculateGradeFromPoints(r.points, assessment.max_points, scale);
					db.update(schema.assessmentResults)
						.set({ grade })
						.where(eq(schema.assessmentResults.id, r.id))
						.run();
				}
			}
		})();
	}
};
