<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Calendar, Clock, CheckCircle2, Trash2, Smartphone, FileText, X } from '@lucide/svelte';

	interface Props {
		course: any;
		lessons?: Array<any>;
	}

	let { course, lessons = [] }: Props = $props();

	let showCreateModal = $state(false);
	let activeLessonId = $state('');

	$effect(() => {
		if (lessons.length > 0 && (!activeLessonId || !lessons.some((l: any) => l.id === activeLessonId))) {
			activeLessonId = lessons[0].id;
		} else if (lessons.length === 0) {
			activeLessonId = '';
		}
	});

	let selectedLesson = $derived(
		lessons.find((l: any) => l.id === activeLessonId) || lessons[0]
	);

	let newDate = $state(new Date().toISOString().slice(0, 10));
	let newTopic = $state('');
	let newNote = $state('');

	let toastMsg = $state<string | null>(null);
	function showToast(msg: string) {
		toastMsg = msg;
		setTimeout(() => (toastMsg = null), 2000);
	}
</script>

<div class="space-y-4">
	<!-- Actions Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
		<div>
			<h3 class="font-bold text-white text-base">Stundeneinträge & Unterrichtsverlauf</h3>
			<p class="text-xs text-slate-400">
				Globaler Notizeintrag (Lehrstoff, Vorkommnisse) und Notizen pro Schüler je Unterrichtsstunde
			</p>
		</div>

		<div class="flex items-center space-x-2 self-start sm:self-auto">
			<a
				href="/stundenansicht?courseId={course.id}"
				class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-semibold text-xs transition flex items-center space-x-1.5 active:scale-95"
			>
				<Smartphone class="w-4 h-4 text-blue-400" />
				<span>In Stundenansicht</span>
			</a>

			<button
				type="button"
				onclick={() => (showCreateModal = true)}
				class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center space-x-1.5"
			>
				<Plus class="w-4 h-4" />
				<span>Neuer Stundeneintrag</span>
			</button>
		</div>
	</div>

	{#if toastMsg}
		<div class="fixed bottom-6 right-6 z-50 pointer-events-none transition-all duration-300">
			<div class="px-4 py-2.5 bg-emerald-950/95 border border-emerald-700 text-emerald-200 text-xs font-semibold rounded-xl shadow-2xl flex items-center space-x-2 backdrop-blur-md">
				<CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
				<span>{toastMsg}</span>
			</div>
		</div>
	{/if}

	<!-- Lesson Switcher / Tabs -->
	{#if lessons.length > 0}
		<div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
			{#each lessons as l}
				<button
					type="button"
					onclick={() => (activeLessonId = l.id)}
					class="px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center space-x-2 shrink-0 {selectedLesson?.id === l.id ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'}"
				>
					<Calendar class="w-4 h-4" />
					<span>{l.date}</span>
					{#if l.topic}
						<span class="text-[11px] opacity-80 max-w-[150px] truncate font-normal">({l.topic})</span>
					{/if}
					{#if l.studentNotesCount > 0}
						<span class="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-blue-300 border border-slate-700">
							{l.studentNotesCount} Notizen
						</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	{#if !selectedLesson}
		<div class="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center">
			<p class="text-slate-400 text-sm">Noch keine Stundeneinträge für diesen Kurs vorhanden.</p>
			<button
				type="button"
				onclick={() => (showCreateModal = true)}
				class="mt-3 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center space-x-1.5"
			>
				<Plus class="w-4 h-4" />
				<span>Ersten Stundeneintrag anlegen</span>
			</button>
		</div>
	{:else}
		<!-- Selected Lesson Card -->
		<div class="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
			<div>
				<div class="flex items-center space-x-2">
					<h4 class="text-base font-bold text-white">{selectedLesson.topic || 'Stundeneintrag'}</h4>
					<span class="px-2 py-0.5 rounded text-[11px] font-mono bg-blue-950 text-blue-300 border border-blue-800">
						{selectedLesson.date}
					</span>
				</div>
			</div>

			<div class="flex items-center space-x-2 self-start sm:self-auto">
				<a
					href="/stundenansicht?courseId={course.id}&lessonId={selectedLesson.id}"
					class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center space-x-1.5 transition"
				>
					<Smartphone class="w-3.5 h-3.5 text-blue-400" />
					<span>In Stundenansicht</span>
				</a>

				<form
					action="?/deleteLesson&tab=stunden"
					method="POST"
					use:enhance={() => async ({ result, update }) => {
						if (result.type === 'success') {
							activeLessonId = '';
							showToast('Stundeneintrag gelöscht');
						}
						await update();
					}}
					onsubmit={(e) => {
						if (!confirm('Diesen Stundeneintrag und alle darin erfassten Notizen unwiderruflich löschen?')) {
							e.preventDefault();
						}
					}}
				>
					<input type="hidden" name="lessonId" value={selectedLesson.id} />
					<button
						type="submit"
						class="px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-400 hover:text-red-200 border border-red-900/60 text-xs font-medium flex items-center space-x-1.5 transition active:scale-95"
					>
						<Trash2 class="w-3.5 h-3.5" />
						<span>Löschen</span>
					</button>
				</form>
			</div>
		</div>

		<!-- GLOBALER NOTIZEINTRAG FÜR DIE STUNDE -->
		<div class="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm space-y-2">
			<div class="flex items-center justify-between">
				<span class="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
					<FileText class="w-4 h-4 text-blue-400" />
					<span>Globaler Notizeintrag zum Stundeneintrag (Lehrstoff, Vorkommnisse, Hausübung)</span>
				</span>
			</div>

			<form
				action="?/updateLessonGlobalNote&tab=stunden"
				method="POST"
				use:enhance={() => async ({ update }) => {
					await update();
					showToast('Globale Notiz gespeichert');
				}}
				class="space-y-2"
			>
				<input type="hidden" name="lessonId" value={selectedLesson.id} />
				<div class="grid grid-cols-1 md:grid-cols-3 gap-2">
					<input
						type="text"
						name="topic"
						bind:value={selectedLesson.topic}
						placeholder="Thema / Lehrstoff..."
						class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-blue-500"
					/>
					<input
						type="text"
						name="note"
						bind:value={selectedLesson.note}
						placeholder="Globale Notiz zur Stunde (Lehrstoff, Hausübung, allgemeine Bemerkungen)..."
						class="md:col-span-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-blue-500"
					/>
				</div>
				<div class="flex justify-end">
					<button
						type="submit"
						class="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition active:scale-95"
					>
						Globale Notiz speichern
					</button>
				</div>
			</form>
		</div>

		<!-- NOTIZEN PRO SCHÜLER FÜR DIESEN STUNDENEINTRAG -->
		<div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg overflow-x-auto">
			<table class="w-full text-left border-collapse text-xs">
				<thead>
					<tr class="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[11px]">
						<th class="py-3 px-3 w-12 text-center">Kat.</th>
						<th class="py-3 px-4 w-56">Schüler</th>
						<th class="py-3 px-4">Notizeintrag pro Schüler (für diesen Stundeneintrag)</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800/80 text-slate-200">
					{#each selectedLesson.scores as s (s.studentId)}
						<tr class="hover:bg-slate-800/40 transition">
							<td class="py-3 px-3 text-center font-bold text-slate-400">{s.catalogNumber ?? '–'}</td>
							<td class="py-3 px-4 font-bold text-white">
								<a href="/schueler/{s.studentId}" class="hover:text-blue-400 transition">
									{s.lastName} {s.firstName}
								</a>
							</td>
							<td class="py-2.5 px-4">
								<form
									action="?/saveLessonStudentNote&tab=stunden"
									method="POST"
									use:enhance={() => async ({ result }) => {
										if (result.type === 'success') {
											showToast(`Notiz für ${s.lastName} gespeichert`);
										}
									}}
									class="w-full"
								>
									<input type="hidden" name="lessonId" value={selectedLesson.id} />
									<input type="hidden" name="studentId" value={s.studentId} />
									<input
										type="text"
										name="note"
										bind:value={s.note}
										placeholder="Notiz für diese Stunde erfassen (Verhalten, Mitarbeit, Vorkommnis)..."
										onchange={(e) => (e.target as HTMLInputElement).form?.requestSubmit()}
										class="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									/>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<!-- Modal: Neuer Stundeneintrag anlegen -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
			<div class="flex items-center justify-between pb-3 border-b border-slate-800">
				<h3 class="text-lg font-bold text-white">Neuen Stundeneintrag anlegen</h3>
				<button type="button" onclick={() => (showCreateModal = false)} class="text-slate-400 hover:text-white">
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				action="?/createLesson&tab=stunden"
				method="POST"
				use:enhance={() => async ({ result, update }) => {
					if (result.type === 'success' && result.data) {
						showCreateModal = false;
						const createdId = (result.data as any).createdLessonId;
						if (createdId) activeLessonId = String(createdId);
						newTopic = '';
						newNote = '';
					}
					await update();
				}}
				class="space-y-4"
			>
				<div>
					<label for="lDate" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Datum der Stunde *
					</label>
					<input
						id="lDate"
						name="date"
						type="date"
						required
						bind:value={newDate}
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="lTopic" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Thema / Lehrstoff (Stichwort)
					</label>
					<input
						id="lTopic"
						name="topic"
						type="text"
						bind:value={newTopic}
						placeholder="z.B. Lineare Funktionen – Übungen Buch S. 42"
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="lNote" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Globaler Notizeintrag zur Stunde
					</label>
					<textarea
						id="lNote"
						name="note"
						rows="3"
						bind:value={newNote}
						placeholder="Lehrstoff, Stundenverlauf, Hausübung, allgemeine Bemerkungen..."
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					></textarea>
				</div>

				<div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
					<button
						type="button"
						onclick={() => (showCreateModal = false)}
						class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-sm font-medium"
					>
						Abbrechen
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition"
					>
						Stundeneintrag erstellen
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
