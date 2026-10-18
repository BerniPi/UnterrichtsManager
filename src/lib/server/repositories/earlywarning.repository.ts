import { db, sqlite } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

export interface EarlyWarningWithDetails {
	id: string;
	studentId: string;
	studentName: string;
	courseId: string;
	courseSubject: string;
	className: string;
	semester: number;
	issuedDate: string;
	reason: string;
	dueDate: string;
	isSigned: boolean;
	signedDate: string | null;
	snoozedUntil: string | null;
	status: string;
	daysOverdue: number;
}

export const earlyWarningRepository = {
	getByCourse(courseId: string): EarlyWarningWithDetails[] {
		const todayStr = new Date().toISOString().slice(0, 10);
		const rows = sqlite
			.prepare(
				`
			SELECT 
				ew.id,
				ew.student_id as studentId,
				s.first_name || ' ' || s.last_name as studentName,
				ew.course_id as courseId,
				c.subject as courseSubject,
				cl.name as className,
				ew.semester,
				ew.issued_date as issuedDate,
				ew.reason,
				ew.due_date as dueDate,
				ew.is_signed as isSigned,
				ew.signed_date as signedDate,
				ew.snoozed_until as snoozedUntil,
				ew.status,
				MAX(0, CAST(julianday(?) - julianday(ew.due_date) AS INTEGER)) as daysOverdue
			FROM early_warnings ew
			JOIN students s ON ew.student_id = s.id
			JOIN courses c ON ew.course_id = c.id
			JOIN classes cl ON c.class_id = cl.id
			WHERE ew.course_id = ?
			ORDER BY ew.issued_date DESC
		`
			)
			.all(todayStr, courseId) as any[];

		return rows.map((r) => ({
			...r,
			isSigned: Boolean(r.isSigned)
		}));
	},

	getByStudent(studentId: string): EarlyWarningWithDetails[] {
		const todayStr = new Date().toISOString().slice(0, 10);
		const rows = sqlite
			.prepare(
				`
			SELECT 
				ew.id,
				ew.student_id as studentId,
				s.first_name || ' ' || s.last_name as studentName,
				ew.course_id as courseId,
				c.subject as courseSubject,
				cl.name as className,
				ew.semester,
				ew.issued_date as issuedDate,
				ew.reason,
				ew.due_date as dueDate,
				ew.is_signed as isSigned,
				ew.signed_date as signedDate,
				ew.snoozed_until as snoozedUntil,
				ew.status,
				MAX(0, CAST(julianday(?) - julianday(ew.due_date) AS INTEGER)) as daysOverdue
			FROM early_warnings ew
			JOIN students s ON ew.student_id = s.id
			JOIN courses c ON ew.course_id = c.id
			JOIN classes cl ON c.class_id = cl.id
			WHERE ew.student_id = ?
			ORDER BY ew.issued_date DESC
		`
			)
			.all(todayStr, studentId) as any[];

		return rows.map((r) => ({
			...r,
			isSigned: Boolean(r.isSigned)
		}));
	},

	create(data: {
		studentId: string;
		courseId: string;
		semester: number;
		issuedDate: string;
		reason: string;
		dueDate: string;
	}): string {
		const id = crypto.randomUUID();
		db.insert(schema.earlyWarnings)
			.values({
				id,
				studentId: data.studentId,
				courseId: data.courseId,
				semester: data.semester,
				issuedDate: data.issuedDate,
				reason: data.reason,
				dueDate: data.dueDate,
				isSigned: false,
				status: 'issued'
			})
			.run();
		return id;
	},

	markSigned(id: string, signedDate: string = new Date().toISOString().slice(0, 10)): void {
		db.update(schema.earlyWarnings)
			.set({ isSigned: true, signedDate, status: 'resolved' })
			.where(eq(schema.earlyWarnings.id, id))
			.run();
	}
};
