<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Plus,
		BookOpen,
		Users,
		Award,
		FileText,
		CheckCircle2,
		X,
		ArrowRight,
		Sliders
	} from '@lucide/svelte';

	interface Props {
		data: {
			currentSchoolYear: any;
			courses: Array<any>;
			classes: Array<any>;
		};
	}

	let { data }: Props = $props();

	let showCreateModal = $state(false);
	let selectedClassId = $state('');
	let subject = $state('Mathematik');

	let weightSA = $state(40);
	let weightTests = $state(20);
	let weightPart = $state(25);
	let weightObs = $state(10);
	let weightHW = $state(5);

	const totalWeight = $derived(
		weightSA + weightTests + weightPart + weightObs + weightHW
	);
</script>

<svelte:head>
	<title>Kurse & Fächer – UnterrichtsManager</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
		<div>
			<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-white">Kurse & Notenbücher</h1>
			<p class="text-slate-400 text-sm mt-0.5">
				Klasse × Fach (Mathe, Physik) mit individuellen Notengewichtungen
			</p>
		</div>

		<button
			type="button"
			onclick={() => {
				selectedClassId = data.classes[0]?.id || '';
				showCreateModal = true;
			}}
			class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center space-x-2 self-start sm:self-auto"
		>
			<Plus class="w-4 h-4" />
			<span>Neuen Kurs anlegen</span>
		</button>
	</div>

	<!-- Course Cards Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
		{#each data.courses as course}
			<div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-4 shadow-lg group">
				<div>
					<div class="flex items-start justify-between">
						<div class="flex items-center space-x-3">
							<div class="w-12 h-12 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-lg">
								{course.className}
							</div>
							<div>
								<h3 class="text-lg font-bold text-white group-hover:text-blue-400 transition">
									{course.className} – {course.subject}
								</h3>
								<div class="flex items-center space-x-1.5 text-xs text-slate-400 mt-0.5">
									<Users class="w-3.5 h-3.5 text-slate-500" />
									<span>{course.studentCount} Schüler</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Weightings breakdown tags -->
					<div class="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
						<span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
							Gewichtung des Notenvorschlags:
						</span>
						<div class="grid grid-cols-5 gap-1 text-[11px] font-medium text-center">
							<div class="p-1 rounded bg-slate-950 border border-slate-800">
								<span class="text-slate-400 block text-[9px]">SA</span>
								<span class="text-blue-400 font-bold">{course.weightSchularbeiten}%</span>
							</div>
							<div class="p-1 rounded bg-slate-950 border border-slate-800">
								<span class="text-slate-400 block text-[9px]">Test</span>
								<span class="text-blue-400 font-bold">{course.weightTests}%</span>
							</div>
							<div class="p-1 rounded bg-slate-950 border border-slate-800">
								<span class="text-slate-400 block text-[9px]">Mit.</span>
								<span class="text-blue-400 font-bold">{course.weightParticipation}%</span>
							</div>
							<div class="p-1 rounded bg-slate-950 border border-slate-800">
								<span class="text-slate-400 block text-[9px]">Beob.</span>
								<span class="text-blue-400 font-bold">{course.weightObservations}%</span>
							</div>
							<div class="p-1 rounded bg-slate-950 border border-slate-800">
								<span class="text-slate-400 block text-[9px]">HÜ</span>
								<span class="text-blue-400 font-bold">{course.weightHomework}%</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Quick action links -->
				<div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
					<a
						href="/stundenansicht?courseId={course.id}"
						class="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1 transition"
					>
						<span>Stunde</span>
					</a>

					<a
						href="/kurse/{course.id}"
						class="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center space-x-1 shadow-md shadow-blue-500/20 transition"
					>
						<span>Notenbuch</span>
						<ArrowRight class="w-3.5 h-3.5" />
					</a>
				</div>
			</div>
		{/each}
	</div>
</div>

<!-- Modal: Neuer Kurs anlegen -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
			<div class="flex items-center justify-between pb-3 border-b border-slate-800">
				<h3 class="text-lg font-bold text-white">Neuen Kurs anlegen</h3>
				<button type="button" onclick={() => (showCreateModal = false)} class="text-slate-400 hover:text-white">
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				action="?/createCourse"
				method="POST"
				use:enhance={() => async ({ result, update }) => {
					await update();
					if (result.type === 'success') showCreateModal = false;
				}}
				class="space-y-4"
			>
				<input type="hidden" name="schoolYearId" value={data.currentSchoolYear?.id} />

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="kursClassId" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Klasse *
						</label>
						<select
							id="kursClassId"
							name="classId"
							bind:value={selectedClassId}
							required
							class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
						>
							{#each data.classes as c}
								<option value={c.id}>Klasse {c.name}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="fach" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Unterrichtsfach *
						</label>
						<input
							id="fach"
							name="subject"
							type="text"
							required
							bind:value={subject}
							placeholder="Mathematik"
							class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				</div>

				<!-- Weightings Section -->
				<div class="space-y-3 pt-2 border-t border-slate-800">
					<div class="flex items-center justify-between">
						<span class="text-xs font-bold uppercase tracking-wider text-slate-300">Gewichtung (%)</span>
						<span class="text-xs font-bold {totalWeight === 100 ? 'text-emerald-400' : 'text-amber-400'}">
							Gesamt: {totalWeight}% {totalWeight === 100 ? '✓' : '(sollte 100% sein)'}
						</span>
					</div>

					<div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
						<div>
							<label for="saWeight" class="block text-[10px] text-slate-400 mb-0.5">Schularbeiten</label>
							<input
								id="saWeight"
								type="number"
								name="weightSchularbeiten"
								bind:value={weightSA}
								min="0"
								max="100"
								class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold text-center"
							/>
						</div>

						<div>
							<label for="testsWeight" class="block text-[10px] text-slate-400 mb-0.5">Tests</label>
							<input
								id="testsWeight"
								type="number"
								name="weightTests"
								bind:value={weightTests}
								min="0"
								max="100"
								class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold text-center"
							/>
						</div>

						<div>
							<label for="partWeight" class="block text-[10px] text-slate-400 mb-0.5">Mitarbeit</label>
							<input
								id="partWeight"
								type="number"
								name="weightParticipation"
								bind:value={weightPart}
								min="0"
								max="100"
								class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold text-center"
							/>
						</div>

						<div>
							<label for="obsWeight" class="block text-[10px] text-slate-400 mb-0.5">Beobachtung</label>
							<input
								id="obsWeight"
								type="number"
								name="weightObservations"
								bind:value={weightObs}
								min="0"
								max="100"
								class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold text-center"
							/>
						</div>

						<div>
							<label for="hwWeight" class="block text-[10px] text-slate-400 mb-0.5">Hausübung</label>
							<input
								id="hwWeight"
								type="number"
								name="weightHomework"
								bind:value={weightHW}
								min="0"
								max="100"
								class="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold text-center"
							/>
						</div>
					</div>
				</div>

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
						Kurs speichern
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
