<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		AlertTriangle,
		CheckCircle2,
		Clock,
		Calendar,
		Users,
		Send,
		Smartphone,
		ChevronRight,
		BellRing,
		ArrowRight
	} from '@lucide/svelte';

	interface Props {
		data: {
			overdueSummary: {
				overdueReturns: Array<any>;
				overdueEarlyWarnings: Array<any>;
				totalOverdue: number;
			};
			assessmentEarlyWarningReminders?: Array<any>;
			missingParticipationByCourse: Array<any>;
			currentWeekNumber: number;
			deadlines: Array<any>;
			isNearNotenschluss: boolean;
			openEarlyWarningsCount: number;
		};
	}

	let { data }: Props = $props();

	let pushChecking = $state(false);
	let pushMessage = $state<string | null>(null);
</script>

<svelte:head>
	<title>Dashboard – UnterrichtsManager</title>
</svelte:head>

<div class="space-y-6">
	<!-- Hero & Welcome -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
		<div>
			<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-white">Lehrer-Cockpit</h1>
			<p class="text-slate-400 text-sm mt-0.5">
				Übersicht zu offenen Unterschriften, wöchentlicher Mitarbeit und Fristen
			</p>
		</div>

		<div class="flex items-center space-x-3">
			<a
				href="/stundenansicht"
				class="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md shadow-blue-500/20 active:scale-95 transition"
			>
				<Smartphone class="w-4 h-4" />
				<span>Zur Stundenansicht</span>
			</a>

			<form
				action="?/triggerPushCheck"
				method="POST"
				use:enhance={() => {
					pushChecking = true;
					pushMessage = null;
					return async ({ result, update }) => {
						pushChecking = false;
						if (result.type === 'success') {
							pushMessage = 'Erinnerungs-Check ausgeführt!';
							setTimeout(() => (pushMessage = null), 4000);
						}
						await update();
					};
				}}
			>
				<button
					type="submit"
					disabled={pushChecking}
					class="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
					title="Erinnerungsprüfung & Push jetzt manuell anstoßen"
				>
					<BellRing class="w-4 h-4 {pushChecking ? 'animate-spin' : ''}" />
				</button>
			</form>
		</div>
	</div>

	{#if pushMessage}
		<div class="p-3 bg-blue-950/80 border border-blue-800 text-blue-200 text-sm rounded-xl flex items-center space-x-2">
			<CheckCircle2 class="w-4 h-4 text-blue-400 shrink-0" />
			<span>{pushMessage}</span>
		</div>
	{/if}

	<!-- Pre-Notenschluss Warning Alert -->
	{#if data.isNearNotenschluss && data.openEarlyWarningsCount > 0}
		<div class="p-4 rounded-2xl bg-amber-950/80 border border-amber-800 text-amber-200 flex items-start space-x-3 shadow-lg">
			<AlertTriangle class="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
			<div>
				<h3 class="font-semibold text-amber-100">Wichtiger Hinweis: Notenschluss steht bevor!</h3>
				<p class="text-sm text-amber-300 mt-1">
					Es sind aktuell noch <strong>{data.openEarlyWarningsCount} Frühwarnungen</strong> ohne unterschriebenen Rücklauf offen. Bitte vor Notenschluss einfordern!
				</p>
			</div>
		</div>
	{/if}

	<!-- Top Metric Cards Grid -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
		<!-- Overdue Card -->
		<div class="p-5 rounded-2xl bg-slate-900 border {data.overdueSummary.totalOverdue > 0 ? 'border-red-900/60 bg-red-950/20' : 'border-slate-800'}">
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Überfällige Unterschriften</span>
				<div class="p-2 rounded-xl {data.overdueSummary.totalOverdue > 0 ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-400'}">
					<AlertTriangle class="w-5 h-5" />
				</div>
			</div>
			<div class="mt-4 flex items-baseline space-x-2">
				<span class="text-3xl font-extrabold {data.overdueSummary.totalOverdue > 0 ? 'text-red-400' : 'text-slate-100'}">
					{data.overdueSummary.totalOverdue}
				</span>
				<span class="text-xs text-slate-400">
					({data.overdueSummary.overdueReturns.length} Tests, {data.overdueSummary.overdueEarlyWarnings.length} Frühwarnungen)
				</span>
			</div>
			{#if data.assessmentEarlyWarningReminders && data.assessmentEarlyWarningReminders.length > 0}
				<div class="mt-2 text-xs text-amber-400 flex items-center space-x-1 font-medium">
					<span>+ {data.assessmentEarlyWarningReminders.length} Frühwarn-Erinnerung(en) nach Tests</span>
				</div>
			{/if}
		</div>

		<!-- Participation Card -->
		<div class="p-5 rounded-2xl bg-slate-900 border border-slate-800">
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wider text-slate-400">KW {data.currentWeekNumber} – Fehlende Mitarbeit</span>
				<div class="p-2 rounded-xl bg-amber-500/10 text-amber-400">
					<Users class="w-5 h-5" />
				</div>
			</div>
			<div class="mt-4 flex items-baseline space-x-2">
				<span class="text-3xl font-extrabold text-white">
					{data.missingParticipationByCourse.reduce((acc, c) => acc + c.students.length, 0)}
				</span>
				<span class="text-xs text-slate-400">Schüler ohne Eintrag diese Woche</span>
			</div>
		</div>

		<!-- Next Deadline Card -->
		<div class="p-5 rounded-2xl bg-slate-900 border border-slate-800">
			<div class="flex items-center justify-between">
				<span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Nächste Frist</span>
				<div class="p-2 rounded-xl bg-blue-500/10 text-blue-400">
					<Calendar class="w-5 h-5" />
				</div>
			</div>
			<div class="mt-4">
				{#if data.deadlines.length > 0}
					<span class="text-lg font-bold text-white block truncate">{data.deadlines[0].title}</span>
					<span class="text-xs text-slate-400">{data.deadlines[0].date} ({data.deadlines[0].approaching.daysRemaining} Tage)</span>
				{:else}
					<span class="text-sm text-slate-400">Keine Fristen eingetragen</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Section 1: Overdue Signatures Details -->
	<section id="overdue-section" class="space-y-4">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-bold text-white flex items-center space-x-2">
				<Clock class="w-5 h-5 text-red-400" />
				<span>Überfällige Rückläufe ({data.overdueSummary.totalOverdue})</span>
			</h2>
			<span class="text-xs text-slate-400">Frist überschritten & nicht abgehakt</span>
		</div>

		{#if data.overdueSummary.totalOverdue === 0}
			<div class="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
				<CheckCircle2 class="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
				<h3 class="font-medium text-slate-200">Alles aktuell!</h3>
				<p class="text-xs text-slate-400 mt-1">Keine überfälligen Schularbeits- oder Frühwarnungs-Unterschriften vorhanden.</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
				<!-- Overdue Test Returns -->
				{#each data.overdueSummary.overdueReturns as item}
					<div class="p-4 rounded-xl bg-slate-900 border border-red-900/40 hover:border-red-700/60 transition flex flex-col justify-between space-y-3 shadow-md">
						<div class="flex items-start justify-between gap-2">
							<div>
								<div class="flex items-center space-x-2">
									<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-950 text-red-300 border border-red-800">
										{item.daysOverdue} {item.daysOverdue === 1 ? 'Tag' : 'Tage'} überfällig
									</span>
									<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300">
										{item.className} • {item.courseSubject}
									</span>
								</div>
								<h3 class="font-bold text-white text-base mt-1.5">{item.studentName}</h3>
								<p class="text-xs text-slate-400 mt-0.5">Test: <span class="text-slate-200">{item.assessmentTitle}</span> (Frist: {item.dueDate})</p>
							</div>
						</div>

						<!-- Quick Action Buttons -->
						<div class="flex items-center gap-2 pt-2 border-t border-slate-800/80">
							<!-- Mark Signed Button -->
							<form action="?/markReturnSigned" method="POST" use:enhance class="flex-1">
								<input type="hidden" name="returnId" value={item.id} />
								<button
									type="submit"
									class="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center space-x-1.5 transition active:scale-95"
									title="Unterschrieben zurückerhalten"
								>
									<CheckCircle2 class="w-3.5 h-3.5" />
									<span>Zurück ✓</span>
								</button>
							</form>

							<!-- Record Asked Button -->
							<form action="?/recordAsked" method="POST" use:enhance class="flex-1">
								<input type="hidden" name="entityType" value="assessment_return" />
								<input type="hidden" name="entityId" value={item.id} />
								<button
									type="submit"
									class="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center justify-center space-x-1.5 transition"
									title="Heute nachgefragt im Unterricht"
								>
									<Send class="w-3.5 h-3.5" />
									<span>Nachgefragt</span>
								</button>
							</form>

							<!-- Snooze 3 Days Button -->
							<form action="?/snooze" method="POST" use:enhance>
								<input type="hidden" name="entityType" value="assessment_return" />
								<input type="hidden" name="entityId" value={item.id} />
								<input type="hidden" name="days" value="3" />
								<button
									type="submit"
									class="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium border border-slate-700 transition"
									title="3 Tage später erinnern (Snooze)"
								>
									+3 Tage
								</button>
							</form>
						</div>
					</div>
				{/each}

				<!-- Overdue Early Warnings -->
				{#each data.overdueSummary.overdueEarlyWarnings as ew}
					<div class="p-4 rounded-xl bg-slate-900 border border-amber-900/50 hover:border-amber-700/60 transition flex flex-col justify-between space-y-3 shadow-md">
						<div class="flex items-start justify-between gap-2">
							<div>
								<div class="flex items-center space-x-2">
									<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-800">
										Frühwarnung • {ew.daysOverdue} Tage überfällig
									</span>
									<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300">
										{ew.className} • {ew.courseSubject}
									</span>
								</div>
								<h3 class="font-bold text-white text-base mt-1.5">{ew.studentName}</h3>
								<p class="text-xs text-slate-400 mt-0.5">Grund: <span class="text-slate-200">{ew.reason}</span></p>
							</div>
						</div>

						<div class="flex items-center gap-2 pt-2 border-t border-slate-800/80">
							<form action="?/markEarlyWarningSigned" method="POST" use:enhance class="flex-1">
								<input type="hidden" name="warningId" value={ew.id} />
								<button
									type="submit"
									class="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center space-x-1.5 transition active:scale-95"
								>
									<CheckCircle2 class="w-3.5 h-3.5" />
									<span>Zurück ✓</span>
								</button>
							</form>

							<form action="?/recordAsked" method="POST" use:enhance class="flex-1">
								<input type="hidden" name="entityType" value="early_warning" />
								<input type="hidden" name="entityId" value={ew.id} />
								<button
									type="submit"
									class="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center justify-center space-x-1.5 transition"
								>
									<Send class="w-3.5 h-3.5" />
									<span>Nachgefragt</span>
								</button>
							</form>

							<form action="?/snooze" method="POST" use:enhance>
								<input type="hidden" name="entityType" value="early_warning" />
								<input type="hidden" name="entityId" value={ew.id} />
								<input type="hidden" name="days" value="3" />
								<button
									type="submit"
									class="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium border border-slate-700 transition"
								>
									+3 Tage
								</button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Section: Early Warning Reminders (1 week after Test/Schularbeit) -->
	{#if data.assessmentEarlyWarningReminders && data.assessmentEarlyWarningReminders.length > 0}
		<section class="space-y-4">
			<div class="flex items-center justify-between">
				<h2 class="text-lg font-bold text-white flex items-center space-x-2">
					<AlertTriangle class="w-5 h-5 text-amber-400" />
					<span>Frühwarnungs-Checks nach Tests & Schularbeiten ({data.assessmentEarlyWarningReminders.length})</span>
				</h2>
				<span class="text-xs text-slate-400">1 Woche nach negativer Beurteilung gem. § 19 Abs. 4 SchUG</span>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
				{#each data.assessmentEarlyWarningReminders as item}
					<div class="p-4 rounded-xl bg-slate-900 border border-amber-900/60 hover:border-amber-700/60 transition flex flex-col justify-between space-y-3 shadow-md">
						<div class="flex items-start justify-between gap-2">
							<div>
								<div class="flex items-center space-x-2">
									<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-800">
										{item.assessmentType === 'schularbeit' ? 'Schularbeit' : 'Test'} • vor {item.daysSinceAssessment} Tagen
									</span>
									<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300">
										{item.className} • {item.courseSubject}
									</span>
								</div>
								<h3 class="font-bold text-white text-base mt-1.5">{item.studentName}</h3>
								<p class="text-xs text-amber-300/90 mt-0.5">
									Note <span class="font-bold text-red-400">5 (Nicht genügend)</span> bei <em>{item.assessmentTitle}</em> ({item.assessmentDate})
								</p>
								<p class="text-[11px] text-slate-400 mt-1">
									Bisher keine Frühwarnung im laufenden Semester für diesen Kurs ausgestellt.
								</p>
							</div>
						</div>

						<div class="flex items-center gap-2 pt-2 border-t border-slate-800/80">
							<a
								href="/kurse/{item.courseId}?tab=fruehwarnungen&studentId={item.studentId}"
								class="flex-1 py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs flex items-center justify-center space-x-1.5 transition active:scale-95 shadow-md shadow-amber-600/20"
							>
								<AlertTriangle class="w-3.5 h-3.5" />
								<span>Frühwarnung erfassen</span>
							</a>

							<form action="?/dismissAssessmentReminder" method="POST" use:enhance>
								<input type="hidden" name="assessmentId" value={item.assessmentId} />
								<input type="hidden" name="studentId" value={item.studentId} />
								<button
									type="submit"
									title="Nicht nötig (z.B. mündlich verbessert)"
									class="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
								>
									Nicht nötig
								</button>
							</form>

							<form action="?/snoozeAssessmentReminder" method="POST" use:enhance>
								<input type="hidden" name="assessmentId" value={item.assessmentId} />
								<input type="hidden" name="studentId" value={item.studentId} />
								<input type="hidden" name="days" value="7" />
								<button
									type="submit"
									title="In 7 Tagen erneut erinnern"
									class="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium border border-slate-700 transition"
								>
									+7 Tage
								</button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Section 2: Missing Participation This Week -->
	<section class="space-y-4">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-bold text-white flex items-center space-x-2">
				<Users class="w-5 h-5 text-amber-400" />
				<span>Noch ohne Mitarbeitseintrag in KW {data.currentWeekNumber}</span>
			</h2>
			<span class="text-xs text-slate-400">Wöchentliches Mitarbeits-Monitoring</span>
		</div>

		{#if data.missingParticipationByCourse.length === 0}
			<div class="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
				<CheckCircle2 class="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
				<p class="text-sm text-slate-300 font-medium">Alle aktiven Schüler haben diese Woche bereits einen Mitarbeitseintrag!</p>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each data.missingParticipationByCourse as item}
					<div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3">
						<div>
							<div class="flex items-center justify-between">
								<h3 class="font-bold text-white text-base">{item.className} • {item.courseSubject}</h3>
								<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">
									{item.students.length} offen
								</span>
							</div>

							<div class="mt-3 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
								{#each item.students as student}
									<span class="px-2 py-1 rounded-md text-xs bg-slate-800 text-slate-300 border border-slate-700/60">
										{student.name}
									</span>
								{/each}
							</div>
						</div>

						<a
							href="/stundenansicht?courseId={item.courseId}"
							class="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 text-xs font-semibold flex items-center justify-center space-x-1 transition"
						>
							<span>In Stundenansicht öffnen</span>
							<ArrowRight class="w-3.5 h-3.5" />
						</a>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Section 3: Upcoming Deadlines & School Calendar -->
	<section class="space-y-4">
		<h2 class="text-lg font-bold text-white flex items-center space-x-2">
			<Calendar class="w-5 h-5 text-blue-400" />
			<span>Fristen & Termine</span>
		</h2>

		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
			{#each data.deadlines as deadline}
				<div class="p-4 rounded-xl bg-slate-900 border {deadline.approaching.isApproaching ? 'border-amber-600 bg-amber-950/20' : 'border-slate-800'}">
					<div class="flex items-center justify-between">
						<span class="text-xs font-medium text-slate-400">{deadline.title}</span>
						{#if deadline.approaching.isApproaching}
							<span class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-950 text-amber-300 border border-amber-800">
								Bald fällig!
							</span>
						{/if}
					</div>
					<div class="mt-2 text-xl font-bold text-white">{deadline.date}</div>
					<div class="text-xs text-slate-400 mt-0.5">
						in {deadline.approaching.daysRemaining} Tagen
					</div>
				</div>
			{/each}
		</div>
	</section>
</div>
