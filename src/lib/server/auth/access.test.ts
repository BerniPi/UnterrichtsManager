import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
	requireUser,
	requireTeacher,
	requireAdmin,
	assertCourseOwned,
	verifyActionOwnership
} from './access';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

function expectHttpStatus(fn: () => unknown, expectedStatus: number) {
	let caught: any = null;
	try {
		fn();
	} catch (e) {
		caught = e;
	}
	expect(caught).not.toBeNull();
	expect(caught?.status).toBe(expectedStatus);
}

describe('Multi-User Access & Ownership Guards', () => {
	const syId = crypto.randomUUID();
	const class1Id = crypto.randomUUID();
	const class2Id = crypto.randomUUID();
	const student1Id = crypto.randomUUID();
	const student2Id = crypto.randomUUID();

	const teacher1Id = crypto.randomUUID();
	const teacher2Id = crypto.randomUUID();

	const course1Id = crypto.randomUUID();
	const course2Id = crypto.randomUUID();

	const assessment1Id = crypto.randomUUID();
	const assessment2Id = crypto.randomUUID();
	const return1Id = crypto.randomUUID();
	const return2Id = crypto.randomUUID();
	const warning1Id = crypto.randomUUID();
	const warning2Id = crypto.randomUUID();
	const obs1Id = crypto.randomUUID();
	const obs2Id = crypto.randomUUID();
	const lesson1Id = crypto.randomUUID();
	const lesson2Id = crypto.randomUUID();
	const hw1Id = crypto.randomUUID();
	const hw2Id = crypto.randomUUID();
	const note1Id = crypto.randomUUID();
	const note2Id = crypto.randomUUID();

	beforeAll(() => {
		db.insert(schema.schoolYears)
			.values({
				id: syId,
				name: '2099/00',
				startDate: '2099-09-01',
				endDate: '2100-07-01',
				firstSemesterEnd: '2100-02-01',
				secondSemesterEnd: '2100-07-01',
				gradingDeadline1: '2100-01-20',
				gradingDeadline2: '2100-06-20',
				earlyWarningDeadline1: '2099-12-15',
				earlyWarningDeadline2: '2100-05-15',
				isCurrent: false
			})
			.run();

		db.insert(schema.classes)
			.values([
				{ id: class1Id, name: '1A-Test', schoolYearId: syId },
				{ id: class2Id, name: '2B-Test', schoolYearId: syId }
			])
			.run();

		db.insert(schema.students)
			.values([
				{ id: student1Id, classId: class1Id, firstName: 'S1', lastName: 'C1', status: 'active' },
				{ id: student2Id, classId: class2Id, firstName: 'S2', lastName: 'C2', status: 'active' }
			])
			.run();

		db.insert(schema.users)
			.values([
				{
					id: teacher1Id,
					username: `t1_${teacher1Id.slice(0, 6)}`,
					passwordHash: 'h',
					totpEnabled: false,
					createdAt: Date.now(),
					role: 'teacher',
					isActive: true
				},
				{
					id: teacher2Id,
					username: `t2_${teacher2Id.slice(0, 6)}`,
					passwordHash: 'h',
					totpEnabled: false,
					createdAt: Date.now(),
					role: 'teacher',
					isActive: true
				}
			])
			.run();

		db.insert(schema.courses)
			.values([
				{
					id: course1Id,
					classId: class1Id,
					schoolYearId: syId,
					subject: 'Mathematik',
					teacherId: teacher1Id
				},
				{
					id: course2Id,
					classId: class2Id,
					schoolYearId: syId,
					subject: 'Physik',
					teacherId: teacher2Id
				}
			])
			.run();

		db.insert(schema.assessments)
			.values([
				{
					id: assessment1Id,
					courseId: course1Id,
					title: 'SA 1',
					type: 'schularbeit',
					date: '2099-10-10',
					maxPoints: 40,
					gradingScale: '[]',
					isCounted: true
				},
				{
					id: assessment2Id,
					courseId: course2Id,
					title: 'SA 2',
					type: 'schularbeit',
					date: '2099-10-10',
					maxPoints: 40,
					gradingScale: '[]',
					isCounted: true
				}
			])
			.run();

		db.insert(schema.assessmentReturns)
			.values([
				{
					id: return1Id,
					assessmentId: assessment1Id,
					studentId: student1Id,
					dueDate: '2099-10-17',
					isSigned: false
				},
				{
					id: return2Id,
					assessmentId: assessment2Id,
					studentId: student2Id,
					dueDate: '2099-10-17',
					isSigned: false
				}
			])
			.run();

		db.insert(schema.earlyWarnings)
			.values([
				{
					id: warning1Id,
					courseId: course1Id,
					studentId: student1Id,
					semester: 1,
					issuedDate: '2099-10-12',
					reason: 'Test',
					dueDate: '2099-10-19'
				},
				{
					id: warning2Id,
					courseId: course2Id,
					studentId: student2Id,
					semester: 1,
					issuedDate: '2099-10-12',
					reason: 'Test',
					dueDate: '2099-10-19'
				}
			])
			.run();

		db.insert(schema.observations)
			.values([
				{ id: obs1Id, courseId: course1Id, title: 'Obs 1', date: '2099-10-11', maxPoints: 10 },
				{ id: obs2Id, courseId: course2Id, title: 'Obs 2', date: '2099-10-11', maxPoints: 10 }
			])
			.run();

		db.insert(schema.lessonEntries)
			.values([
				{ id: lesson1Id, courseId: course1Id, date: '2099-10-11', createdAt: Date.now() },
				{ id: lesson2Id, courseId: course2Id, date: '2099-10-11', createdAt: Date.now() }
			])
			.run();

		db.insert(schema.homeworks)
			.values([
				{ id: hw1Id, courseId: course1Id, title: 'HÜ 1', dueDate: '2099-10-15' },
				{ id: hw2Id, courseId: course2Id, title: 'HÜ 2', dueDate: '2099-10-15' }
			])
			.run();

		db.insert(schema.notes)
			.values([
				{
					id: note1Id,
					studentId: student1Id,
					courseId: course1Id,
					authorId: teacher1Id,
					date: '2099-10-12',
					category: 'allgemein',
					title: 'N1',
					content: 'C1'
				},
				{
					id: note2Id,
					studentId: student2Id,
					courseId: course2Id,
					authorId: teacher2Id,
					date: '2099-10-12',
					category: 'allgemein',
					title: 'N2',
					content: 'C2'
				}
			])
			.run();
	});

	afterAll(() => {
		db.delete(schema.schoolYears).where(eq(schema.schoolYears.id, syId)).run();
		db.delete(schema.users).where(eq(schema.users.id, teacher1Id)).run();
		db.delete(schema.users).where(eq(schema.users.id, teacher2Id)).run();
	});

	it('enforces role checks in requireUser, requireTeacher and requireAdmin', () => {
		expectHttpStatus(() => requireUser({ user: null, session: null }), 403);

		const studentLocals: App.Locals = {
			user: {
				id: 's1',
				username: 'schueler1',
				totpEnabled: false,
				role: 'student',
				displayName: null,
				isActive: true,
				studentId: student1Id
			},
			session: null
		};
		expect(requireUser(studentLocals).id).toBe('s1');
		expectHttpStatus(() => requireTeacher(studentLocals), 403);
		expectHttpStatus(() => requireAdmin(studentLocals), 403);

		const teacherLocals: App.Locals = {
			user: {
				id: teacher1Id,
				username: 't1',
				totpEnabled: false,
				role: 'teacher',
				displayName: null,
				isActive: true,
				studentId: null
			},
			session: null
		};
		expect(requireTeacher(teacherLocals).id).toBe(teacher1Id);
		expectHttpStatus(() => requireAdmin(teacherLocals), 403);

		const adminLocals: App.Locals = {
			user: {
				id: teacher1Id,
				username: 'admin1',
				totpEnabled: false,
				role: 'admin',
				displayName: null,
				isActive: true,
				studentId: null
			},
			session: null
		};
		expect(requireTeacher(adminLocals).role).toBe('admin');
		expect(requireAdmin(adminLocals).role).toBe('admin');
	});

	it('returns 404 from assertCourseOwned for foreign or non-existent courses', () => {
		const owned = assertCourseOwned(course1Id, teacher1Id);
		expect(owned.id).toBe(course1Id);

		// Foreign course -> 404 (not 403)
		expectHttpStatus(() => assertCourseOwned(course2Id, teacher1Id), 404);
		// Non-existent course -> 404
		expectHttpStatus(() => assertCourseOwned(crypto.randomUUID(), teacher1Id), 404);
	});

	it('allows own entity IDs and rejects foreign entity IDs in verifyActionOwnership', () => {
		const cases: Array<[string, string, string]> = [
			['courseId', course1Id, course2Id],
			['assessmentId', assessment1Id, assessment2Id],
			['observationId', obs1Id, obs2Id],
			['lessonId', lesson1Id, lesson2Id],
			['homeworkId', hw1Id, hw2Id],
			['returnId', return1Id, return2Id],
			['warningId', warning1Id, warning2Id],
			['noteId', note1Id, note2Id]
		];

		for (const [field, ownId, foreignId] of cases) {
			const okForm = new FormData();
			okForm.set(field, ownId);
			expect(() => verifyActionOwnership(okForm, teacher1Id)).not.toThrow();

			const badForm = new FormData();
			badForm.set(field, foreignId);
			expectHttpStatus(() => verifyActionOwnership(badForm, teacher1Id), 404);
		}
	});

	it('validates entityType/entityId and type/id pairs against course ownership', () => {
		for (const [typeKey, idKey] of [
			['entityType', 'entityId'],
			['type', 'id']
		] as const) {
			const ownReturnForm = new FormData();
			ownReturnForm.set(typeKey, 'assessment_return');
			ownReturnForm.set(idKey, return1Id);
			expect(() => verifyActionOwnership(ownReturnForm, teacher1Id)).not.toThrow();

			const foreignReturnForm = new FormData();
			foreignReturnForm.set(typeKey, 'assessment_return');
			foreignReturnForm.set(idKey, return2Id);
			expectHttpStatus(() => verifyActionOwnership(foreignReturnForm, teacher1Id), 404);

			const ownWarningForm = new FormData();
			ownWarningForm.set(typeKey, 'early_warning');
			ownWarningForm.set(idKey, warning1Id);
			expect(() => verifyActionOwnership(ownWarningForm, teacher1Id)).not.toThrow();

			const foreignWarningForm = new FormData();
			foreignWarningForm.set(typeKey, 'early_warning');
			foreignWarningForm.set(idKey, warning2Id);
			expectHttpStatus(() => verifyActionOwnership(foreignWarningForm, teacher1Id), 404);
		}
	});

	it('verifies that studentId belongs to the class of the course', () => {
		// Student 1 is in Class 1 (Course 1) -> allowed
		const validForm = new FormData();
		validForm.set('studentId', student1Id);
		expect(() => verifyActionOwnership(validForm, teacher1Id, course1Id)).not.toThrow();

		// Student 2 is in Class 2 -> rejected on Course 1 with 404
		const crossClassForm = new FormData();
		crossClassForm.set('studentId', student2Id);
		expectHttpStatus(() => verifyActionOwnership(crossClassForm, teacher1Id, course1Id), 404);
	});
});
