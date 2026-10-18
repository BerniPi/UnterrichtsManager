import type { RequestHandler } from './$types';
import { sqlite } from '$lib/server/db';
import fs from 'node:fs';
import path from 'node:path';

export const GET: RequestHandler = async () => {
	// Execute checkpoint so WAL is merged into main file
	sqlite.pragma('wal_checkpoint(TRUNCATE)');

	const dbPath = process.env.DATABASE_URL || path.resolve(process.cwd(), 'data', 'notenmanager.db');
	const fileBuffer = fs.readFileSync(dbPath);

	const dateStr = new Date().toISOString().slice(0, 10);
	const filename = `notenmanager_backup_${dateStr}.sqlite`;

	return new Response(fileBuffer, {
		headers: {
			'Content-Type': 'application/x-sqlite3',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
