import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Database from 'better-sqlite3';
import { sqlite, initDb } from '$lib/server/db';
import fs from 'node:fs';
import path from 'node:path';

const MAX_BACKUP_SIZE = 50 * 1024 * 1024; // 50 MB

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('backupFile') as File | null;

	if (!file || !(file instanceof File)) {
		throw error(400, 'Keine Backup-Datei hochgeladen');
	}

	if (file.size > MAX_BACKUP_SIZE) {
		throw error(400, 'Backup-Datei ist zu groß (maximal 50 MB erlaubt)');
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	const tempPath = path.resolve(process.cwd(), 'data', `temp_restore_${Date.now()}.db`);
	fs.writeFileSync(tempPath, buffer);

	try {
		// 1. Verify valid SQLite file and integrity
		const tempDb = new Database(tempPath, { readonly: true });
		const integrityCheck = tempDb.pragma('integrity_check') as Array<{ integrity_check: string }>;
		const isOk = integrityCheck.length > 0 && integrityCheck[0]?.integrity_check === 'ok';

		if (!isOk) {
			tempDb.close();
			throw new Error('Integritätsprüfung der Datenbank fehlgeschlagen');
		}

		// 2. Verify required tables exist
		const requiredTables = ['users', 'school_years', 'classes', 'students', 'courses'];
		const existingTables = (
			tempDb
				.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
				.all() as { name: string }[]
		).map((r) => r.name);

		tempDb.close();

		for (const req of requiredTables) {
			if (!existingTables.includes(req)) {
				throw new Error(`Ungültige Backup-Datei: Erforderliche Tabelle „${req}“ nicht gefunden`);
			}
		}

		// 3. Atomically restore into live database via ATTACH
		sqlite.pragma('foreign_keys = OFF');
		try {
			sqlite.prepare('ATTACH DATABASE ? AS backup_db').run(tempPath);

			const mainTables = (
				sqlite
					.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
					.all() as { name: string }[]
			).map((t) => t.name);

			const restoreTx = sqlite.transaction(() => {
				for (const tbl of mainTables) {
					sqlite.prepare(`DELETE FROM main."${tbl}"`).run();
				}
				for (const tbl of existingTables) {
					if (mainTables.includes(tbl)) {
						sqlite.prepare(`INSERT INTO main."${tbl}" SELECT * FROM backup_db."${tbl}"`).run();
					}
				}
			});

			restoreTx();
		} finally {
			try {
				sqlite.prepare('DETACH DATABASE backup_db').run();
			} catch {}
			sqlite.pragma('foreign_keys = ON');
		}

		// 4. Ensure structure and checkpoint
		initDb();
		sqlite.pragma('wal_checkpoint(TRUNCATE)');

		return new Response(JSON.stringify({ success: true, message: 'Datenbank erfolgreich wiederhergestellt' }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e: any) {
		throw error(400, `Fehler beim Einspielen des Backups: ${e.message}`);
	} finally {
		if (fs.existsSync(tempPath)) {
			try {
				fs.unlinkSync(tempPath);
			} catch {}
		}
	}
};
