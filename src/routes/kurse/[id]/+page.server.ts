import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { courseRepository } from '$lib/server/repositories/course.repository';
import { assessmentRepository } from '$lib/server/repositories/assessment.repository';
import { observationRepository } from '$lib/server/repositories/observation.repository';
import { earlyWarningRepository } from '$lib/server/repositories/earlywarning.repository';
import { homeworkRepository } from '$lib/server/repositories/homework.repository';
import { gradingTemplateRepository } from '$lib/server/repositories/grading-template.repository';
import { settingsRepository } from '$lib/server/repositories/settings.repository';
import { lessonRepository } from '$lib/server/repositories/lesson.repository';
import { evaluateCourseStudents } from '$lib/services/student-evaluator';
import { validateScale, type GradingThreshold } from '$lib/services/grading';
import { requireTeacher, assertCourseOwned, guardCourseActions } from '$lib/server/auth/access';
import { db, sqlite } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { timetableRepository } from '$lib/server/repositories/timetable.repository';
import { syncTimetableIfStale } from '$lib/server/webuntis/timetable';
import { toVienna } from '$lib/services/ical';
import { addDays } from '$lib/services/dates';
import { computeLessonStats, groupExams } from '$lib/services/timetable';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const user = requireTeacher(locals);
	const courseId = params.id;
	assertCourseOwned(courseId, user.id);

	const course = courseRepository.getById(courseId, user.id);

	if (!course) {
		throw error(404, 'Kurs nicht gefunden');
	}

	const activeTab = url.searchParams.get('tab') || 'noten';
	const settings = settingsRepository.getAll(user.id);

	const weights = {
		weightSchularbeiten: course.weightSchularbeiten,
		weightTests: course.weightTests,
		weightParticipation: course.weightParticipation,
		weightObservations: course.weightObservations,
		weightHomework: course.weightHomework
	};

	// 1. Evaluations with Grade Suggestions
	const evaluatedStudents = evaluateCourseStudents(courseId, weights, settings.earlyWarningThreshold);

	// 2. Assessments
	const assessments = assessmentRepository.getByCourse(courseId);

	// Selected assessment detail if query param exists
	const selectedAssessmentId = url.searchParams.get('assessmentId') || assessments[0]?.id;
	const candidateAssessment = selectedAssessmentId
		? assessmentRepository.getById(selectedAssessmentId)
		: null;
	const selectedAssessment =
		candidateAssessment && candidateAssessment.courseId === courseId ? candidateAssessment : null;

	// 3. Observations
	const observations = observationRepository.getByCourse(courseId);

	// 4. Stundeneinträge (Lessons)
	const lessons = lessonRepository.getByCourse(courseId);

	// 5. Homework
	const homeworks = homeworkRepository.getByCourse(courseId);

	// 6. Early Warnings
	const earlyWarnings = earlyWarningRepository.getByCourse(courseId);

	// 7. Grading Scale Templates
	const gradingTemplates = gradingTemplateRepository.getAll(user.id);

	// 8. WebUntis-Stundenplan: gehaltene Stunden, Lücken, Prüfungsvorschläge
	syncTimetableIfStale(user.id);
	const timetableState = timetableRepository.getSyncState(user.id);
	const isLinked = timetableRepository.getLinks(user.id).some((l) => l.courseId === courseId);
	const timetableEvents = isLinked ? timetableRepository.getCourseEvents(courseId, user.id) : [];
	const nowVienna = toVienna(new Date());
	const lessonDates = new Set(lessons.map((l) => l.date));
	const assessmentDates = new Set(assessments.map((a: { date: string }) => a.date));
	const oldestSuggestion = addDays(nowVienna.date, -60);
	const timetable = {
		configured: timetableState.configured,
		linked: isLinked,
		stats: isLinked ? computeLessonStats(timetableEvents, lessonDates, nowVienna) : null,
		examSuggestions: groupExams(timetableEvents).filter(
			(g) => !g.dismissed && !assessmentDates.has(g.date) && g.date >= oldestSuggestion
		),
		upcomingCancelled: timetableEvents
			.filter((e) => e.status === 'cancelled' && e.kind !== 'other' && e.date >= nowVienna.date)
			.map((e) => ({ date: e.date, startTime: e.startTime, endTime: e.endTime }))
	};

	return {
		course,
		activeTab,
		evaluatedStudents,
		assessments,
		selectedAssessment,
		observations,
		lessons,
		homeworks,
		earlyWarnings,
		gradingTemplates,
		timetable,
		defaultReturnDays: settings.defaultReturnDays,
		initialStudentId: url.searchParams.get('studentId') || null
	};
};

export const actions: Actions = guardCourseActions(
	{
		saveFinalGrade: async ({ request, params }) => {
		const form = await request.formData();
		const studentId = form.get('studentId')?.toString();
		const manualGradeRaw = form.get('manualGrade')?.toString();
		const manualGrade = manualGradeRaw && manualGradeRaw.trim() !== '' ? parseInt(manualGradeRaw, 10) : null;
		const suggestedGradeRaw = form.get('suggestedGrade')?.toString();
		const suggestedGrade = suggestedGradeRaw && suggestedGradeRaw.trim() !== '' ? parseFloat(suggestedGradeRaw) : null;
		const note = form.get('note')?.toString().trim() || null;
		const semesterRaw = form.get('semester')?.toString();

		if (!studentId) return fail(400, { success: false, message: 'Schüler-ID fehlt' });

		if (manualGrade !== null && (isNaN(manualGrade) || manualGrade < 1 || manualGrade > 5)) {
			return fail(400, { success: false, message: 'Note muss zwischen 1 und 5 liegen' });
		}

		let semester = 1;
		if (semesterRaw === '1' || semesterRaw === '2') {
			semester = parseInt(semesterRaw, 10);
		} else {
			const sy = sqlite
				.prepare(
					`
				SELECT sy.first_semester_end
				FROM courses c
				JOIN school_years sy ON c.school_year_id = sy.id
				WHERE c.id = ?
			`
				)
				.get(params.id) as { first_semester_end: string } | undefined;
			const todayStr = new Date().toISOString().slice(0, 10);
			if (sy?.first_semester_end && todayStr > sy.first_semester_end) {
				semester = 2;
			}
		}

		const existing = sqlite
			.prepare('SELECT id FROM course_final_grades WHERE course_id = ? AND student_id = ? AND semester = ?')
			.get(params.id, studentId, semester) as { id: string } | undefined;

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
					semester,
					suggestedGrade,
					manualGrade,
					note
				})
				.run();
		}

		return { success: true };
	},

	createAssessment: async ({ request, params, locals }) => {
		const form = await request.formData();
		const title = form.get('title')?.toString().trim();
		const type = form.get('type')?.toString();
		const date = form.get('date')?.toString();
		const maxPoints = parseFloat(form.get('maxPoints')?.toString() || '48');
		const defaultReturnDays = settingsRepository.get('defaultReturnDays', locals.user?.id);
		const returnDays = parseInt(form.get('returnDays')?.toString() || String(defaultReturnDays), 10);
		const note = form.get('note')?.toString().trim() || null;

		const validTypes = ['schularbeit', 'test', 'wiederholung'] as const;
		if (!title || !type || !validTypes.includes(type as any) || !date || isNaN(maxPoints) || maxPoints <= 0) {
			return fail(400, { success: false, message: 'Alle Felder müssen ausgefüllt sein (Typ: Schularbeit, Test oder Wiederholung; Punkte > 0)' });
		}

		const d = new Date(date);
		d.setDate(d.getDate() + returnDays);
		const dueDate = d.toISOString().slice(0, 10);

		const templateId = form.get('templateId')?.toString();
		const scaleJson = form.get('gradingScaleJson')?.toString();
		let gradingScale: GradingThreshold[] | undefined = undefined;

		if (scaleJson) {
			try {
				const parsed = JSON.parse(scaleJson);
				const validation = validateScale(parsed);
				if (validation.valid && validation.normalizedScale) {
					gradingScale = validation.normalizedScale;
				}
			} catch (e) {}
		}
		if (!gradingScale && templateId) {
			const tpl = gradingTemplateRepository.getById(templateId, locals.user?.id);
			if (tpl) gradingScale = tpl.scale;
		}

		const id = assessmentRepository.create({
			courseId: params.id,
			title,
			type: type as 'schularbeit' | 'test' | 'wiederholung',
			date,
			maxPoints,
			gradingScale,
			dueDate,
			note
		});

		return { success: true, createdAssessmentId: id };
	},

	updateAssessmentNote: async ({ request }) => {
		const form = await request.formData();
		const assessmentId = form.get('assessmentId')?.toString();
		const note = form.get('note')?.toString().trim() || null;

		if (!assessmentId) return fail(400, { success: false, message: 'Assessment-ID fehlt' });
		assessmentRepository.updateGlobalNote(assessmentId, note);
		return { success: true };
	},

	saveAssessmentScore: async ({ request }) => {
		const form = await request.formData();
		const assessmentId = form.get('assessmentId')?.toString();
		const studentId = form.get('studentId')?.toString();
		const pointsRaw = form.get('points')?.toString();
		const isAbsent = form.get('isAbsent') === 'true';
		const isMadeUp = form.get('isMadeUp') === 'true';
		const note = form.has('note') ? (form.get('note')?.toString().trim() || null) : undefined;

		if (!assessmentId || !studentId) return fail(400, { success: false, message: 'Parameter fehlen' });

		let points: number | null = null;
		if (pointsRaw !== '' && pointsRaw !== undefined) {
			points = parseFloat(pointsRaw);
			if (isNaN(points) || points < 0) {
				return fail(400, { success: false, message: 'Punkte dürfen nicht negativ sein' });
			}
			const assessment = sqlite
				.prepare('SELECT max_points FROM assessments WHERE id = ?')
				.get(assessmentId) as { max_points: number } | undefined;
			if (assessment && points > assessment.max_points) {
				return fail(400, {
					success: false,
					message: `Punkte (${points}) dürfen nicht höher sein als Maximalpunkte (${assessment.max_points})`
				});
			}
		}

		assessmentRepository.updateResult(assessmentId, studentId, points, isAbsent, isMadeUp, note);
		return { success: true };
	},

	updateGradingScale: async ({ request }) => {
		const form = await request.formData();
		const assessmentId = form.get('assessmentId')?.toString();
		const scaleJson = form.get('scaleJson')?.toString();

		if (!assessmentId || !scaleJson) return fail(400, { success: false, message: 'Ungültige Parameter' });

		let parsed: unknown;
		try {
			parsed = JSON.parse(scaleJson);
		} catch (e) {
			return fail(400, { success: false, message: 'Ungültiges Notenstufen-Format' });
		}

		const validation = validateScale(parsed);
		if (!validation.valid || !validation.normalizedScale) {
			return fail(400, { success: false, message: validation.error || 'Ungültige Notenstufen' });
		}

		assessmentRepository.updateGradingScale(assessmentId, validation.normalizedScale);
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

	deleteAssessment: async ({ request }) => {
		const form = await request.formData();
		const assessmentId = form.get('assessmentId')?.toString();
		if (!assessmentId) return fail(400, { success: false, message: 'Assessment-ID fehlt' });

		assessmentRepository.delete(assessmentId);
		return { success: true };
	},

	createObservation: async ({ request, params }) => {
		const form = await request.formData();
		const title = form.get('title')?.toString().trim();
		const date = form.get('date')?.toString();
		const maxPoints = parseFloat(form.get('maxPoints')?.toString() || '10');
		const note = form.get('note')?.toString().trim() || form.get('description')?.toString().trim() || null;

		if (!title || !date || isNaN(maxPoints) || maxPoints <= 0) {
			return fail(400, { success: false, message: 'Titel, Datum und gültige Max-Punkte (> 0) erforderlich' });
		}

		const id = observationRepository.create({
			courseId: params.id,
			title,
			date,
			maxPoints,
			note,
			description: note
		});

		return { success: true, createdObservationId: id };
	},

	updateObservationNote: async ({ request }) => {
		const form = await request.formData();
		const observationId = form.get('observationId')?.toString();
		const note = form.get('note')?.toString().trim() || null;

		if (!observationId) return fail(400, { success: false, message: 'Beobachtungs-ID fehlt' });
		observationRepository.updateGlobalNote(observationId, note);
		return { success: true };
	},

	saveObservationScore: async ({ request }) => {
		const form = await request.formData();
		const observationId = form.get('observationId')?.toString();
		const studentId = form.get('studentId')?.toString();
		const hasPoints = form.has('points');
		const hasNote = form.has('note');
		const pointsRaw = form.get('points')?.toString();
		const note = hasNote ? (form.get('note')?.toString().trim() || null) : undefined;

		if (!observationId || !studentId) return fail(400, { success: false, message: 'Parameter fehlen' });

		let points: number | null | undefined = undefined;
		if (hasPoints) {
			if (pointsRaw === null || pointsRaw === undefined || pointsRaw.trim() === '') {
				points = null;
			} else {
				points = parseFloat(pointsRaw);
				if (isNaN(points) || points < 0) {
					return fail(400, { success: false, message: 'Punkte dürfen nicht negativ sein' });
				}
				const obs = sqlite
					.prepare('SELECT max_points FROM observations WHERE id = ?')
					.get(observationId) as { max_points: number } | undefined;
				if (obs && points > obs.max_points) {
					return fail(400, {
						success: false,
						message: `Punkte (${points}) dürfen nicht höher sein als Maximalpunkte (${obs.max_points})`
					});
				}
			}
		}

		// Empty input with no note removes the score
		if (hasPoints && points === null && (!hasNote || !note)) {
			observationRepository.deleteScore(observationId, studentId);
		} else {
			observationRepository.saveScores(observationId, [{ studentId, points, note }]);
		}
		return { success: true };
	},

	deleteObservation: async ({ request }) => {
		const form = await request.formData();
		const observationId = form.get('observationId')?.toString();
		if (!observationId) return fail(400, { success: false, message: 'Beobachtungs-ID fehlt' });

		observationRepository.delete(observationId);
		return { success: true };
	},

	dismissTimetableExam: async ({ request, locals }) => {
		const form = await request.formData();
		const uids = (form.get('examUids')?.toString() || '').split(',').map((u) => u.trim()).filter(Boolean);
		if (uids.length === 0) return fail(400, { success: false, message: 'Prüfung fehlt' });
		timetableRepository.dismissExam(locals.user!.id, uids);
		return { success: true };
	},

	createLesson: async ({ request, params }) => {
		const form = await request.formData();
		const date = form.get('date')?.toString() || new Date().toISOString().slice(0, 10);
		const topic = form.get('topic')?.toString().trim() || null;
		const note = form.get('note')?.toString().trim() || null;

		const id = lessonRepository.create({
			courseId: params.id,
			date,
			topic,
			note
		});

		return { success: true, createdLessonId: id };
	},

	updateLessonGlobalNote: async ({ request }) => {
		const form = await request.formData();
		const lessonId = form.get('lessonId')?.toString();
		const topic = form.has('topic') ? (form.get('topic')?.toString().trim() || null) : undefined;
		const note = form.has('note') ? (form.get('note')?.toString().trim() || null) : undefined;
		const date = form.get('date')?.toString() || undefined;

		if (!lessonId) return fail(400, { success: false, message: 'Stundeneintrag-ID fehlt' });
		lessonRepository.updateGlobal(lessonId, { topic, note, date });
		return { success: true };
	},

	saveLessonStudentNote: async ({ request }) => {
		const form = await request.formData();
		const lessonId = form.get('lessonId')?.toString();
		const studentId = form.get('studentId')?.toString();
		const note = form.get('note')?.toString().trim() || null;

		if (!lessonId || !studentId) return fail(400, { success: false, message: 'Parameter fehlen' });
		lessonRepository.saveStudentNote(lessonId, studentId, note);
		return { success: true };
	},

	deleteLesson: async ({ request }) => {
		const form = await request.formData();
		const lessonId = form.get('lessonId')?.toString();
		if (!lessonId) return fail(400, { success: false, message: 'Stundeneintrag-ID fehlt' });

		lessonRepository.delete(lessonId);
		return { success: true };
	},

	createEarlyWarning: async ({ request, params }) => {
		const form = await request.formData();
		const studentId = form.get('studentId')?.toString();
		const reason = form.get('reason')?.toString().trim();
		const issuedDate = form.get('issuedDate')?.toString() || new Date().toISOString().slice(0, 10);
		const days = parseInt(form.get('days')?.toString() || '7', 10);
		const semesterForm = form.get('semester')?.toString();

		if (!studentId || !reason) {
			return fail(400, { success: false, message: 'Schüler und Begründung erforderlich' });
		}

		let semester: 1 | 2 = 1;
		if (semesterForm === '1' || semesterForm === '2') {
			semester = parseInt(semesterForm, 10) as 1 | 2;
		} else {
			const sy = sqlite
				.prepare(
					`
				SELECT sy.first_semester_end
				FROM courses c
				JOIN school_years sy ON c.school_year_id = sy.id
				WHERE c.id = ?
			`
				)
				.get(params.id) as { first_semester_end: string } | undefined;
			if (sy?.first_semester_end && issuedDate > sy.first_semester_end) {
				semester = 2;
			}
		}

		const d = new Date(issuedDate);
		d.setDate(d.getDate() + days);
		const dueDate = d.toISOString().slice(0, 10);

		earlyWarningRepository.create({
			studentId,
			courseId: params.id,
			semester,
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

	setHomeworkStatus: async ({ request }) => {
		const form = await request.formData();
		const homeworkId = form.get('homeworkId')?.toString();
		const studentId = form.get('studentId')?.toString();
		const status = form.get('status')?.toString() as 'done' | 'partial' | 'forgotten';

		if (!homeworkId || !studentId || !status) {
			return fail(400, { success: false, message: 'Fehlende Felder' });
		}

		homeworkRepository.toggleStatus(homeworkId, studentId, status);
		return { success: true };
	},

	markAllHomeworkDone: async ({ request, params }) => {
		const form = await request.formData();
		const homeworkId = form.get('homeworkId')?.toString();
		if (!homeworkId) return fail(400, { success: false, message: 'Hausübung fehlt' });

		homeworkRepository.markAllDone(homeworkId, params.id);
		return { success: true };
	},

	resetHomeworkStatuses: async ({ request }) => {
		const form = await request.formData();
		const homeworkId = form.get('homeworkId')?.toString();
		if (!homeworkId) return fail(400, { success: false, message: 'Hausübung fehlt' });

		homeworkRepository.resetAll(homeworkId);
		return { success: true };
	},

	deleteHomework: async ({ request }) => {
		const form = await request.formData();
		const homeworkId = form.get('homeworkId')?.toString();
		if (!homeworkId) return fail(400, { success: false, message: 'Hausübung fehlt' });

		homeworkRepository.delete(homeworkId);
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
	},
	{ courseIdParam: 'id' }
);
