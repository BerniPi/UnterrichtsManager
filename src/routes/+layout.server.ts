import type { LayoutServerLoad } from './$types';
import { db, sqlite } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getOverdueItems } from '$lib/server/reminders/dispatcher';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { user: null };
	}

	const schoolYearsList = db.select().from(schema.schoolYears).orderBy(desc(schema.schoolYears.startDate)).all();
	const currentSchoolYear = schoolYearsList.find((sy) => sy.isCurrent) || schoolYearsList[0];

	let coursesList: Array<{
		id: string;
		subject: string;
		className: string;
		classId: string;
	}> = [];

	let classesList: Array<{
		id: string;
		name: string;
		room: string | null;
	}> = [];

	if (currentSchoolYear) {
		classesList = db
			.select({
				id: schema.classes.id,
				name: schema.classes.name,
				room: schema.classes.room
			})
			.from(schema.classes)
			.where(eq(schema.classes.schoolYearId, currentSchoolYear.id))
			.all();

		coursesList = sqlite
			.prepare(
				`
			SELECT c.id, c.subject, cl.name as className, cl.id as classId, cl.name as class_name, cl.id as class_id
			FROM courses c
			JOIN classes cl ON c.class_id = cl.id
			WHERE c.school_year_id = ?
			ORDER BY cl.name ASC, c.subject ASC
		`
			)
			.all(currentSchoolYear.id) as any;
	}

	const overdueSummary = getOverdueItems();

	return {
		user: locals.user,
		currentSchoolYear,
		schoolYearsList,
		classesList,
		coursesList,
		totalOverdueCount: overdueSummary.totalOverdue
	};
};
