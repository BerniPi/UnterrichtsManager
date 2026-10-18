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
		GraduationCap
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
	const isAuthPage = $derived(currentPath.startsWith('/login'));
</script>

{#if isAuthPage}
	{@render children()}
{:else}
	<div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
		<!-- Desktop & Tablet Top Navigation Header -->
		<header class="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
				<div class="flex items-center space-x-6">
					<a href="/" class="flex items-center space-x-3 group">
						<div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-500 transition">
							<GraduationCap class="w-6 h-6" />
						</div>
						<div>
							<span class="text-lg font-bold tracking-tight text-white block leading-tight">UnterrichtsManager</span>
							<span class="text-xs text-slate-400 font-medium">
								{data.currentSchoolYear ? `Schuljahr ${data.currentSchoolYear.name}` : 'Österreich'}
							</span>
						</div>
					</a>

					<!-- Desktop Nav Links -->
					<nav class="hidden md:flex items-center space-x-1 pl-4">
						<a
							href="/"
							class="px-3 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 {currentPath === '/' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}"
						>
							<LayoutDashboard class="w-4 h-4" />
							<span>Dashboard</span>
						</a>

						<a
							href="/stundenansicht"
							class="px-3 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 {currentPath.startsWith('/stundenansicht') ? 'bg-blue-600 text-white' : 'text-blue-400 hover:text-blue-300 hover:bg-slate-800/50'}"
						>
							<Smartphone class="w-4 h-4" />
							<span>Stundenansicht (Mobil)</span>
						</a>

						<a
							href="/klassen"
							class="px-3 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 {currentPath.startsWith('/klassen') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}"
						>
							<Users class="w-4 h-4" />
							<span>Klassen & Import</span>
						</a>

						<a
							href="/kurse"
							class="px-3 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 {currentPath.startsWith('/kurse') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}"
						>
							<BookOpen class="w-4 h-4" />
							<span>Kurse & Noten</span>
						</a>

						<a
							href="/einstellungen"
							class="px-3 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 {currentPath.startsWith('/einstellungen') ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}"
						>
							<Settings class="w-4 h-4" />
							<span>Einstellungen</span>
						</a>
					</nav>
				</div>

				<!-- Right Actions -->
				<div class="flex items-center space-x-3">
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
							class="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
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
				href="/klassen"
				class="flex flex-col items-center py-1.5 px-3 rounded-xl text-xs font-medium transition {currentPath.startsWith('/klassen') ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}"
			>
				<Users class="w-5 h-5 mb-0.5" />
				<span>Klassen</span>
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
				href="/kurse"
				class="flex flex-col items-center py-1.5 px-3 rounded-xl text-xs font-medium transition {currentPath.startsWith('/kurse') ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}"
			>
				<BookOpen class="w-5 h-5 mb-0.5" />
				<span>Kurse</span>
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
