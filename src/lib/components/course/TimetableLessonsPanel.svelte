<script lang="ts">
	import { enhance } from '$app/forms';
	import { CalendarDays, Plus } from '@lucide/svelte';

	interface Props {
		timetable: {
			configured: boolean;
			linked: boolean;
			stats: {
				held: number;
				upcoming: number;
				cancelled: number;
				trackedSince: string | null;
				gapDates: string[];
			} | null;
			upcomingCancelled: Array<{ date: string; startTime: string | null; endTime: string | null }>;
		};
	}

	let { timetable }: Props = $props();

	let showAllGaps = $state(false);
	const visibleGaps = $derived(
		timetable.stats ? (showAllGaps ? timetable.stats.gapDates : timetable.stats.gapDates.slice(0, 6)) : []
	);

	function formatDate(d: string): string {
		const date = new Date(`${d}T12:00:00`);
		return date.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit' });
	}
</script>

{#if !timetable.configured}
	<p class="text-[11px] text-slate-500 px-1">
		Tipp: Mit dem WebUntis-Kalender-Link in den <a href="/einstellungen" class="text-blue-400 hover:underline">Einstellungen</a>
		siehst du hier, welche gehaltenen Stunden noch keinen Eintrag haben.
	</p>
{:else if !timetable.linked}
	<p class="text-[11px] text-slate-500 px-1">
		Dieser Kurs ist noch keinem WebUntis-Unterricht zugeordnet –
		<a href="/einstellungen" class="text-blue-400 hover:underline">in den Einstellungen zuordnen</a>.
	</p>
{:else if timetable.stats}
	{@const stats = timetable.stats}
	<div class="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
		<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
			<span class="flex items-center space-x-1.5 font-semibold text-white">
				<CalendarDays class="w-4 h-4 text-blue-400" />
				<span>Laut WebUntis</span>
			</span>
			<span><strong class="text-white">{stats.held}</strong> Stunden gehalten</span>
			<span><strong class="text-white">{stats.upcoming}</strong> geplant</span>
			{#if stats.cancelled > 0}
				<span><strong class="text-amber-300">{stats.cancelled}</strong> entfallen</span>
			{/if}
			{#if stats.trackedSince}
				<span class="text-slate-500">erfasst seit {formatDate(stats.trackedSince)}</span>
			{/if}
		</div>

		{#if stats.gapDates.length > 0}
			<div>
				<p class="text-xs text-amber-200 mb-2">
					{stats.gapDates.length === 1 ? '1 Unterrichtstag' : `${stats.gapDates.length} Unterrichtstage`} ohne Stundeneintrag:
				</p>
				<div class="flex flex-wrap gap-2">
					{#each visibleGaps as d (d)}
						<form action="?/createLesson&tab=stunden" method="POST" use:enhance>
							<input type="hidden" name="date" value={d} />
							<button
								type="submit"
								class="px-2.5 py-1 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/60 text-amber-100 text-xs flex items-center space-x-1"
								title="Stundeneintrag für diesen Tag anlegen"
							>
								<Plus class="w-3 h-3" />
								<span>{formatDate(d)}</span>
							</button>
						</form>
					{/each}
					{#if stats.gapDates.length > 6}
						<button
							type="button"
							onclick={() => (showAllGaps = !showAllGaps)}
							class="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-white"
						>
							{showAllGaps ? 'weniger' : `+ ${stats.gapDates.length - 6} weitere`}
						</button>
					{/if}
				</div>
			</div>
		{:else if stats.held > 0}
			<p class="text-xs text-emerald-300">Für alle gehaltenen Stunden gibt es einen Eintrag.</p>
		{/if}

		{#if timetable.upcomingCancelled.length > 0}
			<p class="text-xs text-slate-400">
				Entfällt demnächst:
				{timetable.upcomingCancelled
					.slice(0, 5)
					.map((c) => `${formatDate(c.date)}${c.startTime ? ' ' + c.startTime : ''}`)
					.join(', ')}
			</p>
		{/if}
	</div>
{/if}
