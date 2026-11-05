# PROJEKTWISSEN – Notenmanager (UnterrichtsManager)

> **Pflege-Regel:** Betrifft eine Änderung etwas, das hier beschrieben ist (Datei, Tabelle, Route, Regel, Befehl),
> wird diese Datei **im selben Commit** angepasst. Nur dauerhaft gültiges Wissen, nichts Aufgabenspezifisches.
> Im Projekt keine Datei mit „CLAUDE“ im Namen anlegen.

## Überblick

Web-App für **eine Lehrkraft** (österr. Schulsystem, Mathe/Physik): Mitarbeit, Hausübungen, Tests/Schularbeiten,
Beobachtungen, Stundeneinträge, Notenvorschlag, Frühwarnungen (§ 19 Abs 4 SchUG), Rücklauf-Fristen, WebUntis-Import/-Export.

| Bereich | Technik |
|---|---|
| Framework | SvelteKit 3, Svelte 5 (**Runes-Modus erzwungen**, `vite.config.ts`), adapter-node |
| Styling | Tailwind CSS v4 (`src/routes/layout.css` = nur `@import 'tailwindcss'`), dunkles Slate-Design, kein `dark:` |
| Icons | `@lucide/svelte` (`lucide-svelte` steht in package.json, wird nicht verwendet) |
| DB | SQLite über `better-sqlite3` + Drizzle ORM (Schema/Typen), viel rohes SQL via `sqlite.prepare` |
| Auth | Argon2 (`@node-rs/argon2`), Session-Cookie, optional TOTP (`otpauth`) |
| Sonstiges | `web-push` (VAPID), `xlsx` + `papaparse` (Import/Export), Vitest |
| Deployment | Docker (Node 24), hinter Caddy (`Caddyfile.snippet`), Backup-Skript `scripts/backup.sh` |

```
src/
  hooks.server.ts            Session prüfen, Login-Pflicht, Seed beim Start
  lib/server/db/             index.ts (Verbindung + initDb/Migrationen), schema.ts (Drizzle), seed.ts
  lib/server/auth/           Sessions, TOTP
  lib/server/repositories/   Datenzugriff je Entität (*.repository.ts, Objekt-Literal `xyzRepository`)
  lib/server/reminders/      dispatcher.ts: überfällige Rückläufe, Frühwarn-Erinnerungen, Web-Push
  lib/server/bgbb/           client.ts: Schülerimport aus der Bot-API von BGBB Admin
  lib/services/              reine Fachlogik (ohne HTTP), mit *.test.ts
  lib/components/course/     Tabs der Kursseite (Course*Tab.svelte)
  lib/components/assessments/ Notenschlüssel-Editor, Vorlagen-Manager, Statistik-Chart
  routes/                    Seiten + API
static/                      manifest.json, sw.js (Push), icon.svg
data/notenmanager.db         lokale DB (gitignored)
```

## Befehle

| Zweck | Befehl |
|---|---|
| Dev-Server | `npm run dev` |
| Tests (einmalig) | `npm run test` (Vitest, nur `src/**/*.test.ts`, Node-Umgebung) |
| Tests (Watch) | `npm run test:unit` |
| Typprüfung | `npm run check` |
| Build | `npm run build` → `build/`, Start mit `node build/index.js` |
| Docker | `docker compose up -d --build` (`.env` aus `.env.example`) |

Lokaler Login (Seed): `lehrer` / `notenmanager123` (oder `ADMIN_PASSWORD`).
Vitest: `expect.requireAssertions: true` → jeder Test braucht mindestens ein `expect`.

## Umgebungsvariablen

| Variable | Bedeutung |
|---|---|
| `DATABASE_URL` | Pfad zur SQLite-Datei (Standard `./data/notenmanager.db`, Docker `/app/data/notenmanager.db`) |
| `ADMIN_PASSWORD` | Passwort für `lehrer` beim **ersten** Seed |
| `ORIGIN`, `PROTOCOL_HEADER` | hinter Caddy nötig (CSRF/Cookie-Secure) |
| `HOST_PORT`, `HOST_BIND` | Port-Mapping in docker-compose |
| `DATA_DIR` | Docker: Host-Ordner für `/app/data` (Bind-Mount, Standard `./data`, Besitzer UID 1000; früher benanntes Volume `notenmanager_data`) |
| `NODE_ENV=production` | Seed legt dann keine fiktiven Demo-Daten an |
| `BGBB_API_URL`, `BGBB_API_KEY` | optional: Anbindung BGBB Admin; sind beide gesetzt, gehen sie den Einstellungen vor (`bgbb_api_url`, `bgbb_api_key` in `settings`) |

VAPID-Keys werden automatisch erzeugt und in `settings` gespeichert (`vapid_public_key`, `vapid_private_key`).

## Backend

- **`hooks.server.ts`**: ruft `seedDatabase()` beim Start; ohne Session Redirect 303 auf `/login`.
  Öffentlich: `/login*`, `/manifest.json`, `/sw.js`, `/icon.svg`, `/api/push/public-key`.
- **Sessions**: Cookie `notenmanager_session`, in DB als SHA-256-Hash gespeichert, 30 Tage, verlängert ab Halbzeit.
- **CSRF**: `csrf.trustedOrigins: ['*']` in `vite.config.ts`.
- **Logik-Schichten**: Route (`+page.server.ts`, Form Actions) → Repository oder direkt `sqlite`/`db` → Services für Berechnungen.
  Routen greifen oft auch direkt per SQL zu.
- **Alias**: `$lib` (in `vite.config.ts` explizit gesetzt, nötig für den Prod-Build mit SvelteKit 3), zusätzlich `#lib` (package.json `imports`).
  `npm run check` warnt deshalb über veraltetes `config.alias` und überschriebene `paths` – bekannt, kein Fehler.

### Routen

| Route | Inhalt / wichtige Actions |
|---|---|
| `/` | Dashboard: überfällige Rückläufe, Frühwarn-Erinnerungen; `markReturnSigned`, `snooze`, `recordAsked`, `triggerPushCheck` … |
| `/stundenansicht` | Mobile Erfassung im Unterricht: `setParticipation`, `setHomeworkStatus`, `quickNote`, Stundennotizen, Rücklauf-Schnellaktionen |
| `/klassen` | Klassen anlegen, WebUntis-Import (`parseUpload` → Vorschau → `commitImport`), BGBB-Import (`bgbbLoadClasses` → `bgbbPreview` → `bgbbCommit`) |
| `/klassen/[id]` | Schülerliste: `addStudent`, `toggleStatus`, `renumberAlphabetically`, `updateStudent` |
| `/kurse` | Kurse (Klasse + Fach) anlegen |
| `/kurse/[id]?tab=…` | Kursseite mit Tabs, größte Action-Datei (Tests, Beobachtungen, Stunden, HÜ, Frühwarnungen, Gewichtung, Endnote) |
| `/schueler/[id]` | Schülerkarte: Gesamtübersicht, Notizen (`addNote`, `deleteNote`), `updateStudent` |
| `/einstellungen` | Einstellungen, BGBB-Anbindung (`updateBgbbSettings`, `testBgbbConnection`), Passwort, TOTP, Notenschlüssel-Vorlagen, `resetFictionalData` |
| `/login`, `/logout` | Anmeldung (mit TOTP), Abmeldung (GET+POST) |
| `/api/backup/download`, `/api/backup/upload` | SQLite-Backup herunterladen / wiederherstellen (max. 50 MB) |
| `/api/export/webuntis` | Notenliste als xlsx/csv |
| `/api/push/public-key`, `/api/push/subscribe` | Web-Push |

Tab-IDs der Kursseite: `noten`, `hausuebungen`, `tests`, `beobachtungen` (Haupttabs), `stunden`, `fruehwarnungen`,
`gewichtung` (unter „Weiteres“). Weitere Query-Parameter: `assessmentId`, `studentId`.

`+layout.server.ts` lädt für alle Seiten: aktuelles Schuljahr (`is_current`, sonst neuestes), Klassen, Kurse, Anzahl Überfälliger.

## Frontend

- Svelte 5 Runes (`$state`, `$derived`, `$props`, `$effect`); Formulare über `use:enhance` + Form Actions.
- Speichern zeigt **Toasts als fixe, schwebende Overlays** (keine Layout-Sprünge); Punkteingaben speichern automatisch,
  Fokus/Tab-Position darf dabei nicht verloren gehen.
- Hauptnavigation (`src/routes/+layout.svelte`): Hausübung, Tests & Schularbeiten, Beobachtungen springen direkt in den
  Kurs-Tab (aktueller Kurs, sonst erster Kurs); bei mehreren Kursen Auswahl über Dropdown.
- Kursseite `src/routes/kurse/[id]/+page.svelte` ist nur Tab-Leiste; Inhalte in `src/lib/components/course/Course*Tab.svelte`.
- PWA: `static/manifest.json`, `static/sw.js` (Push-Empfang).

## Datenmodell

IDs sind `TEXT` (`crypto.randomUUID()`), Datumsfelder `TEXT` im Format `YYYY-MM-DD`, Zeitstempel `INTEGER` (ms).
Booleans als `INTEGER 0/1`. Fremdschlüssel mit `ON DELETE CASCADE` (Ausnahme `notes.course_id` → `SET NULL`).

| Tabelle | Zweck / Besonderheiten |
|---|---|
| `users`, `sessions` | Login, TOTP |
| `school_years` | Semesterenden, Notenschluss- und Frühwarnfristen, `is_current` |
| `classes` → `students` | Schüler: `catalog_number`, `webuntis_id`, `schkz` (aus BGBB Admin), `status` `active`/`inactive` |
| `courses` | Klasse + Fach + Gewichte (`weight_schularbeiten` 40, `tests` 20, `participation` 25, `observations` 10, `homework` 5) |
| `participation_entries` | Mitarbeit `plus`/`tilde`/`minus`, **eindeutig je Kurs+Schüler+ISO-Woche** |
| `observations` → `observation_scores` | Beobachtungen mit Punkten; `note` global bzw. je Schüler |
| `assessments` → `assessment_results` | `type` `schularbeit`/`test`/`wiederholung`; `grading_scale` als JSON; `is_counted`; Ergebnis mit `is_absent`, `is_made_up` |
| `assessment_returns` | Rücklauf unterschriebener Arbeiten: `due_date`, `is_signed`, `snoozed_until` |
| `early_warnings` | Frühwarnungen, `status` `draft`/`issued`/`resolved`, eigener Rücklauf |
| `reminder_logs` | `asked`/`push_sent`/`snoozed` für Rückläufe und Frühwarnungen |
| `homeworks` → `homework_statuses` | `done`/`partial`/`forgotten` |
| `lesson_entries` → `lesson_student_notes` | Stundeneinträge (Thema, globale Notiz) + Notiz je Schüler |
| `notes` | Schülernotizen, `category` `elterngespraech`/`auffaelligkeit`/`foerderung`/`allgemein` |
| `course_final_grades` | Endnote je Kurs+Schüler+Semester (`manual_grade` überschreibt Vorschlag) |
| `settings` | Key/Value: `teacher_name`, `default_return_days` (7), `early_warning_threshold` (4.5), VAPID-Keys |
| `grading_scale_templates` | Notenschlüssel-Vorlagen, höchstens eine mit `is_default = 1` |

Eindeutige Indizes je (Eltern-ID, `student_id`) auf Ergebnissen, Rückläufen, HÜ-Status, Beobachtungs-Punkten, Stunden-Notizen.

### Migrationen

- **Kein drizzle-kit-Workflow** (keine Migrationsdateien, keine drizzle.config). `initDb()` in `src/lib/server/db/index.ts`
  legt alle Tabellen mit `CREATE TABLE IF NOT EXISTS` an und läuft bei jedem Start.
- Neue Spalte für bestehende DBs: in **drei Stellen** eintragen:
  1. `schema.ts` (Drizzle),
  2. `CREATE TABLE` in `initDb()`,
  3. `ALTER TABLE … ADD COLUMN` im `try { } catch {}`-Block in `initDb()`.
- Neue Tabelle: `schema.ts` + `initDb()`; ggf. in die `DELETE`-Liste von `seedDatabase(force)` aufnehmen.
- Backup-Restore (`api/backup/upload`) kopiert je Tabelle nur die Spalten, die in Backup **und** aktueller DB existieren
  → ältere Backups ohne neue Spalten bleiben einspielbar (neue Spalten sind danach leer).
  Neue Spalten trotzdem am Ende des `CREATE TABLE` führen (gleiche Reihenfolge wie nach `ALTER`).

## Fachliche Regeln

- **Notenschlüssel** (`services/grading.ts`): Standard 88/75/60/50 %; Note = erste Schwelle mit `percent + 1e-9 >= minPercent`
  (nur Float-Rauschen tolerieren, nie aufrunden). Vorlagen: `austrian-standard` (Default), `strict`, `lenient`, `linear-four-step`.
- **Notenvorschlag** (`calculateGradeSuggestion`): gewichteter Schnitt nur über Teilbereiche **mit Daten**
  (Gewicht leerer Bereiche fällt weg). Vorschlag = `Math.round(rawAverage)`, begrenzt auf 1–5.
  - Schularbeiten/Tests: Durchschnitt der Noten; `wiederholung` zählt als Test; `is_absent` und `is_counted = 0` werden ignoriert.
  - Mitarbeit: `3 − 2·(plus − minus)/gesamt` (Tilde zählt nur im Nenner).
  - HÜ: done 100 %, partial 50 %, forgotten 0 % → über Standardschlüssel in Note.
  - Beobachtungen: Summe Punkte / Summe Max → Standardschlüssel.
- **Frühwarnung vorschlagen** (`services/earlywarning.ts`), wenn eins zutrifft: ungerundeter Schnitt ≥ Schwelle (4.5),
  eine Schularbeit mit 5, ≥ 2 Tests mit 5, Mitarbeit ≥ 3 Minus und mehr Minus als Plus, ≥ 3 vergessene HÜ.
  Semester: Datum ≤ `first_semester_end` → 1, sonst 2.
- **Frühwarn-Erinnerung** nach Tests: 7 bis 60 Tage nach dem Testdatum (`isAssessmentEarlyWarningDue`), keine fixen Fristen mehr.
- **Überfällig**: nicht unterschrieben, `due_date < heute`, außer `snoozed_until > heute`. Snooze-Schnellaktion +3 Tage.
- **Rücklauffrist** Standard 7 Tage (`default_return_days`).
- **Mitarbeit**: eine Bewertung pro Schüler, Kurs und ISO-Kalenderwoche; erneutes Tippen desselben Werts löscht sie.
- **Hausübungen**: neue HÜ startet **ohne** Status-Einträge (alle „offen“, `pendingCount` = aktive Schüler − erfasste).
  Status setzen über `homeworkRepository.toggleStatus` (gleicher Wert erneut → Eintrag gelöscht, wieder offen);
  `markAllDone` setzt alle aktiven Schüler auf `done`, `resetAll` löscht alle Status. Gleiche Logik in Kursseite und Stundenansicht.
- **Katalognummern**: beim Import automatisch alphabetisch (Nachname, dann Vorname, deutsche Sortierung) vergeben;
  `renumberAlphabetically` nummeriert neu.
- **Schülerabgleich** (`services/reconciliation.ts`, gespeichert über `studentRepository.importRoster`, gilt für WebUntis
  und BGBB): Zuordnung in der Reihenfolge SchKz → WebUntis-ID → Name (normalisiert, ohne Groß/Klein und Akzente).
  Gleicher Name mit **anderer** SchKz ist eine andere Person. Fehlende Schüler werden nur `inactive`, nie gelöscht.
  Namen werden nur bei echter Änderung überschrieben (z. B. Namenswechsel bei gleicher SchKz).
- **BGBB-Import** (`lib/server/bgbb/client.ts`): nutzt `GET /api/v1/bot/classes` und `/classes/:klasse` von BGBB Admin
  (Header `x-api-key`, Key mit Recht „read“). Übernommen werden nur Vorname, Familienname, SchKz; Katalognummern alphabetisch.
  Klassen werden über den Namen (ohne Groß/Klein) im aktuellen Schuljahr zugeordnet, fehlende neu angelegt.
  BGBB liefert die dort **aktive** Schuljahres-DB – passt sie nicht zum aktuellen Schuljahr hier, landen falsche Listen im Import.
  Der API-Key wird nur serverseitig verwendet und nie an den Browser geschickt (liegt aber in `settings` und damit im Backup).
- **Datum/Zeitzone**: `services/dates.ts` verwenden (`todayVienna`, `addDays` in UTC-Arithmetik, `getIsoWeekAndYear`).
  Achtung: einige Stellen nutzen noch `new Date().toISOString().slice(0, 10)` (UTC) – kann kurz nach Mitternacht abweichen.
- **Push** wird nur manuell ausgelöst (Action `triggerPushCheck` auf `/`), es gibt keinen Zeitplan im Server.
- **Seed**: nur wenn noch kein User existiert; Demo-Daten nur ohne `NODE_ENV=production`, ausschließlich fiktive Namen.

## Arbeitsweise

- Commits: Conventional-Commit-Stil auf Englisch (`feat: …`, `fix: …`, `fix(docker): …`, `chore(deploy): …`);
  einzelne deutsche Commits kommen vor.
- Neue Fachlogik nach `src/lib/services/` mit `*.test.ts` daneben; DB-Zugriff in Repositories.
- Vor Commit: `npm run check` und `npm run test`.
- **Öffentliches Repo**: keine echten Schülerdaten committen. `.gitignore` sperrt `*.db`, `*.sqlite`, `data/`, `*.xlsx`, `*.csv`, `.env`.
- UI-Texte auf Deutsch (österreichische Begriffe: Schularbeit, Hausübung, Katalognummer).
