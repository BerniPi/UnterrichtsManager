<script lang="ts" module>
	export interface TimetableSettingsData {
		configured: boolean;
		lastSync: number | null;
		lastError: string | null;
		eventCount: number;
		firstDate: string | null;
		lastDate: string | null;
		courses: Array<{ id: string; subject: string; className: string; link: string }>;
		combos: Array<{ key: string; classCode: string; subjectCode: string; lessonCount: number; examCount: number }>;
	}
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { CalendarDays, RefreshCw, CheckCircle2, AlertTriangle } from '@lucide/svelte';

	interface Props {
		timetable: TimetableSettingsData;
		form?: any;
	}

	let { timetable, form }: Props = $props();

	let busy = $state(false);

	function formatDateTime(ms: number): string {
		return new Date(ms).toLocaleString('de-AT', { dateStyle: 'medium', timeStyle: 'short' });
	}

	function formatDate(d: string): string {
		const [y, m, day] = d.split('-');
		return `${day}.${m}.${y}`;
	}

	const submit = () => {
		busy = true;
		return async ({ update }: { update: (opts?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			busy = false;
		};
	};

	const confirmRemove = ({ cancel }: { cancel: () => void }) => {
		if (!confirm('Link, gespeicherte Stundenplan-Termine und Kurs-Zuordnungen entfernen?')) {
			cancel();
			return;
		}
		return submit();
	};
</script>

<div class="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm space-y-4">
	<h2 class="text-base font-bold text-white flex items-center space-x-2">
		<CalendarDays class="w-5 h-5 text-blue-400" />
		<span>WebUntis-Stundenplan</span>
	</h2>

	<p class="text-xs text-slate-400">
		Mit deinem persönlichen Kalender-Link aus WebUntis (Profil → Freigaben → iCal/Kalender abonnieren) kennt die App deine
		Stunden, Schularbeiten und Tests: Die Stundenansicht öffnet die aktuelle Stunde, die Kursseite zeigt gehaltene Stunden
		ohne Eintrag und schlägt Prüfungen zum Anlegen vor. Der Abgleich läuft täglich automatisch. WebUntis liefert nur die
		aktuelle Woche und die Zukunft – vergangene Stunden sammelt die App ab dem ersten Abgleich selbst.
	</p>

	{#if form?.timetableError}
		<div class="p-3 bg-red-950/90 border border-red-800 text-red-200 text-xs rounded-xl flex items-center space-x-2">
			<AlertTriangle class="w-4 h-4 text-red-400 shrink-0" />
			<span>{form.timetableError}</span>
		</div>
	{:else if form?.timetableMessage}
		<div class="p-3 bg-emerald-950/90 border border-emerald-800 text-emerald-200 text-xs rounded-xl flex items-center space-x-2">
			<CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
			<span>{form.timetableMessage}</span>
		</div>
	{/if}

	<form action="?/saveTimetableUrl" method="POST" use:enhance={submit} class="space-y-3">
		<div>
			<label for="icsUrl" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
				Kalender-Link (ICS)
			</label>
			<input
				id="icsUrl"
				type="password"
				name="icsUrl"
				autocomplete="off"
				placeholder={timetable.configured
					? 'gespeichert – zum Ändern neuen Link einfügen'
					: 'https://schule.webuntis.com/WebUntis/ical_export?…'}
				class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
			/>
			<p class="text-[11px] text-slate-500 mt-1">
				Der Link enthält ein persönliches Token. Er wird nur am Server verwendet und hier nicht mehr angezeigt.
			</p>
		</div>
		<div class="flex justify-end">
			<button
				type="submit"
				disabled={busy}
				class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition"
			>
				{timetable.configured ? 'Link ersetzen & abgleichen' : 'Link speichern & abgleichen'}
			</button>
		</div>
	</form>

	{#if timetable.configured}
		<div class="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
			<div class="text-slate-300 space-y-0.5">
				{#if timetable.lastSync}
					<div>Letzter Abgleich: <strong class="text-white">{formatDateTime(timetable.lastSync)}</strong></div>
				{:else}
					<div>Noch kein erfolgreicher Abgleich.</div>
				{/if}
				{#if timetable.eventCount > 0 && timetable.firstDate && timetable.lastDate}
					<div class="text-slate-400">
						{timetable.eventCount} gespeicherte Termine vom {formatDate(timetable.firstDate)} bis {formatDate(timetable.lastDate)}
					</div>
				{/if}
				{#if timetable.lastError}
					<div class="text-amber-300">Letzter Fehler: {timetable.lastError}</div>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				<form action="?/syncTimetableNow" method="POST" use:enhance={submit}>
					<button
						type="submit"
						disabled={busy}
						class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center space-x-1.5"
					>
						<RefreshCw class="w-3.5 h-3.5 {busy ? 'animate-spin' : ''}" />
						<span>Jetzt abgleichen</span>
					</button>
				</form>
				<form action="?/removeTimetable" method="POST" use:enhance={confirmRemove}>
					<button
						type="submit"
						disabled={busy}
						class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-red-900/60 disabled:opacity-50 text-red-300 text-xs font-semibold border border-slate-700 transition"
					>
						Entfernen
					</button>
				</form>
			</div>
		</div>

		{#if timetable.courses.length > 0 && timetable.combos.length > 0}
			<form action="?/saveTimetableLinks" method="POST" use:enhance={submit} class="space-y-3">
				<div>
					<h3 class="text-sm font-semibold text-white">Kurse zuordnen</h3>
					<p class="text-[11px] text-slate-400">
						Welche Stunden aus WebUntis gehören zu welchem Kurs? Eindeutige Treffer (gleiche Klasse, passendes Fachkürzel)
						werden beim Abgleich automatisch zugeordnet.
					</p>
				</div>
				<div class="divide-y divide-slate-800 rounded-xl border border-slate-800 overflow-hidden">
					{#each timetable.courses as c (c.id)}
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 bg-slate-950">
							<label for="link_{c.id}" class="text-sm text-slate-200">{c.className} – {c.subject}</label>
							<select
								id="link_{c.id}"
								name="link_{c.id}"
								value={c.link}
								class="sm:w-64 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
							>
								<option value="">– nicht zugeordnet –</option>
								{#each timetable.combos as combo (combo.key)}
									<option value={combo.key}>
										{combo.classCode} {combo.subjectCode} ({combo.lessonCount} Std.{combo.examCount > 0
											? `, ${combo.examCount} Prüf.`
											: ''})
									</option>
								{/each}
							</select>
						</div>
					{/each}
				</div>
				<div class="flex justify-end">
					<button
						type="submit"
						disabled={busy}
						class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition"
					>
						Zuordnung speichern
					</button>
				</div>
			</form>
		{/if}
	{/if}
</div>
