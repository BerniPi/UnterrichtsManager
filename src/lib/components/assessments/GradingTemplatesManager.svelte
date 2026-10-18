<script lang="ts">
	import { enhance } from '$app/forms';
	import type { GradingScaleTemplate, GradingThreshold } from '$lib/services/grading';
	import { DEFAULT_AUSTRIAN_SCALE, getGradeIntervals } from '$lib/services/grading';
	import {
		Sliders,
		Plus,
		Check,
		Edit2,
		Trash2,
		Star,
		X,
		Copy,
		Sparkles,
		Info,
		CheckCircle2,
		AlertCircle
	} from '@lucide/svelte';

	interface Props {
		templates?: Array<GradingScaleTemplate>;
		form?: any;
	}

	let {
		templates = [],
		form = null
	}: Props = $props();

	// Modal State
	let showModal = $state(false);
	let editingId = $state<string | null>(null);
	let modalName = $state('');
	let modalDescription = $state('');
	let modalIsDefault = $state(false);

	// Threshold percentages for modal (Note 1, 2, 3, 4)
	let p1 = $state(88);
	let p2 = $state(75);
	let p3 = $state(60);
	let p4 = $state(50);

	// Interactive sample points calculator for cards
	let sampleMaxPoints = $state(48);

	function openCreateModal() {
		editingId = null;
		modalName = '';
		modalDescription = '';
		modalIsDefault = templates.length === 0;
		p1 = 88;
		p2 = 75;
		p3 = 60;
		p4 = 50;
		showModal = true;
	}

	function openEditModal(template: GradingScaleTemplate) {
		editingId = template.id;
		modalName = template.name;
		modalDescription = template.description || '';
		modalIsDefault = template.isDefault;

		const th1 = template.scale.find((s) => s.grade === 1);
		const th2 = template.scale.find((s) => s.grade === 2);
		const th3 = template.scale.find((s) => s.grade === 3);
		const th4 = template.scale.find((s) => s.grade === 4);

		p1 = th1 ? th1.minPercent : 88;
		p2 = th2 ? th2.minPercent : 75;
		p3 = th3 ? th3.minPercent : 60;
		p4 = th4 ? th4.minPercent : 50;

		showModal = true;
	}

	function duplicateTemplate(template: GradingScaleTemplate) {
		editingId = null;
		modalName = `${template.name} (Kopie)`;
		modalDescription = template.description ? `${template.description}` : '';
		modalIsDefault = false;

		const th1 = template.scale.find((s) => s.grade === 1);
		const th2 = template.scale.find((s) => s.grade === 2);
		const th3 = template.scale.find((s) => s.grade === 3);
		const th4 = template.scale.find((s) => s.grade === 4);

		p1 = th1 ? th1.minPercent : 88;
		p2 = th2 ? th2.minPercent : 75;
		p3 = th3 ? th3.minPercent : 60;
		p4 = th4 ? th4.minPercent : 50;

		showModal = true;
	}

	const modalScale = $derived<GradingThreshold[]>([
		{ grade: 1, minPercent: p1 },
		{ grade: 2, minPercent: p2 },
		{ grade: 3, minPercent: p3 },
		{ grade: 4, minPercent: p4 },
		{ grade: 5, minPercent: 0 }
	]);

	const isValidOrder = $derived(p1 > p2 && p2 > p3 && p3 > p4 && p4 > 0 && p1 <= 100);

	const modalIntervals = $derived(getGradeIntervals(sampleMaxPoints, modalScale));
</script>

<div class="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm space-y-6" id="notenschluessel">
	<!-- Top Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
		<div>
			<div class="flex items-center space-x-2">
				<Sliders class="w-5 h-5 text-blue-400" />
				<h2 class="text-base font-bold text-white">Notenschlüssel-Vorlagen (Templates)</h2>
			</div>
			<p class="text-xs text-slate-400 mt-1">
				Definiere Vorlagen für Schularbeiten und Tests. Beim Anlegen eines neuen Tests wählst du direkt die gewünschte Vorlage.
			</p>
		</div>

		<div class="flex items-center space-x-3">
			<div class="hidden sm:flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-400">
				<span>Beispielrechnung:</span>
				<input
					type="number"
					min="1"
					step="1"
					bind:value={sampleMaxPoints}
					class="w-12 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs font-bold text-center"
				/>
				<span>Punkte</span>
			</div>

			<button
				type="button"
				onclick={openCreateModal}
				class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center space-x-1.5 shrink-0"
			>
				<Plus class="w-4 h-4" />
				<span>Neue Vorlage</span>
			</button>
		</div>
	</div>

	<!-- Form Feedbacks -->
	{#if form?.templateSuccess}
		<div class="p-3 bg-emerald-950/90 border border-emerald-800 text-emerald-200 text-xs rounded-xl flex items-center space-x-2">
			<CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
			<span>{form.templateSuccess}</span>
		</div>
	{/if}

	{#if form?.templateError}
		<div class="p-3 bg-red-950/90 border border-red-800 text-red-200 text-xs rounded-xl flex items-center space-x-2">
			<AlertCircle class="w-4 h-4 text-red-400 shrink-0" />
			<span>{form.templateError}</span>
		</div>
	{/if}

	<!-- Template Cards Grid -->
	<div class="grid grid-cols-1 gap-4">
		{#each templates as t (t.id)}
			{@const intervals = getGradeIntervals(sampleMaxPoints, t.scale)}
			<div class="p-5 bg-slate-950 rounded-2xl border transition {t.isDefault ? 'border-blue-700/80 shadow-md shadow-blue-950/40 bg-gradient-to-b from-blue-950/20 to-slate-950' : 'border-slate-800/90 hover:border-slate-700'} space-y-4">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div>
						<div class="flex items-center space-x-2">
							<h3 class="text-base font-bold text-white">{t.name}</h3>
							{#if t.isDefault}
								<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-900/60 text-blue-300 border border-blue-600/60 flex items-center space-x-1">
									<Star class="w-3 h-3 fill-blue-300 text-blue-300" />
									<span>Standard-Vorlage</span>
								</span>
							{/if}
						</div>
						{#if t.description}
							<p class="text-xs text-slate-400 mt-1">{t.description}</p>
						{/if}
					</div>

					<!-- Template Actions -->
					<div class="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
						{#if !t.isDefault}
							<form action="?/setDefaultTemplate" method="POST" use:enhance>
								<input type="hidden" name="id" value={t.id} />
								<button
									type="submit"
									class="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center space-x-1 transition"
									title="Als Standard für neue Tests definieren"
								>
									<Star class="w-3.5 h-3.5 text-amber-400" />
									<span>Als Standard</span>
								</button>
							</form>
						{/if}

						<button
							type="button"
							onclick={() => duplicateTemplate(t)}
							class="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
							title="Vorlage duplizieren"
						>
							<Copy class="w-3.5 h-3.5" />
						</button>

						<button
							type="button"
							onclick={() => openEditModal(t)}
							class="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
							title="Vorlage bearbeiten"
						>
							<Edit2 class="w-3.5 h-3.5" />
						</button>

						{#if templates.length > 1}
							<form
								action="?/deleteTemplate"
								method="POST"
								use:enhance={({ cancel }) => {
									if (!confirm(`Soll die Vorlage „${t.name}“ wirklich gelöscht werden?`)) {
										cancel();
									}
								}}
							>
								<input type="hidden" name="id" value={t.id} />
								<button
									type="submit"
									class="p-2 rounded-xl bg-slate-900 hover:bg-red-950/50 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-800/60 transition"
									title="Vorlage löschen"
								>
									<Trash2 class="w-3.5 h-3.5" />
								</button>
							</form>
						{/if}
					</div>
				</div>

				<!-- Threshold Visual Cards -->
				<div class="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
					{#each intervals as item}
						<div class="p-2.5 rounded-xl border text-center space-y-1 {item.grade === 1 ? 'bg-emerald-950/20 border-emerald-800/50' : item.grade === 5 ? 'bg-red-950/20 border-red-800/50' : 'bg-slate-900/80 border-slate-800'}">
							<span class="text-xs font-bold block {item.grade === 1 ? 'text-emerald-400' : item.grade === 5 ? 'text-red-400' : 'text-slate-200'}">
								Note {item.grade} – {item.label}
							</span>

							<div class="text-xs font-mono font-bold text-white">
								{item.grade === 5 ? `< ${intervals.find(i => i.grade === 4)?.minPercent ?? 50}%` : `≥ ${item.minPercent}%`}
							</div>

							<div class="text-[11px] text-slate-400 font-mono">
								{item.grade === 5 ? `< ${(intervals.find(i => i.grade === 4)?.minPoints ?? 0).toFixed(1)} Pkt.` : `≥ ${item.minPoints.toFixed(1)} Pkt.`}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>

<!-- Modal: Create / Edit Template -->
{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
			<div class="flex items-center justify-between pb-3 border-b border-slate-800">
				<div class="flex items-center space-x-2">
					<Sliders class="w-5 h-5 text-blue-400" />
					<h3 class="text-lg font-bold text-white">
						{editingId ? 'Notenschlüssel-Vorlage bearbeiten' : 'Neue Notenschlüssel-Vorlage anlegen'}
					</h3>
				</div>
				<button type="button" onclick={() => (showModal = false)} class="text-slate-400 hover:text-white">
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				action="?/saveTemplate"
				method="POST"
				use:enhance={() => {
					return async ({ result, update }) => {
						await update();
						if (result.type === 'success') {
							showModal = false;
						}
					};
				}}
				class="space-y-4"
			>
				{#if editingId}
					<input type="hidden" name="id" value={editingId} />
				{/if}

				<div>
					<label for="tplName" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Name der Vorlage *
					</label>
					<input
						id="tplName"
						name="name"
						type="text"
						required
						bind:value={modalName}
						placeholder="z.B. Österreich Standard, Strenger Testschlüssel..."
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="tplDesc" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Beschreibung (optional)
					</label>
					<input
						id="tplDesc"
						name="description"
						type="text"
						bind:value={modalDescription}
						placeholder="z.B. Für alle regulären Mathematik-Schularbeiten..."
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div class="flex items-center space-x-2 pt-1">
					<input
						id="tplDefault"
						name="isDefault"
						type="checkbox"
						value="true"
						bind:checked={modalIsDefault}
						class="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-950"
					/>
					<label for="tplDefault" class="text-xs font-semibold text-slate-300">
						Als Standard für neue Tests & Schularbeiten vorauswählen
					</label>
				</div>

				<!-- Thresholds Configurator -->
				<div class="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
					<h4 class="text-xs font-bold text-slate-200 uppercase tracking-wider">
						Prozentgrenzen für Notenstufen
					</h4>

					<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
						<!-- Note 1 -->
						<div class="space-y-1">
							<label for="pct1" class="block text-[11px] font-bold text-emerald-400">Note 1 (Sehr gut)</label>
							<div class="flex items-center space-x-1">
								<span class="text-xs text-slate-400">ab</span>
								<input
									id="pct1"
									type="number"
									min="1"
									max="100"
									step="0.5"
									bind:value={p1}
									class="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono font-bold text-center text-sm"
								/>
								<span class="text-xs text-slate-400">%</span>
							</div>
						</div>

						<!-- Note 2 -->
						<div class="space-y-1">
							<label for="pct2" class="block text-[11px] font-bold text-blue-400">Note 2 (Gut)</label>
							<div class="flex items-center space-x-1">
								<span class="text-xs text-slate-400">ab</span>
								<input
									id="pct2"
									type="number"
									min="1"
									max="100"
									step="0.5"
									bind:value={p2}
									class="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono font-bold text-center text-sm"
								/>
								<span class="text-xs text-slate-400">%</span>
							</div>
						</div>

						<!-- Note 3 -->
						<div class="space-y-1">
							<label for="pct3" class="block text-[11px] font-bold text-amber-400">Note 3 (Befriedigend)</label>
							<div class="flex items-center space-x-1">
								<span class="text-xs text-slate-400">ab</span>
								<input
									id="pct3"
									type="number"
									min="1"
									max="100"
									step="0.5"
									bind:value={p3}
									class="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono font-bold text-center text-sm"
								/>
								<span class="text-xs text-slate-400">%</span>
							</div>
						</div>

						<!-- Note 4 -->
						<div class="space-y-1">
							<label for="pct4" class="block text-[11px] font-bold text-orange-400">Note 4 (Genügend)</label>
							<div class="flex items-center space-x-1">
								<span class="text-xs text-slate-400">ab</span>
								<input
									id="pct4"
									type="number"
									min="1"
									max="100"
									step="0.5"
									bind:value={p4}
									class="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono font-bold text-center text-sm"
								/>
								<span class="text-xs text-slate-400">%</span>
							</div>
						</div>
					</div>

					<p class="text-[11px] text-slate-400">
						Hinweis: <strong>Note 5 (Nicht genügend)</strong> greift automatisch bei allen Ergebnissen unter {p4}%.
					</p>

					{#if !isValidOrder}
						<div class="p-2.5 bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-lg flex items-center space-x-2">
							<AlertCircle class="w-4 h-4 text-red-400 shrink-0" />
							<span>Ungültig: Die Werte müssen absteigend sortiert sein (100% ≥ Note 1 > Note 2 > Note 3 > Note 4 > 0%).</span>
						</div>
					{/if}

					<!-- Dynamic Interval Calculation Preview in Modal -->
					<div class="pt-2 border-t border-slate-800">
						<span class="text-[11px] font-semibold text-slate-300 flex items-center space-x-1.5 mb-1.5">
							<Sparkles class="w-3.5 h-3.5 text-blue-400" />
							<span>Berechnete Notengrenzen für {sampleMaxPoints} Punkte:</span>
						</span>
						<div class="grid grid-cols-5 gap-1 text-center">
							{#each modalIntervals as item}
								<div class="p-1 rounded bg-slate-900 border border-slate-800">
									<div class="text-[10px] font-bold {item.grade === 1 ? 'text-emerald-400' : item.grade === 5 ? 'text-red-400' : 'text-slate-300'}">
										Note {item.grade}
									</div>
									<div class="text-[9px] text-slate-400 font-mono">
										{item.grade === 5 ? `< ${(modalIntervals.find(i => i.grade === 4)?.minPoints ?? 0).toFixed(1)} Pkt.` : `≥ ${item.minPoints.toFixed(1)} Pkt.`}
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>

				<input type="hidden" name="scaleJson" value={JSON.stringify(modalScale)} />

				<div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
					<button
						type="button"
						onclick={() => (showModal = false)}
						class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 transition"
					>
						Abbrechen
					</button>
					<button
						type="submit"
						disabled={!isValidOrder || !modalName.trim()}
						class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition"
					>
						{editingId ? 'Änderungen speichern' : 'Vorlage erstellen'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
