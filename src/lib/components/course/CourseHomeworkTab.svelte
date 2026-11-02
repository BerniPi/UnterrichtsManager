<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Plus,
		Check,
		Equal,
		X,
		Trash2,
		Users,
		Smartphone,
		Clock,
		RotateCcw,
		Calendar
	} from '@lucide/svelte';

	interface Props {
		course: any;
		homeworks?: Array<any>;
		students?: Array<any>;
	}

	let {
		course,
		homeworks = [],
		students = []
	}: Props = $props();

	let showCreateModal = $state(false);
	let selectedHomeworkId = $state<string | null>(null);

	let title = $state('');
	let dueDate = $state(new Date().toISOString().slice(0, 10));
	let description = $state('');

	const activeHw = $derived(homeworks.find((h) => h.id === selectedHomeworkId) || null);

	const normalizedStudents = $derived(
		students
			.map((s: any) => s.student ?? s)
			.filter((s: any) => s && s.id)
			.sort((a: any, b: any) => {
				const catA = a.catalogNumber ?? 999;
				const catB = b.catalogNumber ?? 999;
				if (catA !== catB) return catA - catB;
				return (a.lastName || '').localeCompare(b.lastName || '');
			})
	);
</script>

<div class="space-y-4">
	<!-- Actions Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
		<div>
			<h3 class="font-bold text-white text-base">Hausübungen</h3>
			<p class="text-xs text-slate-400">
				Aufgabenverwaltung und Erledigungs-Quote (erledigt / teilweise / vergessen / offen)
			</p>
		</div>

		<div class="flex items-center space-x-2">
			<a
				href="/stundenansicht?courseId={course.id}"
				class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition flex items-center space-x-1.5"
				title="Zur Live-Erfassung während des Unterrichts"
			>
				<Smartphone class="w-4 h-4 text-blue-400" />
				<span>In Stundenansicht</span>
			</a>

			<button
				type="button"
				onclick={() => (showCreateModal = true)}
				class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center space-x-1.5 cursor-pointer"
			>
				<Plus class="w-4 h-4" />
				<span>Neue Hausübung</span>
			</button>
		</div>
	</div>

	<!-- Homework List -->
	{#if homeworks.length === 0}
		<div class="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
			<div class="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center text-slate-400">
				<Calendar class="w-6 h-6" />
			</div>
			<p class="text-white font-medium text-sm">Noch keine Hausübungen angelegt</p>
			<p class="text-slate-400 text-xs max-w-sm mx-auto">
				Erstelle eine neue Hausübung, um Aufgaben zu stellen und den Erledigungsstatus deiner Schüler festzuhalten.
			</p>
			<button
				type="button"
				onclick={() => (showCreateModal = true)}
				class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition inline-flex items-center space-x-1.5 cursor-pointer"
			>
				<Plus class="w-4 h-4" />
				<span>Erste Hausübung erstellen</span>
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			{#each homeworks as hw}
				<div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3 shadow-md hover:border-slate-700 transition">
					<div>
						<div class="flex items-center justify-between gap-2">
							<span class="text-xs text-slate-400 font-mono flex items-center space-x-1">
								<Calendar class="w-3.5 h-3.5 text-blue-400" />
								<span>Fällig: {hw.dueDate}</span>
							</span>

							{#if hw.pendingCount > 0 && hw.doneCount === 0 && hw.partialCount === 0 && hw.forgottenCount === 0}
								<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
									⏳ Offen ({hw.pendingCount})
								</span>
							{:else if hw.pendingCount === 0}
								<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
									✓ Vollständig erfasst
								</span>
							{:else}
								<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/80">
									{hw.doneCount + hw.partialCount + hw.forgottenCount}/{hw.totalClassStudents} erfasst
								</span>
							{/if}
						</div>

						<h4 class="font-bold text-white text-base mt-2">{hw.title}</h4>
						{#if hw.description}
							<p class="text-xs text-slate-400 mt-1 line-clamp-2">{hw.description}</p>
						{/if}
					</div>

					<!-- Stats Breakdown (4 categories: Erledigt / Teilweise / Fehlt / Offen) -->
					<div class="pt-3 border-t border-slate-800/80 space-y-3">
						<div class="grid grid-cols-4 gap-1.5 text-center text-xs">
							<div class="p-1.5 rounded-lg bg-slate-950 border border-slate-800/80">
								<div class="flex items-center justify-center space-x-1 text-emerald-400 font-bold">
									<Check class="w-3.5 h-3.5" />
									<span>{hw.doneCount}</span>
								</div>
								<span class="text-[10px] text-slate-500 block">Erledigt</span>
							</div>

							<div class="p-1.5 rounded-lg bg-slate-950 border border-slate-800/80">
								<div class="flex items-center justify-center space-x-1 text-amber-400 font-bold">
									<Equal class="w-3.5 h-3.5" />
									<span>{hw.partialCount}</span>
								</div>
								<span class="text-[10px] text-slate-500 block">Teilweise</span>
							</div>

							<div class="p-1.5 rounded-lg bg-slate-950 border border-slate-800/80">
								<div class="flex items-center justify-center space-x-1 text-red-400 font-bold">
									<X class="w-3.5 h-3.5" />
									<span>{hw.forgottenCount}</span>
								</div>
								<span class="text-[10px] text-slate-500 block">Fehlt</span>
							</div>

							<div class="p-1.5 rounded-lg bg-slate-950 border border-slate-800/80">
								<div class="flex items-center justify-center space-x-1 text-slate-400 font-bold">
									<Clock class="w-3.5 h-3.5" />
									<span>{hw.pendingCount}</span>
								</div>
								<span class="text-[10px] text-slate-500 block">Offen</span>
							</div>
						</div>

						<!-- Card Actions -->
						<div class="flex items-center justify-between gap-2 pt-1">
							<button
								type="button"
								onclick={() => (selectedHomeworkId = hw.id)}
								class="flex-1 py-2 px-3 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-semibold flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer"
							>
								<Users class="w-3.5 h-3.5" />
								<span>Schüler eintragen / bearbeiten</span>
							</button>

							<form
								action="?/deleteHomework&tab=hausuebungen"
								method="POST"
								use:enhance
								onsubmit={(e) => {
									if (!confirm(`Möchten Sie die Hausübung "${hw.title}" wirklich löschen?`)) {
										e.preventDefault();
									}
								}}
							>
								<input type="hidden" name="homeworkId" value={hw.id} />
								<button
									type="submit"
									class="p-2 rounded-xl bg-slate-950 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-900/40 transition active:scale-95 cursor-pointer"
									title="Hausübung löschen"
								>
									<Trash2 class="w-3.5 h-3.5" />
								</button>
							</form>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Modal: Schüler erfassen / bearbeiten -->
{#if activeHw}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
			<!-- Modal Header -->
			<div class="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between gap-3">
				<div>
					<div class="flex items-center space-x-2">
						<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-950 text-blue-300 border border-blue-800 font-mono">
							Fällig: {activeHw.dueDate}
						</span>
						<span class="text-xs text-slate-400">
							{normalizedStudents.length} Schüler
						</span>
					</div>
					<h3 class="text-lg font-bold text-white mt-1.5">{activeHw.title}</h3>
					{#if activeHw.description}
						<p class="text-xs text-slate-400 mt-0.5">{activeHw.description}</p>
					{/if}
				</div>

				<button
					type="button"
					onclick={() => (selectedHomeworkId = null)}
					class="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Quick Actions Bar -->
			<div class="p-3 sm:px-5 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
				<div class="flex items-center space-x-3 text-xs">
					<span class="text-emerald-400 font-semibold flex items-center space-x-1">
						<Check class="w-3.5 h-3.5" />
						<span>{activeHw.doneCount} Erledigt</span>
					</span>
					<span class="text-amber-400 font-semibold flex items-center space-x-1">
						<Equal class="w-3.5 h-3.5" />
						<span>{activeHw.partialCount} Teilw.</span>
					</span>
					<span class="text-red-400 font-semibold flex items-center space-x-1">
						<X class="w-3.5 h-3.5" />
						<span>{activeHw.forgottenCount} Fehlt</span>
					</span>
					{#if activeHw.pendingCount > 0}
						<span class="text-slate-400 font-semibold flex items-center space-x-1">
							<Clock class="w-3.5 h-3.5" />
							<span>{activeHw.pendingCount} Offen</span>
						</span>
					{/if}
				</div>

				<div class="flex items-center space-x-2">
					<form action="?/markAllHomeworkDone&tab=hausuebungen" method="POST" use:enhance>
						<input type="hidden" name="homeworkId" value={activeHw.id} />
						<button
							type="submit"
							class="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-semibold text-xs flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
							title="Setzt alle noch offenen Schüler auf Erledigt"
						>
							<Check class="w-3.5 h-3.5" />
							<span>Alle als erledigt markieren</span>
						</button>
					</form>

					<form action="?/resetHomeworkStatuses&tab=hausuebungen" method="POST" use:enhance>
						<input type="hidden" name="homeworkId" value={activeHw.id} />
						<button
							type="submit"
							class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium text-xs flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
							title="Setzt alle Schüler zurück auf 'Offen'"
						>
							<RotateCcw class="w-3.5 h-3.5" />
							<span>Zurücksetzen</span>
						</button>
					</form>
				</div>
			</div>

			<!-- Student Checklist -->
			<div class="p-3 sm:p-5 overflow-y-auto space-y-2 flex-1">
				{#if normalizedStudents.length === 0}
					<p class="text-slate-400 text-xs text-center py-6">Keine Schüler in diesem Kurs gefunden.</p>
				{:else}
					<div class="divide-y divide-slate-800/60 rounded-xl bg-slate-950 border border-slate-800/80 overflow-hidden">
						{#each normalizedStudents as student}
							{@const currentStatus = activeHw.statuses?.[student.id] || null}
							<div class="p-2.5 sm:px-3 flex items-center justify-between gap-3 hover:bg-slate-900/50 transition">
								<div class="flex items-center space-x-2.5 min-w-0">
									<span class="w-6 text-[11px] font-mono text-slate-500 shrink-0 text-center">
										{student.catalogNumber ? `#${student.catalogNumber}` : '–'}
									</span>
									<span class="text-sm font-semibold text-white truncate">
										{student.lastName} {student.firstName}
									</span>
								</div>

								<!-- 3-Way Status Toggle Buttons -->
								<div class="flex items-center space-x-1.5 shrink-0">
									<!-- Erledigt -->
									<form action="?/setHomeworkStatus&tab=hausuebungen" method="POST" use:enhance>
										<input type="hidden" name="homeworkId" value={activeHw.id} />
										<input type="hidden" name="studentId" value={student.id} />
										<input type="hidden" name="status" value="done" />
										<button
											type="submit"
											class="px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center space-x-1 transition active:scale-95 cursor-pointer {currentStatus === 'done' ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 shadow-md shadow-emerald-600/30' : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'}"
											title={currentStatus === 'done' ? 'Klicken zum Abwählen' : 'Als erledigt markieren'}
										>
											<Check class="w-3.5 h-3.5" />
											<span class="hidden sm:inline">Erledigt</span>
										</button>
									</form>

									<!-- Teilweise -->
									<form action="?/setHomeworkStatus&tab=hausuebungen" method="POST" use:enhance>
										<input type="hidden" name="homeworkId" value={activeHw.id} />
										<input type="hidden" name="studentId" value={student.id} />
										<input type="hidden" name="status" value="partial" />
										<button
											type="submit"
											class="px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center space-x-1 transition active:scale-95 cursor-pointer {currentStatus === 'partial' ? 'bg-amber-600 text-white ring-2 ring-amber-400 shadow-md shadow-amber-600/30' : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'}"
											title={currentStatus === 'partial' ? 'Klicken zum Abwählen' : 'Als teilweise markieren'}
										>
											<Equal class="w-3.5 h-3.5" />
											<span class="hidden sm:inline">Teilw.</span>
										</button>
									</form>

									<!-- Fehlt -->
									<form action="?/setHomeworkStatus&tab=hausuebungen" method="POST" use:enhance>
										<input type="hidden" name="homeworkId" value={activeHw.id} />
										<input type="hidden" name="studentId" value={student.id} />
										<input type="hidden" name="status" value="forgotten" />
										<button
											type="submit"
											class="px-2.5 py-1.5 rounded-lg font-semibold text-xs flex items-center space-x-1 transition active:scale-95 cursor-pointer {currentStatus === 'forgotten' ? 'bg-red-600 text-white ring-2 ring-red-400 shadow-md shadow-red-600/30' : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'}"
											title={currentStatus === 'forgotten' ? 'Klicken zum Abwählen' : 'Als fehlend/vergessen markieren'}
										>
											<X class="w-3.5 h-3.5" />
											<span class="hidden sm:inline">Fehlt</span>
										</button>
									</form>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Modal Footer -->
			<div class="p-3 sm:px-5 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between">
				<a
					href="/stundenansicht?courseId={course.id}"
					class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 flex items-center space-x-1.5 transition"
				>
					<Smartphone class="w-4 h-4 text-blue-400" />
					<span>In Stundenansicht öffnen</span>
				</a>

				<button
					type="button"
					onclick={() => (selectedHomeworkId = null)}
					class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition active:scale-95 cursor-pointer"
				>
					Fertig
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal: Neue Hausübung anlegen -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
			<div class="flex items-center justify-between pb-3 border-b border-slate-800">
				<h3 class="text-lg font-bold text-white">Neue Hausübung anlegen</h3>
				<button type="button" onclick={() => (showCreateModal = false)} class="text-slate-400 hover:text-white cursor-pointer">
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				action="?/createHomework&tab=hausuebungen"
				method="POST"
				use:enhance={() => async ({ result, update }) => {
					await update();
					if (result.type === 'success') {
						showCreateModal = false;
						title = '';
						description = '';
					}
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

				<div class="p-3 rounded-xl bg-blue-950/40 border border-blue-800/40 text-xs text-blue-300 flex items-start space-x-2">
					<Clock class="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
					<span>
						Neue Hausübungen starten als <strong>Offen</strong> (noch nicht kontrolliert). Du kannst den Status bei der Kontrolle mit einem Klick auf <em>„Alle als erledigt markieren“</em> oder schülerweise eintragen.
					</span>
				</div>

				<div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
					<button
						type="button"
						onclick={() => (showCreateModal = false)}
						class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium cursor-pointer"
					>
						Abbrechen
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-md shadow-blue-500/20 cursor-pointer"
					>
						HÜ anlegen
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
