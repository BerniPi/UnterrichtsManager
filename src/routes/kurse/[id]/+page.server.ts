import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { courseRepository } from '$lib/server/repositories/course.repository';
import { assessmentRepository } from '$lib/server/repositories/assessment.repository';
import { observationRepository } from '$lib/server/repositories/observation.repository';
import { earlyWarningRepository } from '$lib/server/repositories/earlywarning.repository';
import { homeworkRepository } from '$lib/server/repositories/homework.repository';
import { participationRepository } from '$lib/server/repositories/participation.repository';
import { gradingTemplateRepository } from '$lib/server/repositories/grading-template.repository';
import { evaluateCourseStudents } from '$lib/services/student-evaluator';
import { generateWebUntisExcel, generateWebUntisCsv } from '$lib/services/export/webuntis';
import type { GradingThreshold } from '$lib/services/grading';
import { db, sqlite } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';

export const load: PageServerLoad = async ({ params, url }) => {
	const courseId = params.id;
	const course = courseRepository.getById(courseId);

	if (!course) {
		throw error(404, 'Kurs nicht gefunden');
	}

	const activeTab = url.searchParams.get('tab') || 'noten';

	const weights = {
		weightSchularbeiten: course.weightSchularbeiten,
		weightTests: course.weightTests,
		weightParticipation: course.weightParticipation,
		weightObservations: course.weightObservations,
		weightHomework: course.weightHomework
	};

	// 1. Evaluations with Grade Suggestions
	const evaluatedStudents = evaluateCourseStudents(courseId, weights);

	// 2. Assessments
	const assessments = assessmentRepository.getByCourse(courseId);

	// Selected assessment detail if query param exists
	const selectedAssessmentId = url.searchParams.get('assessmentId') || assessments[0]?.id;
	const selectedAssessment = selectedAssessmentId ? assessmentRepository.getById(selectedAssessmentId) : null;

	// 3. Observations
	const observations = observationRepository.getByCourse(courseId);

	// 4. Homework
	const homeworks = homeworkRepository.getByCourse(courseId);

	// 5. Early Warnings
	const earlyWarnings = earlyWarningRepository.getByCourse(courseId);

	// 6. Grading Scale Templates
	const gradingTemplates = gradingTemplateRepository.getAll();

	return {
		course,
		activeTab,
		evaluatedStudents,
		assessments,
		selectedAssessment,
		observations,
		homeworks,
		earlyWarnings,
		gradingTemplates
	};
};

export const actions: Actions = {
	saveFinalGrade: async ({ request, params }) => {
		const form = await request.formData();
		const studentId = form.get('studentId')?.toString();
		const manualGrade = form.get('manualGrade') ? parseInt(form.get('manualGrade')!.toString(), 10) : null;
		const suggestedGrade = form.get('suggestedGrade') ? parseFloat(form.get('suggestedGrade')!.toString()) : null;
		const note = form.get('note')?.toString().trim() || null;

		if (!studentId) return { success: false };

		const existing = sqlite
			.prepare('SELECT id FROM course_final_grades WHERE course_id = ? AND student_id = ?')
			.get(params.id, studentId) as { id: string } | undefined;

		if (existing) {
			db.update(schema.courseFinalGrades)
				.set({ manualGrade, suggestedGrade, note })
				.where(eq(schema.courseFinalGrades.id, existing.id))
				.run();
		} else {
			db.insert(schema.courseFinalGrades)
				.values({
					id: crypto.randomUUID(),
					courseId: params.id,
					studentId,
					semester: 1,
					suggestedGrade,
					manualGrade,
					note
				})
				.run();
		}

		return { success: true };
	},

	createAssessment: async ({ request, params }) => {
		const form = await request.formData();
		const title = form.get('title')?.toString().trim();
		const type = form.get('type')?.toString() as 'schularbeit' | 'test' | 'wiederholung';
		const date = form.get('date')?.toString();
		const maxPoints = parseFloat(form.get('maxPoints')?.toString() || '48');
		const returnDays = parseInt(form.get('returnDays')?.toString() || '7', 10);

		if (!title || !type || !date || maxPoints <= 0) {
			return { success: false, message: 'Alle Felder müssen ausgefüllt sein' };
		}

		const d = new Date(date);
		d.setDate(d.getDate() + returnDays);
		const dueDate = d.toISOString().slice(0, 10);

		const templateId = form.get('templateId')?.toString();
		const scaleJson = form.get('gradingScaleJson')?.toString();
		let gradingScale: GradingThreshold[] | undefined = undefined;

		if (scaleJson) {
			try {
				gradingScale = JSON.parse(scaleJson);
			} catch (e) {}
		} else if (templateId) {
			const tpl = gradingTemplateRepository.getById(templateId);
			if (tpl) gradingScale = tpl.scale;
		}

		const id = assessmentRepository.create({
			courseId: params.id,
			title,
			type,
			date,
			maxPoints,
			gradingScale,
			dueDate
		});

		return { success: true, createdAssessmentId: id };
	},

	saveAssessmentScore: async ({ request }) => {
		const form = await request.formData();
		const assessmentId = form.get('assessmentId')?.toString();
		const studentId = form.get('studentId')?.toString();
		const pointsRaw = form.get('points')?.toString();
		const points = pointsRaw !== '' && pointsRaw !== undefined ? parseFloat(pointsRaw) : null;
		const isAbsent = form.get('isAbsent') === 'true';
		const isMadeUp = form.get('isMadeUp') === 'true';
		const note = form.get('note')?.toString() || null;

		if (!assessmentId || !studentId) return { success: false };

		assessmentRepository.updateResult(assessmentId, studentId, points, isAbsent, isMadeUp, note);
		return { success: true };
	},

	updateGradingScale: async ({ request }) => {
		const form = await request.formData();
		const assessmentId = form.get('assessmentId')?.toString();
		const scaleJson = form.get('scaleJson')?.toString();

		if (!assessmentId || !scaleJson) return { success: false };

		const scale = JSON.parse(scaleJson);
		assessmentRepository.updateGradingScale(assessmentId, scale);
		return { success: true };
	},

	markTestReturnSigned: async ({ request }) => {
		const form = await request.formData();
		const returnId = form.get('returnId')?.toString();
		const isSigned = form.get('isSigned') === 'true';
		const todayStr = new Date().toISOString().slice(0, 10);

		if (returnId) {
			db.update(schema.assessmentReturns)
				.set({
					isSigned,
					signedDate: isSigned ? todayStr : null
				})
				.where(eq(schema.assessmentReturns.id, returnId))
				.run();
		}
		return { success: true };
	},

	createObservation: async ({ request, params }) => {
		const form = await request.formData();
		const title = form.get('title')?.toString().trim();
		const date = form.get('date')?.toString();
		const maxPoints = parseFloat(form.get('maxPoints')?.toString() || '10');
		const description = form.get('description')?.toString().trim() || null;

		if (!title || !date || maxPoints <= 0) {
			return { success: false, message: 'Titel, Datum und Max-Punkte erforderlich' };
		}

		observationRepository.create({
			courseId: params.id,
			title,
			date,
			maxPoints,
			description
		});

		return { success: true };
	},

	saveObservationScore: async ({ request }) => {
		const form = await request.formData();
		const observationId = form.get('observationId')?.toString();
		const studentId = form.get('studentId')?.toString();
		const points = parseFloat(form.get('points')?.toString() || '0');
		const note = form.get('note')?.toString().trim() || null;

		if (!observationId || !studentId) return { success: false };

		observationRepository.saveScores(observationId, [{ studentId, points, note }]);
		return { success: true };
	},

	createEarlyWarning: async ({ request, params }) => {
		const form = await request.formData();
		const studentId = form.get('studentId')?.toString();
		const reason = form.get('reason')?.toString().trim();
		const issuedDate = form.get('issuedDate')?.toString() || new Date().toISOString().slice(0, 10);
		const days = parseInt(form.get('days')?.toString() || '7', 10);

		if (!studentId || !reason) {
			return { success: false, message: 'Schüler und Begründung erforderlich' };
		}

		const d = new Date(issuedDate);
		d.setDate(d.getDate() + days);
		const dueDate = d.toISOString().slice(0, 10);

		earlyWarningRepository.create({
			studentId,
			courseId: params.id,
			semester: 1,
			issuedDate,
			reason,
			dueDate
		});

		return { success: true };
	},

	createHomework: async ({ request, params }) => {
		const form = await request.formData();
		const title = form.get('title')?.toString().trim();
		const dueDate = form.get('dueDate')?.toString();
		const description = form.get('description')?.toString().trim() || null;

		if (!title || !dueDate) {
			return { success: false, message: 'Titel und Fälligkeitsdatum erforderlich' };
		}

		homeworkRepository.create({
			courseId: params.id,
			title,
			dueDate,
			description
		});

		return { success: true };
	},

	updateWeights: async ({ request, params }) => {
		const form = await request.formData();
		const weightSchularbeiten = parseFloat(form.get('weightSchularbeiten')?.toString() || '40');
		const weightTests = parseFloat(form.get('weightTests')?.toString() || '20');
		const weightParticipation = parseFloat(form.get('weightParticipation')?.toString() || '25');
		const weightObservations = parseFloat(form.get('weightObservations')?.toString() || '10');
		const weightHomework = parseFloat(form.get('weightHomework')?.toString() || '5');

		courseRepository.updateWeights(params.id, {
			weightSchularbeiten,
			weightTests,
			weightParticipation,
			weightObservations,
			weightHomework
		});

		return { success: true };
	}
};
