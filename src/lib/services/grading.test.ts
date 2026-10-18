import { describe, it, expect } from 'vitest';
import {
	calculateGradeFromPoints,
	calculateParticipationScore,
	calculateHomeworkScore,
	calculateObservationsScore,
	calculateGradeSuggestion,
	getGradeIntervals,
	DEFAULT_AUSTRIAN_SCALE,
	DEFAULT_TEMPLATES,
	type CourseWeights,
	type StudentPerformanceData
} from './grading';

describe('Austrian Grading Logic', () => {
	it('correctly maps percentages to Austrian grades 1-5', () => {
		// 100 points total
		expect(calculateGradeFromPoints(100, 100)).toBe(1);
		expect(calculateGradeFromPoints(88, 100)).toBe(1);
		expect(calculateGradeFromPoints(87.9, 100)).toBe(2);
		expect(calculateGradeFromPoints(75, 100)).toBe(2);
		expect(calculateGradeFromPoints(74.9, 100)).toBe(3);
		expect(calculateGradeFromPoints(60, 100)).toBe(3);
		expect(calculateGradeFromPoints(59.9, 100)).toBe(4);
		expect(calculateGradeFromPoints(50, 100)).toBe(4);
		expect(calculateGradeFromPoints(49.9, 100)).toBe(5);
		expect(calculateGradeFromPoints(0, 100)).toBe(5);
	});

	it('handles null, undefined or absent scores', () => {
		expect(calculateGradeFromPoints(null, 50)).toBeNull();
		expect(calculateGradeFromPoints(undefined, 50)).toBeNull();
		expect(calculateGradeFromPoints(0, 0)).toBeNull();
	});

	it('computes participation score based on plus/tilde/minus balance', () => {
		// All plus -> 1.0
		expect(calculateParticipationScore({ plus: 10, tilde: 0, minus: 0 })).toBe(1.0);
		// Balanced -> 3.0
		expect(calculateParticipationScore({ plus: 5, tilde: 5, minus: 5 })).toBe(3.0);
		// All minus -> 5.0
		expect(calculateParticipationScore({ plus: 0, tilde: 0, minus: 10 })).toBe(5.0);
		// Empty -> null
		expect(calculateParticipationScore({ plus: 0, tilde: 0, minus: 0 })).toBeNull();
		// Moderate plus -> ~2.2
		const score = calculateParticipationScore({ plus: 6, tilde: 2, minus: 2 });
		expect(score).toBeGreaterThanOrEqual(1.5);
		expect(score).toBeLessThanOrEqual(2.5);
	});

	it('computes homework score properly', () => {
		expect(calculateHomeworkScore({ done: 10, partial: 0, forgotten: 0 })).toBe(1);
		expect(calculateHomeworkScore({ done: 0, partial: 0, forgotten: 10 })).toBe(5);
		expect(calculateHomeworkScore({ done: 5, partial: 4, forgotten: 1 })).toBe(3); // 70% -> Grade 3 (Befriedigend, 60-74%)
		expect(calculateHomeworkScore({ done: 0, partial: 0, forgotten: 0 })).toBeNull();
	});

	it('computes observation score across multiple observations', () => {
		const obs = [
			{ points: 9, maxPoints: 10 },
			{ points: 18, maxPoints: 20 }
		]; // 27/30 = 90% -> Grade 1
		expect(calculateObservationsScore(obs)).toBe(1);

		const obsFailing = [{ points: 4, maxPoints: 10 }]; // 40% -> Grade 5
		expect(calculateObservationsScore(obsFailing)).toBe(5);
	});

	it('calculates weighted grade suggestion with Austrian weighting rules', () => {
		const weights: CourseWeights = {
			weightSchularbeiten: 40,
			weightTests: 20,
			weightParticipation: 25,
			weightObservations: 10,
			weightHomework: 5
		};

		// Student A: High achiever
		const dataA: StudentPerformanceData = {
			schularbeitGrades: [1, 2], // avg 1.5
			testGrades: [1], // avg 1.0
			participation: { plus: 8, tilde: 2, minus: 0 }, // score ~1.4
			observations: [{ points: 19, maxPoints: 20 }], // 95% -> Grade 1
			homework: { done: 10, partial: 0, forgotten: 0 } // Grade 1
		};

		const suggestionA = calculateGradeSuggestion(dataA, weights);
		expect(suggestionA.suggestedGrade).toBe(1);
		expect(suggestionA.calculatedAverage).toBeLessThan(1.8);

		// Student B: Failing student
		const dataB: StudentPerformanceData = {
			schularbeitGrades: [5, 4], // avg 4.5
			testGrades: [5], // avg 5.0
			participation: { plus: 0, tilde: 1, minus: 6 }, // negative participation
			observations: [{ points: 5, maxPoints: 20 }], // 25% -> Grade 5
			homework: { done: 1, partial: 1, forgotten: 8 } // Grade 5
		};

		const suggestionB = calculateGradeSuggestion(dataB, weights);
		expect(suggestionB.suggestedGrade).toBe(5);
		expect(suggestionB.calculatedAverage).toBeGreaterThanOrEqual(4.5);
	});

	it('computes correct point intervals for Schularbeiten (48 Pkt.) and Tests (24 Pkt.)', () => {
		// 1. Schularbeit (48 Max-Punkte) with step 0.5
		const intervals48 = getGradeIntervals(48, DEFAULT_AUSTRIAN_SCALE);
		expect(intervals48.length).toBe(5);

		// Grade 1: 88% of 48 = 42.24 -> 42.5 Pkt. with half-point raster
		expect(intervals48[0].grade).toBe(1);
		expect(intervals48[0].minPoints).toBe(42.5);

		// Grade 2: 75% of 48 = 36.0 Pkt.
		expect(intervals48[1].grade).toBe(2);
		expect(intervals48[1].minPoints).toBe(36.0);

		// Grade 3: 60% of 48 = 28.8 -> 29.0 Pkt. with half-point raster
		expect(intervals48[2].grade).toBe(3);
		expect(intervals48[2].minPoints).toBe(29.0);

		// Grade 4: 50% of 48 = 24.0 Pkt.
		expect(intervals48[3].grade).toBe(4);
		expect(intervals48[3].minPoints).toBe(24.0);

		// Grade 5: < 24 Pkt.
		expect(intervals48[4].grade).toBe(5);
		expect(intervals48[4].description).toContain('24 Pkt.');

		// 2. Kurztest (24 Max-Punkte)
		const intervals24 = getGradeIntervals(24, DEFAULT_AUSTRIAN_SCALE);
		expect(intervals24[0].minPoints).toBe(21.5); // 88% of 24 = 21.12 -> 21.5
		expect(intervals24[1].minPoints).toBe(18.0); // 75% of 24 = 18.0
		expect(intervals24[2].minPoints).toBe(14.5); // 60% of 24 = 14.4 -> 14.5
		expect(intervals24[3].minPoints).toBe(12.0); // 50% of 24 = 12.0
		expect(intervals24[4].description).toContain('12 Pkt.');

		// Verify points -> grade matching
		expect(calculateGradeFromPoints(45, 48)).toBe(1);
		expect(calculateGradeFromPoints(37, 48)).toBe(2);
		expect(calculateGradeFromPoints(30, 48)).toBe(3);
		expect(calculateGradeFromPoints(24, 48)).toBe(4);
		expect(calculateGradeFromPoints(23.5, 48)).toBe(5);

		// For 24 point test
		expect(calculateGradeFromPoints(22, 24)).toBe(1);
		expect(calculateGradeFromPoints(18, 24)).toBe(2);
		expect(calculateGradeFromPoints(15, 24)).toBe(3);
		expect(calculateGradeFromPoints(12, 24)).toBe(4);
		expect(calculateGradeFromPoints(11.5, 24)).toBe(5);
	});

	it('regression 1.5: does not round up scores just below grade boundaries', () => {
		// 49.96% of 100 must be Grade 5 (< 50% is Nicht genügend)
		expect(calculateGradeFromPoints(49.96, 100)).toBe(5);
		// 87.96% of 100 must be Grade 2 (< 88% is Gut)
		expect(calculateGradeFromPoints(87.96, 100)).toBe(2);

		// Interval minimum points for 43 max points:
		// 88% of 43 = 37.84. In 0.5 step raster, 37.5 is 87.2% (<88%), so minPoints must be 38.0!
		const intervals43 = getGradeIntervals(43, DEFAULT_AUSTRIAN_SCALE);
		expect(intervals43[0].minPoints).toBe(38);
	});

	it('regression 1.6: avoids double-rounding for grade suggestion', () => {
		// E.g., raw average of 4.496 should give suggestedGrade 4 (not rounded to 4.50 then 5)
		const weights: CourseWeights = {
			weightSchularbeiten: 100,
			weightTests: 0,
			weightParticipation: 0,
			weightObservations: 0,
			weightHomework: 0
		};
		// Create a situation where weighted average is 4.496
		// E.g., 4.496 can be achieved with grades [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, ...]
		// Or using participation:
		// Participation score can be fractional:
		// ratio = net/total. let's check: calculateGradeSuggestion with weights
		const customWeights: CourseWeights = {
			weightSchularbeiten: 50,
			weightTests: 50,
			weightParticipation: 0,
			weightObservations: 0,
			weightHomework: 0
		};
		// saAvg = 4.0, testAvg = 4.992 -> rawAverage = (4.0 * 50 + 4.992 * 50)/100 = 4.496
		// But testGrades are integers. Let's make sa [4], test [4, 5, 5] -> avg = 4.666
		// Or 125 schularbeiten: 63 of '4' and 62 of '5': (63*4 + 62*5)/125 = (252 + 310)/125 = 562/125 = 4.496!
		const grades125: number[] = Array(63).fill(4).concat(Array(62).fill(5));
		const data: StudentPerformanceData = {
			schularbeitGrades: grades125,
			testGrades: [],
			participation: { plus: 0, tilde: 0, minus: 0 },
			observations: [],
			homework: { done: 0, partial: 0, forgotten: 0 }
		};
		const suggestion = calculateGradeSuggestion(data, weights);
		expect(suggestion.rawAverage).toBeCloseTo(4.496, 3);
		expect(suggestion.calculatedAverage).toBe(4.5); // formatted for display
		expect(suggestion.suggestedGrade).toBe(4); // not rounded up to 5!
	});

	it('validates default grading scale templates and custom thresholds', () => {
		expect(DEFAULT_TEMPLATES.length).toBeGreaterThanOrEqual(4);
		const defaultTpl = DEFAULT_TEMPLATES.find((t) => t.isDefault);
		expect(defaultTpl).toBeDefined();
		expect(defaultTpl?.name).toContain('Standard');

		for (const tpl of DEFAULT_TEMPLATES) {
			expect(tpl.scale).toHaveLength(5);
			const grades = tpl.scale.map((s) => s.grade);
			expect(grades).toEqual([1, 2, 3, 4, 5]);

			// Grade 1 > Grade 2 > Grade 3 > Grade 4 > Grade 5 (0)
			expect(tpl.scale[0].minPercent).toBeGreaterThan(tpl.scale[1].minPercent);
			expect(tpl.scale[1].minPercent).toBeGreaterThan(tpl.scale[2].minPercent);
			expect(tpl.scale[2].minPercent).toBeGreaterThan(tpl.scale[3].minPercent);
			expect(tpl.scale[3].minPercent).toBeGreaterThan(tpl.scale[4].minPercent);
			expect(tpl.scale[4].minPercent).toBe(0);

			// Test intervals for 48 points
			const intervals = getGradeIntervals(48, tpl.scale);
			expect(intervals).toHaveLength(5);
			expect(intervals[0].minPoints).toBeGreaterThan(intervals[1].minPoints);
		}
	});
});
