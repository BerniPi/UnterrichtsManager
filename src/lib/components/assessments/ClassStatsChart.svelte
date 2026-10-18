<script lang="ts">
	let {
		results = []
	} = $props<{
		results: Array<{
			grade: number | null;
			points: number | null;
			isAbsent?: boolean;
		}>;
	}>();

	const validResults = $derived(
		results.filter((r: any) => r.grade !== null && !r.isAbsent)
	);

	const gradeCounts = $derived(() => {
		const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
		for (const r of validResults) {
			if (r.grade && counts[r.grade] !== undefined) {
				counts[r.grade]++;
			}
		}
		return counts;
	});

	const averageGrade = $derived(() => {
		if (validResults.length === 0) return null;
		const sum = validResults.reduce((acc: number, r: any) => acc + (r.grade || 0), 0);
		return (sum / validResults.length).toFixed(2);
	});

	const averagePoints = $derived(() => {
		if (validResults.length === 0) return null;
		const sum = validResults.reduce((acc: number, r: any) => acc + (r.points || 0), 0);
		return (sum / validResults.length).toFixed(1);
	});

	const maxCount = $derived(() => {
		const counts = gradeCounts();
		return Math.max(1, ...Object.values(counts));
	});

	const colors: Record<number, { bg: string; text: string; label: string }> = {
		1: { bg: 'bg-emerald-500', text: 'text-emerald-400', label: 'Sehr gut' },
		2: { bg: 'bg-blue-500', text: 'text-blue-400', label: 'Gut' },
		3: { bg: 'bg-amber-500', text: 'text-amber-400', label: 'Befriedigend' },
		4: { bg: 'bg-orange-500', text: 'text-orange-400', label: 'Genügend' },
		5: { bg: 'bg-red-500', text: 'text-red-400', label: 'Nicht genügend' }
	};
</script>

<div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
	<div class="flex items-center justify-between pb-3 border-b border-slate-800">
		<h4 class="text-sm font-bold text-white uppercase tracking-wider">Klassenstatistik & Notenverteilung</h4>
		<div class="flex items-center space-x-4 text-xs">
			<div>
				<span class="text-slate-400">Notenschnitt:</span>
				<span class="ml-1 font-bold text-white text-sm">{averageGrade() ?? '–'}</span>
			</div>
			<div>
				<span class="text-slate-400">Punkte-Ø:</span>
				<span class="ml-1 font-bold text-white text-sm">{averagePoints() ?? '–'}</span>
			</div>
			<div>
				<span class="text-slate-400">Beurteilt:</span>
				<span class="ml-1 font-bold text-white text-sm">{validResults.length} / {results.length}</span>
			</div>
		</div>
	</div>

	<!-- Bar Chart -->
	<div class="grid grid-cols-5 gap-3 pt-2">
		{#each [1, 2, 3, 4, 5] as g}
			{@const count = gradeCounts()[g]}
			{@const heightPercent = (count / maxCount()) * 100}
			<div class="flex flex-col items-center">
				<div class="h-24 w-full flex items-end justify-center bg-slate-950/60 rounded-xl p-1.5 border border-slate-800/80">
					<div
						class="w-full rounded-lg transition-all duration-500 {colors[g].bg} opacity-85 hover:opacity-100 flex items-center justify-center text-xs font-bold text-white shadow"
						style="height: {Math.max(15, heightPercent)}%;"
					>
						{count}
					</div>
				</div>
				<div class="mt-2 text-center">
					<span class="text-xs font-bold {colors[g].text} block">Note {g}</span>
					<span class="text-[10px] text-slate-500 hidden sm:block">{colors[g].label}</span>
				</div>
			</div>
		{/each}
	</div>
</div>
