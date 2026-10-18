import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { courseRepository } from '$lib/server/repositories/course.repository';
import { evaluateCourseStudents } from '$lib/services/student-evaluator';
import { generateWebUntisExcel, generateWebUntisCsv } from '$lib/services/export/webuntis';

export const GET: RequestHandler = async ({ url }) => {
	const courseId = url.searchParams.get('courseId');
	const format = url.searchParams.get('format') || 'xlsx';

	if (!courseId) {
		throw error(400, 'courseId parameter erforderlich');
	}

	const course = courseRepository.getById(courseId);
	if (!course) {
		throw error(404, 'Kurs nicht gefunden');
	}

	const weights = {
		weightSchularbeiten: course.weightSchularbeiten,
		weightTests: course.weightTests,
		weightParticipation: course.weightParticipation,
		weightObservations: course.weightObservations,
		weightHomework: course.weightHomework
	};

	const evaluatedStudents = evaluateCourseStudents(courseId, weights);

	const exportRows = evaluatedStudents.map((s) => ({
		lastName: s.lastName,
		firstName: s.firstName,
		webuntisId: s.webuntisId,
		catalogNumber: s.catalogNumber,
		suggestedGrade: s.breakdown.suggestedGrade,
		manualGrade: s.manualFinalGrade,
		note: s.manualNote
	}));

	const sanitizedFilename = `Noten_${course.className}_${course.subject}`.replace(/[^a-zA-Z0-9_-]/g, '_');

	if (format === 'csv') {
		const csvContent = generateWebUntisCsv(exportRows);
		return new Response(csvContent, {
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="${sanitizedFilename}.csv"`
			}
		});
	}

	const excelBuffer = generateWebUntisExcel(exportRows, `${course.className} ${course.subject}`);
	return new Response(excelBuffer, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${sanitizedFilename}.xlsx"`
		}
	});
};
