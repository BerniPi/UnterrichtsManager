<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Settings,
		ShieldCheck,
		Bell,
		Database,
		KeyRound,
		RotateCcw,
		Download,
		UploadCloud,
		CheckCircle2,
		AlertTriangle,
		AlertCircle,
		Link2
	} from '@lucide/svelte';
	import GradingTemplatesManager from '$lib/components/assessments/GradingTemplatesManager.svelte';

	interface Props {
		data: {
			username: string;
			isAdmin?: boolean;
			totpEnabled: boolean;
			teacherName: string;
			defaultReturnDays: number;
			earlyWarningThreshold: number;
			emailSummaryEnabled: boolean;
			pushSubscriptionsCount: number;
			gradingTemplates: Array<any>;
			bgbb: { apiUrl: string; apiKeySet: boolean; fromEnv: boolean };
			entra: { tenantId: string; clientId: string; clientSecretSet: boolean; fromEnv: boolean; enabled: boolean };
		};
		form?: any;
	}

	let { data, form }: Props = $props();

	let pushRegistered = $state(false);
	let pushError = $state<string | null>(null);

	async function registerWebPush() {
		pushError = null;
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
			pushError = 'Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.';
			return;
		}

		try {
			const reg = await navigator.serviceWorker.ready;
			const res = await fetch('/api/push/public-key');
			const { publicKey } = await res.json();

			const convertedVapidKey = urlBase64ToUint8Array(publicKey);
			const subscription = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: convertedVapidKey
			});

			const subRes = await fetch('/api/push/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(subscription)
			});

			if (subRes.ok) {
				pushRegistered = true;
			}
		} catch (err: any) {
			pushError = err.message || 'Fehler beim Registrieren für Push.';
		}
	}

	function urlBase64ToUint8Array(base64String: string) {
		const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
		const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
		const rawData = window.atob(base64);
		const outputArray = new Uint8Array(rawData.length);
		for (let i = 0; i < rawData.length; ++i) {
			outputArray[i] = rawData.charCodeAt(i);
		}
		return outputArray;
	}
</script>

<svelte:head>
	<title>Einstellungen & Backup – UnterrichtsManager</title>
</svelte:head>

<div class="max-w-4xl mx-auto space-y-6">
	<!-- Header -->
	<div class="pb-3 border-b border-slate-800">
		<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-white">Systemeinstellungen</h1>
		<p class="text-slate-400 text-sm mt-0.5">
			Konfiguration von Fristen, 2FA-Authentifizierung, Push-Benachrichtigungen und Datenbank-Backups
		</p>
	</div>

	{#if form?.message || form?.passwordSuccess || form?.totpEnabledSuccess || form?.resetSuccess}
		<div class="p-3 bg-emerald-950/90 border border-emerald-800 text-emerald-200 text-xs rounded-xl flex items-center space-x-2">
			<CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
			<span>{form.message || form.passwordSuccess || form.totpEnabledSuccess || form.resetSuccess}</span>
		</div>
	{/if}

	{#if form?.resetError || form?.passwordError || form?.totpError || form?.templateError}
		<div class="p-3 bg-red-950/90 border border-red-800 text-red-200 text-xs rounded-xl flex items-center space-x-2">
			<AlertTriangle class="w-4 h-4 text-red-400 shrink-0" />
			<span>{form.resetError || form.passwordError || form.totpError || form.templateError}</span>
		</div>
	{/if}

	<!-- Section 1: Teacher & Deadlines Settings -->
	<div class="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm space-y-4">
		<h2 class="text-base font-bold text-white flex items-center space-x-2">
			<Settings class="w-5 h-5 text-blue-400" />
			<span>Allgemeine Parameter & Fristen</span>
		</h2>

		<form action="?/updateSettings" method="POST" use:enhance class="space-y-4">
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div>
					<label for="tName" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Name der Lehrkraft
					</label>
					<input
						id="tName"
						type="text"
						name="teacherName"
						value={data.teacherName}
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="defDays" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Standard-Rückgabefrist für Unterschriften (Tage)
					</label>
					<input
						id="defDays"
						type="number"
						name="defaultReturnDays"
						value={data.defaultReturnDays}
						min="1"
						max="30"
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500 font-bold"
					/>
				</div>

				<div>
					<label for="ewThresh" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Frühwarnungs-Vorschlagsschwelle (Notenschnitt)
					</label>
					<input
						id="ewThresh"
						type="number"
						step="0.1"
						name="earlyWarningThreshold"
						value={data.earlyWarningThreshold}
						min="3.0"
						max="5.0"
						class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500 font-bold"
					/>
				</div>

				<div class="flex items-center space-x-3 pt-6">
					<input
						id="emailSummary"
						type="checkbox"
						name="emailSummaryEnabled"
						checked={data.emailSummaryEnabled}
						class="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700 focus:ring-blue-500"
					/>
					<label for="emailSummary" class="text-xs text-slate-300 font-medium">
						Wöchentliche Fristen-Zusammenfassung per E-Mail aktivieren
					</label>
				</div>
			</div>

			<div class="flex justify-end pt-2">
				<button
					type="submit"
					class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition"
				>
					Einstellungen speichern
				</button>
			</div>
		</form>
	</div>

	{#if data.isAdmin}
		<!-- Section: Anbindung BGBB Admin (Schülerimport) -->
		<div class="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm space-y-4">
			<h2 class="text-base font-bold text-white flex items-center space-x-2">
				<Link2 class="w-5 h-5 text-blue-400" />
				<span>Anbindung BGBB Admin (Schülerimport)</span>
			</h2>

			<p class="text-xs text-slate-400">
				Schülerlisten können unter „Klassen“ direkt aus BGBB Admin übernommen werden. Dafür in BGBB Admin einen API-Key mit
				Leserecht („read“) anlegen und hier eintragen. Übernommen werden nur Vorname, Familienname und SchKz.
			</p>

			{#if form?.bgbbError}
				<div class="p-3 bg-red-950/90 border border-red-800 text-red-200 text-xs rounded-xl flex items-center space-x-2">
					<AlertTriangle class="w-4 h-4 text-red-400 shrink-0" />
					<span>{form.bgbbError}</span>
				</div>
			{:else if form?.bgbbMessage}
				<div class="p-3 bg-emerald-950/90 border border-emerald-800 text-emerald-200 text-xs rounded-xl flex items-center space-x-2">
					<CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
					<span>{form.bgbbMessage}</span>
				</div>
			{/if}

			{#if data.bgbb.fromEnv}
				<p class="text-xs text-slate-300">
					Eingerichtet über Umgebungsvariablen (<code>BGBB_API_URL</code>, <code>BGBB_API_KEY</code>): <strong>{data.bgbb.apiUrl}</strong>
				</p>
			{:else}
				<form action="?/updateBgbbSettings" method="POST" use:enhance={() => async ({ update }) => update({ reset: false })} class="space-y-4">
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label for="bgbbUrl" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
								Adresse von BGBB Admin
							</label>
							<input
								id="bgbbUrl"
								type="url"
								name="bgbbApiUrl"
								value={data.bgbb.apiUrl}
								placeholder="https://admin.example.at"
								class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
							/>
						</div>
						<div>
							<label for="bgbbKey" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
								API-Key
							</label>
							<input
								id="bgbbKey"
								type="password"
								name="bgbbApiKey"
								autocomplete="off"
								placeholder={data.bgbb.apiKeySet ? 'gespeichert – leer lassen zum Beibehalten' : 'API-Key aus BGBB Admin'}
								class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
							/>
						</div>
					</div>

					<div class="flex justify-end">
						<button
							type="submit"
							class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition"
						>
							Anbindung speichern
						</button>
					</div>
				</form>
			{/if}

			{#if data.bgbb.apiUrl && data.bgbb.apiKeySet}
				<form action="?/testBgbbConnection" method="POST" use:enhance class="flex justify-end">
					<button
						type="submit"
						class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
					>
						Verbindung testen
					</button>
				</form>
			{/if}
		</div>

		<!-- Section: Microsoft 365 / Entra ID Single Sign-On -->
		<div class="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm space-y-4">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h2 class="text-base font-bold text-white flex items-center space-x-2">
					<svg class="w-5 h-5 flex-shrink-0" viewBox="0 0 21 21" fill="none">
						<rect x="1" y="1" width="9" height="9" fill="#f25022" />
						<rect x="11" y="1" width="9" height="9" fill="#7fba00" />
						<rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
						<rect x="11" y="11" width="9" height="9" fill="#ffb900" />
					</svg>
					<span>Microsoft 365 / Entra ID (Single Sign-On)</span>
				</h2>
				{#if data.entra.enabled}
					<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
						Aktiviert
					</span>
				{:else}
					<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
						Nicht eingerichtet
					</span>
				{/if}
			</div>

			<p class="text-xs text-slate-400 leading-relaxed">
				Ermöglicht Lehrkräften und Schüler:innen die Anmeldung über ihr Microsoft-365-Konto.
				Lehrer werden über ihre E-Mail-Adresse abgeglichen; Schüler:innen werden automatisch anhand der BGBB-Klassenstammdaten erkannt.
			</p>

			<div class="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1 font-mono">
				<div class="text-[11px] text-slate-400 font-sans font-medium">Redirect-URI für das Entra ID / Azure Portal:</div>
				<div class="text-blue-400 select-all">/auth/microsoft/callback</div>
			</div>

			{#if form?.entraError}
				<div class="p-3 rounded-xl bg-red-950 border border-red-800 text-red-200 text-xs flex items-center space-x-2">
					<AlertCircle class="w-4 h-4 flex-shrink-0" />
					<span>{form.entraError}</span>
				</div>
			{:else if form?.entraUpdated}
				<div class="p-3 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-200 text-xs flex items-center space-x-2">
					<CheckCircle2 class="w-4 h-4 flex-shrink-0" />
					<span>Microsoft-365-Einstellungen erfolgreich gespeichert!</span>
				</div>
			{/if}

			{#if data.entra.fromEnv}
				<div class="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
					Eingerichtet über Umgebungsvariablen (<code>ENTRA_TENANT_ID</code>, <code>ENTRA_CLIENT_ID</code>, <code>ENTRA_CLIENT_SECRET</code>).
				</div>
			{:else}
				<form action="?/updateEntraSettings" method="POST" use:enhance class="space-y-4">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label for="entraTenant" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
								Tenant-ID (Mandant)
							</label>
							<input
								id="entraTenant"
								name="tenantId"
								type="text"
								value={data.entra.tenantId}
								placeholder="z.B. UUID oder bgblumenstrasse.at"
								class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono"
							/>
						</div>

						<div>
							<label for="entraClient" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
								Client-ID (Anwendungs-ID)
							</label>
							<input
								id="entraClient"
								name="clientId"
								type="text"
								value={data.entra.clientId}
								placeholder="Anwendungs-ID aus Azure Portal"
								class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono"
							/>
						</div>
					</div>

					<div>
						<label for="entraSecret" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Client-Secret (Geheimer Clientschlüssel)
						</label>
						<input
							id="entraSecret"
							name="clientSecret"
							type="password"
							placeholder={data.entra.clientSecretSet ? 'gespeichert – leer lassen zum Beibehalten' : 'Geheimes Passwort / Secret aus Azure Portal'}
							class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono"
						/>
					</div>

					<div class="flex justify-end pt-2">
						<button
							type="submit"
							class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition"
						>
							Microsoft-Zugangsdaten speichern
						</button>
					</div>
				</form>
			{/if}
		</div>
	{/if}

	<!-- Section 2: Notenschlüssel-Vorlagen (Grading Scale Templates Editor) -->
	<GradingTemplatesManager templates={data.gradingTemplates} {form} />

	<!-- Section 3: Security & TOTP 2FA -->
	<div class="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm space-y-4">
		<h2 class="text-base font-bold text-white flex items-center space-x-2">
			<ShieldCheck class="w-5 h-5 text-emerald-400" />
			<span>Passwort & Zwei-Faktor-Authentifizierung (2FA)</span>
		</h2>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<!-- Password Change -->
			<form action="?/changePassword" method="POST" use:enhance class="space-y-3">
				<h3 class="text-xs font-bold uppercase tracking-wider text-slate-300">Passwort ändern (Argon2)</h3>
				{#if form?.passwordError}
					<p class="text-xs text-red-400">{form.passwordError}</p>
				{/if}

				<div>
					<label for="cPass" class="block text-[11px] text-slate-400 mb-0.5">Aktuelles Passwort</label>
					<input
						id="cPass"
						name="currentPassword"
						type="password"
						required
						class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
					/>
				</div>

				<div>
					<label for="nPass" class="block text-[11px] text-slate-400 mb-0.5">Neues Passwort</label>
					<input
						id="nPass"
						name="newPassword"
						type="password"
						required
						class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
					/>
				</div>

				<button
					type="submit"
					class="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
				>
					Passwort aktualisieren
				</button>
			</form>

			<!-- 2FA TOTP -->
			<div class="space-y-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
				<div class="flex items-center justify-between">
					<h3 class="text-xs font-bold uppercase tracking-wider text-slate-300">Authenticator App (TOTP)</h3>
					<span class="px-2 py-0.5 rounded text-[10px] font-bold {data.totpEnabled ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'}">
						{data.totpEnabled ? 'Aktiviert ✓' : 'Inaktiv'}
					</span>
				</div>

				<p class="text-xs text-slate-400">
					Zusätzlicher Schutz per Google Authenticator, 1Password oder Ente Auth beim Anmelden.
				</p>

				{#if data.totpEnabled}
					<form action="?/disableTotp" method="POST" use:enhance>
						<button
							type="submit"
							class="py-2 px-3 rounded-lg bg-red-950 text-red-300 hover:bg-red-900 border border-red-800 text-xs font-semibold w-full"
						>
							2FA deaktivieren
						</button>
					</form>
				{:else if form?.totpSetup}
					<div class="space-y-3 pt-2">
						<div class="p-2.5 bg-slate-900 rounded-lg text-xs font-mono text-center break-all select-all border border-slate-700 text-blue-300">
							{form.secret}
						</div>
						<p class="text-[11px] text-slate-400">
							Trage diesen geheimen Schlüssel in deine Authenticator App ein und gib den erzeugten Code ein:
						</p>

						<form action="?/enableTotp" method="POST" use:enhance class="flex items-center space-x-2">
							<input
								type="text"
								name="code"
								placeholder="123456"
								maxlength="6"
								required
								class="w-28 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-center text-sm font-bold"
							/>
							<button
								type="submit"
								class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
							>
								Aktivieren
							</button>
						</form>
					</div>
				{:else}
					<form action="?/setupTotp" method="POST" use:enhance>
						<button
							type="submit"
							class="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20"
						>
							2FA jetzt einrichten
						</button>
					</form>
				{/if}
			</div>
		</div>
	</div>

	<!-- Section 3: Web Push Subscriptions -->
	<div class="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm space-y-4">
		<h2 class="text-base font-bold text-white flex items-center space-x-2">
			<Bell class="w-5 h-5 text-blue-400" />
			<span>PWA Web-Push Benachrichtigungen</span>
		</h2>

		<p class="text-xs text-slate-400">
			Erhalte morgens oder vor Schulstunden direkte Push-Mitteilungen auf deinem Tablet oder Smartphone, sobald Tests oder Frühwarnungen überfällig sind.
		</p>

		{#if pushError}
			<p class="text-xs text-red-400">{pushError}</p>
		{/if}

		<div class="flex items-center justify-between pt-1">
			<span class="text-xs text-slate-300">
				Aktive Geräte-Registrierungen: <strong>{data.pushSubscriptionsCount}</strong>
			</span>

			<button
				type="button"
				onclick={registerWebPush}
				class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition"
			>
				{pushRegistered ? 'Dieses Gerät ist registriert ✓' : 'Auf diesem Gerät Push aktivieren'}
			</button>
		</div>
	</div>

	{#if data.isAdmin}
		<!-- Section 4: Full Database Backup & Restore -->
		<div class="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm space-y-4">
			<h2 class="text-base font-bold text-white flex items-center space-x-2">
				<Database class="w-5 h-5 text-purple-400" />
				<span>Datenbank-Sicherung & Wiederherstellung (SQLite)</span>
			</h2>

			<p class="text-xs text-slate-400">
				Da alle Noten, Schüler und Aufzeichnungen in einer einzigen SQLite-Datei gespeichert sind, ist das Backup 100% vollständig und portabel.
			</p>

			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
				<!-- Backup Download -->
				<div class="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
					<div>
						<h3 class="font-bold text-white text-sm">Vollständiges Backup herunterladen</h3>
						<p class="text-xs text-slate-400 mt-1">
							Lädt die aktuelle SQLite-Datenbankdatei direkt auf deinen Rechner herunter.
						</p>
					</div>
					<a
						href="/api/backup/download"
						download
						class="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 shadow-md shadow-purple-500/20 active:scale-95 transition"
					>
						<Download class="w-4 h-4" />
						<span>Datenbank-Snapshot (.sqlite)</span>
					</a>
				</div>

				<!-- Backup Restore Upload -->
				<div class="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
					<div>
						<h3 class="font-bold text-white text-sm">Backup wiederherstellen</h3>
						<p class="text-xs text-slate-400 mt-1">
							Spielt eine vorhandene SQLite-Sicherungsdatei ein.
						</p>
					</div>

					<form
						action="/api/backup/upload"
						method="POST"
						enctype="multipart/form-data"
						class="flex items-center space-x-2"
					>
						<input
							type="file"
							name="backupFile"
							required
							accept=".sqlite,.db"
							class="text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-white"
						/>
						<button
							type="submit"
							class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 shrink-0"
						>
							Einspielen
						</button>
					</form>
				</div>
			</div>
		</div>

		<!-- Section 5: Fictional Demo Data Reset -->
		<div class="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div>
				<h2 class="text-sm font-bold text-white">Testdaten zurücksetzen (Fiktive Schüler)</h2>
				<p class="text-xs text-slate-400 mt-0.5">
					Setzt die Datenbank auf die fiktiven Testdaten (Max Mustermann, Sophie Weber etc.) zurück.
				</p>
			</div>

			<form action="?/resetFictionalData" method="POST" use:enhance>
				<button
					type="submit"
					class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold border border-slate-700 flex items-center space-x-1.5 transition"
				>
					<RotateCcw class="w-4 h-4" />
					<span>Auf Testdaten zurücksetzen</span>
				</button>
			</form>
		</div>
	{/if}
</div>
