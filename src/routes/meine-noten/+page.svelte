<script lang="ts">
	import { Award, BookOpen, GraduationCap, Calendar } from '@lucide/svelte';

	interface Props {
		data: {
			student: {
				id: string;
				firstName: string;
				lastName: string;
				catalogNumber: number | null;
				classId: string;
				className: string;
				schoolYearName: string;
			} | null;
			courses: Array<{
				id: string;
				subject: string;
				teacherName: string | null;
				assessments: Array<{
					id: string;
					title: string;
					type: string;
					date: string;
					maxPoints: number;
					points: number | null;
					grade: number | null;
					isAbsent: boolean;
					isMadeUp: boolean;
				}>;
				finalGrades: Array<{
					semester: number;
					manualGrade: number;
				}>;
			}>;
		};
	}

	let { data }: Props = $props();

	function typeLabel(type: string): string {
		if (type === 'schularbeit') return 'Schularbeit';
		if (type === 'wiederholung') return 'Wiederholung';
		return 'Test';
	}

	function gradeColor(grade: number | null): string {
		if (grade === 1) return 'bg-emerald-600 text-white';
		if (grade === 2) return 'bg-teal-600 text-white';
		if (grade === 3) return 'bg-blue-600 text-white';
		if (grade === 4) return 'bg-amber-600 text-white';
		if (grade === 5) return 'bg-red-600 text-white';
		return 'bg-slate-800 text-slate-400';
	}
</script>

<svelte:head>
	<title>Meine Noten – UnterrichtsManager</title>
</svelte:head>

<div class="max-w-5xl mx-auto space-y-6">
	{#if !data.student}
		<div class="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-2">
			<GraduationCap class="w-10 h-10 text-slate-500 mx-auto" />
			<h1 class="text-lg font-bold text-white">Kein Schülerprofil verknüpft</h1>
			<p class="text-xs text-slate-400">
				Dein Benutzerkonto ist derzeit noch keinem Schülerprofil zugeordnet. Bitte wende dich an deine Lehrkraft.
			</p>
		</div>
	{:else}
		<!-- Student Header -->
		<div class="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div class="flex items-center space-x-4">
				<div class="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
					<GraduationCap class="w-7 h-7" />
				</div>
				<div>
					<h1 class="text-2xl font-bold text-white">
						{data.student.firstName} {data.student.lastName}
					</h1>
					<p class="text-xs text-slate-400 mt-0.5">
						Klasse <strong class="text-slate-200">{data.student.className}</strong> • Schuljahr {data.student.schoolYearName}
						{#if data.student.catalogNumber != null}
							• Katalognummer {data.student.catalogNumber}
						{/if}
					</p>
				</div>
			</div>
		</div>

		{#if data.courses.length === 0}
			<div class="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center text-xs text-slate-400">
				Für deine Klasse sind noch keine Kurse eingetragen.
			</div>
		{:else}
			<div class="space-y-5">
				{#each data.courses as course}
					<div class="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg space-y-4">
						<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
							<div>
								<h2 class="text-xl font-bold text-white flex items-center space-x-2">
									<BookOpen class="w-5 h-5 text-blue-400" />
									<span>{course.subject}</span>
								</h2>
								{#if course.teacherName}
									<p class="text-xs text-slate-400 mt-0.5">Lehrkraft: {course.teacherName}</p>
								{/if}
							</div>

							{#if course.finalGrades.length > 0}
								<div class="flex items-center space-x-3">
									{#each course.finalGrades as fg}
										<div class="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center space-x-2">
											<span class="text-xs text-slate-400">{fg.semester}. Semester Endnote:</span>
											<span class="w-7 h-7 rounded-lg font-extrabold text-sm flex items-center justify-center {gradeColor(fg.manualGrade)}">
												{fg.manualGrade}
											</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						{#if course.assessments.length === 0}
							<p class="text-xs text-slate-500">Noch keine Schularbeiten oder Tests eingetragen.</p>
						{:else}
							<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
								{#each course.assessments as a}
									<div class="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3">
										<div class="min-w-0">
											<div class="flex items-center space-x-2">
												<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
													{typeLabel(a.type)}
												</span>
												<span class="text-[11px] text-slate-400 font-mono flex items-center space-x-1">
													<Calendar class="w-3 h-3" />
													<span>{a.date}</span>
												</span>
											</div>
											<h3 class="font-bold text-white text-sm mt-1.5 truncate" title={a.title}>
												{a.title}
											</h3>
											<p class="text-xs text-slate-400 font-mono mt-0.5">
												{#if a.isAbsent}
													Abwesend
												{:else if a.points != null}
													{a.points} / {a.maxPoints} Punkte
												{:else}
													Noch nicht beurteilt (Max. {a.maxPoints} Pkt.)
												{/if}
											</p>
										</div>

										<div class="shrink-0">
											{#if a.isAbsent}
												<span class="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-400">
													Abw.
												</span>
											{:else if a.grade != null}
												<div class="text-center">
													<span class="text-[10px] text-slate-400 block mb-0.5">Note</span>
													<span class="w-9 h-9 rounded-xl font-extrabold text-base flex items-center justify-center shadow {gradeColor(a.grade)}">
														{a.grade}
													</span>
												</div>
											{:else}
												<span class="text-xs text-slate-500">–</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
