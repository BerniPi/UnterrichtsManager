<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import GradingScaleEditor from '$lib/components/assessments/GradingScaleEditor.svelte';
	import ClassStatsChart from '$lib/components/assessments/ClassStatsChart.svelte';
	import {
		calculateGradeFromPoints,
		getGradeIntervals,
		GRADE_LABELS,
		DEFAULT_AUSTRIAN_SCALE,
		type GradingThreshold,
		type GradingScaleTemplate
	} from '$lib/services/grading';
	import {
		Plus,
		CheckCircle2,
		AlertTriangle,
		Sliders,
		Calendar,
		Award,
		X,
		Check,
		Send,
		AlertCircle,
		Sparkles,
		Trash2
	} from '@lucide/svelte';

	interface Props {
		course: any;
		assessments?: Array<any>;
		selectedAssessment?: any;
		gradingTemplates?: Array<GradingScaleTemplate>;
		defaultReturnDays?: number;
	}

	let {
		course,
		assessments = [],
		selectedAssessment = null,
		gradingTemplates = [],
		defaultReturnDays = 7
	}: Props = $props();

	let showCreateModal = $state(false);
	let showScaleModal = $state(false);
	let activeTabMode = $state<'points' | 'returns'>('points');

	let newTitle = $state('');
	let newType = $state<'schularbeit' | 'test' | 'wiederholung'>('schularbeit');
	let newDate = $state(new Date().toISOString().slice(0, 10));
	let newMaxPoints = $state(48);
	let newReturnDays = $state(7);
	$effect(() => {
		newReturnDays = defaultReturnDays;
	});
	let selectedTemplateId = $state<string>('');

	const defaultTemplateId = $derived(
		gradingTemplates.find((t) => t.isDefault)?.id || gradingTemplates[0]?.id || ''
	);
	const effectiveTemplateId = $derived(selectedTemplateId || defaultTemplateId);

	const activeTemplate = $derived(
		gradingTemplates.find((t) => t.id === effectiveTemplateId) || gradingTemplates[0] || null
	);

	let editingScale = $state<GradingThreshold[]>([]);

	function toggleScaleModal() {
		if (!showScaleModal && selectedAssessment?.scale) {
			editingScale = structuredClone(selectedAssessment.scale);
		}
		showScaleModal = !showScaleModal;
	}

	const templateScale = $derived<GradingThreshold[]>(
		activeTemplate ? activeTemplate.scale : DEFAULT_AUSTRIAN_SCALE
	);

	const templateIntervals = $derived(
		getGradeIntervals(newMaxPoints > 0 ? newMaxPoints : 48, templateScale)
	);

	let toastMsg = $state<string | null>(null);
	function showToast(msg: string) {
		toastMsg = msg;
		setTimeout(() => (toastMsg = null), 2500);
	}

	// Active intervals for the selected assessment's grading scale
	const activeIntervals = $derived(
		selectedAssessment ? getGradeIntervals(selectedAssessment.maxPoints, selectedAssessment.scale) : []
	);

	function calculateLiveGrade(points: number | null | undefined): number | null {
		if (!selectedAssessment || points === null || points === undefined) return null;
		return calculateGradeFromPoints(points, selectedAssessment.maxPoints, selectedAssessment.scale);
	}

	function formatPercent(points: number | null | undefined): string {
		if (!selectedAssessment || points === null || points === undefined || selectedAssessment.maxPoints <= 0) return '';
		return `${((points / selectedAssessment.maxPoints) * 100).toFixed(1)}%`;
	}

	// Navigate to next student input on Enter or ArrowDown
	function handleKeyDown(e: KeyboardEvent, index: number) {
		if (e.key === 'Enter' || e.key === 'ArrowDown') {
			e.preventDefault();
			const nextInput = document.getElementById(`points-input-${index + 1}`) as HTMLInputElement;
			if (nextInput) {
				nextInput.focus();
				nextInput.select();
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			const prevInput = document.getElementById(`points-input-${index - 1}`) as HTMLInputElement;
			if (prevInput) {
				prevInput.focus();
				prevInput.select();
			}
		}
	}
</script>

<div class="space-y-5">
	<!-- Top Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
		<div>
			<h3 class="font-bold text-white text-base">Schularbeiten & Tests</h3>
			<p class="text-xs text-slate-400">
				Punkte eintragen & Notenschlüssel berechnet automatisch die Note (1–5) für Schularbeiten und Tests
			</p>
		</div>

		<button
			type="button"
			onclick={() => (showCreateModal = true)}
			class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center space-x-1.5 self-start sm:self-auto"
		>
			<Plus class="w-4 h-4" />
			<span>Neuen Test / Schularbeit anlegen</span>
		</button>
	</div>

	{#if toastMsg}
		<div class="fixed bottom-6 right-6 z-50 pointer-events-none transition-all duration-300">
			<div class="px-4 py-2.5 bg-emerald-950/95 border border-emerald-700 text-emerald-200 text-xs font-semibold rounded-xl shadow-2xl flex items-center space-x-2 backdrop-blur-md">
				<CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
				<span>{toastMsg}</span>
			</div>
		</div>
	{/if}

	<!-- Test Selection Tabs / Horizontal List -->
	{#if assessments.length > 0}
		<div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
			{#each assessments as a}
				<a
					href="/kurse/{course.id}?tab=tests&assessmentId={a.id}"
					class="px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center space-x-2 shrink-0 {selectedAssessment?.id === a.id ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/40' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'}"
				>
					<Award class="w-4 h-4" />
					<span>{a.title}</span>
					<span class="text-[10px] opacity-75 font-mono">({a.maxPoints} Pkt.)</span>
					{#if a.overdueCount > 0}
						<span class="px-1.5 py-0.2 rounded-full text-[10px] bg-red-950 text-red-300 border border-red-800 font-bold">
							{a.overdueCount} überfällig
						</span>
					{/if}
				</a>
			{/each}
		</div>
	{/if}

	{#if !selectedAssessment}
		<div class="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center">
			<p class="text-slate-400 text-sm">Noch keine Tests oder Schularbeiten angelegt.</p>
		</div>
	{:else}
		<!-- Selected Assessment Workspace -->
		<div class="space-y-4">
			<!-- Header of Selected Assessment -->
			<div class="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
				<div>
					<div class="flex items-center space-x-2">
						<span class="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider {selectedAssessment.type === 'schularbeit' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-blue-950 text-blue-300 border border-blue-800'}">
							{selectedAssessment.type === 'schularbeit' ? 'Schularbeit' : selectedAssessment.type}
						</span>
						<h3 class="text-lg font-bold text-white">{selectedAssessment.title}</h3>
					</div>
					<p class="text-xs text-slate-400 mt-1">
						Datum: <strong>{selectedAssessment.date}</strong> | Maximal erreichbare Punkte: <strong class="text-white font-mono">{selectedAssessment.maxPoints} Pkt.</strong>
					</p>
				</div>

				<!-- Sub-tab switcher: Punkteingabe vs. Rücklauf -->
				<div class="flex items-center gap-2">
					<div class="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
						<button
							type="button"
							onclick={() => (activeTabMode = 'points')}
							class="px-3 py-1.5 rounded-lg font-semibold transition {activeTabMode === 'points' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}"
						>
							Punkteingabe ({selectedAssessment.results.filter((r: any) => r.points !== null).length})
						</button>
						<button
							type="button"
							onclick={() => (activeTabMode = 'returns')}
							class="px-3 py-1.5 rounded-lg font-semibold transition {activeTabMode === 'returns' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}"
						>
							Rücklaufliste ({selectedAssessment.results.filter((r: any) => r.isSigned).length}/{selectedAssessment.results.length})
						</button>
					</div>

					<button
						type="button"
						onclick={toggleScaleModal}
						class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition"
						title="Notenschlüssel bearbeiten"
					>
						<Sliders class="w-4 h-4 text-blue-400" />
						<span>Notenschlüssel</span>
					</button>

					<form
						action="?/deleteAssessment&tab=tests"
						method="POST"
						use:enhance={() => {
							return async ({ result, update }) => {
								if (result.type === 'success') {
									showToast('Test / Schularbeit gelöscht');
									await goto(`/kurse/${course.id}?tab=tests`, { invalidateAll: true });
								} else {
									await update();
								}
							};
						}}
						onsubmit={(e) => {
							if (
								!confirm(
									`Möchtest du "${selectedAssessment.title}" wirklich unwiderruflich löschen? Alle Noten und Rückläufe dazu werden entfernt.`
								)
							) {
								e.preventDefault();
							}
						}}
					>
						<input type="hidden" name="assessmentId" value={selectedAssessment.id} />
						<button
							type="submit"
							class="px-3 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-400 hover:text-red-200 border border-red-900/60 text-xs font-semibold flex items-center space-x-1.5 transition active:scale-95"
							title="Test / Schularbeit löschen"
						>
							<Trash2 class="w-4 h-4" />
							<span class="hidden sm:inline">Löschen</span>
						</button>
					</form>
				</div>
			</div>

			<!-- PERMANENT NOTENSCHLÜSSEL ÜBERSICHTSLEISTE (Punkte → Note) -->
			<div class="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm space-y-2">
				<div class="flex items-center justify-between text-xs">
					<span class="font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
						<span>Aktiver Notenschlüssel (Punkte &rarr; Note):</span>
					</span>
					<span class="text-slate-400 text-[11px]">
						Max. {selectedAssessment.maxPoints} Punkte
					</span>
				</div>

				<div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
					{#each activeIntervals as iv}
						<div class="p-2 rounded-xl bg-slate-950 border {iv.grade === 1 ? 'border-emerald-800/80 bg-emerald-950/20' : iv.grade === 5 ? 'border-red-800/80 bg-red-950/20' : 'border-slate-800'}">
							<span class="font-bold block {iv.grade === 1 ? 'text-emerald-400' : iv.grade === 5 ? 'text-red-400' : 'text-slate-200'}">
								Note {iv.grade} – {iv.label}
							</span>
							<span class="text-white font-mono font-bold block text-sm mt-0.5">
								{iv.description}
							</span>
						</div>
					{/each}
				</div>
			</div>

			<!-- Grading Scale Editor Modal/Drawer (if open) -->
			{#if showScaleModal}
				<form
					action="?/updateGradingScale&tab=tests"
					method="POST"
					use:enhance={() => {
						return async ({ result, update }) => {
							await update();
							if (result.type === 'success') {
								showScaleModal = false;
								showToast('Notenschlüssel aktualisiert und alle Noten neu berechnet!');
							}
						};
					}}
					class="p-4 bg-slate-900 border border-blue-800/80 rounded-2xl space-y-3"
				>
					<input type="hidden" name="assessmentId" value={selectedAssessment.id} />
					<input type="hidden" name="scaleJson" value={JSON.stringify(editingScale)} />

					<GradingScaleEditor bind:scale={editingScale} maxPoints={selectedAssessment.maxPoints} templates={gradingTemplates} />

					<div class="flex justify-end space-x-2">
						<button
							type="button"
							onclick={() => (showScaleModal = false)}
							class="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
						>
							Schließen
						</button>
						<button
							type="submit"
							class="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow"
						>
							Notenschlüssel speichern & neu berechnen
						</button>
					</div>
				</form>
			{/if}

			<!-- Class Stats Chart -->
			<ClassStatsChart results={selectedAssessment.results} />

			<!-- Mode 1: Points Entry Table -->
			{#if activeTabMode === 'points'}
				<div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg overflow-x-auto">
					<table class="w-full text-left border-collapse text-xs">
						<thead>
							<tr class="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[11px]">
								<th class="py-3 px-3 w-12 text-center">Kat.</th>
								<th class="py-3 px-4">Schüler</th>
								<th class="py-3 px-4 w-40 text-center">Punkte (max. {selectedAssessment.maxPoints})</th>
								<th class="py-3 px-3 w-28 text-center">Erreicht (%)</th>
								<th class="py-3 px-4 w-48 text-center">Berechnete Note</th>
								<th class="py-3 px-3 w-24 text-center">Abwesend</th>
								<th class="py-3 px-3 w-28 text-center">Nachgeholt</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-800/80 text-slate-200">
							{#each selectedAssessment.results as r, idx (r.studentId)}
								{@const liveGrade = r.isAbsent ? null : calculateLiveGrade(r.points)}
								<tr class="hover:bg-slate-800/40 transition {liveGrade === 5 ? 'bg-red-950/20' : ''}">
									<td class="py-3 px-3 text-center font-bold text-slate-400">{r.catalogNumber ?? '–'}</td>
									<td class="py-3 px-4">
										<a href="/schueler/{r.studentId}" class="font-bold text-white hover:text-blue-400 transition">
											{r.lastName} {r.firstName}
										</a>
									</td>

									<!-- Points Input with instant reactive calculation -->
									<td class="py-3 px-4 text-center">
										<form
											action="?/saveAssessmentScore&tab=tests"
											method="POST"
											use:enhance={() => {
												return async ({ result }) => {
													if (result.type === 'success') {
														showToast(`Punkte für ${r.lastName} gespeichert`);
													}
												};
											}}
											class="inline-block"
										>
											<input type="hidden" name="assessmentId" value={selectedAssessment.id} />
											<input type="hidden" name="studentId" value={r.studentId} />
											<input type="hidden" name="isAbsent" value={r.isAbsent ? 'true' : 'false'} />
											<input type="hidden" name="isMadeUp" value={r.isMadeUp ? 'true' : 'false'} />

											<div class="relative inline-flex items-center">
												<input
													id="points-input-{idx}"
													type="number"
													name="points"
													step="0.5"
													min="0"
													max={selectedAssessment.maxPoints}
													bind:value={r.points}
													disabled={r.isAbsent}
													onkeydown={(e) => handleKeyDown(e, idx)}
													onchange={(e) => (e.target as HTMLInputElement).form?.requestSubmit()}
													placeholder="–"
													class="w-24 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-30 shadow-inner"
												/>
												<span class="ml-1 text-slate-500 font-mono text-[11px]">/ {selectedAssessment.maxPoints}</span>
											</div>
										</form>
									</td>

									<!-- Percentage achieved -->
									<td class="py-3 px-3 text-center font-mono text-slate-400 text-xs">
										{r.isAbsent ? '–' : formatPercent(r.points) || '–'}
									</td>

									<!-- Computed Grade Badge & Label based on Notenschlüssel -->
									<td class="py-3 px-4 text-center">
										{#if r.isAbsent}
											<span class="px-2.5 py-1 rounded bg-slate-800 text-slate-400 font-semibold text-[11px]">Abwesend</span>
										{:else if liveGrade !== null}
											<div class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg shadow-sm {liveGrade === 1 ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300' : liveGrade === 2 ? 'bg-blue-950/80 border border-blue-800 text-blue-300' : liveGrade === 3 ? 'bg-amber-950/80 border border-amber-800 text-amber-300' : liveGrade === 4 ? 'bg-orange-950/80 border border-orange-800 text-orange-300' : 'bg-red-950 text-red-300 border border-red-800 animate-pulse'}">
												<span class="font-extrabold text-sm">{liveGrade}</span>
												<span class="text-xs font-semibold">({GRADE_LABELS[liveGrade]})</span>
											</div>
										{:else}
											<span class="text-slate-500">–</span>
										{/if}
									</td>

									<!-- Absent Toggle -->
									<td class="py-3 px-3 text-center">
										<form
											action="?/saveAssessmentScore&tab=tests"
											method="POST"
											use:enhance={() => {
												r.isAbsent = !r.isAbsent;
												return async ({ result }) => {
													if (result.type !== 'success') r.isAbsent = !r.isAbsent;
												};
											}}
										>
											<input type="hidden" name="assessmentId" value={selectedAssessment.id} />
											<input type="hidden" name="studentId" value={r.studentId} />
											<input type="hidden" name="points" value={r.points ?? ''} />
											<input type="hidden" name="isAbsent" value={r.isAbsent ? 'true' : 'false'} />
											<input type="hidden" name="isMadeUp" value={r.isMadeUp ? 'true' : 'false'} />
											<button
												type="submit"
												class="p-1 px-2 rounded text-xs transition {r.isAbsent ? 'text-amber-400 bg-amber-950/80 border border-amber-800 font-bold' : 'text-slate-500 hover:text-white'}"
											>
												{r.isAbsent ? 'Abwesend ✓' : 'Nein'}
											</button>
										</form>
									</td>

									<!-- Made up Toggle -->
									<td class="py-3 px-3 text-center">
										<form
											action="?/saveAssessmentScore&tab=tests"
											method="POST"
											use:enhance={() => {
												r.isMadeUp = !r.isMadeUp;
												return async ({ result }) => {
													if (result.type !== 'success') r.isMadeUp = !r.isMadeUp;
												};
											}}
										>
											<input type="hidden" name="assessmentId" value={selectedAssessment.id} />
											<input type="hidden" name="studentId" value={r.studentId} />
											<input type="hidden" name="points" value={r.points ?? ''} />
											<input type="hidden" name="isAbsent" value={r.isAbsent ? 'true' : 'false'} />
											<input type="hidden" name="isMadeUp" value={r.isMadeUp ? 'true' : 'false'} />
											<button
												type="submit"
												class="p-1 px-2 rounded text-xs transition {r.isMadeUp ? 'text-emerald-400 bg-emerald-950/80 border border-emerald-800 font-bold' : 'text-slate-500 hover:text-white'}"
											>
												{r.isMadeUp ? 'Nachgeholt ✓' : '–'}
											</button>
										</form>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<!-- Mode 2: Return Tracking Checklist ("Unterschrieben zurück") -->
				<div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg overflow-x-auto">
					<table class="w-full text-left border-collapse text-xs">
						<thead>
							<tr class="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[11px]">
								<th class="py-3 px-3 w-12 text-center">Kat.</th>
								<th class="py-3 px-4">Schüler</th>
								<th class="py-3 px-3 text-center">Frist</th>
								<th class="py-3 px-4 text-center">Status</th>
								<th class="py-3 px-4 text-center">Aktion</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-800/80 text-slate-200">
							{#each selectedAssessment.results as r}
								{@const todayStr = new Date().toISOString().slice(0, 10)}
								{@const isOverdue = !r.isSigned && r.dueDate && r.dueDate < todayStr && (!r.snoozedUntil || r.snoozedUntil <= todayStr)}
								<tr class="hover:bg-slate-800/40 transition {isOverdue ? 'bg-red-950/15' : ''}">
									<td class="py-3 px-3 text-center font-bold text-slate-400">{r.catalogNumber ?? '–'}</td>
									<td class="py-3 px-4 font-bold text-white">{r.lastName} {r.firstName}</td>

									<td class="py-3 px-3 text-center text-slate-400 font-mono">
										{r.dueDate || '–'}
									</td>

									<td class="py-3 px-4 text-center">
										{#if r.isSigned}
											<span class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
												<CheckCircle2 class="w-3.5 h-3.5 text-emerald-400" />
												<span>Unterschrieben retour</span>
											</span>
										{:else if isOverdue}
											<span class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-950 text-red-300 border border-red-800 animate-pulse">
												<AlertTriangle class="w-3.5 h-3.5 text-red-400" />
												<span>Überfällig!</span>
											</span>
										{:else}
											<span class="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400">
												Offen
											</span>
										{/if}
									</td>

									<td class="py-3 px-4 text-center">
										<form
											action="?/markTestReturnSigned&tab=tests"
											method="POST"
											use:enhance={() => {
												return async ({ update }) => {
													showToast(`Rücklauf für ${r.lastName} aktualisiert`);
													await update();
												};
											}}
											class="inline-block"
										>
											<input type="hidden" name="returnId" value={r.returnId} />
											<input type="hidden" name="isSigned" value={r.isSigned ? 'false' : 'true'} />
											<button
												type="submit"
												class="px-3 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 {r.isSigned ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20'}"
											>
												{r.isSigned ? 'Rückgängig' : 'Unterschrieben ✓'}
											</button>
										</form>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Modal: Neuen Test / Schularbeit anlegen -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
			<div class="flex items-center justify-between pb-3 border-b border-slate-800">
				<h3 class="text-lg font-bold text-white">Neuen Test / Schularbeit anlegen</h3>
				<button type="button" onclick={() => (showCreateModal = false)} class="text-slate-400 hover:text-white">
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				action="?/createAssessment&tab=tests"
				method="POST"
				use:enhance={() => async ({ result, update }) => {
					if (result.type === 'success' && result.data) {
						showCreateModal = false;
						const createdId = (result.data as any).createdAssessmentId;
						if (createdId) {
							await goto(`/kurse/${course.id}?tab=tests&assessmentId=${createdId}`, { invalidateAll: true });
							return;
						}
					}
					await update();
				}}
				class="space-y-4"
			>
				<div>
					<label for="assTitle" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Bezeichnung *
					</label>
					<input
						id="assTitle"
						name="title"
						type="text"
						required
						bind:value={newTitle}
						placeholder="z.B. 1. Schularbeit, Kapiteltest 3..."
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="assType" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Typ *
						</label>
						<select
							id="assType"
							name="type"
							bind:value={newType}
							class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
						>
							<option value="schularbeit">Schularbeit</option>
							<option value="test">Test</option>
							<option value="wiederholung">Wiederholung</option>
						</select>
					</div>

					<div>
						<label for="assDate" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Datum *
						</label>
						<input
							id="assDate"
							name="date"
							type="date"
							required
							bind:value={newDate}
							class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="assMaxPoints" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Max. erreichbare Punkte *
						</label>
						<input
							id="assMaxPoints"
							name="maxPoints"
							type="number"
							step="0.5"
							min="1"
							required
							bind:value={newMaxPoints}
							class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500 font-bold"
						/>
					</div>

					<div>
						<label for="assReturnDays" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Rückgabefrist (Tage)
						</label>
						<input
							id="assReturnDays"
							name="returnDays"
							type="number"
							min="1"
							bind:value={newReturnDays}
							class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500 font-bold"
						/>
					</div>
				</div>

				<!-- Notenschlüssel-Vorlage Dropdown -->
				<div>
					<div class="flex items-center justify-between mb-1">
						<label for="assTemplate" class="block text-xs font-semibold uppercase tracking-wider text-slate-400">
							Notenschlüssel-Vorlage
						</label>
						<a
							href="/einstellungen#notenschluessel"
							target="_blank"
							class="text-[11px] text-blue-400 hover:underline flex items-center space-x-1"
						>
							<Sliders class="w-3 h-3" />
							<span>Vorlagen verwalten</span>
						</a>
					</div>
					<select
						id="assTemplate"
						name="templateId"
						bind:value={selectedTemplateId}
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					>
						{#each gradingTemplates as t}
							<option value={t.id}>
								{t.name} {t.isDefault ? '(Standard)' : ''}
							</option>
						{/each}
					</select>
					{#if activeTemplate?.description}
						<p class="text-[11px] text-slate-400 mt-1 italic">
							{activeTemplate.description}
						</p>
					{/if}
				</div>

				<!-- Live Preview of Grade Intervals based on selected template and max points -->
				<div class="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
							<Sparkles class="w-3.5 h-3.5 text-blue-400" />
							<span>Notenstufen-Vorschau ({newMaxPoints} Punkte)</span>
						</span>
					</div>
					<div class="grid grid-cols-5 gap-1.5 text-center">
						{#each templateIntervals as item}
							<div class="p-1.5 rounded-lg border {item.grade === 1 ? 'bg-emerald-950/30 border-emerald-800/60' : item.grade === 5 ? 'bg-red-950/30 border-red-800/60' : 'bg-slate-900 border-slate-800'}">
								<div class="text-[11px] font-bold {item.grade === 1 ? 'text-emerald-400' : item.grade === 5 ? 'text-red-400' : 'text-slate-200'}">
									Note {item.grade}
								</div>
								<div class="text-[10px] text-slate-300 font-mono mt-0.5">
									{item.grade === 5 ? `< ${(templateIntervals.find(i => i.grade === 4)?.minPoints ?? 0).toFixed(1)}` : `≥ ${item.minPoints.toFixed(1)}`}
								</div>
								<div class="text-[9px] text-slate-400">
									{item.grade === 5 ? `< ${templateIntervals.find(i => i.grade === 4)?.minPercent ?? 50}%` : `≥ ${item.minPercent}%`}
								</div>
							</div>
						{/each}
					</div>
				</div>

				<input type="hidden" name="gradingScaleJson" value={JSON.stringify(templateScale)} />

				<div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
					<button
						type="button"
						onclick={() => (showCreateModal = false)}
						class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
					>
						Abbrechen
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-md shadow-blue-500/20"
					>
						Erfassen
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
