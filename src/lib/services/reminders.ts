import { addDays, todayVienna } from './dates';

/**
 * Checks if a return item (assessment return or early warning) is currently overdue.
 */
export function isItemOverdue(
	dueDate: string,
	isSigned: boolean,
	snoozedUntil: string | null | undefined,
	referenceDateStr: string = todayVienna()
): boolean {
	if (isSigned) return false;

	// If snoozed to a future date, it's not overdue yet
	if (snoozedUntil && snoozedUntil > referenceDateStr) {
		return false;
	}

	return dueDate < referenceDateStr;
}

/**
 * Calculates how many days an item is overdue. Returns 0 if not overdue.
 */
export function getDaysOverdue(
	dueDate: string,
	referenceDateStr: string = todayVienna()
): number {
	const due = new Date(dueDate.slice(0, 10) + 'T00:00:00Z');
	const ref = new Date(referenceDateStr.slice(0, 10) + 'T00:00:00Z');
	const diffMs = ref.getTime() - due.getTime();
	if (diffMs <= 0) return 0;
	return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculates a snooze target date (YYYY-MM-DD) by adding N days to the reference date.
 * Uses UTC date calculation to avoid DST clock shift errors.
 */
export function calculateSnoozeDate(
	daysToAdd: number,
	referenceDateStr: string = todayVienna()
): string {
	return addDays(referenceDateStr, daysToAdd);
}

/**
 * Checks if a deadline is approaching within specified days.
 */
export function isDeadlineApproaching(
	deadlineStr: string,
	daysThreshold: number = 14,
	referenceDateStr: string = todayVienna()
): { isApproaching: boolean; daysRemaining: number } {
	const deadline = new Date(deadlineStr.slice(0, 10) + 'T00:00:00Z');
	const ref = new Date(referenceDateStr.slice(0, 10) + 'T00:00:00Z');
	const diffDays = Math.ceil((deadline.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));

	return {
		isApproaching: diffDays >= 0 && diffDays <= daysThreshold,
		daysRemaining: Math.max(0, diffDays)
	};
}

/**
 * Checks if 1 week or more has passed since an assessment (test/schularbeit)
 * to remind the teacher about potential early warnings (§ 19 Abs 4 SchUG).
 */
export function isAssessmentEarlyWarningDue(
	assessmentDateStr: string,
	referenceDateStr: string = todayVienna(),
	minDays: number = 7,
	maxDays: number = 60
): { isDue: boolean; daysSince: number } {
	const assess = new Date(assessmentDateStr.slice(0, 10) + 'T00:00:00Z');
	const ref = new Date(referenceDateStr.slice(0, 10) + 'T00:00:00Z');
	const diffDays = Math.floor((ref.getTime() - assess.getTime()) / (1000 * 60 * 60 * 24));
	return {
		isDue: diffDays >= minDays && diffDays <= maxDays,
		daysSince: Math.max(0, diffDays)
	};
}
