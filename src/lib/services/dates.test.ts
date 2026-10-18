import { describe, it, expect } from 'vitest';
import { getIsoWeekAndYear } from './dates';

describe('ISO 8601 Calendar Week calculation', () => {
	it('calculates the correct ISO week for 2026 dates', () => {
		// 2026-01-01 was Thursday -> Week 1
		expect(getIsoWeekAndYear(new Date('2026-01-01'))).toEqual({ week: 1, year: 2026 });
		// 2026-01-04 was Sunday -> still Week 1
		expect(getIsoWeekAndYear(new Date('2026-01-04'))).toEqual({ week: 1, year: 2026 });
		// 2026-01-05 was Monday -> Week 2
		expect(getIsoWeekAndYear(new Date('2026-01-05'))).toEqual({ week: 2, year: 2026 });
	});

	it('correctly attributes year-boundary days in late December', () => {
		// 2025-12-31 was Wednesday before Thu 2026-01-01 -> belongs to Week 1 of 2026
		expect(getIsoWeekAndYear(new Date('2025-12-31'))).toEqual({ week: 1, year: 2026 });

		// 2024-12-29 was Sunday -> belongs to Week 52 of 2024
		expect(getIsoWeekAndYear(new Date('2024-12-29'))).toEqual({ week: 52, year: 2024 });

		// 2024-12-30 was Monday -> Week 1 of 2025 (contains Thu 2025-01-02)
		expect(getIsoWeekAndYear(new Date('2024-12-30'))).toEqual({ week: 1, year: 2025 });
	});
});
