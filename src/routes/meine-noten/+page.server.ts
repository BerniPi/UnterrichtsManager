import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { sqlite } from '$lib/server/db';
import { requireUser } from '$lib/server/auth/access';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);

	if (user.role !== 'student') {
		throw redirect(303, '/');
	}

	if (!user.studentId) {
		return {
			student: null,
			courses: []
		};
	}

	const student = sqlite
		.prepare(
			`
		SELECT
			s.id,
			s.first_name as firstName,
			s.last_name as lastName,
			s.catalog_number as catalogNumber,
			cl.id as classId,
			cl.name as className,
			sy.name as schoolYearName
		FROM students s
		JOIN classes cl ON s.class_id = cl.id
		JOIN school_years sy ON cl.school_year_id = sy.id
		WHERE s.id = ?
	`
		)
		.get(user.studentId) as
		| {
				id: string;
				firstName: string;
				lastName: string;
				catalogNumber: number | null;
				classId: string;
				className: string;
				schoolYearName: string;
		  }
		| undefined;

	if (!student) {
		throw error(404, 'Verknüpftes Schülerprofil nicht gefunden.');
	}

	const rawCourses = sqlite
		.prepare(
			`
		SELECT
			c.id,
			c.subject,
			COALESCE(u.display_name, u.username) as teacherName
		FROM courses c
		LEFT JOIN users u ON c.teacher_id = u.id
		WHERE c.class_id = ?
		ORDER BY c.subject ASC
	`
		)
		.all(student.classId) as Array<{
		id: string;
		subject: string;
		teacherName: string | null;
	}>;

	const courses = rawCourses.map((c) => {
		// Only Schularbeiten & Tests with points and grade — NO teacher notes, NO observations, NO participation comments
		const assessments = sqlite
			.prepare(
				`
			SELECT
				a.id,
				a.title,
				a.type,
				a.date,
				a.max_points as maxPoints,
				ar.points,
				ar.grade,
				ar.is_absent as isAbsent,
				ar.is_made_up as isMadeUp
			FROM assessments a
			LEFT JOIN assessment_results ar ON ar.assessment_id = a.id AND ar.student_id = ?
			WHERE a.course_id = ? AND a.is_counted = 1
			ORDER BY a.date DESC
		`
			)
			.all(student.id, c.id) as Array<{
			id: string;
			title: string;
			type: string;
			date: string;
			maxPoints: number;
			points: number | null;
			grade: number | null;
			isAbsent: number | null;
			isMadeUp: number | null;
		}>;

		// Only manual final grades if entered (no internal notes or suggestions)
		const finalGrades = sqlite
			.prepare(
				`
			SELECT semester, manual_grade as manualGrade
			FROM course_final_grades
			WHERE course_id = ? AND student_id = ? AND manual_grade IS NOT NULL
			ORDER BY semester ASC
		`
			)
			.all(c.id, student.id) as Array<{
			semester: number;
			manualGrade: number;
		}>;

		return {
			id: c.id,
			subject: c.subject,
			teacherName: c.teacherName,
			assessments: assessments.map((a) => ({
				id: a.id,
				title: a.title,
				type: a.type,
				date: a.date,
				maxPoints: a.maxPoints,
				points: a.points,
				grade: a.grade,
				isAbsent: Boolean(a.isAbsent),
				isMadeUp: Boolean(a.isMadeUp)
			})),
			finalGrades
		};
	});

	return {
		student,
		courses
	};
};
