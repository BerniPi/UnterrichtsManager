/**
 * Checks if a return item (assessment return or early warning) is currently overdue.
 */
export function isItemOverdue(
	dueDate: string,
	isSigned: boolean,
	snoozedUntil: string | null | undefined,
	referenceDateStr: string = new Date().toISOString().slice(0, 10)
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
	referenceDateStr: string = new Date().toISOString().slice(0, 10)
): number {
	const due = new Date(dueDate);
	const ref = new Date(referenceDateStr);
	const diffMs = ref.getTime() - due.getTime();
	if (diffMs <= 0) return 0;
	return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculates a snooze target date (YYYY-MM-DD) by adding N days to the reference date.
 */
export function calculateSnoozeDate(
	daysToAdd: number,
	referenceDateStr: string = new Date().toISOString().slice(0, 10)
): string {
	const d = new Date(referenceDateStr);
	d.setDate(d.getDate() + daysToAdd);
	return d.toISOString().slice(0, 10);
}

/**
 * Checks if a deadline is approaching within specified days.
 */
export function isDeadlineApproaching(
	deadlineStr: string,
	daysThreshold: number = 14,
	referenceDateStr: string = new Date().toISOString().slice(0, 10)
): { isApproaching: boolean; daysRemaining: number } {
	const deadline = new Date(deadlineStr);
	const ref = new Date(referenceDateStr);
	const diffDays = Math.ceil((deadline.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));

	return {
		isApproaching: diffDays >= 0 && diffDays <= daysThreshold,
		daysRemaining: Math.max(0, diffDays)
	};
}
