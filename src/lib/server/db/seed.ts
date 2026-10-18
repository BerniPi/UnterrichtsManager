import { db, sqlite, initDb } from './index';
import * as schema from './schema';
import { hash } from '@node-rs/argon2';
import crypto from 'node:crypto';
import { DEFAULT_TEMPLATES } from '../../services/grading';

export async function seedDatabase(force = false) {
	initDb();

	const userCount = sqlite.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
	if (userCount.count > 0 && !force) {
		return { message: 'Database already seeded' };
	}

	if (force) {
		sqlite.exec(`
			DELETE FROM reminder_logs;
			DELETE FROM push_subscriptions;
			DELETE FROM homework_statuses;
			DELETE FROM homeworks;
			DELETE FROM notes;
			DELETE FROM course_final_grades;
			DELETE FROM early_warnings;
			DELETE FROM assessment_returns;
			DELETE FROM assessment_results;
			DELETE FROM assessments;
			DELETE FROM observation_scores;
			DELETE FROM observations;
			DELETE FROM participation_entries;
			DELETE FROM courses;
			DELETE FROM students;
			DELETE FROM classes;
			DELETE FROM school_years;
			DELETE FROM sessions;
			DELETE FROM users;
			DELETE FROM settings;
			DELETE FROM grading_scale_templates;
		`);
	}

	// 1. Create Teacher User
	const teacherId = crypto.randomUUID();
	const passwordHash = await hash('notenmanager123');
	db.insert(schema.users)
		.values({
			id: teacherId,
			username: 'lehrer',
			passwordHash,
			totpEnabled: false,
			createdAt: Date.now()
		})
		.run();

	// Default settings
	db.insert(schema.settings)
		.values([
			{ key: 'default_return_days', value: '7' },
			{ key: 'early_warning_threshold', value: '4.5' },
			{ key: 'email_summary_enabled', value: 'false' },
			{ key: 'teacher_name', value: 'Prof. Mag. Bernhard' }
		])
		.run();

	// Default Grading Scale Templates
	for (const t of DEFAULT_TEMPLATES) {
		db.insert(schema.gradingScaleTemplates)
			.values({
				id: t.id,
				name: t.name,
				description: t.description || null,
				scaleJson: JSON.stringify(t.scale),
				isDefault: t.isDefault,
				createdAt: Date.now()
			})
			.run();
	}

	// 2. School Year 2026/27 (Austrian school calendar)
	const syId = crypto.randomUUID();
	db.insert(schema.schoolYears)
		.values({
			id: syId,
			name: '2026/27',
			startDate: '2026-09-07',
			endDate: '2027-07-02',
			firstSemesterEnd: '2027-02-05',
			secondSemesterEnd: '2027-07-02',
			gradingDeadline1: '2027-01-22',
			gradingDeadline2: '2027-06-18',
			earlyWarningDeadline1: '2026-12-15',
			earlyWarningDeadline2: '2027-05-15',
			isCurrent: true
		})
		.run();

	// 3. Classes (3B and 7A)
	const class3BId = crypto.randomUUID();
	const class7AId = crypto.randomUUID();

	db.insert(schema.classes)
		.values([
			{ id: class3BId, name: '3B', schoolYearId: syId, room: 'R204' },
			{ id: class7AId, name: '7A', schoolYearId: syId, room: 'Physiksaal 1' }
		])
		.run();

	// 4. Students (Fictional names)
	const fictionalStudents3B = [
		{ firstName: 'Max', lastName: 'Mustermann', webuntisId: 'WU-3B-01', catalogNumber: 1 },
		{ firstName: 'Anna', lastName: 'Huber', webuntisId: 'WU-3B-02', catalogNumber: 2 },
		{ firstName: 'Lukas', lastName: 'Gruber', webuntisId: 'WU-3B-03', catalogNumber: 3 },
		{ firstName: 'Sophie', lastName: 'Weber', webuntisId: 'WU-3B-04', catalogNumber: 4 },
		{ firstName: 'Felix', lastName: 'Hofer', webuntisId: 'WU-3B-05', catalogNumber: 5 },
		{ firstName: 'Elena', lastName: 'Pichler', webuntisId: 'WU-3B-06', catalogNumber: 6 },
		{ firstName: 'David', lastName: 'Bauer', webuntisId: 'WU-3B-07', catalogNumber: 7 },
		{ firstName: 'Laura', lastName: 'Steiner', webuntisId: 'WU-3B-08', catalogNumber: 8 },
		{ firstName: 'Tobias', lastName: 'Mayer', webuntisId: 'WU-3B-09', catalogNumber: 9 },
		{ firstName: 'Julia', lastName: 'Moser', webuntisId: 'WU-3B-10', catalogNumber: 10 }
	];

	const studentIds3B: string[] = [];
	for (const s of fictionalStudents3B) {
		const sid = crypto.randomUUID();
		studentIds3B.push(sid);
		db.insert(schema.students)
			.values({
				id: sid,
				classId: class3BId,
				firstName: s.firstName,
				lastName: s.lastName,
				webuntisId: s.webuntisId,
				catalogNumber: s.catalogNumber,
				status: 'active'
			})
			.run();
	}

	const fictionalStudents7A = [
		{ firstName: 'Julian', lastName: 'Wagner', webuntisId: 'WU-7A-01', catalogNumber: 1 },
		{ firstName: 'Marie', lastName: 'Eder', webuntisId: 'WU-7A-02', catalogNumber: 2 },
		{ firstName: 'Simon', lastName: 'Brunner', webuntisId: 'WU-7A-03', catalogNumber: 3 },
		{ firstName: 'Leon', lastName: 'Fischer', webuntisId: 'WU-7A-04', catalogNumber: 4 }
	];

	const studentIds7A: string[] = [];
	for (const s of fictionalStudents7A) {
		const sid = crypto.randomUUID();
		studentIds7A.push(sid);
		db.insert(schema.students)
			.values({
				id: sid,
				classId: class7AId,
				firstName: s.firstName,
				lastName: s.lastName,
				webuntisId: s.webuntisId,
				catalogNumber: s.catalogNumber,
				status: 'active'
			})
			.run();
	}

	// 5. Courses
	const course3BMathId = crypto.randomUUID();
	const course3BPhysId = crypto.randomUUID();
	const course7APhysId = crypto.randomUUID();

	db.insert(schema.courses)
		.values([
			{
				id: course3BMathId,
				classId: class3BId,
				schoolYearId: syId,
				subject: 'Mathematik',
				weightSchularbeiten: 40,
				weightTests: 20,
				weightParticipation: 25,
				weightObservations: 10,
				weightHomework: 5
			},
			{
				id: course3BPhysId,
				classId: class3BId,
				schoolYearId: syId,
				subject: 'Physik',
				weightSchularbeiten: 35,
				weightTests: 25,
				weightParticipation: 30,
				weightObservations: 5,
				weightHomework: 5
			},
			{
				id: course7APhysId,
				classId: class7AId,
				schoolYearId: syId,
				subject: 'Physik',
				weightSchularbeiten: 40,
				weightTests: 20,
				weightParticipation: 25,
				weightObservations: 10,
				weightHomework: 5
			}
		])
		.run();

	// 6. Participation entries for 3B Mathematik (Weeks 41, 42)
	const participationSample = [
		{ studentIdx: 0, val: 'plus', comment: 'Gute Mitarbeit an der Tafel' },
		{ studentIdx: 1, val: 'plus', comment: 'Aufgabe fehlerfrei gelöst' },
		{ studentIdx: 2, val: 'tilde', comment: 'Etwas unkonzentriert' },
		{ studentIdx: 3, val: 'minus', comment: 'Keine Beteiligung' },
		{ studentIdx: 4, val: 'plus', comment: 'Freiwillige Meldung' },
		{ studentIdx: 5, val: 'tilde', comment: 'Teilweise mitgearbeitet' }
		// studentIdx 6..9 haven't participated this week yet -> shows up in Dashboard!
	];

	for (const p of participationSample) {
		db.insert(schema.participationEntries)
			.values({
				id: crypto.randomUUID(),
				courseId: course3BMathId,
				studentId: studentIds3B[p.studentIdx],
				date: '2026-10-15',
				weekNumber: 42,
				year: 2026,
				value: p.val,
				comment: p.comment,
				createdAt: Date.now()
			})
			.run();
	}

	// 7. Assessment 1: 1. Schularbeit Mathematik 3B
	const assessment1Id = crypto.randomUUID();
	const defaultScale = JSON.stringify([
		{ grade: 1, minPercent: 88 },
		{ grade: 2, minPercent: 75 },
		{ grade: 3, minPercent: 60 },
		{ grade: 4, minPercent: 50 },
		{ grade: 5, minPercent: 0 }
	]);

	db.insert(schema.assessments)
		.values({
			id: assessment1Id,
			courseId: course3BMathId,
			title: '1. Schularbeit (Gleichungen & Geometrie)',
			type: 'schularbeit',
			date: '2026-10-06',
			maxPoints: 48,
			gradingScale: defaultScale,
			isCounted: true
		})
		.run();

	// Assessment Results & Returns
	const studentScores = [
		{ points: 46, grade: 1 }, // Max Mustermann
		{ points: 41, grade: 2 }, // Anna Huber
		{ points: 32, grade: 3 }, // Lukas Gruber
		{ points: 21, grade: 5 }, // Sophie Weber -> Negativ!
		{ points: 44, grade: 1 }, // Felix Hofer
		{ points: 27, grade: 4 }, // Elena Pichler
		{ points: 30, grade: 3 }, // David Bauer
		{ points: 38, grade: 2 }, // Laura Steiner
		{ points: 23, grade: 5 }, // Tobias Mayer -> Negativ!
		{ points: 35, grade: 3 } // Julia Moser
	];

	for (let i = 0; i < studentIds3B.length; i++) {
		const sId = studentIds3B[i];
		const score = studentScores[i];

		db.insert(schema.assessmentResults)
			.values({
				id: crypto.randomUUID(),
				assessmentId: assessment1Id,
				studentId: sId,
				points: score.points,
				grade: score.grade,
				isAbsent: false,
				isMadeUp: false
			})
			.run();

		// Return status
		// Student 0, 1, 2, 4 have signed and returned
		// Student 3 (Sophie Weber) is OVERDUE! returned on 2026-10-08, due on 2026-10-15 (today is 2026-10-18)
		// Student 8 (Tobias Mayer) is also OVERDUE!
		const isSigned = i !== 3 && i !== 8;
		db.insert(schema.assessmentReturns)
			.values({
				id: crypto.randomUUID(),
				assessmentId: assessment1Id,
				studentId: sId,
				returnedDate: '2026-10-08',
				dueDate: '2026-10-15', // Overdue!
				isSigned,
				signedDate: isSigned ? '2026-10-12' : null,
				snoozedUntil: null
			})
			.run();
	}

	// 8. Early Warning (Frühwarnung) for Sophie Weber (Index 3)
	const ewId = crypto.randomUUID();
	db.insert(schema.earlyWarnings)
		.values({
			id: ewId,
			studentId: studentIds3B[3], // Sophie Weber
			courseId: course3BMathId,
			semester: 1,
			issuedDate: '2026-10-09',
			reason: '1. Schularbeit Nicht Genügend (21/48 Pkt.), Mitarbeit rückläufig',
			dueDate: '2026-10-16', // Overdue!
			isSigned: false,
			signedDate: null,
			snoozedUntil: null,
			status: 'issued'
		})
		.run();

	// 9. Observation: Kopfrechnen & Bruchrechnen
	const obsId = crypto.randomUUID();
	db.insert(schema.observations)
		.values({
			id: obsId,
			courseId: course3BMathId,
			title: 'Mitarbeitsbeobachtung: Bruchrechnen',
			date: '2026-10-14',
			maxPoints: 10,
			description: 'Kürzen, Erweitern und Textaufgaben'
		})
		.run();

	const obsScores = [9, 8.5, 6, 4, 10, 6.5, 7, 8, 3.5, 7.5];
	for (let i = 0; i < studentIds3B.length; i++) {
		db.insert(schema.observationScores)
			.values({
				id: crypto.randomUUID(),
				observationId: obsId,
				studentId: studentIds3B[i],
				points: obsScores[i],
				note: obsScores[i] < 5 ? 'Braucht noch Übung' : null
			})
			.run();
	}

	// 10. Homework
	const hwId = crypto.randomUUID();
	db.insert(schema.homeworks)
		.values({
			id: hwId,
			courseId: course3BMathId,
			title: 'Buch S. 42 Nr. 12-15',
			dueDate: '2026-10-16',
			description: 'Gleichungssysteme graphisch lösen'
		})
		.run();

	for (let i = 0; i < studentIds3B.length; i++) {
		const status = i === 3 ? 'forgotten' : i === 8 ? 'partial' : 'done';
		db.insert(schema.homeworkStatuses)
			.values({
				id: crypto.randomUUID(),
				homeworkId: hwId,
				studentId: studentIds3B[i],
				status,
				note: status === 'forgotten' ? 'HÜ vergessen' : null
			})
			.run();
	}

	// 11. Notes
	db.insert(schema.notes)
		.values([
			{
				id: crypto.randomUUID(),
				studentId: studentIds3B[3], // Sophie Weber
				courseId: course3BMathId,
				date: '2026-10-10',
				category: 'elterngespraech',
				title: 'Telefonat mit Mutter bezüglich Frühwarnung',
				content: 'Mutter informiert über Schularbeitsnote und Förderunterricht am Mittwoch angeboten.'
			},
			{
				id: crypto.randomUUID(),
				studentId: studentIds3B[0], // Max Mustermann
				courseId: course3BMathId,
				date: '2026-09-25',
				category: 'foerderung',
				title: 'Mathe-Olympiade Einladung',
				content: 'Sehr starke Leistungen, Unterlagen für die Vorausscheidung übergeben.'
			}
		])
		.run();

	return { message: 'Database seeded successfully with fictional data' };
}
