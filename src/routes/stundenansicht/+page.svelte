<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import {
		Plus,
		Minus,
		Equal,
		Check,
		X,
		FileText,
		AlertTriangle,
		CheckCircle2,
		Clock,
		Send,
		User,
		ExternalLink,
		BookOpen
	} from '@lucide/svelte';

	interface Props {
		data: {
			courses: Array<any>;
			selectedCourse: any;
			currentWeekNumber: number;
			currentYear: number;
			activeHomework: any;
			studentsWithDetails: Array<any>;
		};
	}

	let { data }: Props = $props();

	let filterMode = $state<'all' | 'missing' | 'overdue'>('all');
	let noteModalStudent = $state<any | null>(null);
	let noteTitle = $state('');
	let noteContent = $state('');
	let noteCategory = $state('allgemein');
	let toastMessage = $state<string | null>(null);

	function showToast(msg: string) {
		toastMessage = msg;
		setTimeout(() => (toastMessage = null), 3000);
	}

	const filteredStudents = $derived(() => {
		if (filterMode === 'missing') {
			return data.studentsWithDetails.filter((s: any) => !s.participation);
		}
		if (filterMode === 'overdue') {
			return data.studentsWithDetails.filter((s: any) => s.overdueItems && s.overdueItems.length > 0);
		}
		return data.studentsWithDetails;
	});

	const missingCount = $derived(
		data.studentsWithDetails.filter((s: any) => !s.participation).length
	);

	const overdueCount = $derived(
		data.studentsWithDetails.filter((s: any) => s.overdueItems && s.overdueItems.length > 0).length
	);
</script>

<svelte:head>
	<title>Stundenansicht – UnterrichtsManager</title>
</svelte:head>

<div class="space-y-4">
	<!-- Course Selector Bar -->
	<div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
		{#each data.courses as c}
			<a
				href="/stundenansicht?courseId={c.id}"
				class="px-4 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition flex items-center space-x-2 shrink-0 {data.selectedCourse?.id === c.id ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-400/40' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'}"
			>
				<BookOpen class="w-4 h-4" />
				<span>{c.className} • {c.subject}</span>
			</a>
		{/each}
	</div>

	{#if !data.selectedCourse}
		<div class="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center">
			<p class="text-slate-400">Keine Kurse vorhanden. Bitte erstelle zuerst eine Klasse und einen Kurs.</p>
		</div>
	{:else}
		<!-- Lesson Header & Quick Filters -->
		<div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
			<div>
				<div class="flex items-center space-x-2">
					<h2 class="text-xl font-bold text-white">
						{data.selectedCourse.className} – {data.selectedCourse.subject}
					</h2>
					<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-800">
						KW {data.currentWeekNumber}
					</span>
				</div>
				<p class="text-xs text-slate-400 mt-0.5">
					{data.studentsWithDetails.length} Schüler | Schnelleingabe für Mitarbeit, HÜ und Notizen
				</p>
			</div>

			<!-- Filter Pills -->
			<div class="flex items-center gap-1.5 self-start sm:self-auto bg-slate-950 p-1 rounded-xl border border-slate-800">
				<button
					type="button"
					onclick={() => (filterMode = 'all')}
					class="px-3 py-1.5 rounded-lg text-xs font-semibold transition {filterMode === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}"
				>
					Alle ({data.studentsWithDetails.length})
				</button>
				<button
					type="button"
					onclick={() => (filterMode = 'missing')}
					class="px-3 py-1.5 rounded-lg text-xs font-semibold transition {filterMode === 'missing' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-amber-300'}"
				>
					Ohne Eintrag ({missingCount})
				</button>
				<button
					type="button"
					onclick={() => (filterMode = 'overdue')}
					class="px-3 py-1.5 rounded-lg text-xs font-semibold transition {filterMode === 'overdue' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-red-300'}"
				>
					Überfällig ({overdueCount})
				</button>
			</div>
		</div>

		<!-- Toast notification -->
		{#if toastMessage}
			<div class="p-3 bg-emerald-950/90 border border-emerald-800 text-emerald-200 text-sm rounded-xl flex items-center space-x-2 shadow-lg animate-fade-in">
				<CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
				<span>{toastMessage}</span>
			</div>
		{/if}

		<!-- Active Homework Context (if any) -->
		{#if data.activeHomework}
			<div class="px-4 py-2.5 bg-slate-900/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs text-slate-300">
				<div class="flex items-center space-x-2">
					<span class="font-semibold text-blue-400">Aktuelle HÜ:</span>
					<span class="text-white font-medium">{data.activeHomework.title}</span>
					<span class="text-slate-500">(Fällig: {data.activeHomework.due_date})</span>
				</div>
				<span class="text-slate-400 hidden sm:inline">HÜ-Status direkt in der Zeile erfassen</span>
			</div>
		{/if}

		<!-- Student List (Touch-Friendly Card Rows) -->
		<div class="space-y-3">
			{#each filteredStudents() as student}
				<div
					class="p-4 rounded-2xl bg-slate-900 border transition shadow-md {student.overdueItems.length > 0 ? 'border-red-800/70 bg-red-950/15' : 'border-slate-800 hover:border-slate-700'}"
				>
					<!-- Top Row: Student Name, Catalog Number & Overdue Alert -->
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/70">
						<div class="flex items-center space-x-3">
							<span class="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
								{student.catalogNumber ?? '–'}
							</span>
							<div>
								<a
									href="/schueler/{student.id}"
									class="font-bold text-base text-white hover:text-blue-400 transition flex items-center space-x-1.5"
								>
									<span>{student.lastName} {student.firstName}</span>
									<ExternalLink class="w-3.5 h-3.5 text-slate-500" />
								</a>
							</div>
						</div>

						<!-- Quick Actions Right: Note Button -->
						<div class="flex items-center space-x-2 self-end sm:self-auto">
							<button
								type="button"
								onclick={() => {
									noteModalStudent = student;
									noteTitle = '';
									noteContent = '';
									noteCategory = 'allgemein';
								}}
								class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 flex items-center space-x-1.5 transition active:scale-95"
							>
								<FileText class="w-3.5 h-3.5 text-blue-400" />
								<span>Notiz</span>
							</button>
						</div>
					</div>

					<!-- OVERDUE INSTRUCTION / WARNING BADGE -->
					{#if student.overdueItems.length > 0}
						<div class="mt-3 p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs space-y-2">
							<div class="flex items-center space-x-2 font-bold text-red-300">
								<AlertTriangle class="w-4 h-4 text-red-400 shrink-0" />
								<span>Unterschrift überfällig! Bitte in der Stunde ansprechen:</span>
							</div>

							{#each student.overdueItems as item}
								<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-red-900/60">
									<div>
										<span class="font-semibold text-white">{item.title}</span>
										<span class="text-red-400 ml-1.5 font-bold">({item.daysOverdue} Tage überfällig)</span>
									</div>

									<div class="flex items-center gap-1.5">
										<!-- Mark signed -->
										<form action="?/markSigned" method="POST" use:enhance={() => async ({ update }) => {
											await update();
											showToast('Unterschrift als zurück markiert!');
										}}>
											<input type="hidden" name="type" value={item.type} />
											<input type="hidden" name="id" value={item.id} />
											<button
												type="submit"
												class="px-2.5 py-1 rounded-md bg-emerald-700 hover:bg-emerald-600 text-white font-medium text-[11px] flex items-center space-x-1 active:scale-95 transition"
											>
												<Check class="w-3 h-3" />
												<span>Zurück ✓</span>
											</button>
										</form>

										<!-- Asked button -->
										<form action="?/recordAsked" method="POST" use:enhance={() => async ({ update }) => {
											await update();
											showToast('Nachfrage protokolliert!');
										}}>
											<input type="hidden" name="type" value={item.type} />
											<input type="hidden" name="id" value={item.id} />
											<button
												type="submit"
												class="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-[11px] border border-slate-700 flex items-center space-x-1 transition active:scale-95"
											>
												<Send class="w-3 h-3" />
												<span>Nachgefragt</span>
											</button>
										</form>

										<!-- Snooze -->
										<form action="?/snooze" method="POST" use:enhance={() => async ({ update }) => {
											await update();
											showToast('Erinnerung um 3 Tage verschoben.');
										}}>
											<input type="hidden" name="type" value={item.type} />
											<input type="hidden" name="id" value={item.id} />
											<input type="hidden" name="days" value="3" />
											<button
												type="submit"
												class="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[11px] border border-slate-700"
												title="Snooze 3 Tage"
											>
												+3d
											</button>
										</form>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Controls Row: Participation Buttons & Homework Status -->
					<div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
						<!-- Big Participation Buttons (+, ~, -) -->
						<div>
							<span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
								Mitarbeit diese Woche (KW {data.currentWeekNumber})
							</span>
							<div class="grid grid-cols-3 gap-2">
								<!-- Plus Button -->
								<form action="?/setParticipation" method="POST" use:enhance class="w-full">
									<input type="hidden" name="courseId" value={data.selectedCourse.id} />
									<input type="hidden" name="studentId" value={student.id} />
									<input type="hidden" name="value" value="plus" />
									<input type="hidden" name="weekNumber" value={data.currentWeekNumber} />
									<input type="hidden" name="year" value={data.currentYear} />
									<button
										type="submit"
										class="w-full py-3 px-2 rounded-xl font-extrabold text-lg flex items-center justify-center space-x-1 transition active:scale-95 {student.participation?.value === 'plus' ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/30' : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700'}"
									>
										<Plus class="w-5 h-5 stroke-[3]" />
										<span>+</span>
									</button>
								</form>

								<!-- Tilde Button -->
								<form action="?/setParticipation" method="POST" use:enhance class="w-full">
									<input type="hidden" name="courseId" value={data.selectedCourse.id} />
									<input type="hidden" name="studentId" value={student.id} />
									<input type="hidden" name="value" value="tilde" />
									<input type="hidden" name="weekNumber" value={data.currentWeekNumber} />
									<input type="hidden" name="year" value={data.currentYear} />
									<button
										type="submit"
										class="w-full py-3 px-2 rounded-xl font-extrabold text-lg flex items-center justify-center space-x-1 transition active:scale-95 {student.participation?.value === 'tilde' ? 'bg-amber-600 text-white ring-2 ring-amber-400 shadow-lg shadow-amber-500/30' : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700'}"
									>
										<Equal class="w-5 h-5 stroke-[3]" />
										<span>~</span>
									</button>
								</form>

								<!-- Minus Button -->
								<form action="?/setParticipation" method="POST" use:enhance class="w-full">
									<input type="hidden" name="courseId" value={data.selectedCourse.id} />
									<input type="hidden" name="studentId" value={student.id} />
									<input type="hidden" name="value" value="minus" />
									<input type="hidden" name="weekNumber" value={data.currentWeekNumber} />
									<input type="hidden" name="year" value={data.currentYear} />
									<button
										type="submit"
										class="w-full py-3 px-2 rounded-xl font-extrabold text-lg flex items-center justify-center space-x-1 transition active:scale-95 {student.participation?.value === 'minus' ? 'bg-red-600 text-white ring-2 ring-red-400 shadow-lg shadow-red-500/30' : 'bg-slate-800 hover:bg-slate-700 text-red-400 border border-slate-700'}"
									>
										<Minus class="w-5 h-5 stroke-[3]" />
										<span>−</span>
									</button>
								</form>
							</div>
						</div>

						<!-- Homework Status (if active homework exists) -->
						{#if data.activeHomework}
							<div>
								<span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
									HÜ-Status
								</span>
								<div class="grid grid-cols-3 gap-2">
									<form action="?/setHomeworkStatus" method="POST" use:enhance>
										<input type="hidden" name="homeworkId" value={data.activeHomework.id} />
										<input type="hidden" name="studentId" value={student.id} />
										<input type="hidden" name="status" value="done" />
										<button
											type="submit"
											class="w-full py-2.5 px-2 rounded-xl font-medium text-xs flex items-center justify-center space-x-1 transition active:scale-95 {student.homeworkStatus === 'done' ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}"
										>
											<Check class="w-3.5 h-3.5 text-emerald-400" />
											<span>Erledigt</span>
										</button>
									</form>

									<form action="?/setHomeworkStatus" method="POST" use:enhance>
										<input type="hidden" name="homeworkId" value={data.activeHomework.id} />
										<input type="hidden" name="studentId" value={student.id} />
										<input type="hidden" name="status" value="partial" />
										<button
											type="submit"
											class="w-full py-2.5 px-2 rounded-xl font-medium text-xs flex items-center justify-center space-x-1 transition active:scale-95 {student.homeworkStatus === 'partial' ? 'bg-amber-600 text-white ring-2 ring-amber-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}"
										>
											<Equal class="w-3.5 h-3.5 text-amber-400" />
											<span>Teilw.</span>
										</button>
									</form>

									<form action="?/setHomeworkStatus" method="POST" use:enhance>
										<input type="hidden" name="homeworkId" value={data.activeHomework.id} />
										<input type="hidden" name="studentId" value={student.id} />
										<input type="hidden" name="status" value="forgotten" />
										<button
											type="submit"
											class="w-full py-2.5 px-2 rounded-xl font-medium text-xs flex items-center justify-center space-x-1 transition active:scale-95 {student.homeworkStatus === 'forgotten' ? 'bg-red-600 text-white ring-2 ring-red-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}"
										>
											<X class="w-3.5 h-3.5 text-red-400" />
											<span>Fehlt</span>
										</button>
									</form>
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Quick Note Modal -->
{#if noteModalStudent}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
			<div class="flex items-center justify-between pb-3 border-b border-slate-800">
				<div>
					<h3 class="text-lg font-bold text-white">Schnellnotiz erfassen</h3>
					<p class="text-xs text-slate-400">
						Schüler: <strong>{noteModalStudent.lastName} {noteModalStudent.firstName}</strong> ({data.selectedCourse?.className})
					</p>
				</div>
				<button
					type="button"
					onclick={() => (noteModalStudent = null)}
					class="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				action="?/quickNote"
				method="POST"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') {
							noteModalStudent = null;
							showToast('Notiz erfolgreich gespeichert!');
						}
						await update();
					};
				}}
				class="space-y-4"
			>
				<input type="hidden" name="studentId" value={noteModalStudent.id} />
				<input type="hidden" name="courseId" value={data.selectedCourse?.id} />

				<div>
					<label for="category" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Kategorie
					</label>
					<select
						id="category"
						name="category"
						bind:value={noteCategory}
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					>
						<option value="allgemein">Allgemeine Beobachtung</option>
						<option value="elterngespraech">Elterngespräch / Kontakt</option>
						<option value="auffaelligkeit">Auffälligkeit / Verhalten</option>
						<option value="foerderung">Förderbedarf / Begabung</option>
					</select>
				</div>

				<div>
					<label for="title" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Titel / Stichwort
					</label>
					<input
						id="title"
						name="title"
						type="text"
						required
						bind:value={noteTitle}
						placeholder="z.B. Mitarbeit an der Tafel, Hausübung wiederholt vergessen..."
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="content" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Inhalt
					</label>
					<textarea
						id="content"
						name="content"
						rows="3"
						required
						bind:value={noteContent}
						placeholder="Details der Beobachtung oder Vereinbarung..."
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					></textarea>
				</div>

				<div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
					<button
						type="button"
						onclick={() => (noteModalStudent = null)}
						class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-sm font-medium transition"
					>
						Abbrechen
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition active:scale-95"
					>
						Notiz speichern
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
