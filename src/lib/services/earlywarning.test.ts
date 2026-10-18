import { describe, it, expect } from 'vitest';
import { checkEarlyWarningSuggestion, type EarlyWarningContext } from './earlywarning';
import { calculateGradeSuggestion, type CourseWeights, type StudentPerformanceData } from './grading';

describe('Early Warning Logic (§19 Abs 4 SchUG)', () => {
	const weights: CourseWeights = {
		weightSchularbeiten: 40,
		weightTests: 20,
		weightParticipation: 25,
		weightObservations: 10,
		weightHomework: 5
	};

	const context: EarlyWarningContext = {
		currentDateStr: '2026-11-20',
		earlyWarningDeadline1: '2026-12-15',
		earlyWarningDeadline2: '2027-05-15',
		firstSemesterEnd: '2027-02-05',
		threshold: 4.5
	};

	it('suggests early warning if student has a grade 5 on a Schularbeit', () => {
		const perf: StudentPerformanceData = {
			schularbeitGrades: [5],
			testGrades: [4],
			participation: { plus: 2, tilde: 2, minus: 1 },
			observations: [],
			homework: { done: 4, partial: 0, forgotten: 0 }
		};

		const breakdown = calculateGradeSuggestion(perf, weights);
		const result = checkEarlyWarningSuggestion(breakdown, perf, context);

		expect(result.shouldWarn).toBe(true);
		expect(result.suggestedSemester).toBe(1);
		expect(result.reasons.some((r) => r.includes('Schularbeit'))).toBe(true);
	});

	it('suggests early warning if calculated average is >= 4.5', () => {
		const perf: StudentPerformanceData = {
			schularbeitGrades: [4, 5],
			testGrades: [5],
			participation: { plus: 0, tilde: 1, minus: 4 },
			observations: [],
			homework: { done: 1, partial: 0, forgotten: 4 }
		};

		const breakdown = calculateGradeSuggestion(perf, weights);
		const result = checkEarlyWarningSuggestion(breakdown, perf, context);

		expect(result.shouldWarn).toBe(true);
		expect(result.reasons.some((r) => r.includes('Notendurchschnitt'))).toBe(true);
	});

	it('does not trigger early warning for a passing student', () => {
		const perf: StudentPerformanceData = {
			schularbeitGrades: [2, 3],
			testGrades: [2],
			participation: { plus: 6, tilde: 2, minus: 0 },
			observations: [{ points: 9, maxPoints: 10 }],
			homework: { done: 8, partial: 1, forgotten: 0 }
		};

		const breakdown = calculateGradeSuggestion(perf, weights);
		const result = checkEarlyWarningSuggestion(breakdown, perf, context);

		expect(result.shouldWarn).toBe(false);
		expect(result.reasons.length).toBe(0);
	});
});
