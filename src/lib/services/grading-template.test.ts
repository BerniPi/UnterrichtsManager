import { describe, it, expect } from 'vitest';
import { gradingTemplateRepository } from '../server/repositories/grading-template.repository';
import { assessmentRepository } from '../server/repositories/assessment.repository';
import { courseRepository } from '../server/repositories/course.repository';
import { calculateGradeFromPoints } from './grading';
import { db } from '../server/db';
import * as schema from '../server/db/schema';
import { eq } from 'drizzle-orm';

describe('Grading Template Integration Tests', () => {
	it('seeds and retrieves default grading templates', () => {
		const templates = gradingTemplateRepository.getAll();
		expect(templates.length).toBeGreaterThanOrEqual(4);

		const defaultTpl = gradingTemplateRepository.getDefault();
		expect(defaultTpl).toBeDefined();
		expect(defaultTpl?.isDefault).toBe(true);
		expect(defaultTpl?.name).toContain('Standard');
	});

	it('creates, retrieves, updates and deletes a custom grading template', () => {
		const newId = gradingTemplateRepository.create({
			name: 'Unterstufe 1. Klasse',
			description: 'Milderer Einstiegsschlüssel',
			scale: [
				{ grade: 1, minPercent: 84 },
				{ grade: 2, minPercent: 70 },
				{ grade: 3, minPercent: 55 },
				{ grade: 4, minPercent: 45 },
				{ grade: 5, minPercent: 0 }
			],
			isDefault: false
		});

		expect(newId).toBeDefined();

		const loaded = gradingTemplateRepository.getById(newId);
		expect(loaded).toBeDefined();
		expect(loaded?.name).toBe('Unterstufe 1. Klasse');
		expect(loaded?.scale[0].minPercent).toBe(84);
		expect(loaded?.isDefault).toBe(false);

		// Update template
		gradingTemplateRepository.update(newId, {
			name: 'Unterstufe 1. Klasse (Aktualisiert)',
			description: 'Angepasst',
			scale: [
				{ grade: 1, minPercent: 82 },
				{ grade: 2, minPercent: 68 },
				{ grade: 3, minPercent: 54 },
				{ grade: 4, minPercent: 44 },
				{ grade: 5, minPercent: 0 }
			],
			isDefault: false
		});

		const updated = gradingTemplateRepository.getById(newId);
		expect(updated?.name).toBe('Unterstufe 1. Klasse (Aktualisiert)');
		expect(updated?.scale[0].minPercent).toBe(82);

		// Delete template
		gradingTemplateRepository.delete(newId);
		const deleted = gradingTemplateRepository.getById(newId);
		expect(deleted).toBeNull();
	});

	it('creates assessment using template scale and calculates correct grades', () => {
		const courses = courseRepository.getAll();
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

		// Verify calculated grades:
		// Grade 1 ab 85% = 34 Pkt
		// Grade 2 ab 70% = 28 Pkt
		// Grade 3 ab 55% = 22 Pkt
		// Grade 4 ab 45% = 18 Pkt
		// Grade 5 < 18 Pkt
		expect(calculateGradeFromPoints(35, 40, assessment?.scale)).toBe(1);
		expect(calculateGradeFromPoints(28, 40, assessment?.scale)).toBe(2);
		expect(calculateGradeFromPoints(22, 40, assessment?.scale)).toBe(3);
		expect(calculateGradeFromPoints(18, 40, assessment?.scale)).toBe(4);
		expect(calculateGradeFromPoints(17.5, 40, assessment?.scale)).toBe(5);

		// Clean up
		db.delete(schema.assessments).where(eq(schema.assessments.id, testId)).run();
	});
});
