import { sqlite } from '$lib/server/db';
import {
	calculateGradeSuggestion,
	type CourseWeights,
	type GradeSuggestionBreakdown,
	type StudentPerformanceData
} from './grading';
import { checkEarlyWarningSuggestion, type EarlyWarningCheckResult } from './earlywarning';

export interface StudentCourseEvaluation {
	studentId: string;
	firstName: string;
	lastName: string;
	catalogNumber: number | null;
	webuntisId: string | null;
	status: string;
	performance: StudentPerformanceData;
	breakdown: GradeSuggestionBreakdown;
	earlyWarningSuggestion: EarlyWarningCheckResult;
	hasActiveEarlyWarning: boolean;
	manualFinalGrade: number | null;
	manualNote: string | null;
}

export function evaluateStudentInCourse(
	studentId: string,
	courseId: string,
	weights: CourseWeights,
	earlyWarningThreshold = 4.5
): StudentCourseEvaluation | null {
	const student = sqlite
		.prepare(
			'SELECT id, first_name, last_name, catalog_number, webuntis_id, status FROM students WHERE id = ?'
		)
		.get(studentId) as any;

	if (!student) return null;

	// 1. Schularbeiten and Test Grades
	const assessmentRows = sqlite
		.prepare(
			`
		SELECT a.type, ar.grade, ar.points, ar.is_absent
		FROM assessment_results ar
		JOIN assessments a ON ar.assessment_id = a.id
		WHERE a.course_id = ? AND ar.student_id = ? AND a.is_counted = 1
	`
		)
		.all(courseId, studentId) as Array<{
		type: string;
		grade: number | null;
		points: number | null;
		is_absent: number;
	}>;

	const schularbeitGrades = assessmentRows
		.filter((r) => r.type === 'schularbeit' && r.grade !== null && !r.is_absent)
		.map((r) => r.grade as number);

	const testGrades = assessmentRows
		.filter((r) => (r.type === 'test' || r.type === 'wiederholung') && r.grade !== null && !r.is_absent)
		.map((r) => r.grade as number);

	// 2. Participation
	const partCounts = sqlite
		.prepare(
			`
		SELECT 
			COUNT(CASE WHEN value = 'plus' THEN 1 END) as plus,
			COUNT(CASE WHEN value = 'tilde' THEN 1 END) as tilde,
			COUNT(CASE WHEN value = 'minus' THEN 1 END) as minus
		FROM participation_entries
		WHERE course_id = ? AND student_id = ?
	`
		)
		.get(courseId, studentId) as { plus: number; tilde: number; minus: number };

	// 3. Observations
	const obsRows = sqlite
		.prepare(
			`
		SELECT os.points, o.max_points as maxPoints
		FROM observation_scores os
		JOIN observations o ON os.observation_id = o.id
		WHERE o.course_id = ? AND os.student_id = ?
	`
		)
		.all(courseId, studentId) as Array<{ points: number; maxPoints: number }>;

	// 4. Homework
	const hwCounts = sqlite
		.prepare(
			`
		SELECT 
			COUNT(CASE WHEN hs.status = 'done' THEN 1 END) as done,
			COUNT(CASE WHEN hs.status = 'partial' THEN 1 END) as partial,
			COUNT(CASE WHEN hs.status = 'forgotten' THEN 1 END) as forgotten
		FROM homework_statuses hs
		JOIN homeworks h ON hs.homework_id = h.id
		WHERE h.course_id = ? AND hs.student_id = ?
	`
		)
		.get(courseId, studentId) as { done: number; partial: number; forgotten: number };

	// 5. Existing Active Early Warning
	const activeEarlyWarning = sqlite
		.prepare(
			`SELECT COUNT(*) as count FROM early_warnings WHERE course_id = ? AND student_id = ? AND is_signed = 0`
		)
		.get(courseId, studentId) as { count: number };

	// 6. Manual Final Grade
	const finalGradeRow = sqlite
		.prepare(
			'SELECT manual_grade, note FROM course_final_grades WHERE course_id = ? AND student_id = ?'
		)
		.get(courseId, studentId) as { manual_grade: number | null; note: string | null } | undefined;

	const performance: StudentPerformanceData = {
		schularbeitGrades,
		testGrades,
		participation: {
			plus: partCounts?.plus || 0,
			tilde: partCounts?.tilde || 0,
			minus: partCounts?.minus || 0
		},
		observations: obsRows,
		homework: {
			done: hwCounts?.done || 0,
			partial: hwCounts?.partial || 0,
			forgotten: hwCounts?.forgotten || 0
		}
	};

	const breakdown = calculateGradeSuggestion(performance, weights);

	const todayStr = new Date().toISOString().slice(0, 10);
	const earlyWarningSuggestion = checkEarlyWarningSuggestion(breakdown, performance, {
		currentDateStr: todayStr,
		earlyWarningDeadline1: '2026-12-15',
		earlyWarningDeadline2: '2027-05-15',
		firstSemesterEnd: '2027-02-05',
		threshold: earlyWarningThreshold
	});

	return {
		studentId: student.id,
		firstName: student.first_name,
		lastName: student.last_name,
		catalogNumber: student.catalog_number,
		webuntisId: student.webuntis_id,
		status: student.status,
		performance,
		breakdown,
		earlyWarningSuggestion,
		hasActiveEarlyWarning: (activeEarlyWarning?.count || 0) > 0,
		manualFinalGrade: finalGradeRow?.manual_grade ?? null,
		manualNote: finalGradeRow?.note ?? null
	};
}

export function evaluateCourseStudents(
	courseId: string,
	weights: CourseWeights,
	earlyWarningThreshold = 4.5
): StudentCourseEvaluation[] {
	const course = sqlite.prepare('SELECT class_id FROM courses WHERE id = ?').get(courseId) as {
		class_id: string;
	};
	if (!course) return [];

	const students = sqlite
		.prepare(
			"SELECT id FROM students WHERE class_id = ? AND status = 'active' ORDER BY COALESCE(catalog_number, 999) ASC, last_name ASC"
		)
		.all(course.class_id) as Array<{ id: string }>;

	return students
		.map((s) => evaluateStudentInCourse(s.id, courseId, weights, earlyWarningThreshold))
		.filter((e): e is StudentCourseEvaluation => e !== null);
}
