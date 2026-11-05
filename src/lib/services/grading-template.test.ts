import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { gradingTemplateRepository } from '../server/repositories/grading-template.repository';
import { assessmentRepository } from '../server/repositories/assessment.repository';
import { courseRepository } from '../server/repositories/course.repository';
import { calculateGradeFromPoints } from './grading';
import { db } from '../server/db';
import * as schema from '../server/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

describe('Grading Template Integration Tests (Per-User)', () => {
	const userAId = crypto.randomUUID();
	const userBId = crypto.randomUUID();

	beforeAll(() => {
		db.insert(schema.users)
			.values([
				{
					id: userAId,
					username: `tpl_test_a_${userAId.slice(0, 8)}`,
					passwordHash: 'hash',
					totpEnabled: false,
					createdAt: Date.now(),
					role: 'teacher',
					isActive: true
				},
				{
					id: userBId,
					username: `tpl_test_b_${userBId.slice(0, 8)}`,
					passwordHash: 'hash',
					totpEnabled: false,
					createdAt: Date.now(),
					role: 'teacher',
					isActive: true
				}
			])
			.run();
	});

	afterAll(() => {
		db.delete(schema.users).where(eq(schema.users.id, userAId)).run();
		db.delete(schema.users).where(eq(schema.users.id, userBId)).run();
	});

	it('seeds and retrieves default grading templates per user independently', () => {
		const templatesA = gradingTemplateRepository.getAll(userAId);
		const templatesB = gradingTemplateRepository.getAll(userBId);

		expect(templatesA.length).toBe(4);
		expect(templatesB.length).toBe(4);

		const defaultA = gradingTemplateRepository.getDefault(userAId);
		const defaultB = gradingTemplateRepository.getDefault(userBId);

		expect(defaultA).toBeDefined();
		expect(defaultA?.isDefault).toBe(true);
		expect(defaultB).toBeDefined();
		expect(defaultB?.isDefault).toBe(true);
		expect(defaultA?.id).not.toBe(defaultB?.id);
	});

	it('creates, updates, sets default and deletes a custom template isolated per user', () => {
		const newId = gradingTemplateRepository.create(
			{
				name: 'Unterstufe 1. Klasse',
				description: 'Milderer Einstiegsschlüssel',
				scale: [
					{ grade: 1, minPercent: 84 },
					{ grade: 2, minPercent: 70 },
					{ grade: 3, minPercent: 55 },
					{ grade: 4, minPercent: 45 },
					{ grade: 5, minPercent: 0 }
				],
				isDefault: true
			},
			userAId
		);

		expect(newId).toBeDefined();

		const loadedA = gradingTemplateRepository.getById(newId, userAId);
		expect(loadedA).toBeDefined();
		expect(loadedA?.name).toBe('Unterstufe 1. Klasse');
		expect(loadedA?.isDefault).toBe(true);

		// User B cannot access User A's template by user-scoped lookup and keeps their own default
		const loadedByB = gradingTemplateRepository.getById(newId, userBId);
		expect(loadedByB).toBeNull();
		const defaultB = gradingTemplateRepository.getDefault(userBId);
		expect(defaultB?.name).toContain('Standard');

		// Update template for User A
		gradingTemplateRepository.update(
			newId,
			{
				name: 'Unterstufe 1. Klasse (Aktualisiert)',
				description: 'Angepasst',
				scale: [
					{ grade: 1, minPercent: 82 },
					{ grade: 2, minPercent: 68 },
					{ grade: 3, minPercent: 54 },
					{ grade: 4, minPercent: 44 },
					{ grade: 5, minPercent: 0 }
				],
				isDefault: true
			},
			userAId
		);

		const updated = gradingTemplateRepository.getById(newId, userAId);
		expect(updated?.name).toBe('Unterstufe 1. Klasse (Aktualisiert)');
		expect(updated?.scale[0].minPercent).toBe(82);

		// Delete template for User A -> fallback default is automatically restored
		gradingTemplateRepository.delete(newId, userAId);
		const deleted = gradingTemplateRepository.getById(newId, userAId);
		expect(deleted).toBeNull();

		const restoredDefaultA = gradingTemplateRepository.getDefault(userAId);
		expect(restoredDefaultA?.isDefault).toBe(true);
	});

	it('creates assessment using template scale and calculates correct grades', () => {
		const courses = courseRepository.getAll();
		expect(courses).toBeDefined();
		if (courses.length === 0) return;

		const course = courses[0];
		const customScale = [
			{ grade: 1, minPercent: 85 },
			{ grade: 2, minPercent: 70 },
			{ grade: 3, minPercent: 55 },
			{ grade: 4, minPercent: 45 },
			{ grade: 5, minPercent: 0 }
		];

		const testId = assessmentRepository.create({
			courseId: course.id,
			title: 'Template Integration Test Schularbeit',
			type: 'schularbeit',
			date: '2026-10-25',
			maxPoints: 40,
			gradingScale: customScale,
			dueDate: '2026-11-01'
		});

		const assessment = assessmentRepository.getById(testId);
		expect(assessment).toBeDefined();
		expect(assessment?.scale).toEqual(customScale);

		expect(calculateGradeFromPoints(35, 40, assessment?.scale)).toBe(1);
		expect(calculateGradeFromPoints(28, 40, assessment?.scale)).toBe(2);
		expect(calculateGradeFromPoints(22, 40, assessment?.scale)).toBe(3);
		expect(calculateGradeFromPoints(18, 40, assessment?.scale)).toBe(4);
		expect(calculateGradeFromPoints(17.5, 40, assessment?.scale)).toBe(5);

		db.delete(schema.assessments).where(eq(schema.assessments.id, testId)).run();
	});
});
