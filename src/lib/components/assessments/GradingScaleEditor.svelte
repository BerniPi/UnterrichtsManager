<script lang="ts">
	import type { GradingThreshold, GradingScaleTemplate } from '$lib/services/grading';
	import { DEFAULT_AUSTRIAN_SCALE, DEFAULT_TEMPLATES, getGradeIntervals } from '$lib/services/grading';
	import { RotateCcw, Sliders, Check } from '@lucide/svelte';

	let {
		scale = $bindable(DEFAULT_AUSTRIAN_SCALE),
		maxPoints = 48,
		templates = []
	} = $props<{
		scale: GradingThreshold[];
		maxPoints: number;
		templates?: Array<GradingScaleTemplate>;
	}>();

	let inputMode = $state<'percent' | 'points'>('percent');

	function resetToDefault() {
		scale = JSON.parse(JSON.stringify(DEFAULT_AUSTRIAN_SCALE));
	}

	function applyTemplate(tplScale: GradingThreshold[]) {
		scale = JSON.parse(JSON.stringify(tplScale));
	}

	const availableTemplates = $derived(
		templates.length > 0 ? templates : DEFAULT_TEMPLATES
	);

	function getMinPoints(minPercent: number): number {
		return Math.round(((maxPoints * minPercent) / 100) * 10) / 10;
	}

	function handlePercentChange(grade: number, pct: number) {
		scale = scale.map((s) => (s.grade === grade ? { ...s, minPercent: Math.max(0, Math.min(100, pct)) } : s));
	}

	function handlePointsChange(grade: number, pointsValue: number) {
		if (maxPoints <= 0) return;
		const pct = Math.min(100, Math.max(0, Math.round((pointsValue / maxPoints) * 100 * 10) / 10));
		scale = scale.map((s) => (s.grade === grade ? { ...s, minPercent: pct } : s));
	}

	const intervals = $derived(getGradeIntervals(maxPoints, scale));
</script>

<div class="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
	<!-- Top Controls -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
		<div>
			<div class="flex items-center space-x-2">
				<Sliders class="w-4 h-4 text-blue-400" />
				<h4 class="text-xs font-bold uppercase tracking-wider text-slate-200">
					Notenschlüssel für Schularbeiten & Tests
				</h4>
			</div>
			<p class="text-[11px] text-slate-400 mt-0.5">
				Basis: <strong class="text-white">{maxPoints} Maximalpunkte</strong>. Berechnet automatisch die Note beim Eintragen der Punkte.
			</p>
		</div>

		<!-- Switcher: Prozent vs. Punkte -->
		<div class="flex items-center gap-2">
			<div class="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
				<button
					type="button"
					onclick={() => (inputMode = 'percent')}
					class="px-2.5 py-1 rounded-md font-semibold transition {inputMode === 'percent' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}"
				>
					In Prozent (%)
				</button>
				<button
					type="button"
					onclick={() => (inputMode = 'points')}
					class="px-2.5 py-1 rounded-md font-semibold transition {inputMode === 'points' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}"
				>
					Direkt in Punkten
				</button>
			</div>

			<button
				type="button"
				onclick={resetToDefault}
				class="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-[11px] border border-slate-800 flex items-center space-x-1"
				title="Zurücksetzen auf österreichischen Standard"
			>
				<RotateCcw class="w-3 h-3" />
				<span>Standard</span>
			</button>
		</div>
	</div>

	<!-- Presets Quick Buttons -->
	<div class="flex items-center gap-2 text-xs flex-wrap">
		<span class="text-[11px] text-slate-400 font-medium">Vorlagen:</span>
		{#each availableTemplates as tpl}
			<button
				type="button"
				onclick={() => applyTemplate(tpl.scale)}
				class="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] transition"
			>
				{tpl.name}
			</button>
		{/each}
	</div>

	<!-- Interactive Threshold Cards -->
	<div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
		{#each intervals as item}
			<div class="p-3 rounded-xl bg-slate-900 border {item.grade === 1 ? 'border-emerald-800/80 bg-emerald-950/20' : item.grade === 5 ? 'border-red-800/80 bg-red-950/20' : 'border-slate-800'} text-center space-y-1.5">
				<span class="text-xs font-bold block {item.grade === 1 ? 'text-emerald-400' : item.grade === 5 ? 'text-red-400' : 'text-slate-200'}">
					Note {item.grade} – {item.label}
				</span>

				{#if item.grade < 5}
					{#if inputMode === 'percent'}
						<!-- Percent Mode Input -->
						<div class="flex items-center justify-center space-x-1 text-xs">
							<span class="text-slate-400">ab</span>
							<input
								type="number"
								min="0"
								max="100"
								step="1"
								value={item.minPercent}
								oninput={(e) => handlePercentChange(item.grade, parseFloat((e.target as HTMLInputElement).value || '0'))}
								class="w-12 px-1 py-1 rounded bg-slate-950 border border-slate-700 text-white text-center text-xs font-bold font-mono focus:ring-1 focus:ring-blue-500"
							/>
							<span class="text-slate-400">%</span>
						</div>
						<span class="text-[11px] font-bold text-blue-300 block">
							ab {item.minPoints.toFixed(1)} Pkt.
						</span>
					{:else}
						<!-- Points Mode Input -->
						<div class="flex items-center justify-center space-x-1 text-xs">
							<span class="text-slate-400">ab</span>
							<input
								type="number"
								min="0"
								max={maxPoints}
								step="0.5"
								value={item.minPoints}
								onchange={(e) => handlePointsChange(item.grade, parseFloat((e.target as HTMLInputElement).value || '0'))}
								class="w-14 px-1 py-1 rounded bg-slate-950 border border-slate-700 text-white text-center text-xs font-bold font-mono focus:ring-1 focus:ring-blue-500"
							/>
							<span class="text-slate-400">Pkt.</span>
						</div>
						<span class="text-[10px] text-slate-400 block">
							({item.minPercent}%)
						</span>
					{/if}
				{:else}
					<!-- Grade 5 (Nicht genügend) -->
					<div class="py-1">
						<span class="text-xs font-bold text-red-400 block font-mono">
							{item.description}
						</span>
						<span class="text-[10px] text-slate-500 block mt-0.5">
							Nicht genügend
						</span>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>
