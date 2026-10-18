import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// --- Auth & Sessions ---
export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	totpSecret: text('totp_secret'),
	totpEnabled: integer('totp_enabled', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at').notNull()
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at').notNull()
});

// --- School Structure ---
export const schoolYears = sqliteTable('school_years', {
	id: text('id').primaryKey(),
	name: text('name').notNull(), // e.g. "2026/27"
	startDate: text('start_date').notNull(), // YYYY-MM-DD
	endDate: text('end_date').notNull(),
	firstSemesterEnd: text('first_semester_end').notNull(),
	secondSemesterEnd: text('second_semester_end').notNull(),
	gradingDeadline1: text('grading_deadline_1').notNull(), // Notenschluss 1. Sem
	gradingDeadline2: text('grading_deadline_2').notNull(), // Notenschluss 2. Sem
	earlyWarningDeadline1: text('early_warning_deadline_1').notNull(), // Frühwarnfrist 1. Sem
	earlyWarningDeadline2: text('early_warning_deadline_2').notNull(), // Frühwarnfrist 2. Sem
	isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(false)
});

export const classes = sqliteTable('classes', {
	id: text('id').primaryKey(),
	name: text('name').notNull(), // e.g. "3B"
	schoolYearId: text('school_year_id')
		.notNull()
		.references(() => schoolYears.id, { onDelete: 'cascade' }),
	room: text('room')
});

export const students = sqliteTable('students', {
	id: text('id').primaryKey(),
	classId: text('class_id')
		.notNull()
		.references(() => classes.id, { onDelete: 'cascade' }),
	firstName: text('first_name').notNull(),
	lastName: text('last_name').notNull(),
	webuntisId: text('webuntis_id'),
	catalogNumber: integer('catalog_number'), // Katalognummer
	status: text('status').notNull().default('active'), // 'active' | 'inactive'
	notes: text('notes')
});

export const courses = sqliteTable('courses', {
	id: text('id').primaryKey(),
	classId: text('class_id')
		.notNull()
		.references(() => classes.id, { onDelete: 'cascade' }),
	schoolYearId: text('school_year_id')
		.notNull()
		.references(() => schoolYears.id, { onDelete: 'cascade' }),
	subject: text('subject').notNull(), // e.g. "Mathematik", "Physik"
	weightSchularbeiten: real('weight_schularbeiten').notNull().default(40),
	weightTests: real('weight_tests').notNull().default(20),
	weightParticipation: real('weight_participation').notNull().default(25),
	weightObservations: real('weight_observations').notNull().default(10),
	weightHomework: real('weight_homework').notNull().default(5)
});

// --- Participation (Mitarbeit wöchentlich) ---
export const participationEntries = sqliteTable('participation_entries', {
	id: text('id').primaryKey(),
	courseId: text('course_id')
		.notNull()
		.references(() => courses.id, { onDelete: 'cascade' }),
	studentId: text('student_id')
		.notNull()
		.references(() => students.id, { onDelete: 'cascade' }),
	date: text('date').notNull(), // YYYY-MM-DD
	weekNumber: integer('week_number').notNull(),
	year: integer('year').notNull(),
	value: text('value').notNull(), // 'plus' | 'tilde' | 'minus'
	comment: text('comment'),
	createdAt: integer('created_at').notNull()
});

// --- Observations (Mitarbeitsbeobachtungen mit Punkten) ---
export const observations = sqliteTable('observations', {
	id: text('id').primaryKey(),
	courseId: text('course_id')
		.notNull()
		.references(() => courses.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	date: text('date').notNull(), // YYYY-MM-DD
	maxPoints: real('max_points').notNull(),
	description: text('description')
});

export const observationScores = sqliteTable('observation_scores', {
	id: text('id').primaryKey(),
	observationId: text('observation_id')
		.notNull()
		.references(() => observations.id, { onDelete: 'cascade' }),
	studentId: text('student_id')
		.notNull()
		.references(() => students.id, { onDelete: 'cascade' }),
	points: real('points').notNull(),
	note: text('note')
});

// --- Tests & Schularbeiten ---
export const assessments = sqliteTable('assessments', {
	id: text('id').primaryKey(),
	courseId: text('course_id')
		.notNull()
		.references(() => courses.id, { onDelete: 'cascade' }),
	title: text('title').notNull(), // z.B. "1. Schularbeit", "Kapitel 2 Test"
	type: text('type').notNull(), // 'schularbeit' | 'test' | 'wiederholung'
	date: text('date').notNull(), // YYYY-MM-DD
	maxPoints: real('max_points').notNull(),
	gradingScale: text('grading_scale').notNull(), // JSON string: [{ grade: 1, minPercent: 88 }, ...]
	isCounted: integer('is_counted', { mode: 'boolean' }).notNull().default(true)
});

export const assessmentResults = sqliteTable('assessment_results', {
	id: text('id').primaryKey(),
	assessmentId: text('assessment_id')
		.notNull()
		.references(() => assessments.id, { onDelete: 'cascade' }),
	studentId: text('student_id')
		.notNull()
		.references(() => students.id, { onDelete: 'cascade' }),
	points: real('points'),
	grade: integer('grade'), // 1..5
	isAbsent: integer('is_absent', { mode: 'boolean' }).notNull().default(false),
	isMadeUp: integer('is_made_up', { mode: 'boolean' }).notNull().default(false),
	note: text('note')
});

export const assessmentReturns = sqliteTable('assessment_returns', {
	id: text('id').primaryKey(),
	assessmentId: text('assessment_id')
		.notNull()
		.references(() => assessments.id, { onDelete: 'cascade' }),
	studentId: text('student_id')
		.notNull()
		.references(() => students.id, { onDelete: 'cascade' }),
	returnedDate: text('returned_date'), // YYYY-MM-DD (wann ausgeteilt)
	dueDate: text('due_date').notNull(), // YYYY-MM-DD (Rückgabefrist unterschrieben)
	isSigned: integer('is_signed', { mode: 'boolean' }).notNull().default(false),
	signedDate: text('signed_date'), // YYYY-MM-DD (wann unterschrieben retourniert)
	snoozedUntil: text('snoozed_until') // YYYY-MM-DD (Snooze Datum)
});

// --- Frühwarnungen ---
export const earlyWarnings = sqliteTable('early_warnings', {
	id: text('id').primaryKey(),
	studentId: text('student_id')
		.notNull()
		.references(() => students.id, { onDelete: 'cascade' }),
	courseId: text('course_id')
		.notNull()
		.references(() => courses.id, { onDelete: 'cascade' }),
	semester: integer('semester').notNull().default(1),
	issuedDate: text('issued_date').notNull(), // YYYY-MM-DD
	reason: text('reason').notNull(),
	dueDate: text('due_date').notNull(), // YYYY-MM-DD
	isSigned: integer('is_signed', { mode: 'boolean' }).notNull().default(false),
	signedDate: text('signed_date'),
	snoozedUntil: text('snoozed_until'),
	status: text('status').notNull().default('issued') // 'draft' | 'issued' | 'resolved'
});

// --- Reminder Log (Nachgefragt, Push, etc.) ---
export const reminderLogs = sqliteTable('reminder_logs', {
	id: text('id').primaryKey(),
	entityType: text('entity_type').notNull(), // 'assessment_return' | 'early_warning'
	entityId: text('entity_id').notNull(),
	date: text('date').notNull(), // ISO datetime or YYYY-MM-DD
	type: text('type').notNull(), // 'asked' | 'push_sent' | 'snoozed'
	note: text('note')
});

// --- Web Push Subscriptions ---
export const pushSubscriptions = sqliteTable('push_subscriptions', {
	id: text('id').primaryKey(),
	endpoint: text('endpoint').notNull().unique(),
	p256dh: text('p256dh').notNull(),
	auth: text('auth').notNull(),
	createdAt: integer('created_at').notNull(),
	userAgent: text('user_agent')
});

// --- Hausübungen ---
export const homeworks = sqliteTable('homeworks', {
	id: text('id').primaryKey(),
	courseId: text('course_id')
		.notNull()
		.references(() => courses.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	dueDate: text('due_date').notNull(), // YYYY-MM-DD
	description: text('description')
});

export const homeworkStatuses = sqliteTable('homework_statuses', {
	id: text('id').primaryKey(),
	homeworkId: text('homework_id')
		.notNull()
		.references(() => homeworks.id, { onDelete: 'cascade' }),
	studentId: text('student_id')
		.notNull()
		.references(() => students.id, { onDelete: 'cascade' }),
	status: text('status').notNull().default('done'), // 'done' | 'partial' | 'forgotten'
	note: text('note')
});

// --- Notizen (Elterngespräche, Auffälligkeiten, Förderung) ---
export const notes = sqliteTable('notes', {
	id: text('id').primaryKey(),
	studentId: text('student_id')
		.notNull()
		.references(() => students.id, { onDelete: 'cascade' }),
	courseId: text('course_id').references(() => courses.id, { onDelete: 'set null' }),
	date: text('date').notNull(), // YYYY-MM-DD
	category: text('category').notNull(), // 'elterngespraech' | 'auffaelligkeit' | 'foerderung' | 'allgemein'
	title: text('title').notNull(),
	content: text('content').notNull()
});

// --- Final Manual Grades ---
export const courseFinalGrades = sqliteTable('course_final_grades', {
	id: text('id').primaryKey(),
	courseId: text('course_id')
		.notNull()
		.references(() => courses.id, { onDelete: 'cascade' }),
	studentId: text('student_id')
		.notNull()
		.references(() => students.id, { onDelete: 'cascade' }),
	semester: integer('semester').notNull().default(1),
	suggestedGrade: real('suggested_grade'),
	manualGrade: integer('manual_grade'), // 1..5
	note: text('note')
});

// --- Global Settings ---
export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

// --- Notenschlüssel-Vorlagen (Grading Scale Templates) ---
export const gradingScaleTemplates = sqliteTable('grading_scale_templates', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	description: text('description'),
	scaleJson: text('scale_json').notNull(),
	isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at').notNull()
});

// --- Relations ---
export const classesRelations = relations(classes, ({ one, many }) => ({
	schoolYear: one(schoolYears, {
		fields: [classes.schoolYearId],
		references: [schoolYears.id]
	}),
	students: many(students),
	courses: many(courses)
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
	class: one(classes, {
		fields: [students.classId],
		references: [classes.id]
	}),
	participationEntries: many(participationEntries),
	assessmentResults: many(assessmentResults),
	assessmentReturns: many(assessmentReturns),
	earlyWarnings: many(earlyWarnings),
	notes: many(notes),
	observationScores: many(observationScores),
	homeworkStatuses: many(homeworkStatuses)
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
	class: one(classes, {
		fields: [courses.classId],
		references: [classes.id]
	}),
	schoolYear: one(schoolYears, {
		fields: [courses.schoolYearId],
		references: [schoolYears.id]
	}),
	assessments: many(assessments),
	observations: many(observations),
	homeworks: many(homeworks),
	participationEntries: many(participationEntries),
	earlyWarnings: many(earlyWarnings)
}));

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
	course: one(courses, {
		fields: [assessments.courseId],
		references: [courses.id]
	}),
	results: many(assessmentResults),
	returns: many(assessmentReturns)
}));

export const assessmentReturnsRelations = relations(assessmentReturns, ({ one }) => ({
	assessment: one(assessments, {
		fields: [assessmentReturns.assessmentId],
		references: [assessments.id]
	}),
	student: one(students, {
		fields: [assessmentReturns.studentId],
		references: [students.id]
	})
}));

export const earlyWarningsRelations = relations(earlyWarnings, ({ one }) => ({
	student: one(students, {
		fields: [earlyWarnings.studentId],
		references: [students.id]
	}),
	course: one(courses, {
		fields: [earlyWarnings.courseId],
		references: [courses.id]
	})
}));
