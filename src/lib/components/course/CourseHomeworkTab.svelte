<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Check, Equal, X, CheckCircle2 } from '@lucide/svelte';

	interface Props {
		course: any;
		homeworks?: Array<any>;
	}

	let {
		course,
		homeworks = []
	}: Props = $props();

	let showCreateModal = $state(false);
	let title = $state('');
	let dueDate = $state(new Date().toISOString().slice(0, 10));
	let description = $state('');
</script>

<div class="space-y-4">
	<!-- Actions Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
		<div>
			<h3 class="font-bold text-white text-base">Hausübungen</h3>
			<p class="text-xs text-slate-400">Aufgabenverwaltung und Erledigungs-Quote (erledigt / teilweise / vergessen)</p>
		</div>

		<button
			type="button"
			onclick={() => (showCreateModal = true)}
			class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center space-x-1.5 self-start sm:self-auto"
		>
			<Plus class="w-4 h-4" />
			<span>Neue Hausübung</span>
		</button>
	</div>

	<!-- Homework List -->
	{#if homeworks.length === 0}
		<div class="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center">
			<p class="text-slate-400 text-sm">Noch keine Hausübungen angelegt.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			{#each homeworks as hw}
				<div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3 shadow-md">
					<div>
						<div class="flex items-center justify-between">
							<span class="text-xs text-slate-400 font-mono">Fällig: {hw.dueDate}</span>
						</div>
						<h4 class="font-bold text-white text-base mt-1">{hw.title}</h4>
						{#if hw.description}
							<p class="text-xs text-slate-400 mt-1">{hw.description}</p>
						{/if}
					</div>

					<!-- Stats Breakdown -->
					<div class="pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-xs">
						<div class="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
							<div class="flex items-center justify-center space-x-1 text-emerald-400 font-bold">
								<Check class="w-3.5 h-3.5" />
								<span>{hw.doneCount}</span>
							</div>
							<span class="text-[10px] text-slate-500 block">Erledigt</span>
						</div>

						<div class="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
							<div class="flex items-center justify-center space-x-1 text-amber-400 font-bold">
								<Equal class="w-3.5 h-3.5" />
								<span>{hw.partialCount}</span>
							</div>
							<span class="text-[10px] text-slate-500 block">Teilweise</span>
						</div>

						<div class="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
							<div class="flex items-center justify-center space-x-1 text-red-400 font-bold">
								<X class="w-3.5 h-3.5" />
								<span>{hw.forgottenCount}</span>
							</div>
							<span class="text-[10px] text-slate-500 block">Fehlt</span>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Modal: Neue Hausübung anlegen -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
			<div class="flex items-center justify-between pb-3 border-b border-slate-800">
				<h3 class="text-lg font-bold text-white">Neue Hausübung anlegen</h3>
				<button type="button" onclick={() => (showCreateModal = false)} class="text-slate-400 hover:text-white">
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				action="?/createHomework&tab=hausuebungen"
				method="POST"
				use:enhance={() => async ({ result, update }) => {
					await update();
					if (result.type === 'success') showCreateModal = false;
				}}
				class="space-y-4"
			>
				<div>
					<label for="hwTitle" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Titel / Buchseite *
					</label>
					<input
						id="hwTitle"
						name="title"
						type="text"
						required
						bind:value={title}
						placeholder="z.B. Buch S. 42 Nr. 1-4"
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="hwDue" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Fälligkeitsdatum *
					</label>
					<input
						id="hwDue"
						name="dueDate"
						type="date"
						required
						bind:value={dueDate}
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="hwDesc" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Beschreibung (optional)
					</label>
					<textarea
						id="hwDesc"
						name="description"
						rows="2"
						bind:value={description}
						placeholder="Aufgabenstellung oder Zusatzhinweise..."
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					></textarea>
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
						HÜ speichern
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
