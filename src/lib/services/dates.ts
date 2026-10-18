/**
 * Date and calendar utilities adhering to European & Austrian standards (ISO 8601 / DIN EN 28601).
 * Safe against daylight saving time (DST) shifts and UTC midnight boundary offsets.
 */

/**
 * Returns today's date in Vienna time (Europe/Vienna) as 'YYYY-MM-DD'.
 */
export function todayVienna(d = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/Vienna',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(d);
}

/**
 * Adds (or subtracts) N days to a date string or Date object using pure UTC calendar arithmetic.
 * Never affected by daylight saving time shifts.
 */
export function addDays(date: string | Date, days: number): string {
	const parts = typeof date === 'string'
		? date.slice(0, 10).split('-').map(Number)
		: [date.getFullYear(), date.getMonth() + 1, date.getDate()];
	
	const utc = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
	utc.setUTCDate(utc.getUTCDate() + days);
	return utc.toISOString().slice(0, 10);
}

/**
 * Returns the ISO 8601 calendar week and ISO week-year for a given date (defaults to current date).
 * 
 * Rules:
 * - Weeks start on Monday (day 1) and end on Sunday (day 7).
 * - Week 1 is the first week with at least 4 days in the new year (i.e. contains the first Thursday).
 * - Days before week 1 belong to the 52nd or 53rd week of the previous year.
 */
export function getIsoWeekAndYear(d = new Date()): { week: number; year: number } {
	const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
	const dayNum = date.getUTCDay() || 7; // 1 = Monday ... 7 = Sunday
	date.setUTCDate(date.getUTCDate() + 4 - dayNum); // Move to Thursday in current week
	const year = date.getUTCFullYear();
	const yearStart = new Date(Date.UTC(year, 0, 1));
	const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	return { week, year };
}
