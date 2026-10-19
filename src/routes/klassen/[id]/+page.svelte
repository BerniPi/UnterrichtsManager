<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		ArrowLeft,
		Plus,
		Users,
		UserCheck,
		UserX,
		BookOpen,
		ExternalLink,
		X,
		Hash,
		Pencil
	} from '@lucide/svelte';

	interface Props {
		data: {
			cls: any;
			students: Array<any>;
			courses: Array<any>;
		};
	}

	let { data }: Props = $props();

	let showAddModal = $state(false);
	let filterActive = $state(true);

	let editingStudent = $state<any | null>(null);
	let editFirstName = $state('');
	let editLastName = $state('');
	let editCatalogNumber = $state<number | null>(null);
	let editWebuntisId = $state('');

	const visibleStudents = $derived(
		filterActive ? data.students.filter((s: any) => s.status === 'active') : data.students
	);
</script>

<svelte:head>
	<title>Klasse {data.cls.name} – UnterrichtsManager</title>
</svelte:head>

<div class="space-y-6">
	<!-- Top Bar -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
		<div class="flex items-center space-x-3">
			<a
				href="/klassen"
				class="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
			>
				<ArrowLeft class="w-5 h-5" />
			</a>
			<div>
				<h1 class="text-2xl font-bold text-white">Klasse {data.cls.name}</h1>
				<p class="text-xs text-slate-400">
					Raum: {data.cls.room || '–'} • {data.students.filter((s: any) => s.status === 'active').length} aktive Schüler
				</p>
			</div>
		</div>

		<div class="flex items-center space-x-3">
			<form action="?/renumberAlphabetically" method="POST" use:enhance>
				<button
					type="submit"
					class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs border border-slate-700 transition flex items-center space-x-1.5 active:scale-95"
					title="Katalognummern für alle aktiven Schüler alphabetisch (A–Z) durchnummerieren"
				>
					<Hash class="w-3.5 h-3.5 text-blue-400" />
					<span>Katalognummern (A–Z) vergeben</span>
				</button>
			</form>

			<button
				type="button"
				onclick={() => (showAddModal = true)}
				class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center space-x-1.5"
			>
				<Plus class="w-4 h-4" />
				<span>Schüler manuell anlegen</span>
			</button>
		</div>
	</div>

	<!-- Courses in this class -->
	{#if data.courses.length > 0}
		<div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
			<div class="flex items-center space-x-2">
				<BookOpen class="w-4 h-4 text-blue-400" />
				<span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Kurse dieser Klasse:</span>
			</div>
			<div class="flex items-center gap-2">
				{#each data.courses as crs}
					<a
						href="/kurse/{crs.id}"
						class="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-blue-300 hover:bg-blue-600 hover:text-white border border-slate-700 transition"
					>
						{crs.subject}
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Filter toggles -->
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-bold text-white flex items-center space-x-2">
			<Users class="w-5 h-5 text-blue-400" />
			<span>Schülerliste</span>
		</h2>

		<button
			type="button"
			onclick={() => (filterActive = !filterActive)}
			class="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
		>
			{filterActive ? 'Auch Ausgetretene anzeigen' : 'Nur Aktive anzeigen'}
		</button>
	</div>

	<!-- Student Table / Card list -->
	<div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
		<div class="divide-y divide-slate-800">
			{#each visibleStudents as student}
				<div class="p-4 flex items-center justify-between hover:bg-slate-800/40 transition">
					<div class="flex items-center space-x-3">
						{#if student.catalog_number != null}
							<span class="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
								{student.catalog_number}
							</span>
						{/if}
						<div>
							<a
								href="/schueler/{student.id}"
								class="font-bold text-white hover:text-blue-400 transition flex items-center space-x-1.5"
							>
								<span>{student.last_name} {student.first_name}</span>
								<ExternalLink class="w-3.5 h-3.5 text-slate-500" />
							</a>
							<div class="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
								<span>WebUntis-ID: {student.webuntis_id || '–'}</span>
								{#if student.status === 'inactive'}
									<span class="px-1.5 py-0.2 rounded text-[10px] bg-red-950 text-red-400 border border-red-800 font-semibold">
										Ausgetreten
									</span>
								{/if}
							</div>
						</div>
					</div>

					<div class="flex items-center space-x-2">
						<button
							type="button"
							onclick={() => {
								editingStudent = student;
								editFirstName = student.first_name;
								editLastName = student.last_name;
								editCatalogNumber = student.catalog_number;
								editWebuntisId = student.webuntis_id || '';
							}}
							class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
							title="Schülerdaten / Name bearbeiten"
						>
							<Pencil class="w-4 h-4 text-blue-400" />
						</button>

						<a
							href="/schueler/{student.id}"
							class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
						>
							Schülerkarte
						</a>

						<form action="?/toggleStatus" method="POST" use:enhance>
							<input type="hidden" name="studentId" value={student.id} />
							<input type="hidden" name="currentStatus" value={student.status} />
							<button
								type="submit"
								class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
								title={student.status === 'active' ? 'Als ausgetreten markieren' : 'Wieder aktivieren'}
							>
								{#if student.status === 'active'}
									<UserX class="w-4 h-4 text-slate-400 hover:text-red-400" />
								{:else}
									<UserCheck class="w-4 h-4 text-emerald-400" />
								{/if}
							</button>
						</form>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<!-- Modal: Add Student -->
{#if showAddModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
			<div class="flex items-center justify-between pb-3 border-b border-slate-800">
				<h3 class="text-lg font-bold text-white">Schüler manuell anlegen</h3>
				<button type="button" onclick={() => (showAddModal = false)} class="text-slate-400 hover:text-white">
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				action="?/addStudent"
				method="POST"
				use:enhance={() => async ({ result, update }) => {
					await update();
					if (result.type === 'success') showAddModal = false;
				}}
				class="space-y-4"
			>
				<div>
					<label for="nachname" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Nachname *
					</label>
					<input
						id="nachname"
						name="lastName"
						type="text"
						required
						placeholder="Mustermann"
						class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500 text-sm"
					/>
				</div>

				<div>
					<label for="vorname" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Vorname *
					</label>
					<input
						id="vorname"
						name="firstName"
						type="text"
						required
						placeholder="Max"
						class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500 text-sm"
					/>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="catalogNum" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Katalognummer
						</label>
						<input
							id="catalogNum"
							name="catalogNumber"
							type="number"
							placeholder="1"
							class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500 text-sm"
						/>
					</div>

					<div>
						<label for="webuntisId" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							WebUntis-ID
						</label>
						<input
							id="webuntisId"
							name="webuntisId"
							type="text"
							placeholder="WU-01"
							class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500 text-sm"
						/>
					</div>
				</div>

				<div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
					<button
						type="button"
						onclick={() => (showAddModal = false)}
						class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
					>
						Abbrechen
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-md shadow-blue-500/20"
					>
						Schüler anlegen
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal: Edit Student -->
{#if editingStudent}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
			<div class="flex items-center justify-between pb-3 border-b border-slate-800">
				<h3 class="text-lg font-bold text-white">Schüler bearbeiten</h3>
				<button type="button" onclick={() => (editingStudent = null)} class="text-slate-400 hover:text-white">
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				action="?/updateStudent"
				method="POST"
				use:enhance={() => async ({ result, update }) => {
					await update();
					if (result.type === 'success') editingStudent = null;
				}}
				class="space-y-4"
			>
				<input type="hidden" name="studentId" value={editingStudent.id} />

				<div>
					<label for="editLastName" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Nachname *
					</label>
					<input
						id="editLastName"
						name="lastName"
						type="text"
						required
						bind:value={editLastName}
						class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500 text-sm"
					/>
				</div>

				<div>
					<label for="editFirstName" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Vorname *
					</label>
					<input
						id="editFirstName"
						name="firstName"
						type="text"
						required
						bind:value={editFirstName}
						class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500 text-sm"
					/>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="editCatalogNum" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Katalognummer
						</label>
						<input
							id="editCatalogNum"
							name="catalogNumber"
							type="number"
							bind:value={editCatalogNumber}
							class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500 text-sm"
						/>
					</div>

					<div>
						<label for="editWebuntisId" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							WebUntis-ID
						</label>
						<input
							id="editWebuntisId"
							name="webuntisId"
							type="text"
							bind:value={editWebuntisId}
							class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500 text-sm"
						/>
					</div>
				</div>

				<div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
					<button
						type="button"
						onclick={() => (editingStudent = null)}
						class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
					>
						Abbrechen
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition"
					>
						Änderungen speichern
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
