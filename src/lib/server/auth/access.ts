import { error, type Action, type Actions, type RequestEvent } from '@sveltejs/kit';
import { sqlite } from '$lib/server/db';

export type AuthenticatedUser = NonNullable<App.Locals['user']>;

export function requireUser(locals: App.Locals): AuthenticatedUser {
	if (!locals.user || !locals.user.isActive) {
		throw error(403, 'Nicht angemeldet');
	}
	return locals.user;
}

export function requireTeacher(locals: App.Locals): AuthenticatedUser {
	const user = requireUser(locals);
	if (user.role !== 'teacher' && user.role !== 'admin') {
		throw error(403, 'Zugriff nur für Lehrkräfte erlaubt');
	}
	return user;
}

export function requireAdmin(locals: App.Locals): AuthenticatedUser {
	const user = requireUser(locals);
	if (user.role !== 'admin') {
		throw error(403, 'Zugriff nur für Administratoren erlaubt');
	}
	return user;
}

export interface OwnedCourseRow {
	id: string;
	classId: string;
	schoolYearId: string;
	subject: string;
	teacherId: string;
}

/**
 * Verifies that the given course exists and belongs to userId.
 * Throws 404 (not 403) so callers cannot probe whether a foreign course ID exists.
 */
export function assertCourseOwned(courseId: string, userId: string): OwnedCourseRow {
	const row = sqlite
		.prepare(
			`
		SELECT
			id,
			class_id as classId,
			school_year_id as schoolYearId,
			subject,
			teacher_id as teacherId
		FROM courses
		WHERE id = ? AND teacher_id = ?
	`
		)
		.get(courseId, userId) as OwnedCourseRow | undefined;

	if (!row) {
		throw error(404, 'Kurs nicht gefunden');
	}
	return row;
}

/**
 * Inspects form fields and asserts that every referenced entity belongs to a course
 * (or note) owned by userId, and that studentId belongs to the course's class.
 */
export function verifyActionOwnership(
	formData: FormData,
	userId: string,
	routeCourseId?: string
): void {
	const resolvedClassIds = new Set<string>();

	if (routeCourseId) {
		const routeCourse = assertCourseOwned(routeCourseId, userId);
		resolvedClassIds.add(routeCourse.classId);
	}

	const checkCourse = (courseId: string) => {
		const owned = assertCourseOwned(courseId, userId);
		if (routeCourseId && owned.id !== routeCourseId) {
			throw error(404, 'Kurs nicht gefunden');
		}
		resolvedClassIds.add(owned.classId);
		return owned;
	};

	const formCourseId = formData.get('courseId')?.toString().trim();
	if (formCourseId) {
		checkCourse(formCourseId);
	}
	const effectiveCourseId = formCourseId || routeCourseId;

	const assessmentId = formData.get('assessmentId')?.toString().trim();
	if (assessmentId) {
		const row = sqlite
			.prepare('SELECT course_id FROM assessments WHERE id = ?')
			.get(assessmentId) as { course_id: string } | undefined;
		if (!row) throw error(404, 'Beurteilung nicht gefunden');
		checkCourse(row.course_id);
		if (effectiveCourseId && row.course_id !== effectiveCourseId) {
			throw error(404, 'Beurteilung gehört nicht zu diesem Kurs');
		}
	}

	const observationId = formData.get('observationId')?.toString().trim();
	if (observationId) {
		const row = sqlite
			.prepare('SELECT course_id FROM observations WHERE id = ?')
			.get(observationId) as { course_id: string } | undefined;
		if (!row) throw error(404, 'Beobachtung nicht gefunden');
		checkCourse(row.course_id);
		if (effectiveCourseId && row.course_id !== effectiveCourseId) {
			throw error(404, 'Beobachtung gehört nicht zu diesem Kurs');
		}
	}

	const lessonId = formData.get('lessonId')?.toString().trim();
	if (lessonId) {
		const row = sqlite
			.prepare('SELECT course_id FROM lesson_entries WHERE id = ?')
			.get(lessonId) as { course_id: string } | undefined;
		if (!row) throw error(404, 'Stundeneintrag nicht gefunden');
		checkCourse(row.course_id);
		if (effectiveCourseId && row.course_id !== effectiveCourseId) {
			throw error(404, 'Stundeneintrag gehört nicht zu diesem Kurs');
		}
	}

	const homeworkId = formData.get('homeworkId')?.toString().trim();
	if (homeworkId) {
		const row = sqlite
			.prepare('SELECT course_id FROM homeworks WHERE id = ?')
			.get(homeworkId) as { course_id: string } | undefined;
		if (!row) throw error(404, 'Hausübung nicht gefunden');
		checkCourse(row.course_id);
		if (effectiveCourseId && row.course_id !== effectiveCourseId) {
			throw error(404, 'Hausübung gehört nicht zu diesem Kurs');
		}
	}

	const checkReturn = (returnId: string) => {
		const row = sqlite
			.prepare(
				`
			SELECT a.course_id
			FROM assessment_returns ar
			JOIN assessments a ON ar.assessment_id = a.id
			WHERE ar.id = ?
		`
			)
			.get(returnId) as { course_id: string } | undefined;
		if (!row) throw error(404, 'Rücklauf nicht gefunden');
		checkCourse(row.course_id);
		if (effectiveCourseId && row.course_id !== effectiveCourseId) {
			throw error(404, 'Rücklauf gehört nicht zu diesem Kurs');
		}
	};

	const checkWarning = (warningId: string) => {
		const row = sqlite
			.prepare('SELECT course_id FROM early_warnings WHERE id = ?')
			.get(warningId) as { course_id: string } | undefined;
		if (!row) throw error(404, 'Frühwarnung nicht gefunden');
		checkCourse(row.course_id);
		if (effectiveCourseId && row.course_id !== effectiveCourseId) {
			throw error(404, 'Frühwarnung gehört nicht zu diesem Kurs');
		}
	};

	const returnId = formData.get('returnId')?.toString().trim();
	if (returnId) {
		checkReturn(returnId);
	}

	const warningId = formData.get('warningId')?.toString().trim();
	if (warningId) {
		checkWarning(warningId);
	}

	const noteId = formData.get('noteId')?.toString().trim();
	if (noteId) {
		const row = sqlite
			.prepare('SELECT author_id, course_id FROM notes WHERE id = ?')
			.get(noteId) as { author_id: string | null; course_id: string | null } | undefined;
		if (!row || row.author_id !== userId) {
			throw error(404, 'Notiz nicht gefunden');
		}
		if (row.course_id) {
			checkCourse(row.course_id);
		}
	}

	// Pairs: entityType/entityId and type/id
	for (const [typeKey, idKey] of [
		['entityType', 'entityId'],
		['type', 'id']
	] as const) {
		const entityType = formData.get(typeKey)?.toString().trim();
		const entityId = formData.get(idKey)?.toString().trim();

		if (entityType === 'assessment_return') {
			if (!entityId) throw error(404, 'Rücklauf nicht gefunden');
			checkReturn(entityId);
		} else if (entityType === 'early_warning') {
			if (!entityId) throw error(404, 'Frühwarnung nicht gefunden');
			checkWarning(entityId);
		} else if (typeKey === 'entityType' && (entityType || entityId)) {
			throw error(404, 'Eintrag nicht gefunden');
		}
	}

	const studentId = formData.get('studentId')?.toString().trim();
	if (studentId) {
		const student = sqlite
			.prepare('SELECT id, class_id FROM students WHERE id = ?')
			.get(studentId) as { id: string; class_id: string } | undefined;

		if (!student) {
			throw error(404, 'Schüler nicht gefunden');
		}

		if (resolvedClassIds.size > 0) {
			if (!resolvedClassIds.has(student.class_id)) {
				throw error(404, 'Schüler gehört nicht zur Klasse des Kurses');
			}
		} else {
			const teachesClass = sqlite
				.prepare('SELECT 1 FROM courses WHERE class_id = ? AND teacher_id = ? LIMIT 1')
				.get(student.class_id, userId);
			if (!teachesClass) {
				throw error(404, 'Schüler gehört nicht zu einem eigenen Kurs');
			}
		}
	}
}

/**
 * Wraps all form actions of a route with teacher check + course/entity ownership guard.
 */
export function guardCourseActions<T extends Record<string, any>>(
	actions: T,
	options: { courseIdParam?: string } = {}
): T {
	const wrapped: Record<string, Action> = {};

	for (const [name, handler] of Object.entries(actions)) {
		if (!handler) continue;
		wrapped[name] = async (event: RequestEvent) => {
			const user = requireTeacher(event.locals);
			const routeCourseId = options.courseIdParam
				? (event.params as Record<string, string | undefined>)[options.courseIdParam]
				: undefined;

			let formData: FormData | null = null;
			const contentType = event.request.headers.get('content-type') || '';
			if (
				contentType.includes('application/x-www-form-urlencoded') ||
				contentType.includes('multipart/form-data')
			) {
				formData = await event.request.clone().formData();
			} else {
				try {
					formData = await event.request.clone().formData();
				} catch {
					formData = new FormData();
				}
			}

			verifyActionOwnership(formData, user.id, routeCourseId);
			return handler(event as any);
		};
	}

	return wrapped as T;
}
