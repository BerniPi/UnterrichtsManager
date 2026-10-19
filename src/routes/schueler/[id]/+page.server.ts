import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { studentRepository } from '$lib/server/repositories/student.repository';
import { noteRepository } from '$lib/server/repositories/note.repository';
import { earlyWarningRepository } from '$lib/server/repositories/earlywarning.repository';
import { participationRepository } from '$lib/server/repositories/participation.repository';
import { evaluateStudentInCourse } from '$lib/services/student-evaluator';
import { sqlite, db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

import { lessonRepository } from '$lib/server/repositories/lesson.repository';

export const load: PageServerLoad = async ({ params }) => {
	const studentId = params.id;
	const student = studentRepository.getById(studentId);

	if (!student) {
		throw error(404, 'Schüler nicht gefunden');
	}

	// Courses of this student's class
	const courses = sqlite
		.prepare(
			`
		SELECT 
			c.id, 
			c.subject, 
			c.weight_schularbeiten as weightSchularbeiten,
			c.weight_tests as weightTests,
			c.weight_participation as weightParticipation,
			c.weight_observations as weightObservations,
			c.weight_homework as weightHomework
		FROM courses c
		WHERE c.class_id = ?
		ORDER BY c.subject ASC
	`
		)
		.all(student.classId) as Array<{
		id: string;
		subject: string;
		weightSchularbeiten: number;
		weightTests: number;
		weightParticipation: number;
		weightObservations: number;
		weightHomework: number;
	}>;

	// Evaluate student in each course
	const courseEvaluations = courses.map((c) => {
		const evaluation = evaluateStudentInCourse(studentId, c.id, {
			weightSchularbeiten: c.weightSchularbeiten,
			weightTests: c.weightTests,
			weightParticipation: c.weightParticipation,
			weightObservations: c.weightObservations,
			weightHomework: c.weightHomework
		});

		// Fetch assessments for this student in this course
		const assessments = sqlite
			.prepare(
				`
			SELECT 
				a.title,
				a.type,
				a.date,
				a.note as globalNote,
				a.max_points as maxPoints,
				ar.points,
				ar.grade,
				ar.note as studentNote,
				ar.is_absent as isAbsent,
				ret.due_date as dueDate,
				ret.is_signed as isSigned,
				ret.signed_date as signedDate
			FROM assessments a
			JOIN assessment_results ar ON ar.assessment_id = a.id AND ar.student_id = ?
			LEFT JOIN assessment_returns ret ON ret.assessment_id = a.id AND ret.student_id = ?
			WHERE a.course_id = ?
			ORDER BY a.date DESC
		`
			)
			.all(studentId, studentId, c.id) as any[];

		// Fetch observations for this student in this course
		const observations = sqlite
			.prepare(
				`
			SELECT 
				o.title,
				o.date,
				o.note as globalNote,
				os.points,
				os.note as studentNote
			FROM observations o
			JOIN observation_scores os ON os.observation_id = o.id AND os.student_id = ?
			WHERE o.course_id = ?
			ORDER BY o.date DESC
		`
			)
			.all(studentId, c.id) as Array<{
			title: string;
			date: string;
			globalNote: string | null;
			points: number | null;
			studentNote: string | null;
		}>;

		return {
			courseId: c.id,
			courseSubject: c.subject,
			evaluation,
			assessments: assessments.map((a) => ({
				...a,
				isAbsent: Boolean(a.isAbsent),
				isSigned: Boolean(a.isSigned)
			})),
			observations
		};
	});

	// Notes
	const notes = noteRepository.getByStudent(studentId);

	// Early warnings
	const earlyWarnings = earlyWarningRepository.getByStudent(studentId);

	// Full participation history
	const participationHistory = participationRepository.getHistoryForStudent(studentId);

	// Stundeneintrag / Lesson notes history
	const lessonNotes = lessonRepository.getStudentHistory(studentId);

	return {
		student,
		courseEvaluations,
		notes,
		earlyWarnings,
		participationHistory,
		lessonNotes
	};
};

export const actions: Actions = {
	addNote: async ({ request, params }) => {
		const form = await request.formData();
		const courseId = form.get('courseId')?.toString() || null;
		const category = form.get('category')?.toString() as any || 'allgemein';
		const title = form.get('title')?.toString().trim();
		const content = form.get('content')?.toString().trim();
		const date = form.get('date')?.toString() || new Date().toISOString().slice(0, 10);

		if (!title || !content) {
			return { success: false, message: 'Titel und Inhalt erforderlich' };
		}

		noteRepository.create({
			studentId: params.id,
			courseId,
			date,
			category,
			title,
			content
		});

		return { success: true };
	},

	deleteNote: async ({ request }) => {
		const form = await request.formData();
		const noteId = form.get('noteId')?.toString();
		if (noteId) {
			noteRepository.delete(noteId);
		}
		return { success: true };
	},

	updateStudent: async ({ request, params }) => {
		const form = await request.formData();
		const firstName = form.get('firstName')?.toString().trim();
		const lastName = form.get('lastName')?.toString().trim();
		const catalogNumberStr = form.get('catalogNumber')?.toString().trim();
		const catalogNumber = catalogNumberStr ? parseInt(catalogNumberStr, 10) : null;
		const webuntisId = form.get('webuntisId')?.toString().trim() || null;

		if (!firstName || !lastName) {
			return { success: false, message: 'Vorname und Nachname sind erforderlich' };
		}

		studentRepository.update(params.id, {
			firstName,
			lastName,
			catalogNumber,
			webuntisId
		});

		return { success: true };
	}
};
