<script lang="ts">
	import { enhance } from '$app/forms';
	import { CheckCircle2, Sliders } from '@lucide/svelte';

	interface Props {
		course: any;
	}

	let { course }: Props = $props();

	// svelte-ignore state_referenced_locally
	let weightSA = $state(course?.weightSchularbeiten ?? 40);
	// svelte-ignore state_referenced_locally
	let weightTests = $state(course?.weightTests ?? 20);
	// svelte-ignore state_referenced_locally
	let weightPart = $state(course?.weightParticipation ?? 25);
	// svelte-ignore state_referenced_locally
	let weightObs = $state(course?.weightObservations ?? 10);
	// svelte-ignore state_referenced_locally
	let weightHW = $state(course?.weightHomework ?? 5);

	let saveToast = $state<string | null>(null);

	const totalWeight = $derived(
		weightSA + weightTests + weightPart + weightObs + weightHW
	);
</script>

<div class="max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-lg">
	<div>
		<h3 class="font-bold text-white text-lg flex items-center space-x-2">
			<Sliders class="w-5 h-5 text-blue-400" />
			<span>Notengewichtung für {course.className} – {course.subject}</span>
		</h3>
		<p class="text-xs text-slate-400 mt-1">
			Lege fest, zu wie viel Prozent die Teilleistungen in den automatischen Notenvorschlag einfließen.
		</p>
	</div>

	{#if saveToast}
		<div class="p-3 bg-emerald-950/90 border border-emerald-800 text-emerald-200 text-xs rounded-xl flex items-center space-x-2">
			<CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
			<span>{saveToast}</span>
		</div>
	{/if}

	<!-- Visual Weight Bar -->
	<div class="space-y-2">
		<div class="h-4 w-full rounded-full bg-slate-950 overflow-hidden flex border border-slate-800">
			<div class="bg-purple-600 transition-all duration-300" style="width: {weightSA}%;" title="Schularbeiten: {weightSA}%"></div>
			<div class="bg-blue-600 transition-all duration-300" style="width: {weightTests}%;" title="Tests: {weightTests}%"></div>
			<div class="bg-emerald-600 transition-all duration-300" style="width: {weightPart}%;" title="Mitarbeit: {weightPart}%"></div>
			<div class="bg-amber-600 transition-all duration-300" style="width: {weightObs}%;" title="Beobachtungen: {weightObs}%"></div>
			<div class="bg-indigo-600 transition-all duration-300" style="width: {weightHW}%;" title="Hausübungen: {weightHW}%"></div>
		</div>

		<div class="flex items-center justify-between text-xs">
			<span class="text-slate-400">Summe aller Gewichte:</span>
			<span class="font-bold {totalWeight === 100 ? 'text-emerald-400' : 'text-amber-400'}">
				{totalWeight}% {totalWeight === 100 ? '✓ Exakt 100%' : '(Sollte 100% ergeben)'}
			</span>
		</div>
	</div>

	<form
		action="?/updateWeights"
		method="POST"
		use:enhance={() => {
			return async ({ update }) => {
				saveToast = 'Gewichtung erfolgreich aktualisiert!';
				setTimeout(() => (saveToast = null), 2500);
				await update();
			};
		}}
		class="space-y-4"
	>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<div class="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
				<label for="wSA" class="block text-xs font-semibold text-purple-300 mb-1">
					Schularbeiten (%)
				</label>
				<input
					id="wSA"
					type="number"
					name="weightSchularbeiten"
					min="0"
					max="100"
					bind:value={weightSA}
					class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold"
				/>
			</div>

			<div class="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
				<label for="wTests" class="block text-xs font-semibold text-blue-300 mb-1">
					Tests & Überprüfungen (%)
				</label>
				<input
					id="wTests"
					type="number"
					name="weightTests"
					min="0"
					max="100"
					bind:value={weightTests}
					class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold"
				/>
			</div>

			<div class="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
				<label for="wPart" class="block text-xs font-semibold text-emerald-300 mb-1">
					Wöchentliche Mitarbeit (%)
				</label>
				<input
					id="wPart"
					type="number"
					name="weightParticipation"
					min="0"
					max="100"
					bind:value={weightPart}
					class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold"
				/>
			</div>

			<div class="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
				<label for="wObs" class="block text-xs font-semibold text-amber-300 mb-1">
					Mitarbeitsbeobachtungen (%)
				</label>
				<input
					id="wObs"
					type="number"
					name="weightObservations"
					min="0"
					max="100"
					bind:value={weightObs}
					class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold"
				/>
			</div>

			<div class="p-3.5 bg-slate-950 rounded-xl border border-slate-800 sm:col-span-2">
				<label for="wHW" class="block text-xs font-semibold text-indigo-300 mb-1">
					Hausübungs-Erfüllung (%)
				</label>
				<input
					id="wHW"
					type="number"
					name="weightHomework"
					min="0"
					max="100"
					bind:value={weightHW}
					class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold"
				/>
			</div>
		</div>

		<div class="flex justify-end pt-2">
			<button
				type="submit"
				class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-md shadow-blue-500/20 active:scale-95 transition"
			>
				Gewichtung speichern
			</button>
		</div>
	</form>
</div>
