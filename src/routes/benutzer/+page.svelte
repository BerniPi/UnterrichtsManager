<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Shield,
		UserPlus,
		UserCheck,
		UserX,
		KeyRound,
		ShieldOff,
		ArrowRightLeft,
		CheckCircle2,
		AlertTriangle,
		X,
		Pencil,
		GraduationCap,
		BookOpen
	} from '@lucide/svelte';

	interface Props {
		data: {
			currentUserId: string;
			users: Array<{
				id: string;
				username: string;
				displayName: string | null;
				role: 'admin' | 'teacher' | 'student';
				isActive: boolean;
				totpEnabled: boolean;
				createdAt: number;
				courseCount: number;
				studentId: string | null;
				studentName: string | null;
				studentClassName: string | null;
			}>;
			allCourses: Array<{
				id: string;
				subject: string;
				className: string;
				schoolYearName: string;
				teacherId: string | null;
				teacherName: string;
			}>;
			students: Array<{
				id: string;
				firstName: string;
				lastName: string;
				schkz: string | null;
				className: string;
				linkedUserId: string | null;
			}>;
		};
		form?: any;
	}

	let { data, form }: Props = $props();

	let showCreateModal = $state(false);
	let createRole = $state<'teacher' | 'admin' | 'student'>('teacher');
	let createUsername = $state('');
	let createDisplayName = $state('');
	let createPassword = $state('');
	let createStudentId = $state('');

	let resetPasswordUser = $state<any | null>(null);
	let newResetPassword = $state('');

	let editingUser = $state<any | null>(null);
	let editRole = $state<'teacher' | 'admin' | 'student'>('teacher');
	let editDisplayName = $state('');
	let editStudentId = $state('');

	const activeTeachers = $derived(
		data.users.filter((u) => u.isActive && (u.role === 'teacher' || u.role === 'admin'))
	);

	const roleBadge = (role: string) => {
		if (role === 'admin')
			return { label: 'Admin', cls: 'bg-purple-950 text-purple-300 border-purple-800' };
		if (role === 'student')
			return { label: 'Schüler:in', cls: 'bg-sky-950 text-sky-300 border-sky-800' };
		return { label: 'Lehrkraft', cls: 'bg-blue-950 text-blue-300 border-blue-800' };
	};
</script>

<svelte:head>
	<title>Benutzerverwaltung – UnterrichtsManager</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
		<div>
			<h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center space-x-2.5">
				<Shield class="w-7 h-7 text-purple-400" />
				<span>Benutzerverwaltung</span>
			</h1>
			<p class="text-slate-400 text-sm mt-0.5">
				Lehrkräfte, Administratoren und Schüler-Zugänge verwalten sowie Kurse übertragen
			</p>
		</div>

		<button
			type="button"
			onclick={() => {
				createRole = 'teacher';
				createUsername = '';
				createDisplayName = '';
				createPassword = '';
				createStudentId = '';
				showCreateModal = true;
			}}
			class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center space-x-2"
		>
			<UserPlus class="w-4 h-4" />
			<span>Benutzer anlegen</span>
		</button>
	</div>

	{#if form?.message}
		<div class="p-3 bg-emerald-950/90 border border-emerald-800 text-emerald-200 text-xs rounded-xl flex items-center space-x-2">
			<CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
			<span>{form.message}</span>
		</div>
	{/if}

	{#if form?.error}
		<div class="p-3 bg-red-950/90 border border-red-800 text-red-200 text-xs rounded-xl flex items-center space-x-2">
			<AlertTriangle class="w-4 h-4 text-red-400 shrink-0" />
			<span>{form.error}</span>
		</div>
	{/if}

	<!-- Users Table -->
	<div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
		<div class="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
			<h2 class="text-sm font-bold uppercase tracking-wider text-slate-300">
				Alle Benutzerkonten ({data.users.length})
			</h2>
		</div>

		<div class="overflow-x-auto">
			<table class="w-full text-left border-collapse text-xs">
				<thead>
					<tr class="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px] bg-slate-950/60">
						<th class="py-3 px-4">Benutzer</th>
						<th class="py-3 px-4">Rolle</th>
						<th class="py-3 px-4">Status</th>
						<th class="py-3 px-4">Kurse / Schüler</th>
						<th class="py-3 px-4">2FA</th>
						<th class="py-3 px-4">Erstellt am</th>
						<th class="py-3 px-4 text-right">Aktionen</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800">
					{#each data.users as u}
						{@const badge = roleBadge(u.role)}
						<tr class="hover:bg-slate-800/40 transition {!u.isActive ? 'opacity-60' : ''}">
							<td class="py-3.5 px-4">
								<div class="font-bold text-white text-sm flex items-center space-x-1.5">
									<span>{u.username}</span>
									{#if u.id === data.currentUserId}
										<span class="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-normal">Du</span>
									{/if}
								</div>
								{#if u.displayName}
									<div class="text-xs text-slate-400">{u.displayName}</div>
								{/if}
							</td>

							<td class="py-3.5 px-4">
								<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold border {badge.cls}">
									{badge.label}
								</span>
							</td>

							<td class="py-3.5 px-4">
								{#if u.isActive}
									<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
										Aktiv
									</span>
								{:else}
									<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-950 text-red-300 border border-red-800">
										Gesperrt
									</span>
								{/if}
							</td>

							<td class="py-3.5 px-4 text-slate-300">
								{#if u.role === 'student'}
									{#if u.studentName}
										<span class="flex items-center space-x-1">
											<GraduationCap class="w-3.5 h-3.5 text-sky-400" />
											<span>{u.studentName} ({u.studentClassName})</span>
										</span>
									{:else}
										<span class="text-slate-500">Kein Schüler verknüpft</span>
									{/if}
								{:else}
									<span class="font-semibold">{u.courseCount}</span> Kurs(e)
								{/if}
							</td>

							<td class="py-3.5 px-4">
								{#if u.totpEnabled}
									<span class="text-emerald-400 font-semibold">Aktiv</span>
								{:else}
									<span class="text-slate-500">Aus</span>
								{/if}
							</td>

							<td class="py-3.5 px-4 text-slate-400 font-mono">
								{new Date(u.createdAt).toLocaleDateString('de-AT')}
							</td>

							<td class="py-3.5 px-4 text-right">
								<div class="flex items-center justify-end space-x-1.5">
									<button
										type="button"
										onclick={() => {
											editingUser = u;
											editRole = u.role;
											editDisplayName = u.displayName || '';
											editStudentId = u.studentId || '';
										}}
										class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
										title="Rolle / Anzeigename bearbeiten"
									>
										<Pencil class="w-3.5 h-3.5" />
									</button>

									<button
										type="button"
										onclick={() => {
											resetPasswordUser = u;
											newResetPassword = '';
										}}
										class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 transition"
										title="Passwort zurücksetzen"
									>
										<KeyRound class="w-3.5 h-3.5" />
									</button>

									{#if u.totpEnabled}
										<form action="?/resetTotp" method="POST" use:enhance>
											<input type="hidden" name="userId" value={u.id} />
											<button
												type="submit"
												class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-orange-300 transition"
												title="2FA (TOTP) zurücksetzen"
											>
												<ShieldOff class="w-3.5 h-3.5" />
											</button>
										</form>
									{/if}

									{#if u.id !== data.currentUserId}
										<form action="?/toggleActive" method="POST" use:enhance>
											<input type="hidden" name="userId" value={u.id} />
											<button
												type="submit"
												class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition {u.isActive ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}"
												title={u.isActive ? 'Deaktivieren (Sperren)' : 'Reaktivieren'}
											>
												{#if u.isActive}
													<UserX class="w-3.5 h-3.5" />
												{:else}
													<UserCheck class="w-3.5 h-3.5" />
												{/if}
											</button>
										</form>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Course Ownership Transfer -->
	<div class="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg space-y-4">
		<div class="flex items-center space-x-2">
			<ArrowRightLeft class="w-5 h-5 text-blue-400" />
			<h2 class="text-base font-bold text-white">Kurs einer anderen Lehrkraft übertragen</h2>
		</div>
		<p class="text-xs text-slate-400">
			Bei einem Lehrerwechsel kann ein Kurs samt allen Schularbeiten, Tests, Mitarbeitseinträgen und Frühwarnungen einem anderen Lehrer zugeordnet werden.
		</p>

		{#if data.allCourses.length === 0}
			<p class="text-xs text-slate-500">Noch keine Kurse vorhanden.</p>
		{:else}
			<div class="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
				{#each data.allCourses as c}
					<form
						action="?/transferCourse"
						method="POST"
						use:enhance
						class="p-3.5 bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
					>
						<input type="hidden" name="courseId" value={c.id} />
						<div class="flex items-center space-x-3">
							<BookOpen class="w-4 h-4 text-blue-400 shrink-0" />
							<div>
								<span class="font-bold text-white text-sm">{c.className} – {c.subject}</span>
								<span class="text-xs text-slate-400 ml-2">({c.schoolYearName})</span>
								<div class="text-xs text-slate-400">
									Aktuell: <strong class="text-slate-200">{c.teacherName}</strong>
								</div>
							</div>
						</div>

						<div class="flex items-center space-x-2">
							<select
								name="targetTeacherId"
								value={c.teacherId || ''}
								class="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
							>
								{#each activeTeachers as t}
									<option value={t.id}>{t.displayName || t.username} ({t.username})</option>
								{/each}
							</select>
							<button
								type="submit"
								class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition"
							>
								Übertragen
							</button>
						</div>
					</form>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Modal: Create User -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
			<div class="flex items-center justify-between pb-3 border-b border-slate-800">
				<h3 class="text-lg font-bold text-white">Neuen Benutzer anlegen</h3>
				<button type="button" onclick={() => (showCreateModal = false)} class="text-slate-400 hover:text-white">
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				action="?/createUser"
				method="POST"
				use:enhance={() => async ({ result, update }) => {
					await update();
					if (result.type === 'success') showCreateModal = false;
				}}
				class="space-y-4"
			>
				<div>
					<label for="cRole" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Rolle
					</label>
					<select
						id="cRole"
						name="role"
						bind:value={createRole}
						class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
					>
						<option value="teacher">Lehrkraft</option>
						<option value="admin">Administrator (Lehrkraft + Verwaltungsrechte)</option>
						<option value="student">Schüler:in (Nur Lesezugriff auf /meine-noten)</option>
					</select>
				</div>

				{#if createRole === 'student'}
					<div>
						<label for="cStudent" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Verknüpfter Schüler *
						</label>
						<select
							id="cStudent"
							name="studentId"
							bind:value={createStudentId}
							required
							class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
						>
							<option value="">– Bitte Schüler:in wählen –</option>
							{#each data.students.filter((s) => !s.linkedUserId) as s}
								<option value={s.id}>
									{s.className}: {s.lastName} {s.firstName}{s.schkz ? ` (${s.schkz})` : ''}
								</option>
							{/each}
						</select>
					</div>
				{/if}

				<div>
					<label for="cUser" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Benutzername *
					</label>
					<input
						id="cUser"
						name="username"
						type="text"
						required
						bind:value={createUsername}
						placeholder={createRole === 'student' ? 'z.B. max.mustermann' : 'z.B. berger'}
						class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
					/>
				</div>

				<div>
					<label for="cDisp" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Anzeigename {createRole === 'student' ? '(optional, sonst Schülername)' : '(z.B. Prof. Mag. Anna Berger)'}
					</label>
					<input
						id="cDisp"
						name="displayName"
						type="text"
						bind:value={createDisplayName}
						placeholder="Prof. Mag. Anna Berger"
						class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
					/>
				</div>

				<div>
					<label for="cPass" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Startpasswort (mind. 6 Zeichen) *
					</label>
					<input
						id="cPass"
						name="password"
						type="password"
						required
						minlength="6"
						bind:value={createPassword}
						class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
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
						Anlegen
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal: Edit User Role / DisplayName -->
{#if editingUser}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
			<div class="flex items-center justify-between pb-3 border-b border-slate-800">
				<h3 class="text-lg font-bold text-white">Benutzer „{editingUser.username}“ bearbeiten</h3>
				<button type="button" onclick={() => (editingUser = null)} class="text-slate-400 hover:text-white">
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				action="?/updateRole"
				method="POST"
				use:enhance={() => async ({ result, update }) => {
					await update();
					if (result.type === 'success') editingUser = null;
				}}
				class="space-y-4"
			>
				<input type="hidden" name="userId" value={editingUser.id} />

				<div>
					<label for="eDisp" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Anzeigename
					</label>
					<input
						id="eDisp"
						name="displayName"
						type="text"
						bind:value={editDisplayName}
						class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
					/>
				</div>

				<div>
					<label for="eRole" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Rolle
					</label>
					<select
						id="eRole"
						name="role"
						bind:value={editRole}
						class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
					>
						<option value="teacher">Lehrkraft</option>
						<option value="admin">Administrator</option>
						<option value="student">Schüler:in</option>
					</select>
				</div>

				{#if editRole === 'student'}
					<div>
						<label for="eStudent" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
							Verknüpfter Schüler *
						</label>
						<select
							id="eStudent"
							name="studentId"
							bind:value={editStudentId}
							required
							class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
						>
							<option value="">– Bitte Schüler:in wählen –</option>
							{#each data.students.filter((s) => !s.linkedUserId || s.linkedUserId === editingUser.id) as s}
								<option value={s.id}>
									{s.className}: {s.lastName} {s.firstName}
								</option>
							{/each}
						</select>
					</div>
				{/if}

				<div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
					<button
						type="button"
						onclick={() => (editingUser = null)}
						class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
					>
						Abbrechen
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold"
					>
						Speichern
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal: Reset Password -->
{#if resetPasswordUser}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
		<div class="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
			<div class="flex items-center justify-between pb-3 border-b border-slate-800">
				<h3 class="text-lg font-bold text-white">Passwort zurücksetzen ({resetPasswordUser.username})</h3>
				<button type="button" onclick={() => (resetPasswordUser = null)} class="text-slate-400 hover:text-white">
					<X class="w-5 h-5" />
				</button>
			</div>

			<form
				action="?/resetPassword"
				method="POST"
				use:enhance={() => async ({ result, update }) => {
					await update();
					if (result.type === 'success') resetPasswordUser = null;
				}}
				class="space-y-4"
			>
				<input type="hidden" name="userId" value={resetPasswordUser.id} />

				<p class="text-xs text-slate-400">
					Das neue Passwort gilt sofort. Alle aktiven Sitzungen dieses Benutzers werden beendet.
				</p>

				<div>
					<label for="rPass" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
						Neues Passwort (mind. 6 Zeichen) *
					</label>
					<input
						id="rPass"
						name="newPassword"
						type="password"
						required
						minlength="6"
						bind:value={newResetPassword}
						class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
					/>
				</div>

				<div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
					<button
						type="button"
						onclick={() => (resetPasswordUser = null)}
						class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium"
					>
						Abbrechen
					</button>
					<button
						type="submit"
						class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold"
					>
						Passwort setzen
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
