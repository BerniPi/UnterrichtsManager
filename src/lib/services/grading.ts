export interface GradingThreshold {
	grade: number; // 1, 2, 3, 4, 5
	minPercent: number; // e.g. 88, 75, 60, 50, 0
}

export interface GradingScaleTemplate {
	id: string;
	name: string;
	description?: string | null;
	scale: GradingThreshold[];
	isDefault: boolean;
	createdAt?: number;
}

export const DEFAULT_AUSTRIAN_SCALE: GradingThreshold[] = [
	{ grade: 1, minPercent: 88 },
	{ grade: 2, minPercent: 75 },
	{ grade: 3, minPercent: 60 },
	{ grade: 4, minPercent: 50 },
	{ grade: 5, minPercent: 0 }
];

export const DEFAULT_TEMPLATES: Array<Omit<GradingScaleTemplate, 'createdAt'>> = [
	{
		id: 'austrian-standard',
		name: 'Österreich Standard (88 / 75 / 60 / 50 %)',
		description: 'Bewährter Notenschlüssel (z.B. Vereinbarung der Fachgruppe gem. LBVO § 14)',
		scale: [
			{ grade: 1, minPercent: 88 },
			{ grade: 2, minPercent: 75 },
			{ grade: 3, minPercent: 60 },
			{ grade: 4, minPercent: 50 },
			{ grade: 5, minPercent: 0 }
		],
		isDefault: true
	},
	{
		id: 'strict',
		name: 'Strenger Notenschlüssel (90 / 80 / 65 / 50 %)',
		description: 'Höhere Hürde für Sehr gut und Gut bei anspruchsvollen Schularbeiten',
		scale: [
			{ grade: 1, minPercent: 90 },
			{ grade: 2, minPercent: 80 },
			{ grade: 3, minPercent: 65 },
			{ grade: 4, minPercent: 50 },
			{ grade: 5, minPercent: 0 }
		],
		isDefault: false
	},
	{
		id: 'lenient',
		name: 'Milder / Fördernder Notenschlüssel (85 / 70 / 55 / 45 %)',
		description: 'Niedrigere Hürden, z.B. für Wiederholungsprüfungen oder Einstiegsklassen',
		scale: [
			{ grade: 1, minPercent: 85 },
			{ grade: 2, minPercent: 70 },
			{ grade: 3, minPercent: 55 },
			{ grade: 4, minPercent: 45 },
			{ grade: 5, minPercent: 0 }
		],
		isDefault: false
	},
	{
		id: 'linear-four-step',
		name: 'Gleichmäßig linear (87.5 / 75 / 62.5 / 50 %)',
		description: 'Exakt 12,5% Bandbreite für jede positive Note zwischen 50% und 100%',
		scale: [
			{ grade: 1, minPercent: 87.5 },
			{ grade: 2, minPercent: 75 },
			{ grade: 3, minPercent: 62.5 },
			{ grade: 4, minPercent: 50 },
			{ grade: 5, minPercent: 0 }
		],
		isDefault: false
	}
];

export const GRADE_LABELS: Record<number, string> = {
	1: 'Sehr gut',
	2: 'Gut',
	3: 'Befriedigend',
	4: 'Genügend',
	5: 'Nicht genügend'
};

const EPS = 1e-9;

/**
 * Calculates grade (1-5) from achieved points and max points based on threshold scale.
 */
export function calculateGradeFromPoints(
	points: number | null | undefined,
	maxPoints: number,
	scale: GradingThreshold[] = DEFAULT_AUSTRIAN_SCALE
): number | null {
	if (points === null || points === undefined || isNaN(points) || maxPoints <= 0) {
		return null;
	}

	const percent = (points / maxPoints) * 100;
	// Sort scale descending by minPercent (e.g. 88, 75, 60, 50, 0)
	const sorted = [...scale].sort((a, b) => b.minPercent - a.minPercent);

	for (const threshold of sorted) {
		// Nur Float-Rauschen tolerieren, nie echte Werte unter der Grenze aufrunden
		if (percent + EPS >= threshold.minPercent) {
			return threshold.grade;
		}
	}

	return 5;
}

/**
 * Converts percent score (0-100) to standard Austrian grade (1-5).
 */
export function percentToGrade(percent: number): number {
	return calculateGradeFromPoints(percent, 100, DEFAULT_AUSTRIAN_SCALE) ?? 5;
}

/**
 * Validates grading scale thresholds and returns normalized 5-step scale if valid.
 */
export function validateScale(scale: unknown): {
	valid: boolean;
	error?: string;
	normalizedScale?: GradingThreshold[];
} {
	if (!Array.isArray(scale)) {
		return { valid: false, error: 'Ungültiges Notenstufen-Format.' };
	}

	const p1 = Number(scale.find((s) => s?.grade === 1)?.minPercent ?? 0);
	const p2 = Number(scale.find((s) => s?.grade === 2)?.minPercent ?? 0);
	const p3 = Number(scale.find((s) => s?.grade === 3)?.minPercent ?? 0);
	const p4 = Number(scale.find((s) => s?.grade === 4)?.minPercent ?? 0);

	if (!(p1 > p2 && p2 > p3 && p3 > p4 && p4 > 0 && p1 <= 100)) {
		return {
			valid: false,
			error:
				'Die Prozentgrenzen müssen streng absteigend und sinnvoll sein (100% ≥ Note 1 > Note 2 > Note 3 > Note 4 > 0%).'
		};
	}

	return {
		valid: true,
		normalizedScale: [
			{ grade: 1, minPercent: p1 },
			{ grade: 2, minPercent: p2 },
			{ grade: 3, minPercent: p3 },
			{ grade: 4, minPercent: p4 },
			{ grade: 5, minPercent: 0 }
		]
	};
}

export interface GradeInterval {
	grade: number;
	label: string;
	minPercent: number;
	minPoints: number;
	description: string;
}

/**
 * Returns point thresholds and interval descriptions for each grade (1-5) based on maxPoints.
 */
export function getGradeIntervals(
	maxPoints: number,
	scale: GradingThreshold[] = DEFAULT_AUSTRIAN_SCALE,
	step: number = 0.5
): GradeInterval[] {
	const sorted = [...scale].sort((a, b) => a.grade - b.grade); // 1, 2, 3, 4, 5
	const EPS = 1e-9;

	const intervals = sorted.map((th) => {
		// Kleinste erreichbare Punktzahl bei Halbpunkte-Raster (Schritt konfigurierbar)
		const minPoints =
			th.minPercent <= 0
				? 0
				: Math.ceil((maxPoints * th.minPercent) / 100 / step - EPS) * step;
		const label = GRADE_LABELS[th.grade] || `Note ${th.grade}`;

		return {
			grade: th.grade,
			label,
			minPercent: th.minPercent,
			minPoints,
			description: ''
		};
	});

	const grade4 = intervals.find((i) => i.grade === 4);
	const grade4Threshold = sorted.find((s) => s.grade === 4);

	for (const item of intervals) {
		const formattedPoints = item.minPoints % 1 === 0 ? item.minPoints.toFixed(0) : item.minPoints.toFixed(1);
		if (item.grade === 5) {
			const cutoffPoints = grade4 ? (grade4.minPoints % 1 === 0 ? grade4.minPoints.toFixed(0) : grade4.minPoints.toFixed(1)) : '0';
			item.description = `< ${cutoffPoints} Pkt. (< ${grade4Threshold?.minPercent ?? 50}%)`;
		} else {
			item.description = `ab ${formattedPoints} Pkt. (≥ ${item.minPercent}%)`;
		}
	}

	return intervals;
}

export interface CourseWeights {
	weightSchularbeiten: number;
	weightTests: number;
	weightParticipation: number;
	weightObservations: number;
	weightHomework: number;
}

export interface StudentPerformanceData {
	schularbeitGrades: number[];
	testGrades: number[];
	participation: { plus: number; tilde: number; minus: number };
	observations: Array<{ points: number; maxPoints: number }>;
	homework: { done: number; partial: number; forgotten: number };
}

export interface GradeSuggestionBreakdown {
	schularbeitenAverage: number | null;
	testsAverage: number | null;
	participationScore: number | null;
	observationsScore: number | null;
	homeworkScore: number | null;
	rawAverage: number | null;
	calculatedAverage: number | null;
	suggestedGrade: number | null;
	activeWeight: number;
	weightsUsed: {
		schularbeiten: number;
		tests: number;
		participation: number;
		observations: number;
		homework: number;
	};
}

/**
 * Computes participation score on a 1.0 - 5.0 scale.
 * 3.0 is neutral. Each net plus improves grade; each net minus worsens grade.
 */
export function calculateParticipationScore(p: { plus: number; tilde: number; minus: number }): number | null {
	const total = p.plus + p.tilde + p.minus;
	if (total === 0) return null;

	const net = p.plus - p.minus;
	// Net ratio between -1 and +1
	const ratio = net / total;
	// Linear mapping: ratio +1 -> 1.0 (Sehr gut), 0 -> 3.0 (Befriedigend), -1 -> 5.0 (Nicht genügend)
	const score = 3.0 - ratio * 2.0;
	return Math.max(1.0, Math.min(5.0, Math.round(score * 100) / 100));
}

/**
 * Computes homework score on a 1.0 - 5.0 scale.
 * done = 100%, partial = 50%, forgotten = 0%.
 */
export function calculateHomeworkScore(hw: { done: number; partial: number; forgotten: number }): number | null {
	const total = hw.done + hw.partial + hw.forgotten;
	if (total === 0) return null;

	const percent = ((hw.done * 1.0 + hw.partial * 0.5) / total) * 100;
	// Convert homework completion percentage to grade 1-5
	const grade = percentToGrade(percent);
	return grade;
}

/**
 * Computes observation score on a 1.0 - 5.0 scale.
 */
export function calculateObservationsScore(observations: Array<{ points: number; maxPoints: number }>): number | null {
	if (observations.length === 0) return null;

	let totalPoints = 0;
	let totalMax = 0;
	for (const obs of observations) {
		totalPoints += obs.points;
		totalMax += obs.maxPoints;
	}

	if (totalMax <= 0) return null;
	const percent = (totalPoints / totalMax) * 100;
	return percentToGrade(percent);
}

/**
 * Calculates weighted grade suggestion (1-5) with detailed component breakdown.
 */
export function calculateGradeSuggestion(
	data: StudentPerformanceData,
	weights: CourseWeights
): GradeSuggestionBreakdown {
	// 1. Schularbeiten
	const saAvg =
		data.schularbeitGrades.length > 0
			? data.schularbeitGrades.reduce((a, b) => a + b, 0) / data.schularbeitGrades.length
			: null;

	// 2. Tests
	const testAvg =
		data.testGrades.length > 0
			? data.testGrades.reduce((a, b) => a + b, 0) / data.testGrades.length
			: null;

	// 3. Participation
	const partScore = calculateParticipationScore(data.participation);

	// 4. Observations
	const obsScore = calculateObservationsScore(data.observations);

	// 5. Homework
	const hwScore = calculateHomeworkScore(data.homework);

	// Weighted sum
	let weightedSum = 0;
	let activeWeight = 0;

	if (saAvg !== null && weights.weightSchularbeiten > 0) {
		weightedSum += saAvg * weights.weightSchularbeiten;
		activeWeight += weights.weightSchularbeiten;
	}

	if (testAvg !== null && weights.weightTests > 0) {
		weightedSum += testAvg * weights.weightTests;
		activeWeight += weights.weightTests;
	}

	if (partScore !== null && weights.weightParticipation > 0) {
		weightedSum += partScore * weights.weightParticipation;
		activeWeight += weights.weightParticipation;
	}

	if (obsScore !== null && weights.weightObservations > 0) {
		weightedSum += obsScore * weights.weightObservations;
		activeWeight += weights.weightObservations;
	}

	if (hwScore !== null && weights.weightHomework > 0) {
		weightedSum += hwScore * weights.weightHomework;
		activeWeight += weights.weightHomework;
	}

	if (activeWeight === 0) {
		return {
			schularbeitenAverage: saAvg,
			testsAverage: testAvg,
			participationScore: partScore,
			observationsScore: obsScore,
			homeworkScore: hwScore,
			rawAverage: null,
			calculatedAverage: null,
			suggestedGrade: null,
			activeWeight: 0,
			weightsUsed: {
				schularbeiten: weights.weightSchularbeiten,
				tests: weights.weightTests,
				participation: weights.weightParticipation,
				observations: weights.weightObservations,
				homework: weights.weightHomework
			}
		};
	}

	const rawAverage = weightedSum / activeWeight;
	const calculatedAverage = Math.round(rawAverage * 100) / 100;
	const suggestedGrade = Math.max(1, Math.min(5, Math.round(rawAverage)));

	return {
		schularbeitenAverage: saAvg ? Math.round(saAvg * 100) / 100 : null,
		testsAverage: testAvg ? Math.round(testAvg * 100) / 100 : null,
		participationScore: partScore,
		observationsScore: obsScore,
		homeworkScore: hwScore,
		rawAverage,
		calculatedAverage,
		suggestedGrade,
		activeWeight,
		weightsUsed: {
			schularbeiten: weights.weightSchularbeiten,
			tests: weights.weightTests,
			participation: weights.weightParticipation,
			observations: weights.weightObservations,
			homework: weights.weightHomework
		}
	};
}
