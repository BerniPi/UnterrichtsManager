import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('backupFile') as File;

	if (!file) {
		throw error(400, 'Keine Backup-Datei hochgeladen');
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	const tempPath = path.resolve(process.cwd(), 'data', 'temp_restore.db');
	fs.writeFileSync(tempPath, buffer);

	// Validate that it's a valid SQLite database with students and users tables
	try {
		const tempDb = new Database(tempPath);
		const testUsers = tempDb.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='users'").get() as { count: number };
		tempDb.close();

		if (testUsers.count === 0) {
			fs.unlinkSync(tempPath);
			throw error(400, 'Ungültige Backup-Datei: Tabellen nicht gefunden');
		}

		// Overwrite main db
		const targetPath = process.env.DATABASE_URL || path.resolve(process.cwd(), 'data', 'notenmanager.db');
		fs.copyFileSync(tempPath, targetPath);
		fs.unlinkSync(tempPath);

		return new Response(JSON.stringify({ success: true, message: 'Datenbank erfolgreich wiederhergestellt' }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (e: any) {
		if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
		throw error(400, `Fehler beim Einspielen des Backups: ${e.message}`);
	}
};
