<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		ArrowLeft,
		Printer,
		User,
		FileText,
		AlertTriangle,
		CheckCircle2,
		Plus,
		Trash2,
		Award,
		Calendar,
		MessageSquare
	} from '@lucide/svelte';

	interface Props {
		data: {
			student: any;
			courseEvaluations: Array<any>;
			notes: Array<any>;
			earlyWarnings: Array<any>;
			participationHistory: Array<any>;
		};
	}

	let { data }: Props = $props();

	let showAddNoteModal = $state(false);
	let newNoteCategory = $state('elterngespraech');
	let newNoteTitle = $state('');
	let newNoteContent = $state('');
	let newNoteDate = $state(new Date().toISOString().slice(0, 10));

	const categoryBadges: Record<string, { label: string; bg: string; text: string }> = {
		elterngespraech: { label: 'Elterngespräch', bg: 'bg-amber-950/70', text: 'text-amber-300' },
		auffaelligkeit: { label: 'Auffälligkeit', bg: 'bg-red-950/70', text: 'text-red-300' },
		foerderung: { label: 'Förderung / Begabung', bg: 'bg-emerald-950/70', text: 'text-emerald-300' },
		allgemein: { label: 'Allgemein', bg: 'bg-slate-800', text: 'text-slate-300' }
	};
</script>

<svelte:head>
	<title>{data.student.lastName} {data.student.firstName} – Schülerkarte</title>
</svelte:head>

<div class="space-y-6">
	<!-- Top Bar (Hidden on print) -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800 print:hidden">
		<div class="flex items-center space-x-3">
			<a
				href="/klassen/{data.student.classId}"
				class="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
			>
				<ArrowLeft class="w-5 h-5" />
			</a>
			<div>
				<div class="flex items-center space-x-2">
					<h1 class="text-2xl font-bold text-white">
						{data.student.lastName} {data.student.firstName}
					</h1>
					<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-800">
						Klasse {data.student.className}
					</span>
				</div>
				<p class="text-xs text-slate-400 mt-0.5">
					Katalognummer: <strong>{data.student.catalogNumber ?? '–'}</strong> • WebUntis-ID: <strong>{data.student.webuntisId ?? '–'}</strong>
				</p>
			</div>
		</div>

		<div class="flex items-center space-x-2">
			<button
				type="button"
				onclick={() => window.print()}
				class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 transition active:scale-95"
			>
				<Printer class="w-4 h-4 text-blue-400" />
				<span>Drucken / PDF</span>
			</button>

			<button
				type="button"
				onclick={() => (showAddNoteModal = true)}
				class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center space-x-1.5"
			>
				<Plus class="w-4 h-4" />
				<span>Neue Notiz</span>
			</button>
		</div>
	</div>

	<!-- Print Header (Visible ONLY on print) -->
	<div class="hidden print:block mb-6 border-b pb-4 text-slate-900">
		<h1 class="text-2xl font-bold">{data.student.lastName} {data.student.firstName}</h1>
		<p class="text-sm">Klasse: {data.student.className} | Katalognummer: {data.student.catalogNumber ?? '–'} | WebUntis-ID: {data.student.webuntisId ?? '–'}</p>
		<p class="text-xs text-gray-500 mt-1">Ausdruck für Elterngespräch am {new Date().toLocaleDateString('de-AT')}</p>
	</div>

	<!-- Course Performances -->
	<div class="space-y-5">
		<h2 class="text-lg font-bold text-white print:text-slate-900 flex items-center space-x-2">
			<Award class="w-5 h-5 text-blue-400" />
			<span>Leistungsübersicht & Notenvorschläge</span>
		</h2>

		<div class="grid grid-cols-1 gap-5">
			{#each data.courseEvaluations as ce}
				{@const ev = ce.evaluation}
				<div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md space-y-4 print:bg-white print:border-gray-300 print:text-slate-900">
					<!-- Subject Header & Suggested Grade -->
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 print:border-gray-200">
						<div>
							<h3 class="text-xl font-bold text-white print:text-slate-900">{ce.courseSubject}</h3>
							<p class="text-xs text-slate-400 print:text-gray-500">
								Schularbeiten ({ev?.breakdown.weightsUsed.schularbeiten}%) • Tests ({ev?.breakdown.weightsUsed.tests}%) • Mitarbeit ({ev?.breakdown.weightsUsed.participation}%) • Beobachtungen ({ev?.breakdown.weightsUsed.observations}%) • HÜ ({ev?.breakdown.weightsUsed.homework}%)
							</p>
						</div>

						<div class="flex items-center space-x-3">
							<div class="text-right">
								<span class="text-xs text-slate-400 print:text-gray-500 block">Berechneter Schnitt</span>
								<span class="text-base font-bold text-blue-400 print:text-slate-900 font-mono">
									{ev?.breakdown.calculatedAverage ? ev.breakdown.calculatedAverage.toFixed(2) : '–'}
								</span>
							</div>

							<div class="text-center pl-3 border-l border-slate-800 print:border-gray-200">
								<span class="text-xs text-slate-400 print:text-gray-500 block">Notenvorschlag</span>
								{#if ev?.breakdown.suggestedGrade}
									<span class="inline-flex items-center justify-center w-8 h-8 rounded-lg font-extrabold text-base shadow {ev.breakdown.suggestedGrade === 1 ? 'bg-emerald-600 text-white' : ev.breakdown.suggestedGrade === 5 ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}">
										{ev.breakdown.suggestedGrade}
									</span>
								{:else}
									<span class="text-slate-500">–</span>
								{/if}
							</div>
						</div>
					</div>

					<!-- Component Breakdown Cards -->
					<div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
						<div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 print:bg-gray-50 print:border-gray-200">
							<span class="text-slate-400 print:text-gray-600 block text-[11px]">Schularbeiten</span>
							<span class="text-sm font-bold text-white print:text-slate-900 font-mono">
								{ev?.breakdown.schularbeitenAverage ? ev.breakdown.schularbeitenAverage.toFixed(2) : '–'}
							</span>
							<span class="text-[10px] text-slate-500 block mt-0.5">({ev?.performance.schularbeitGrades.join(', ') || 'keine'})</span>
						</div>

						<div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 print:bg-gray-50 print:border-gray-200">
							<span class="text-slate-400 print:text-gray-600 block text-[11px]">Tests</span>
							<span class="text-sm font-bold text-white print:text-slate-900 font-mono">
								{ev?.breakdown.testsAverage ? ev.breakdown.testsAverage.toFixed(2) : '–'}
							</span>
							<span class="text-[10px] text-slate-500 block mt-0.5">({ev?.performance.testGrades.join(', ') || 'keine'})</span>
						</div>

						<div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 print:bg-gray-50 print:border-gray-200">
							<span class="text-slate-400 print:text-gray-600 block text-[11px]">Mitarbeit (Note)</span>
							<span class="text-sm font-bold text-white print:text-slate-900 font-mono">
								{ev?.breakdown.participationScore ? ev.breakdown.participationScore.toFixed(1) : '–'}
							</span>
							<span class="text-[10px] text-slate-500 block mt-0.5">
								+{ev?.performance.participation.plus} ~{ev?.performance.participation.tilde} -{ev?.performance.participation.minus}
							</span>
						</div>

						<div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 print:bg-gray-50 print:border-gray-200">
							<span class="text-slate-400 print:text-gray-600 block text-[11px]">Beobachtungen</span>
							<span class="text-sm font-bold text-white print:text-slate-900 font-mono">
								{ev?.breakdown.observationsScore ?? '–'}
							</span>
							<span class="text-[10px] text-slate-500 block mt-0.5">{ev?.performance.observations.length} Einträge</span>
						</div>

						<div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 print:bg-gray-50 print:border-gray-200">
							<span class="text-slate-400 print:text-gray-600 block text-[11px]">Hausübung</span>
							<span class="text-sm font-bold text-white print:text-slate-900 font-mono">
								{ev?.breakdown.homeworkScore ?? '–'}
							</span>
							<span class="text-[10px] text-slate-500 block mt-0.5">
								{ev?.performance.homework.done}✓ {ev?.performance.homework.partial}~ {ev?.performance.homework.forgotten}✗
							</span>
						</div>
					</div>

					<!-- Assessments list in this subject -->
					{#if ce.assessments.length > 0}
						<div class="pt-2">
							<span class="text-xs font-semibold text-slate-400 print:text-gray-600 block mb-1.5">Einzelnoten:</span>
							<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
								{#each ce.assessments as a}
									<div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 print:bg-gray-50 print:border-gray-200 flex items-center justify-between">
										<div>
											<span class="font-bold text-white print:text-slate-900 block truncate">{a.title}</span>
											<span class="text-[10px] text-slate-500 font-mono">{a.date} | {a.points ?? '–'}/{a.maxPoints} Pkt.</span>
										</div>

										<div class="flex items-center space-x-2">
											{#if a.isAbsent}
												<span class="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">Abw.</span>
											{:else if a.grade}
												<span class="font-bold text-sm text-blue-400 print:text-slate-900 font-mono">Note {a.grade}</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Notes / Elterngespräche Feed -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-bold text-white print:text-slate-900 flex items-center space-x-2">
				<MessageSquare class="w-5 h-5 text-amber-400" />
				<span>Notizen & Elterngespräche ({data.notes.length})</span>
			</h2>
		</div>

		{#if data.notes.length === 0}
			<div class="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400 print:bg-white print:border-gray-200">
				Keine Notizen für diesen Schüler hinterlegt.
			</div>
		{:else}
			<div class="space-y-3">
				{#each data.notes as note}
					{@const badge = categoryBadges[note.category] || categoryBadges.allgemein}
					<div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm print:bg-white print:border-gray-200 space-y-2">
						<div class="flex items-center justify-between">
							<div class="flex items-center space-x-2">
								<span class="px-2 py-0.5 rounded text-[10px] font-semibold {badge.bg} {badge.text} border border-slate-700">
									{badge.label}
								</span>
								{#if note.courseSubject}
									<span class="text-xs text-slate-400">Fach: {note.courseSubject}</span>
								{/if}
								<span class="text-xs text-slate-500 font-mono">{note.date}</span>
							</div>

							<form action="?/deleteNote" method="POST" use:enhance class="print:hidden">
								<input type="hidden" name="noteId" value={note.id} />
								<button
									type="submit"
									class="p-1 rounded text-slate-500 hover:text-red-400 transition"
									title="Notiz löschen"
								>
									<Trash2 class="w-3.5 h-3.5" />
								</button>
							</form>
						</div>

						<h4 class="font-bold text-white print:text-slate-900 text-sm">{note.title}</h4>
						<p class="text-xs text-slate-300 print:text-gray-800 leading-relaxed whitespace-pre-wrap">{note.content}</p>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Modal: Neue Notiz anlegen -->
{#if showAddNoteModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm print:hidden">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
			<div class="flex items-center justify-between pb-3 border-b border-slate-800">
				<h3 class="text-lg font-bold text-white">Neue Notiz erfassen</h3>
				<button type="button" onclick={() => (showAddNoteModal = false)} class="text-slate-400 hover:text-white">
					✕
				</button>
			</div>

			<form
				action="?/addNote"
				method="POST"
				use:enhance={() => async ({ result, update }) => {
					await update();
					if (result.type === 'success') showAddNoteModal = false;
				}}
				class="space-y-4"
			>
				<div>
					<label for="nCat" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Kategorie
					</label>
					<select
						id="nCat"
						name="category"
						bind:value={newNoteCategory}
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					>
						<option value="elterngespraech">Elterngespräch / Kontakt</option>
						<option value="auffaelligkeit">Auffälligkeit / Verhalten</option>
						<option value="foerderung">Förderbedarf / Begabung</option>
						<option value="allgemein">Allgemeine Notiz</option>
					</select>
				</div>

				<div>
					<label for="nDate" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Datum
					</label>
					<input
						id="nDate"
						name="date"
						type="date"
						bind:value={newNoteDate}
						required
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="nTitle" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Titel / Stichwort *
					</label>
					<input
						id="nTitle"
						name="title"
						type="text"
						required
						bind:value={newNoteTitle}
						placeholder="z.B. Telefonat mit Mutter, Förderplan besprochen..."
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="nContent" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Inhalt / Vereinbarung *
					</label>
					<textarea
						id="nContent"
						name="content"
						rows="3"
						required
						bind:value={newNoteContent}
						placeholder="Details..."
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					></textarea>
				</div>

				<div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
					<button
						type="button"
						onclick={() => (showAddNoteModal = false)}
						class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
					>
						Abbrechen
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-md shadow-blue-500/20"
					>
						Notiz speichern
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
