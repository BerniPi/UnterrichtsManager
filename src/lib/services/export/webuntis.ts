import * as XLSX from 'xlsx';

export interface WebUntisGradeExportRow {
	lastName: string;
	firstName: string;
	webuntisId?: string | null;
	catalogNumber?: number | null;
	suggestedGrade?: number | null;
	manualGrade?: number | null;
	note?: string | null;
}

/**
 * Generates an Excel (.xlsx) buffer formatted for WebUntis grade import.
 */
export function generateWebUntisExcel(rows: WebUntisGradeExportRow[], courseName: string): Buffer {
	const data = rows.map((r) => ({
		'Katalognummer': r.catalogNumber ?? '',
		'Familienname': r.lastName,
		'Vorname': r.firstName,
		'WebUntis-ID': r.webuntisId ?? '',
		'Notenvorschlag': r.suggestedGrade ? r.suggestedGrade.toFixed(2) : '',
		'Endnote': r.manualGrade ?? (r.suggestedGrade ? Math.round(r.suggestedGrade) : ''),
		'Bemerkung': r.note ?? ''
	}));

	const worksheet = XLSX.utils.json_to_sheet(data);
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, 'Noten');

	return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generates a CSV string formatted for WebUntis grade transfer.
 */
export function generateWebUntisCsv(rows: WebUntisGradeExportRow[]): string {
	const header = 'Katalognummer;Familienname;Vorname;WebUntis-ID;Notenvorschlag;Endnote;Bemerkung\r\n';
	const lines = rows.map((r) => {
		const kat = r.catalogNumber ?? '';
		const last = `"${r.lastName.replace(/"/g, '""')}"`;
		const first = `"${r.firstName.replace(/"/g, '""')}"`;
		const id = r.webuntisId ? `"${r.webuntisId.replace(/"/g, '""')}"` : '';
		const sug = r.suggestedGrade ? r.suggestedGrade.toFixed(2) : '';
		const fin = r.manualGrade ?? (r.suggestedGrade ? Math.round(r.suggestedGrade) : '');
		const note = r.note ? `"${r.note.replace(/"/g, '""')}"` : '';
		return `${kat};${last};${first};${id};${sug};${fin};${note}`;
	});

	return '\uFEFF' + header + lines.join('\r\n'); // Include UTF-8 BOM for Excel compatibility
}
