<script lang="ts">
	import { enhance } from '$app/forms';
	import type { StudentCourseEvaluation } from '$lib/services/student-evaluator';
	import {
		AlertTriangle,
		CheckCircle2,
		Plus,
		Calendar,
		Clock,
		Send,
		X
	} from '@lucide/svelte';

	interface Props {
		course: any;
		students?: StudentCourseEvaluation[];
		earlyWarnings?: Array<any>;
		initialStudentId?: string | null;
	}

	let {
		course,
		students = [],
		earlyWarnings = [],
		initialStudentId = null
	}: Props = $props();

	let showIssueModal = $state(false);
	let selectedStudentId = $state('');
	let reason = $state('');
	let returnDays = $state(7);
	let semester = $state(1);

	// Auto-open modal if initialStudentId is passed
	$effect(() => {
		if (initialStudentId) {
			const s = students.find((st: any) => st.studentId === initialStudentId);
			if (s) {
				openIssueModal(s);
			} else {
				selectedStudentId = initialStudentId;
				reason = 'Nicht genügend bei Leistungsfeststellung (§ 19 Abs 4 SchUG)';
				showIssueModal = true;
			}
		}
	});

	// Find students with automatic suggestion who don't already have an active warning
	const suggestedStudents = $derived(
		students.filter((s: any) => s.earlyWarningSuggestion.shouldWarn && !s.hasActiveEarlyWarning)
	);

	function openIssueModal(s: StudentCourseEvaluation) {
		selectedStudentId = s.studentId;
		reason = s.earlyWarningSuggestion.reasons.join('; ');
		semester = s.earlyWarningSuggestion.suggestedSemester ?? 1;
		showIssueModal = true;
	}
</script>

<div class="space-y-6">
	<!-- Automatic Early Warning Suggestions Section -->
	<section class="space-y-3">
		<div class="flex items-center justify-between">
			<h3 class="text-base font-bold text-white flex items-center space-x-2">
				<AlertTriangle class="w-5 h-5 text-amber-400" />
				<span>Automatische Frühwarn-Vorschläge (§ 19 Abs 4 SchUG)</span>
			</h3>
			<span class="text-xs text-slate-400">Erkennung bei negativer Schularbeit oder Schnitt &ge; 4.5</span>
		</div>

		{#if suggestedStudents.length === 0}
			<div class="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
				<CheckCircle2 class="w-7 h-7 text-emerald-400 mx-auto mb-1.5 opacity-80" />
				<p class="text-xs text-slate-300 font-medium">
					Aktuell sind keine Schüler im gefährdeten Bereich.
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
				{#each suggestedStudents as s}
					<div class="p-4 rounded-xl bg-slate-900 border border-amber-900/60 flex flex-col justify-between space-y-3 shadow-md">
						<div>
							<div class="flex items-center justify-between">
								<h4 class="font-bold text-white text-sm">{s.lastName} {s.firstName}</h4>
								<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
									Vorschlag {s.breakdown.suggestedGrade ?? '–'}
								</span>
							</div>

							<ul class="mt-2 text-xs text-amber-200/90 space-y-1 list-disc list-inside">
								{#each s.earlyWarningSuggestion.reasons as r}
									<li>{r}</li>
								{/each}
							</ul>
						</div>

						<div class="pt-2 border-t border-slate-800">
							<button
								type="button"
								onclick={() => openIssueModal(s)}
								class="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition"
							>
								<AlertTriangle class="w-3.5 h-3.5" />
								<span>Frühwarnung jetzt ausstellen</span>
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Issued Early Warnings List & Return Checklist -->
	<section class="space-y-3">
		<div class="flex items-center justify-between">
			<h3 class="text-base font-bold text-white flex items-center space-x-2">
				<Clock class="w-5 h-5 text-blue-400" />
				<span>Ausgestellte Frühwarnungen & Rücklauf ({earlyWarnings.length})</span>
			</h3>

			<button
				type="button"
				onclick={() => {
					selectedStudentId = students[0]?.studentId || '';
					reason = '';
					showIssueModal = true;
				}}
				class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 flex items-center space-x-1.5"
			>
				<Plus class="w-3.5 h-3.5" />
				<span>Manuell ausstellen</span>
			</button>
		</div>

		{#if earlyWarnings.length === 0}
			<div class="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center">
				<p class="text-slate-400 text-xs">In diesem Kurs wurden bisher keine Frühwarnungen ausgestellt.</p>
			</div>
		{:else}
			<div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg overflow-x-auto">
				<table class="w-full text-left border-collapse text-xs">
					<thead>
						<tr class="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[11px]">
							<th class="py-3 px-4">Schüler</th>
							<th class="py-3 px-3">Ausgestellt</th>
							<th class="py-3 px-4">Begründung</th>
							<th class="py-3 px-3">Frist</th>
							<th class="py-3 px-4 text-center">Status</th>
							<th class="py-3 px-4 text-center">Aktion</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-800/80 text-slate-200">
						{#each earlyWarnings as ew}
							{@const todayStr = new Date().toISOString().slice(0, 10)}
							{@const isOverdue = !ew.isSigned && ew.dueDate && ew.dueDate < todayStr && (!ew.snoozedUntil || ew.snoozedUntil <= todayStr)}
							<tr class="hover:bg-slate-800/40 transition {isOverdue ? 'bg-red-950/20' : ''}">
								<td class="py-3 px-4 font-bold text-white">{ew.studentName}</td>
								<td class="py-3 px-3 text-slate-400 font-mono">{ew.issuedDate}</td>
								<td class="py-3 px-4 text-slate-300 max-w-xs truncate" title={ew.reason}>
									{ew.reason}
								</td>
								<td class="py-3 px-3 font-mono {isOverdue ? 'text-red-400 font-bold' : 'text-slate-400'}">
									{ew.dueDate}
								</td>

								<td class="py-3 px-4 text-center">
									{#if ew.isSigned}
										<span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
											<CheckCircle2 class="w-3.5 h-3.5 text-emerald-400" />
											<span>Unterschrieben</span>
										</span>
									{:else if isOverdue}
										<span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-950 text-red-300 border border-red-800 animate-pulse">
											<AlertTriangle class="w-3.5 h-3.5 text-red-400" />
											<span>{ew.daysOverdue} Tage überfällig!</span>
										</span>
									{:else}
										<span class="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400">
											Offen
										</span>
									{/if}
								</td>

								<td class="py-3 px-4 text-center">
									{#if !ew.isSigned}
										<form action="/stundenansicht?/markSigned" method="POST" use:enhance class="inline-block">
											<input type="hidden" name="type" value="early_warning" />
											<input type="hidden" name="id" value={ew.id} />
											<button
												type="submit"
												class="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] active:scale-95 transition"
											>
												Zurück ✓
											</button>
										</form>
									{:else}
										<span class="text-slate-500 text-[11px]">Erledigt</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>

<!-- Modal: Frühwarnung ausstellen -->
{#if showIssueModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
			<div class="flex items-center justify-between pb-3 border-b border-slate-800">
				<h3 class="text-lg font-bold text-white flex items-center space-x-2">
					<AlertTriangle class="w-5 h-5 text-amber-400" />
					<span>Frühwarnung ausstellen</span>
				</h3>
				<button type="button" onclick={() => (showIssueModal = false)} class="text-slate-400 hover:text-white">
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				action="?/createEarlyWarning&tab=fruehwarnungen"
				method="POST"
				use:enhance={() => async ({ result, update }) => {
					await update();
					if (result.type === 'success') showIssueModal = false;
				}}
				class="space-y-4"
			>
				<div>
					<label for="ewStudentId" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Schüler *
					</label>
					<select
						id="ewStudentId"
						name="studentId"
						bind:value={selectedStudentId}
						required
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					>
						{#each students as s}
							<option value={s.studentId}>{s.lastName} {s.firstName} (Kat. {s.catalogNumber ?? '–'})</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="ewReason" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Begründung (gem. § 19 Abs 4 SchUG) *
					</label>
					<textarea
						id="ewReason"
						name="reason"
						rows="3"
						required
						bind:value={reason}
						placeholder="z.B. Schularbeit mit Nicht genügend beurteilt, Mitarbeit stark rückläufig..."
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					></textarea>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="ewSemester" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Semester *
						</label>
						<select
							id="ewSemester"
							name="semester"
							bind:value={semester}
							class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
						>
							<option value={1}>1. Semester</option>
							<option value={2}>2. Semester</option>
						</select>
					</div>

					<div>
						<label for="ewDays" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Rückgabefrist
						</label>
						<select
							id="ewDays"
							name="days"
							bind:value={returnDays}
							class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
						>
							<option value="5">5 Tage</option>
							<option value="7">7 Tage (Standard)</option>
							<option value="10">10 Tage</option>
							<option value="14">14 Tage</option>
						</select>
					</div>
				</div>

				<div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
					<button
						type="button"
						onclick={() => (showIssueModal = false)}
						class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
					>
						Abbrechen
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold shadow-md shadow-amber-500/20"
					>
						Frühwarnung erfassen
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
