<script lang="ts">
	import { page } from '$app/state';
	import {
		ArrowLeft,
		BookOpen,
		Award,
		Eye,
		House,
		TriangleAlert,
		SlidersHorizontal,
		Smartphone,
		FileSpreadsheet,
		ChevronDown
	} from '@lucide/svelte';

	import CourseNotenTab from '$lib/components/course/CourseNotenTab.svelte';
	import CourseLessonsTab from '$lib/components/course/CourseLessonsTab.svelte';
	import CourseTestsTab from '$lib/components/course/CourseTestsTab.svelte';
	import CourseObservationsTab from '$lib/components/course/CourseObservationsTab.svelte';
	import CourseHomeworkTab from '$lib/components/course/CourseHomeworkTab.svelte';
	import CourseEarlyWarningsTab from '$lib/components/course/CourseEarlyWarningsTab.svelte';
	import CourseWeightsTab from '$lib/components/course/CourseWeightsTab.svelte';

	interface Props {
		data: {
			course: any;
			activeTab: string;
			evaluatedStudents: Array<any>;
			assessments: Array<any>;
			selectedAssessment: any;
			observations: Array<any>;
			lessons?: Array<any>;
			homeworks: Array<any>;
			earlyWarnings: Array<any>;
			gradingTemplates?: Array<any>;
			defaultReturnDays?: number;
			initialStudentId?: string | null;
		};
	}

	let { data }: Props = $props();

	let showMoreDropdown = $state(false);

	// Primary 4 tabs: Noten & Übersicht, Hausübung, Tests & Schularbeiten, Beobachtungen
	const mainTabs = [
		{ id: 'noten', label: 'Noten & Übersicht', icon: FileSpreadsheet },
		{ id: 'hausuebungen', label: 'Hausübung', icon: House },
		{ id: 'tests', label: 'Tests & Schularbeiten', icon: Award },
		{ id: 'beobachtungen', label: 'Beobachtungen', icon: Eye }
	];

	// Secondary tabs under 'Weiteres'
	const moreTabs = [
		{ id: 'stunden', label: 'Stundeneinträge & Lehrstoff', shortLabel: 'Stunden', icon: BookOpen },
		{ id: 'fruehwarnungen', label: 'Frühwarnungen (§19 SchUG)', shortLabel: 'Frühwarnungen', icon: TriangleAlert },
		{ id: 'gewichtung', label: 'Gewichtung & Notenschlüssel', shortLabel: 'Gewichtung', icon: SlidersHorizontal }
	];

	const isMoreTabActive = $derived(moreTabs.some((t) => t.id === data.activeTab));
	const activeMoreItem = $derived(moreTabs.find((t) => t.id === data.activeTab));
</script>

<svelte:head>
	<title>{data.course.className} {data.course.subject} – UnterrichtsManager</title>
</svelte:head>

<div class="space-y-5">
	<!-- Top Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
		<div class="flex items-center space-x-3">
			<a
				href="/kurse"
				class="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
			>
				<ArrowLeft class="w-5 h-5" />
			</a>
			<div>
				<div class="flex items-center space-x-2">
					<h1 class="text-2xl font-bold text-white">
						{data.course.className} – {data.course.subject}
					</h1>
					<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-800">
						{data.evaluatedStudents.length} Schüler
					</span>
				</div>
				<p class="text-xs text-slate-400 mt-0.5">
					Klasse: <a href="/klassen/{data.course.classId}" class="text-blue-400 hover:underline">{data.course.className}</a>
				</p>
			</div>
		</div>

		<div class="flex items-center space-x-2">
			<a
				href="/stundenansicht?courseId={data.course.id}"
				class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center space-x-1.5"
			>
				<Smartphone class="w-4 h-4" />
				<span>In Stundenansicht öffnen</span>
			</a>
		</div>
	</div>

	<!-- Navigation Tabs -->
	<div class="flex items-center gap-1.5 overflow-x-visible pb-1 scrollbar-none border-b border-slate-800 relative">
		{#each mainTabs as tab}
			{@const Icon = tab.icon}
			<a
				href="/kurse/{data.course.id}?tab={tab.id}"
				class="px-4 py-2.5 rounded-xl text-xs font-semibold transition flex items-center space-x-2 shrink-0 {data.activeTab === tab.id ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-900'}"
			>
				<Icon class="w-4 h-4" />
				<span>{tab.label}</span>
			</a>
		{/each}

		<!-- Dropdown: Weiteres -->
		<div class="relative shrink-0">
			<button
				type="button"
				onclick={() => (showMoreDropdown = !showMoreDropdown)}
				class="px-3.5 py-2.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer {isMoreTabActive ? 'bg-blue-950 text-blue-300 border border-blue-800 shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'}"
			>
				<span>{activeMoreItem ? `Weiteres: ${activeMoreItem.shortLabel}` : 'Weiteres'}</span>
				<ChevronDown class="w-3.5 h-3.5 transition duration-200 {showMoreDropdown ? 'rotate-180' : ''}" />
			</button>

			{#if showMoreDropdown}
				<button
					type="button"
					aria-label="Menü schließen"
					class="fixed inset-0 z-30 bg-transparent border-0 cursor-default"
					onclick={() => (showMoreDropdown = false)}
				></button>

				<div class="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 z-40 w-64 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 space-y-1 backdrop-blur-md">
					<div class="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
						Zusätzliche Bereiche
					</div>
					{#each moreTabs as tab}
						{@const Icon = tab.icon}
						<a
							href="/kurse/{data.course.id}?tab={tab.id}"
							onclick={() => (showMoreDropdown = false)}
							class="w-full px-3 py-2.5 rounded-xl text-xs font-semibold transition flex items-center space-x-2.5 {data.activeTab === tab.id ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-300 hover:text-white hover:bg-slate-800'}"
						>
							<Icon class="w-4 h-4 text-slate-400 {data.activeTab === tab.id ? 'text-white' : ''}" />
							<span>{tab.label}</span>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Tab Content Components -->
	<div>
		{#if data.activeTab === 'noten'}
			<CourseNotenTab course={data.course} students={data.evaluatedStudents} />
		{:else if data.activeTab === 'hausuebungen'}
			<CourseHomeworkTab
				course={data.course}
				homeworks={data.homeworks}
				students={data.evaluatedStudents}
			/>
		{:else if data.activeTab === 'tests'}
			<CourseTestsTab
				course={data.course}
				assessments={data.assessments}
				selectedAssessment={data.selectedAssessment}
				gradingTemplates={data.gradingTemplates || []}
				defaultReturnDays={data.defaultReturnDays ?? 7}
			/>
		{:else if data.activeTab === 'beobachtungen'}
			<CourseObservationsTab course={data.course} observations={data.observations} />
		{:else if data.activeTab === 'stunden'}
			<CourseLessonsTab course={data.course} lessons={data.lessons || []} />
		{:else if data.activeTab === 'fruehwarnungen'}
			<CourseEarlyWarningsTab
				course={data.course}
				students={data.evaluatedStudents}
				earlyWarnings={data.earlyWarnings}
				initialStudentId={data.initialStudentId}
			/>
		{:else if data.activeTab === 'gewichtung'}
			<CourseWeightsTab course={data.course} />
		{/if}
	</div>
</div>
