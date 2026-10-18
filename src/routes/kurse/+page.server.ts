import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { courseRepository } from '$lib/server/repositories/course.repository';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ parent }) => {
	const layoutData = await parent();
	const sy = layoutData.currentSchoolYear;

	if (!sy) {
		return { courses: [], classes: [] };
	}

	const courses = courseRepository.getBySchoolYear(sy.id);
	const classes = layoutData.classesList || [];

	return {
		currentSchoolYear: sy,
		courses,
		classes
	};
};

export const actions: Actions = {
	createCourse: async ({ request }) => {
		const form = await request.formData();
		const classId = form.get('classId')?.toString();
		const schoolYearId = form.get('schoolYearId')?.toString();
		const subject = form.get('subject')?.toString().trim();

		const weightSchularbeiten = parseFloat(form.get('weightSchularbeiten')?.toString() || '40');
		const weightTests = parseFloat(form.get('weightTests')?.toString() || '20');
		const weightParticipation = parseFloat(form.get('weightParticipation')?.toString() || '25');
		const weightObservations = parseFloat(form.get('weightObservations')?.toString() || '10');
		const weightHomework = parseFloat(form.get('weightHomework')?.toString() || '5');

		if (!classId || !schoolYearId || !subject) {
			return fail(400, { success: false, message: 'Klasse und Fach erforderlich' });
		}

		courseRepository.create({
			classId,
			schoolYearId,
			subject,
			weightSchularbeiten,
			weightTests,
			weightParticipation,
			weightObservations,
			weightHomework
		});

		return { success: true };
	}
};
