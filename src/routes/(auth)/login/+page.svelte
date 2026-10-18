<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props<{
		form?: { message?: string; needsTotp?: boolean };
	}>();

	let loading = $state(false);
	let showTotp = $state(false);

	$effect(() => {
		if (form?.needsTotp) {
			showTotp = true;
		}
	});
</script>

<svelte:head>
	<title>Anmelden – UnterrichtsManager</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
	<div class="sm:mx-auto sm:w-full sm:max-w-md text-center">
		<div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/25 mb-4">
			<svg class="w-10 h-10 text-white" viewBox="0 0 512 512" fill="none">
				<path d="M256 120L96 200L256 280L416 200L256 120Z" fill="white" />
				<path d="M146 225V310C146 345 195 375 256 375C317 375 366 345 366 310V225L256 280L146 225Z" fill="#93c5fd" />
			</svg>
		</div>
		<h1 class="text-3xl font-bold tracking-tight text-white">UnterrichtsManager</h1>
		<p class="mt-2 text-sm text-slate-400">Österreichisches Noten- & Aufzeichnungssystem</p>
	</div>

	<div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
		<div class="bg-slate-900 border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
			{#if form?.message}
				<div class="mb-4 p-3 rounded-lg bg-red-950/80 border border-red-800 text-red-200 text-sm">
					{form.message}
				</div>
			{/if}

			<form
				method="POST"
				action="?/login"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						loading = false;
						await update();
					};
				}}
				class="space-y-5"
			>
				<div>
					<label for="username" class="block text-sm font-medium text-slate-300">Benutzername</label>
					<div class="mt-1">
						<input
							id="username"
							name="username"
							type="text"
							required
							autocomplete="username"
							value="lehrer"
							class="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
						/>
					</div>
				</div>

				<div>
					<label for="password" class="block text-sm font-medium text-slate-300">Passwort</label>
					<div class="mt-1">
						<input
							id="password"
							name="password"
							type="password"
							required
							autocomplete="current-password"
							placeholder="••••••••••••"
							class="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
						/>
					</div>
				</div>

				{#if showTotp}
					<div>
						<label for="totpCode" class="block text-sm font-medium text-slate-300">
							2FA-Code (Authenticator App)
						</label>
						<div class="mt-1">
							<input
								id="totpCode"
								name="totpCode"
								type="text"
								inputmode="numeric"
								pattern="[0-9]*"
								maxlength="6"
								placeholder="123456"
								class="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-blue-500 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest text-lg font-mono"
							/>
						</div>
					</div>
				{/if}

				<div>
					<button
						type="submit"
						disabled={loading}
						class="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition active:scale-[0.99]"
					>
						{loading ? 'Wird angemeldet...' : 'Anmelden'}
					</button>
				</div>
			</form>

			<div class="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400 space-y-1">
				<p class="font-medium text-slate-300">Standard-Zugang für den Test:</p>
				<p>Benutzer: <code class="text-blue-400 bg-slate-950 px-1.5 py-0.5 rounded">lehrer</code></p>
				<p>Passwort: <code class="text-blue-400 bg-slate-950 px-1.5 py-0.5 rounded">notenmanager123</code></p>
			</div>
		</div>
	</div>
</div>
