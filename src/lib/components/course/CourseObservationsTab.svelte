<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Eye, CheckCircle2, X } from '@lucide/svelte';

	interface Props {
		course: any;
		observations?: Array<any>;
	}

	let {
		course,
		observations = []
	}: Props = $props();

	let showCreateModal = $state(false);
	let activeObsId = $state('');

	$effect(() => {
		if (observations.length > 0 && !activeObsId) {
			activeObsId = observations[0].id;
		}
	});

	let selectedObs = $derived(
		observations.find((o: any) => o.id === activeObsId) || observations[0]
	);

	let title = $state('');
	let date = $state(new Date().toISOString().slice(0, 10));
	let maxPoints = $state(10);
	let description = $state('');

	let toastMsg = $state<string | null>(null);
	function showToast(msg: string) {
		toastMsg = msg;
		setTimeout(() => (toastMsg = null), 2000);
	}

	function handleKeyDown(e: KeyboardEvent, index: number) {
		if (e.key === 'Enter' || e.key === 'ArrowDown') {
			e.preventDefault();
			const nextInput = document.getElementById(`obs-points-input-${index + 1}`) as HTMLInputElement;
			if (nextInput) {
				nextInput.focus();
				nextInput.select();
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			const prevInput = document.getElementById(`obs-points-input-${index - 1}`) as HTMLInputElement;
			if (prevInput) {
				prevInput.focus();
				prevInput.select();
			}
		}
	}
</script>

<div class="space-y-4">
	<!-- Actions Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
		<div>
			<h3 class="font-bold text-white text-base">Mitarbeitsbeobachtungen (mit Punkten)</h3>
			<p class="text-xs text-slate-400">Gezielte Überprüfungen, Tafelübungen oder Stationenarbeiten mit Maximalpunkten</p>
		</div>

		<button
			type="button"
			onclick={() => (showCreateModal = true)}
			class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center space-x-1.5 self-start sm:self-auto"
		>
			<Plus class="w-4 h-4" />
			<span>Neue Beobachtung</span>
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

	<!-- Observation Switcher -->
	{#if observations.length > 0}
		<div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
			{#each observations as obs}
				<button
					type="button"
					onclick={() => (activeObsId = obs.id)}
					class="px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center space-x-2 shrink-0 {selectedObs?.id === obs.id ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'}"
				>
					<Eye class="w-4 h-4" />
					<span>{obs.title}</span>
					<span class="text-[10px] opacity-75">({obs.maxPoints} Pkt.)</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if !selectedObs}
		<div class="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center">
			<p class="text-slate-400 text-sm">Noch keine Mitarbeitsbeobachtungen angelegt.</p>
		</div>
	{:else}
		<!-- Observation Points Table -->
		<div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg overflow-x-auto">
			<table class="w-full text-left border-collapse text-xs">
				<thead>
					<tr class="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[11px]">
						<th class="py-3 px-3 w-12 text-center">Kat.</th>
						<th class="py-3 px-4">Schüler</th>
						<th class="py-3 px-4 w-36 text-center">Punkte (max. {selectedObs.maxPoints})</th>
						<th class="py-3 px-4">Notiz / Bemerkung</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800/80 text-slate-200">
					{#each selectedObs.scores as s, idx (s.studentId)}
						<tr class="hover:bg-slate-800/40 transition">
							<td class="py-3 px-3 text-center font-bold text-slate-400">{s.catalogNumber ?? '–'}</td>
							<td class="py-3 px-4 font-bold text-white">{s.lastName} {s.firstName}</td>

							<!-- Points Input -->
							<td class="py-3 px-4 text-center">
								<form
									action="?/saveObservationScore&tab=beobachtungen"
									method="POST"
									use:enhance={() => {
										return async ({ result }) => {
											if (result.type === 'success') {
												showToast(`Punkte für ${s.lastName} gespeichert`);
											}
										};
									}}
									class="inline-block"
								>
									<input type="hidden" name="observationId" value={selectedObs.id} />
									<input type="hidden" name="studentId" value={s.studentId} />
									<input
										id="obs-points-input-{idx}"
										type="number"
										name="points"
										step="0.5"
										min="0"
										max={selectedObs.maxPoints}
										bind:value={s.points}
										onkeydown={(e) => handleKeyDown(e, idx)}
										onchange={(e) => (e.target as HTMLInputElement).form?.requestSubmit()}
										class="w-20 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold text-center text-sm focus:ring-2 focus:ring-blue-500"
									/>
								</form>
							</td>

							<td class="py-3 px-4 text-slate-400">
								{s.note || '–'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<!-- Modal: Neue Beobachtung anlegen -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
			<div class="flex items-center justify-between pb-3 border-b border-slate-800">
				<h3 class="text-lg font-bold text-white">Neue Beobachtung anlegen</h3>
				<button type="button" onclick={() => (showCreateModal = false)} class="text-slate-400 hover:text-white">
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				action="?/createObservation&tab=beobachtungen"
				method="POST"
				use:enhance={() => async ({ result, update }) => {
					if (result.type === 'success' && result.data) {
						showCreateModal = false;
						const createdId = (result.data as any).createdObservationId;
						if (createdId) {
							activeObsId = String(createdId);
						}
						title = '';
						description = '';
					}
					await update();
					if (result.type === 'success' && result.data) {
						const createdId = (result.data as any).createdObservationId;
						if (createdId) {
							activeObsId = String(createdId);
						}
					}
				}}
				class="space-y-4"
			>
				<div>
					<label for="obsTitle" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Thema / Inhalt *
					</label>
					<input
						id="obsTitle"
						name="title"
						type="text"
						required
						bind:value={title}
						placeholder="z.B. Kopfrechnen, Stationenarbeit, Gruppenpräsentation..."
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="obsDate" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Datum *
						</label>
						<input
							id="obsDate"
							name="date"
							type="date"
							required
							bind:value={date}
							class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div>
						<label for="obsMaxPts" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Max. Punkte *
						</label>
						<input
							id="obsMaxPts"
							name="maxPoints"
							type="number"
							step="0.5"
							min="1"
							required
							bind:value={maxPoints}
							class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500 font-bold"
						/>
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
						Beobachtung speichern
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
