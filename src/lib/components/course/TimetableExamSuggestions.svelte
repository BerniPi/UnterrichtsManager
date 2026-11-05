<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { CalendarDays, Plus, X } from '@lucide/svelte';

	interface ExamSuggestion {
		uid: string;
		uids: string[];
		date: string;
		startTime: string | null;
		endTime: string | null;
		examType: 'schularbeit' | 'test' | 'wiederholung' | null;
		title: string;
		periods: number;
	}

	interface Props {
		courseId: string;
		suggestions: ExamSuggestion[];
		gradingTemplates: Array<{ id: string; isDefault: boolean }>;
	}

	let { courseId, suggestions, gradingTemplates }: Props = $props();

	const typeLabels = { schularbeit: 'Schularbeit', test: 'Test', wiederholung: 'Wiederholung' } as const;
	const defaultTemplateId = $derived((gradingTemplates.find((t) => t.isDefault) || gradingTemplates[0])?.id ?? '');

	function formatDate(d: string): string {
		const date = new Date(`${d}T12:00:00`);
		return date.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
	}
</script>

{#if suggestions.length > 0}
	<div class="p-4 bg-slate-900 border border-blue-900/60 rounded-2xl space-y-3">
		<div class="flex items-center space-x-2">
			<CalendarDays class="w-4 h-4 text-blue-400" />
			<h3 class="text-sm font-bold text-white">Aus WebUntis: noch nicht angelegte Prüfungen</h3>
		</div>
		<div class="space-y-2">
			{#each suggestions as s (s.uid)}
				<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
					<div class="text-sm">
						<span class="font-semibold text-white">{s.title}</span>
						<span class="text-slate-400 text-xs ml-1">
							{formatDate(s.date)}{s.startTime ? `, ${s.startTime}–${s.endTime}` : ''}{s.periods > 1 ? ` (${s.periods} Std.)` : ''}
						</span>
					</div>
					<div class="flex items-center gap-2">
						<form
							action="?/createAssessment&tab=tests"
							method="POST"
							class="flex items-center gap-2"
							use:enhance={() => async ({ result, update }) => {
								if (result.type === 'success' && result.data?.createdAssessmentId) {
									await goto(`/kurse/${courseId}?tab=tests&assessmentId=${result.data.createdAssessmentId}`, {
										invalidateAll: true
									});
									return;
								}
								await update({ reset: false });
							}}
						>
							<input type="hidden" name="title" value={s.title} />
							<input type="hidden" name="date" value={s.date} />
							<input type="hidden" name="templateId" value={defaultTemplateId} />
							<select
								name="type"
								value={s.examType ?? 'test'}
								aria-label="Art der Prüfung"
								class="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
							>
								{#each Object.entries(typeLabels) as [value, label]}
									<option {value}>{label}</option>
								{/each}
							</select>
							<input
								type="number"
								name="maxPoints"
								min="1"
								step="0.5"
								required
								placeholder="Max. Punkte"
								aria-label="Höchstpunktezahl"
								class="w-28 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
							/>
							<button
								type="submit"
								class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1"
							>
								<Plus class="w-3.5 h-3.5" />
								<span>Anlegen</span>
							</button>
						</form>
						<form action="?/dismissTimetableExam&tab=tests" method="POST" use:enhance>
							<input type="hidden" name="examUids" value={s.uids.join(',')} />
							<button
								type="submit"
								title="Vorschlag ausblenden"
								aria-label="Vorschlag ausblenden"
								class="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800"
							>
								<X class="w-4 h-4" />
							</button>
						</form>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
