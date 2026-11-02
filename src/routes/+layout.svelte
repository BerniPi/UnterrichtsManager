<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import {
		LayoutDashboard,
		Smartphone,
		Users,
		BookOpen,
		Settings,
		LogOut,
		Bell,
		GraduationCap,
		House,
		Award,
		Eye,
		ChevronDown
	} from '@lucide/svelte';

	interface Props {
		data: {
			user: any;
			currentSchoolYear?: any;
			coursesList?: Array<any>;
			totalOverdueCount?: number;
		};
		children: any;
	}

	let { data, children }: Props = $props();

	const currentPath = $derived(page.url.pathname);
	const currentTab = $derived(page.url.searchParams.get('tab'));
	const isAuthPage = $derived(currentPath.startsWith('/login'));

	const activeCourseId = $derived(
		currentPath.startsWith('/kurse/') ? currentPath.split('/')[2] : null
	);

	const defaultCourseId = $derived(
		activeCourseId || data.coursesList?.[0]?.id || ''
	);

	let openDropdown = $state<'hw' | 'tests' | 'obs' | null>(null);
</script>

{#if isAuthPage}
	{@render children()}
{:else}
	<div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
		<!-- Desktop & Tablet Top Navigation Header -->
		<header class="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
				<div class="flex items-center space-x-4 lg:space-x-6 min-w-0">
					<a href="/" class="flex items-center space-x-3 group shrink-0">
						<div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-500 transition">
							<GraduationCap class="w-6 h-6" />
						</div>
						<div class="hidden xl:block">
							<span class="text-base font-bold tracking-tight text-white block leading-tight">UnterrichtsManager</span>
							<span class="text-[11px] text-slate-400 font-medium">
								{data.currentSchoolYear ? `Schuljahr ${data.currentSchoolYear.name}` : 'Österreich'}
							</span>
						</div>
					</a>

					<!-- Desktop Nav Links -->
					<nav class="hidden md:flex items-center space-x-1 overflow-x-visible">
						<!-- Dashboard -->
						<a
							href="/"
							class="px-2.5 py-2 rounded-lg text-xs lg:text-sm font-medium transition flex items-center space-x-1.5 shrink-0 {currentPath === '/' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}"
						>
							<LayoutDashboard class="w-4 h-4" />
							<span class="hidden lg:inline">Dashboard</span>
						</a>

						<!-- Stundenansicht (Live Unterricht) -->
						<a
							href="/stundenansicht"
							class="px-2.5 py-2 rounded-lg text-xs lg:text-sm font-medium transition flex items-center space-x-1.5 shrink-0 {currentPath.startsWith('/stundenansicht') ? 'bg-blue-600 text-white' : 'text-blue-400 hover:text-blue-300 hover:bg-slate-800/50'}"
							title="Stundenansicht (Live Unterricht)"
						>
							<Smartphone class="w-4 h-4" />
							<span>Unterricht</span>
						</a>

						<div class="h-4 w-px bg-slate-800 mx-1 shrink-0"></div>

						<!-- Hauptpunkt: Hausübung -->
						<div class="relative shrink-0">
							<div class="flex items-center rounded-lg transition {currentTab === 'hausuebungen' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}">
								<a
									href={defaultCourseId ? `/kurse/${defaultCourseId}?tab=hausuebungen` : '/kurse'}
									class="px-2.5 py-2 text-xs lg:text-sm font-medium flex items-center space-x-1.5"
								>
									<House class="w-4 h-4 text-emerald-400 {currentTab === 'hausuebungen' ? 'text-white' : ''}" />
									<span>Hausübung</span>
								</a>
								{#if (data.coursesList?.length ?? 0) > 1}
									<button
										type="button"
										onclick={(e) => {
											e.stopPropagation();
											openDropdown = openDropdown === 'hw' ? null : 'hw';
										}}
										class="pr-2 py-2 text-slate-400 hover:text-white transition cursor-pointer"
										title="Kurs für Hausübung wählen"
									>
										<ChevronDown class="w-3.5 h-3.5" />
									</button>
								{/if}
							</div>

							{#if openDropdown === 'hw' && (data.coursesList?.length ?? 0) > 1}
								<button
									type="button"
									aria-label="Menü schließen"
									class="fixed inset-0 z-40 bg-transparent border-0 cursor-default"
									onclick={() => (openDropdown = null)}
								></button>
								<div class="absolute left-0 top-full mt-1.5 z-50 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 space-y-1">
									<div class="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
										Hausübungen für Kurs:
									</div>
									{#each data.coursesList || [] as c}
										<a
											href="/kurse/{c.id}?tab=hausuebungen"
											onclick={() => (openDropdown = null)}
											class="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between text-slate-300 hover:text-white hover:bg-slate-800 transition {activeCourseId === c.id && currentTab === 'hausuebungen' ? 'bg-blue-600 text-white' : ''}"
										>
											<span>{c.className} – {c.subject}</span>
										</a>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Hauptpunkt: Tests & Schularbeiten -->
						<div class="relative shrink-0">
							<div class="flex items-center rounded-lg transition {currentTab === 'tests' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}">
								<a
									href={defaultCourseId ? `/kurse/${defaultCourseId}?tab=tests` : '/kurse'}
									class="px-2.5 py-2 text-xs lg:text-sm font-medium flex items-center space-x-1.5"
								>
									<Award class="w-4 h-4 text-amber-400 {currentTab === 'tests' ? 'text-white' : ''}" />
									<span>Tests & Schularbeiten</span>
								</a>
								{#if (data.coursesList?.length ?? 0) > 1}
									<button
										type="button"
										onclick={(e) => {
											e.stopPropagation();
											openDropdown = openDropdown === 'tests' ? null : 'tests';
										}}
										class="pr-2 py-2 text-slate-400 hover:text-white transition cursor-pointer"
										title="Kurs für Tests wählen"
									>
										<ChevronDown class="w-3.5 h-3.5" />
									</button>
								{/if}
							</div>

							{#if openDropdown === 'tests' && (data.coursesList?.length ?? 0) > 1}
								<button
									type="button"
									aria-label="Menü schließen"
									class="fixed inset-0 z-40 bg-transparent border-0 cursor-default"
									onclick={() => (openDropdown = null)}
								></button>
								<div class="absolute left-0 top-full mt-1.5 z-50 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 space-y-1">
									<div class="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
										Tests & Schularbeiten für Kurs:
									</div>
									{#each data.coursesList || [] as c}
										<a
											href="/kurse/{c.id}?tab=tests"
											onclick={() => (openDropdown = null)}
											class="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between text-slate-300 hover:text-white hover:bg-slate-800 transition {activeCourseId === c.id && currentTab === 'tests' ? 'bg-blue-600 text-white' : ''}"
										>
											<span>{c.className} – {c.subject}</span>
										</a>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Hauptpunkt: Beobachtungen -->
						<div class="relative shrink-0">
							<div class="flex items-center rounded-lg transition {currentTab === 'beobachtungen' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}">
								<a
									href={defaultCourseId ? `/kurse/${defaultCourseId}?tab=beobachtungen` : '/kurse'}
									class="px-2.5 py-2 text-xs lg:text-sm font-medium flex items-center space-x-1.5"
								>
									<Eye class="w-4 h-4 text-sky-400 {currentTab === 'beobachtungen' ? 'text-white' : ''}" />
									<span>Beobachtungen</span>
								</a>
								{#if (data.coursesList?.length ?? 0) > 1}
									<button
										type="button"
										onclick={(e) => {
											e.stopPropagation();
											openDropdown = openDropdown === 'obs' ? null : 'obs';
										}}
										class="pr-2 py-2 text-slate-400 hover:text-white transition cursor-pointer"
										title="Kurs für Beobachtungen wählen"
									>
										<ChevronDown class="w-3.5 h-3.5" />
									</button>
								{/if}
							</div>

							{#if openDropdown === 'obs' && (data.coursesList?.length ?? 0) > 1}
								<button
									type="button"
									aria-label="Menü schließen"
									class="fixed inset-0 z-40 bg-transparent border-0 cursor-default"
									onclick={() => (openDropdown = null)}
								></button>
								<div class="absolute left-0 top-full mt-1.5 z-50 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 space-y-1">
									<div class="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
										Beobachtungen für Kurs:
									</div>
									{#each data.coursesList || [] as c}
										<a
											href="/kurse/{c.id}?tab=beobachtungen"
											onclick={() => (openDropdown = null)}
											class="w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between text-slate-300 hover:text-white hover:bg-slate-800 transition {activeCourseId === c.id && currentTab === 'beobachtungen' ? 'bg-blue-600 text-white' : ''}"
										>
											<span>{c.className} – {c.subject}</span>
										</a>
									{/each}
								</div>
							{/if}
						</div>

						<div class="h-4 w-px bg-slate-800 mx-1 shrink-0"></div>

						<!-- Kurse & Noten -->
						<a
							href="/kurse"
							class="px-2.5 py-2 rounded-lg text-xs lg:text-sm font-medium transition flex items-center space-x-1.5 shrink-0 {currentPath.startsWith('/kurse') && (!currentTab || currentTab === 'noten' || !['hausuebungen', 'tests', 'beobachtungen'].includes(currentTab)) ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}"
						>
							<BookOpen class="w-4 h-4" />
							<span>Kurse</span>
						</a>

						<!-- Klassen & Import -->
						<a
							href="/klassen"
							class="px-2.5 py-2 rounded-lg text-xs lg:text-sm font-medium transition flex items-center space-x-1.5 shrink-0 {currentPath.startsWith('/klassen') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}"
						>
							<Users class="w-4 h-4" />
							<span class="hidden xl:inline">Klassen & Import</span>
							<span class="xl:hidden">Klassen</span>
						</a>

						<!-- Einstellungen -->
						<a
							href="/einstellungen"
							class="px-2 py-2 rounded-lg text-xs lg:text-sm font-medium transition flex items-center space-x-1 shrink-0 {currentPath.startsWith('/einstellungen') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}"
							title="Einstellungen"
						>
							<Settings class="w-4 h-4" />
						</a>
					</nav>
				</div>

				<!-- Right Actions -->
				<div class="flex items-center space-x-3 shrink-0">
					{#if (data.totalOverdueCount ?? 0) > 0}
						<a
							href="/#overdue-section"
							class="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-red-950/80 border border-red-800 text-red-300 hover:bg-red-900/80 transition text-xs font-semibold animate-pulse"
							title="{data.totalOverdueCount} überfällige Unterschrift(en)"
						>
							<Bell class="w-3.5 h-3.5 text-red-400" />
							<span>{data.totalOverdueCount} überfällig</span>
						</a>
					{/if}

					<div class="hidden sm:flex items-center pl-2 border-l border-slate-800 space-x-2 text-sm text-slate-300">
						<span class="font-medium">{data.user?.username}</span>
					</div>

					<form action="/login?/logout" method="POST" use:enhance>
						<button
							type="submit"
							class="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition cursor-pointer"
							title="Abmelden"
						>
							<LogOut class="w-5 h-5" />
						</button>
					</form>
				</div>
			</div>
		</header>

		<!-- Main Content Area with bottom padding for mobile bar -->
		<main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-10">
			{@render children()}
		</main>

		<!-- Mobile Fixed Bottom Navigation Bar -->
		<nav class="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur border-t border-slate-800 px-2 py-1 flex items-center justify-around safe-bottom">
			<a
				href="/"
				class="flex flex-col items-center py-1.5 px-3 rounded-xl text-xs font-medium transition {currentPath === '/' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}"
			>
				<LayoutDashboard class="w-5 h-5 mb-0.5" />
				<span>Dashboard</span>
			</a>

			<a
				href="/kurse"
				class="flex flex-col items-center py-1.5 px-3 rounded-xl text-xs font-medium transition {currentPath.startsWith('/kurse') ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}"
			>
				<BookOpen class="w-5 h-5 mb-0.5" />
				<span>Kurse</span>
			</a>

			<!-- Center Big Button: Stundenansicht -->
			<a
				href="/stundenansicht"
				class="flex flex-col items-center -mt-4 py-2 px-3 rounded-2xl bg-blue-600 text-white font-semibold text-xs shadow-lg shadow-blue-500/30 active:scale-95 transition"
			>
				<Smartphone class="w-6 h-6 mb-0.5" />
				<span>Unterricht</span>
			</a>

			<a
				href="/klassen"
				class="flex flex-col items-center py-1.5 px-3 rounded-xl text-xs font-medium transition {currentPath.startsWith('/klassen') ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}"
			>
				<Users class="w-5 h-5 mb-0.5" />
				<span>Klassen</span>
			</a>

			<a
				href="/einstellungen"
				class="flex flex-col items-center py-1.5 px-3 rounded-xl text-xs font-medium transition {currentPath.startsWith('/einstellungen') ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}"
			>
				<Settings class="w-5 h-5 mb-0.5" />
				<span>Setup</span>
			</a>
		</nav>
	</div>
{/if}
