import type { GradeSuggestionBreakdown, StudentPerformanceData } from './grading';

export interface EarlyWarningCheckResult {
	shouldWarn: boolean;
	reasons: string[];
	suggestedSemester: 1 | 2;
}

export interface EarlyWarningContext {
	currentDateStr: string; // YYYY-MM-DD
	earlyWarningDeadline1: string;
	earlyWarningDeadline2: string;
	firstSemesterEnd: string;
	threshold?: number; // e.g. 4.5
}

/**
 * Checks whether an early warning (Frühwarnung gem. §19 Abs 4 SchUG) should be suggested.
 */
export function checkEarlyWarningSuggestion(
	breakdown: GradeSuggestionBreakdown,
	performance: StudentPerformanceData,
	context: EarlyWarningContext
): EarlyWarningCheckResult {
	const threshold = context.threshold ?? 4.5;
	const reasons: string[] = [];

	// Determine semester based on current date vs firstSemesterEnd
	const semester: 1 | 2 = context.currentDateStr <= context.firstSemesterEnd ? 1 : 2;

	// Check 1: Calculated average / suggested grade is at or above threshold (check against unrounded average)
	const avg = breakdown.rawAverage ?? breakdown.calculatedAverage;
	if (avg !== null && avg >= threshold) {
		const displayAvg = breakdown.calculatedAverage !== null ? breakdown.calculatedAverage.toFixed(2) : avg.toFixed(2);
		reasons.push(
			`Gesamtrechnerischer Notendurchschnitt liegt bei ${displayAvg} (Schwelle: ${threshold.toFixed(2)})`
		);
	}

	// Check 2: Negative Schularbeit (Grade 5)
	const negativeSchularbeiten = performance.schularbeitGrades.filter((g) => g === 5).length;
	if (negativeSchularbeiten > 0) {
		reasons.push(`${negativeSchularbeiten} Schularbeit(en) mit „Nicht genügend“ bewertet`);
	}

	// Check 3: Multiple negative tests
	const negativeTests = performance.testGrades.filter((g) => g === 5).length;
	if (negativeTests >= 2) {
		reasons.push(`${negativeTests} Tests mit „Nicht genügend“ bewertet`);
	}

	// Check 4: Prevalent negative participation
	if (
		performance.participation.minus >= 3 &&
		performance.participation.minus > performance.participation.plus
	) {
		reasons.push(
			`Mitarbeit stark negativ (${performance.participation.minus}x Minus vs. ${performance.participation.plus}x Plus)`
		);
	}

	// Check 5: Severe homework neglect (forgotten >= 3)
	if (performance.homework.forgotten >= 3) {
		reasons.push(`${performance.homework.forgotten} Hausübungen nicht abgegeben`);
	}

	return {
		shouldWarn: reasons.length > 0,
		reasons,
		suggestedSemester: semester
	};
}
