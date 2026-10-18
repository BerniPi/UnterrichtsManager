import { describe, it, expect } from 'vitest';
import {
	isItemOverdue,
	getDaysOverdue,
	calculateSnoozeDate,
	isDeadlineApproaching,
	isAssessmentEarlyWarningDue
} from './reminders';

describe('Reminders and Overdue Logic', () => {
	const refDate = '2026-10-18';

	it('identifies overdue unsigned items correctly', () => {
		// Due on Oct 15, unsigned, no snooze -> overdue
		expect(isItemOverdue('2026-10-15', false, null, refDate)).toBe(true);

		// Due on Oct 20, unsigned -> not overdue yet
		expect(isItemOverdue('2026-10-20', false, null, refDate)).toBe(false);

		// Signed items are NEVER overdue
		expect(isItemOverdue('2026-10-10', true, null, refDate)).toBe(false);
	});

	it('respects snooze dates', () => {
		// Due on Oct 10, but snoozed until Oct 25 -> not overdue
		expect(isItemOverdue('2026-10-10', false, '2026-10-25', refDate)).toBe(false);

		// Due on Oct 10, snoozed until Oct 16 -> snooze expired -> overdue!
		expect(isItemOverdue('2026-10-10', false, '2026-10-16', refDate)).toBe(true);
	});

	it('calculates days overdue correctly', () => {
		expect(getDaysOverdue('2026-10-15', refDate)).toBe(3);
		expect(getDaysOverdue('2026-10-18', refDate)).toBe(0);
		expect(getDaysOverdue('2026-10-22', refDate)).toBe(0);
	});

	it('computes snooze dates accurately', () => {
		expect(calculateSnoozeDate(3, '2026-10-18')).toBe('2026-10-21');
		expect(calculateSnoozeDate(7, '2026-10-18')).toBe('2026-10-25');
	});

	it('flags approaching deadlines (e.g. Notenschluss)', () => {
		// 10 days away -> within 14-day threshold
		const check1 = isDeadlineApproaching('2026-10-28', 14, refDate);
		expect(check1.isApproaching).toBe(true);
		expect(check1.daysRemaining).toBe(10);

		// 25 days away -> not yet approaching
		const check2 = isDeadlineApproaching('2026-11-12', 14, refDate);
		expect(check2.isApproaching).toBe(false);
	});

	it('checks if early warning reminder is due 1 week after test or schularbeit', () => {
		// Test was 8 days ago (2026-10-10 vs 2026-10-18) -> due!
		const check1 = isAssessmentEarlyWarningDue('2026-10-10', refDate);
		expect(check1.isDue).toBe(true);
		expect(check1.daysSince).toBe(8);

		// Test was exactly 7 days ago (2026-10-11 vs 2026-10-18) -> due!
		const check2 = isAssessmentEarlyWarningDue('2026-10-11', refDate);
		expect(check2.isDue).toBe(true);
		expect(check2.daysSince).toBe(7);

		// Test was 3 days ago (2026-10-15 vs 2026-10-18) -> not due yet!
		const check3 = isAssessmentEarlyWarningDue('2026-10-15', refDate);
		expect(check3.isDue).toBe(false);
		expect(check3.daysSince).toBe(3);

		// Test was 90 days ago -> older than maxDays (60)
		const check4 = isAssessmentEarlyWarningDue('2026-07-01', refDate);
		expect(check4.isDue).toBe(false);
	});
});
