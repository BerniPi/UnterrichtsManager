<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Plus,
		UploadCloud,
		Users,
		FileSpreadsheet,
		ChevronRight,
		CheckCircle2,
		AlertCircle,
		ArrowRight,
		X,
		School
	} from '@lucide/svelte';

	let { data, form } = $props<{
		data: {
			activeSchoolYear: any;
			classes: Array<{
				id: string;
				name: string;
				room: string | null;
				active_student_count: number;
				inactive_student_count: number;
			}>;
		};
		form?: any;
	}>();

	let showCreateModal = $state(false);
	let showImportModal = $state(false);
	let selectedClassId = $state('');

	// Column mapping state
	let firstNameCol = $state('');
	let lastNameCol = $state('');
	let idCol = $state('');
	let catCol = $state('');
	let step = $state<1 | 2>(1); // 1 = Upload, 2 = Mapping/Preview

	$effect(() => {
		if (form?.parsed && form.suggestedMapping) {
			firstNameCol = form.suggestedMapping.firstNameCol || '';
			lastNameCol = form.suggestedMapping.lastNameCol || '';
			idCol = form.suggestedMapping.idCol || '';
			catCol = form.suggestedMapping.catCol || '';
			step = 2;
		}
		if (form?.imported) {
			showImportModal = false;
			step = 1;
		}
	});

	function prepareMappedStudents() {
		if (!form?.allRows) return [];
		return form.allRows.map((row: any) => ({
			firstName: String(row[firstNameCol] || '').trim(),
			lastName: String(row[lastNameCol] || '').trim(),
			webuntisId: idCol ? String(row[idCol] || '').trim() : undefined,
			catalogNumber: catCol && !isNaN(parseInt(row[catCol], 10)) ? parseInt(row[catCol], 10) : undefined
		}));
	}
</script>

<svelte:head>
	<title>Klassen & Import – UnterrichtsManager</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
		<div>
			<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-white">Klassen & Schülerimport</h1>
			<p class="text-slate-400 text-sm mt-0.5">
				Klassenverwaltung und Schülerabgleich mit WebUntis-Exporten (CSV / Excel)
			</p>
		</div>

		<div class="flex items-center space-x-3">
			<button
				type="button"
				onclick={() => (showCreateModal = true)}
				class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-sm border border-slate-700 transition flex items-center space-x-2"
			>
				<Plus class="w-4 h-4" />
				<span>Neue Klasse</span>
			</button>

			<button
				type="button"
				onclick={() => {
					selectedClassId = data.classes[0]?.id || '';
					step = 1;
					showImportModal = true;
				}}
				class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center space-x-2"
			>
				<UploadCloud class="w-4 h-4" />
				<span>WebUntis Import</span>
			</button>
		</div>
	</div>

	<!-- Success toast if imported -->
	{#if form?.imported}
		<div class="p-4 bg-emerald-950/90 border border-emerald-800 text-emerald-200 rounded-2xl flex items-start space-x-3 shadow-lg">
			<CheckCircle2 class="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
			<div>
				<h4 class="font-bold text-white">Import erfolgreich abgeschlossen!</h4>
				<p class="text-xs text-emerald-300 mt-1">
					{form.stats.added} neu hinzugefügt, {form.stats.updated} aktualisiert, {form.stats.reactivated} reaktiviert, {form.stats.left} als ausgetreten markiert, {form.stats.unchanged} unverändert.
				</p>
			</div>
		</div>
	{/if}

	<!-- Classes Grid -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
		{#each data.classes as cls}
			<div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-4 shadow-lg group">
				<div class="flex items-start justify-between">
					<div class="flex items-center space-x-3">
						<div class="w-12 h-12 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-lg">
							{cls.name}
						</div>
						<div>
							<h3 class="text-lg font-bold text-white group-hover:text-blue-400 transition">Klasse {cls.name}</h3>
							<p class="text-xs text-slate-400">Raum: {cls.room || 'Nicht angegeben'}</p>
						</div>
					</div>
				</div>

				<div class="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
					<div class="flex items-center space-x-1.5">
						<Users class="w-4 h-4 text-slate-500" />
						<span class="text-white font-semibold">{cls.active_student_count} aktive Schüler</span>
						{#if cls.inactive_student_count > 0}
							<span class="text-slate-500">({cls.inactive_student_count} ausgetreten)</span>
						{/if}
					</div>

					<a
						href="/klassen/{cls.id}"
						class="text-blue-400 hover:text-blue-300 font-semibold flex items-center space-x-1"
					>
						<span>Schülerliste</span>
						<ChevronRight class="w-4 h-4" />
					</a>
				</div>
			</div>
		{/each}
	</div>
</div>

<!-- Modal: Neue Klasse anlegen -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
			<div class="flex items-center justify-between pb-3 border-b border-slate-800">
				<h3 class="text-lg font-bold text-white">Neue Klasse anlegen</h3>
				<button type="button" onclick={() => (showCreateModal = false)} class="text-slate-400 hover:text-white">
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				action="?/createClass"
				method="POST"
				use:enhance={() => () => (showCreateModal = false)}
				class="space-y-4"
			>
				<input type="hidden" name="schoolYearId" value={data.activeSchoolYear?.id} />

				<div>
					<label for="name" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Klassenbezeichnung (z.B. 3B, 7A)
					</label>
					<input
						id="name"
						name="name"
						type="text"
						required
						placeholder="3B"
						class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="room" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Stammraum (optional)
					</label>
					<input
						id="room"
						name="room"
						type="text"
						placeholder="R204"
						class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
					<button
						type="button"
						onclick={() => (showCreateModal = false)}
						class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
					>
						Abbrechen
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-md shadow-blue-500/20"
					>
						Klasse speichern
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal: WebUntis Import & Spaltenzuordnung -->
{#if showImportModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl my-8">
			<div class="flex items-center justify-between pb-3 border-b border-slate-800">
				<div>
					<h3 class="text-lg font-bold text-white flex items-center space-x-2">
						<FileSpreadsheet class="w-5 h-5 text-blue-400" />
						<span>WebUntis Schülerliste importieren</span>
					</h3>
					<p class="text-xs text-slate-400">Unterstützt .xlsx, .xls und .csv Exporte aus WebUntis</p>
				</div>
				<button type="button" onclick={() => (showImportModal = false)} class="text-slate-400 hover:text-white">
					<X class="w-5 h-5" />
				</button>
			</div>

			{#if step === 1}
				<!-- Step 1: File Upload Form -->
				<form
					action="?/parseUpload"
					method="POST"
					enctype="multipart/form-data"
					use:enhance
					class="space-y-4"
				>
					<div>
						<label for="classId" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Zielklasse auswählen
						</label>
						<select
							id="classId"
							name="classId"
							bind:value={selectedClassId}
							required
							class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
						>
							{#each data.classes as c}
								<option value={c.id}>Klasse {c.name} ({c.active_student_count} Schüler)</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="file" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							WebUntis Export-Datei (.xlsx, .csv)
						</label>
						<input
							id="file"
							name="file"
							type="file"
							required
							accept=".xlsx,.xls,.csv"
							class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
						/>
					</div>

					<div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
						<button
							type="button"
							onclick={() => (showImportModal = false)}
							class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
						>
							Abbrechen
						</button>
						<button
							type="submit"
							class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-md shadow-blue-500/20"
						>
							Datei einlesen & prüfen
						</button>
					</div>
				</form>
			{:else if step === 2 && form?.parsed}
				<!-- Step 2: Column Mapping & Reconciliation Preview -->
				<form
					action="?/commitImport"
					method="POST"
					use:enhance
					class="space-y-4"
				>
					<input type="hidden" name="classId" value={form.classId} />
					<input type="hidden" name="studentsJson" value={JSON.stringify(prepareMappedStudents())} />

					<div class="p-3 bg-blue-950/60 border border-blue-800/80 rounded-xl text-xs text-blue-200">
						Es wurden <strong>{form.rowCount} Datenzeilen</strong> in der Datei gefunden. Bitte prüfe die automatische Spaltenzuordnung:
					</div>

					<!-- Mapping dropdowns -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<label for="nachnameCol" class="block text-xs font-semibold text-slate-300 mb-1">
								Nachname / Familienname *
							</label>
							<select
								id="nachnameCol"
								bind:value={lastNameCol}
								required
								class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-blue-500"
							>
								{#each form.headers as h}
									<option value={h}>{h}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="vornameCol" class="block text-xs font-semibold text-slate-300 mb-1">
								Vorname / Rufname *
							</label>
							<select
								id="vornameCol"
								bind:value={firstNameCol}
								required
								class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-blue-500"
							>
								{#each form.headers as h}
									<option value={h}>{h}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="katNumCol" class="block text-xs font-semibold text-slate-300 mb-1">
								Katalognummer (optional)
							</label>
							<select
								id="katNumCol"
								bind:value={catCol}
								class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-blue-500"
							>
								<option value="">-- Nicht zugeordnet --</option>
								{#each form.headers as h}
									<option value={h}>{h}</option>
								{/each}
							</select>
						</div>

						<div>
							<label for="wuIdCol" class="block text-xs font-semibold text-slate-300 mb-1">
								WebUntis-ID / Schülernummer (optional)
							</label>
							<select
								id="wuIdCol"
								bind:value={idCol}
								class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-blue-500"
							>
								<option value="">-- Nicht zugeordnet --</option>
								{#each form.headers as h}
									<option value={h}>{h}</option>
								{/each}
							</select>
						</div>
					</div>

					<!-- Preview of first 3 rows -->
					<div>
						<span class="text-xs font-semibold text-slate-400 block mb-1">Vorschau der ersten Einträge:</span>
						<div class="bg-slate-950 rounded-xl border border-slate-800 p-3 space-y-1 text-xs">
							{#each prepareMappedStudents().slice(0, 3) as s, idx}
								<div class="flex items-center justify-between text-slate-300 py-0.5 border-b border-slate-900 last:border-0">
									<span>{idx + 1}. {s.lastName} {s.firstName}</span>
									<span class="text-slate-500 font-mono">Kat: {s.catalogNumber ?? '-'} | WU: {s.webuntisId ?? '-'}</span>
								</div>
							{/each}
						</div>
					</div>

					<div class="flex items-center justify-between pt-3 border-t border-slate-800">
						<button
							type="button"
							onclick={() => (step = 1)}
							class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
						>
							Zurück
						</button>
						<button
							type="submit"
							class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-md shadow-emerald-500/20"
						>
							Roster jetzt abgleichen & speichern
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
{/if}
