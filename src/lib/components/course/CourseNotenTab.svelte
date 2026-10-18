<script lang="ts">
	import { enhance } from '$app/forms';
	import type { StudentCourseEvaluation } from '$lib/services/student-evaluator';
	import {
		Download,
		FileSpreadsheet,
		AlertTriangle,
		ExternalLink,
		CheckCircle2,
		Info
	} from '@lucide/svelte';

	let {
		course,
		students = []
	} = $props<{
		course: any;
		students: StudentCourseEvaluation[];
	}>();

	let selectedStudentBreakdown = $state<StudentCourseEvaluation | null>(null);
	let saveToast = $state<string | null>(null);

	function showToast(msg: string) {
		saveToast = msg;
		setTimeout(() => (saveToast = null), 2500);
	}
</script>

<div class="space-y-4">
	<!-- Actions Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
		<div>
			<h3 class="font-bold text-white text-base">Noten- und Notenvorschlagsliste</h3>
			<p class="text-xs text-slate-400">
				Gewichtete Notenvorschläge basierend auf Schularbeiten, Tests, Mitarbeit, Beobachtungen und HÜ
			</p>
		</div>

		<div class="flex items-center gap-2">
			<a
				href="/api/export/webuntis?courseId={course.id}&format=xlsx"
				download
				class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition"
			>
				<FileSpreadsheet class="w-4 h-4" />
				<span>WebUntis Excel (.xlsx)</span>
			</a>

			<a
				href="/api/export/webuntis?courseId={course.id}&format=csv"
				download
				class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 transition"
			>
				<Download class="w-4 h-4" />
				<span>CSV</span>
			</a>
		</div>
	</div>

	{#if saveToast}
		<div class="p-3 bg-emerald-950/90 border border-emerald-800 text-emerald-200 text-xs rounded-xl flex items-center space-x-2">
			<CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
			<span>{saveToast}</span>
		</div>
	{/if}

	<!-- Grades Table -->
	<div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg overflow-x-auto">
		<table class="w-full text-left border-collapse text-xs">
			<thead>
				<tr class="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[11px]">
					<th class="py-3 px-3 w-12 text-center">Kat.</th>
					<th class="py-3 px-4">Schüler</th>
					<th class="py-3 px-2 text-center">SA ({course.weightSchularbeiten}%)</th>
					<th class="py-3 px-2 text-center">Test ({course.weightTests}%)</th>
					<th class="py-3 px-2 text-center">Mitarbeit ({course.weightParticipation}%)</th>
					<th class="py-3 px-2 text-center">Beob. ({course.weightObservations}%)</th>
					<th class="py-3 px-2 text-center">HÜ ({course.weightHomework}%)</th>
					<th class="py-3 px-3 text-center bg-blue-950/30 text-blue-300">Schnitt</th>
					<th class="py-3 px-3 text-center bg-blue-950/40 text-blue-200 font-bold">Vorschlag</th>
					<th class="py-3 px-4 text-center">Endnote (Manuell)</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-800/80 text-slate-200">
				{#each students as s}
					<tr class="hover:bg-slate-800/40 transition {s.earlyWarningSuggestion.shouldWarn && !s.hasActiveEarlyWarning ? 'bg-amber-950/15' : ''}">
						<td class="py-3 px-3 text-center font-bold text-slate-400">{s.catalogNumber ?? '–'}</td>
						<td class="py-3 px-4">
							<div class="flex items-center space-x-2">
								<a href="/schueler/{s.studentId}" class="font-bold text-white hover:text-blue-400 transition">
									{s.lastName} {s.firstName}
								</a>
								{#if s.earlyWarningSuggestion.shouldWarn}
									<span
										class="p-1 rounded bg-amber-950 text-amber-400 border border-amber-800"
										title="Frühwarnung empfohlen: {s.earlyWarningSuggestion.reasons.join(', ')}"
									>
										<AlertTriangle class="w-3.5 h-3.5" />
									</span>
								{/if}
							</div>
						</td>

						<!-- SA Average -->
						<td class="py-3 px-2 text-center font-mono">
							{s.breakdown.schularbeitenAverage ? s.breakdown.schularbeitenAverage.toFixed(2) : '–'}
						</td>

						<!-- Test Average -->
						<td class="py-3 px-2 text-center font-mono">
							{s.breakdown.testsAverage ? s.breakdown.testsAverage.toFixed(2) : '–'}
						</td>

						<!-- Participation -->
						<td class="py-3 px-2 text-center font-mono">
							{#if s.breakdown.participationScore}
								<span class="font-bold">{s.breakdown.participationScore.toFixed(1)}</span>
								<span class="text-[10px] text-slate-500 block">
									(+{s.performance.participation.plus} ~{s.performance.participation.tilde} -{s.performance.participation.minus})
								</span>
							{:else}
								<span class="text-slate-500">–</span>
							{/if}
						</td>

						<!-- Observation -->
						<td class="py-3 px-2 text-center font-mono">
							{s.breakdown.observationsScore ? s.breakdown.observationsScore : '–'}
						</td>

						<!-- Homework -->
						<td class="py-3 px-2 text-center font-mono">
							{s.breakdown.homeworkScore ? s.breakdown.homeworkScore : '–'}
						</td>

						<!-- Calculated Average -->
						<td class="py-3 px-3 text-center font-mono font-bold text-blue-300 bg-blue-950/20">
							{s.breakdown.calculatedAverage ? s.breakdown.calculatedAverage.toFixed(2) : '–'}
						</td>

						<!-- Suggested Grade -->
						<td class="py-3 px-3 text-center bg-blue-950/30">
							{#if s.breakdown.suggestedGrade}
								<span class="inline-flex items-center justify-center w-7 h-7 rounded-lg font-extrabold text-sm shadow {s.breakdown.suggestedGrade === 1 ? 'bg-emerald-600 text-white' : s.breakdown.suggestedGrade === 5 ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}">
									{s.breakdown.suggestedGrade}
								</span>
							{:else}
								<span class="text-slate-500">–</span>
							{/if}
						</td>

						<!-- Manual Final Grade Input (Teacher sets final grade) -->
						<td class="py-3 px-4 text-center">
							<form
								action="?/saveFinalGrade"
								method="POST"
								use:enhance={() => {
									return async ({ update }) => {
										showToast(`Endnote für ${s.lastName} aktualisiert`);
										await update();
									};
								}}
								class="inline-flex items-center space-x-1.5"
							>
								<input type="hidden" name="studentId" value={s.studentId} />
								<input type="hidden" name="suggestedGrade" value={s.breakdown.suggestedGrade ?? ''} />

								<select
									name="manualGrade"
									value={s.manualFinalGrade ?? (s.breakdown.suggestedGrade ? String(s.breakdown.suggestedGrade) : '')}
									onchange={(e) => (e.target as HTMLSelectElement).form?.requestSubmit()}
									class="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:ring-2 focus:ring-blue-500"
								>
									<option value="">–</option>
									<option value="1">1 (Sehr gut)</option>
									<option value="2">2 (Gut)</option>
									<option value="3">3 (Befriedigend)</option>
									<option value="4">4 (Genügend)</option>
									<option value="5">5 (Nicht genügend)</option>
								</select>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
