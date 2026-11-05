# PROJEKTWISSEN – Notenmanager (UnterrichtsManager)

> **Pflege-Regel:** Betrifft eine Änderung etwas, das hier beschrieben ist (Datei, Tabelle, Route, Regel, Befehl),
> wird diese Datei **im selben Commit** angepasst. Nur dauerhaft gültiges Wissen, nichts Aufgabenspezifisches.
> Im Projekt keine Datei mit „CLAUDE“ im Namen anlegen.

## Überblick

Multi-User-Web-App für Lehrkräfte, Administration und Schüler (österr. Schulsystem, Mathe/Physik u. a.): Mitarbeit, Hausübungen, Tests/Schularbeiten,
Beobachtungen, Stundeneinträge, Notenvorschlag, Frühwarnungen (§ 19 Abs 4 SchUG), Rücklauf-Fristen, WebUntis-/BGBB-Import und -Export.

| Bereich | Technik |
|---|---|
| Framework | SvelteKit 3, Svelte 5 (**Runes-Modus erzwungen**, `vite.config.ts`), adapter-node |
| Styling | Tailwind CSS v4 (`src/routes/layout.css` = nur `@import 'tailwindcss'`), dunkles Slate-Design, kein `dark:` |
| Icons | `@lucide/svelte` (`lucide-svelte` steht in package.json, wird nicht verwendet) |
| DB | SQLite über `better-sqlite3` + Drizzle ORM (Schema/Typen), viel rohes SQL via `sqlite.prepare` |
| Auth | Argon2 (`@node-rs/argon2`), Session-Cookie, optional TOTP (`otpauth`), Microsoft 365 / Entra ID SSO (OIDC/PKCE), Rollen (`admin`, `teacher`, `student`) |
| Sonstiges | `web-push` (VAPID), `xlsx` + `papaparse` (Import/Export), Vitest (`fileParallelism: false`) |
| Deployment | Docker (Node 24), hinter Caddy (`Caddyfile.snippet`), Backup-Skript `scripts/backup.sh` |

```
src/
  hooks.server.ts            Session prüfen, Login-Pflicht, Rollen-Guards (Schüler/Lehrer), Seed beim Start
  lib/server/db/             index.ts (Verbindung + initDb/Migrationen), schema.ts (Drizzle), seed.ts
  lib/server/auth/           index.ts (Sessions), totp.ts, access.ts (Guards), entra.ts (Microsoft 365 / Entra ID SSO)
  lib/server/repositories/   Datenzugriff je Entität (*.repository.ts, Objekt-Literal `xyzRepository`)
  lib/server/reminders/      dispatcher.ts: überfällige Rückläufe, Frühwarn-Erinnerungen, Web-Push (je Lehrkraft)
  lib/server/bgbb/           client.ts: Schülerimport & Query aus der Bot-API von BGBB Admin
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

Lokaler Login (Seed beim ersten Start mit leerer DB):
- Admin/Lehrer 1: `lehrer` / `notenmanager123` (oder `ADMIN_PASSWORD`) – Kurse `3B Mathematik`, `3B Physik`, `7A Physik`
- Demo-Lehrer 2 (nur Dev): `lehrer2` / `notenmanager123` – Kurs `3B Biologie` (wird nur beim ersten DB-Setup angelegt, nicht bei jedem Neustart)

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
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` | optional: Microsoft 365 / Entra ID SSO (alternativ in den Einstellungen hinterlegbar) |

VAPID-Keys werden automatisch erzeugt und in `settings` gespeichert (`vapid_public_key`, `vapid_private_key`).

## Multi-User, Rollen und Zugriffsschutz

### Rollen (`users.role`)
- **`teacher`** (Standard): verwaltet eigene Kurse (`courses.teacher_id = user.id`), sieht Klassen und Schüler stammdatenmäßig, auf `/schueler/[id]` und `/klassen/[id]` aber nur Noten/Daten aus eigenen Kursen bzw. eigene Notizen (`notes.author_id = user.id`).
- **`admin`**: ist eine Lehrkraft mit Zusatzrechten. Sieht ebenfalls **nur die eigenen Kurse** (keine fremden Kurse). Darf zusätzlich:
  - Klassen anlegen, WebUntis-/BGBB-Import durchführen, Schüler anlegen/bearbeiten/deaktivieren/neu nummerieren (`/klassen`, `/klassen/[id]`, `/schueler/[id]`),
  - BGBB- und Microsoft-365-Konfiguration bearbeiten, DB-Backup herunterladen/einspielen, fiktive Testdaten zurücksetzen (`/einstellungen`, `/api/backup/*`),
  - Benutzerverwaltung `/benutzer` nutzen (Konten anlegen, aktivieren/deaktivieren, E-Mail hinterlegen, Passwort/TOTP zurücksetzen, Kurse einem anderen Lehrer übertragen).
- **`student`**: verknüpft über `users.student_id` mit `students.id`. Hat nur Lesezugriff auf `/meine-noten` (sieht pro Kurs der eigenen Klasse die gewerteten Schularbeiten/Tests mit Punkten und Note sowie eingetragene Endnoten; keine internen Lehrernotizen, Beobachtungen oder Mitarbeits-Kommentare).

### Microsoft 365 / Entra ID Single Sign-On (SSO)
- **Aktivierung:** aktiv, sobald `tenantId`, `clientId` und `clientSecret` konfiguriert sind (über `.env` oder `/einstellungen`).
- **Sicherheitsanforderungen:**
  - Multi-Tenant `common` ist strikt verboten; es wird immer die exakte Schul-Tenant-ID im Token geprüft (`claims.tid === tenantId`). Die Tenant-ID muss eine konkrete GUID aus dem Azure-Portal sein (keine Domain).
  - Als Identität werden nur verifizierte Organisations-Attribute (`preferred_username` oder `upn`) akzeptiert.
- **Endpunkte:**
  - `GET /auth/microsoft`: Erzeugt PKCE-Challenge, Nonce und State, legt ein kurzlebiges signiertes Cookie `m365_flow` ab und leitet zu Microsoft um (`openid profile email`, `prompt=select_account`).
  - `GET /auth/microsoft/callback`: Validiert State und Nonce, tauscht den Code gegen Tokens aus und liest E-Mail, Name und Entra-OID aus.
- **Benutzer-Zuordnung:**
  - **Lehrer:** müssen vorab in `/benutzer` existieren. Die Zuordnung erfolgt **ausschließlich** über die hinterlegte OID (`users.entra_oid`) oder eine explizit vom Admin hinterlegte E-Mail (`users.email`). Ein Matching über Benutzernamen oder den Teil vor dem `@` ist untersagt, um feindliche Übernahmen (z.B. Admin-Konto `lehrer`) auszuschließen. Beim ersten Login wird `users.entra_oid` fest verknüpft.
  - **Schüler:** werden anhand eindeutiger Kennungen erkannt:
    1. Direkter Match in `students.email` (aus BGBB Admin importiert).
    2. Schüler-Kennung im UPN: Muster `s<schkz>@...` gleicht direkt gegen `students.schkz` ab.
    3. Fallback: Abfrage der BGBB-Admin-Bot-API `GET /api/v1/bot/query?q=<email>`; der Treffer wird exakt auf die E-Mail geprüft und dann über die SchKz zugeordnet.
    - **Wichtig:** Eine Zuordnung nur über Vor- und Nachname ist strikt untersagt („Gleicher Name mit anderer SchKz ist eine andere Person“).
    4. Existiert noch kein Benutzer-Account für den Schüler, wird er beim ersten M365-Login automatisch in `users` angelegt (`role = 'student'`, verknüpft mit `students.id`) und direkt zu `/meine-noten` weitergeleitet.

### Guards (`hooks.server.ts` & `src/lib/server/auth/access.ts`)
- **`hooks.server.ts`**:
  - Ruft `seedDatabase()` beim Start; ohne gültige Session Redirect 303 auf `/login`.
  - Deaktivierte Benutzer (`is_active = 0`) werden bei `validateSessionToken` sofort abgemeldet und ihre Sessions gelöscht.
  - Öffentliche Pfade: `/login*`, `/auth/microsoft*`, `/manifest.json`, `/sw.js`, `/icon.svg`, `/api/push/public-key`.
  - Schüler (`role === 'student'`) dürfen nur auf `/meine-noten`, `/logout` und öffentliche Pfade; andere Seiten leiten auf `/meine-noten` um, `/api/*`-Aufrufe liefern 403.
  - Lehrer und Admins werden bei Aufruf von `/meine-noten` auf `/` umgeleitet.
- **`src/lib/server/auth/access.ts`**:
  - `requireUser(locals)` (401), `requireTeacher(locals)` (403 für Schüler), `requireAdmin(locals)` (403 für Nicht-Admins).
  - `assertCourseOwned(courseId, userId)`: prüft `courses.teacher_id === userId`; wirft bei fremdem oder nicht existierendem Kurs immer **404** (verhindert ID-Enumeration).
  - `guardCourseActions(actions, { courseIdParam })` / `verifyActionOwnership(formData, userId, routeCourseId)`: umschließt alle Form Actions auf `/kurse/[id]`, `/stundenansicht` und `/`. Prüft automatisch übergebene IDs sowie Klassenzugehörigkeit von Schülern.

## Backend

- **Sessions**: Cookie `notenmanager_session`, in DB als SHA-256-Hash gespeichert, 30 Tage, verlängert ab Halbzeit. `invalidateAllUserSessions(userId)` beendet alle aktiven Sessions eines Benutzers.
- **CSRF**: `csrf.trustedOrigins: ['*']` in `vite.config.ts`.
- **Logik-Schichten**: Route (`+page.server.ts`, Form Actions) → Repository oder direkt `sqlite`/`db` → Services für Berechnungen.
- **Alias**: `$lib` (in `vite.config.ts` explizit gesetzt, nötig für den Prod-Build mit SvelteKit 3), zusätzlich `#lib` (package.json `imports`).

### Routen

| Route | Inhalt / wichtige Actions |
|---|---|
| `/` | Dashboard (eigene Kurse): überfällige Rückläufe, Frühwarn-Erinnerungen; `markReturnSigned`, `snooze`, `recordAsked`, `triggerPushCheck` … (geschützt mit `guardCourseActions`) |
| `/stundenansicht` | Mobile Erfassung im Unterricht (eigene Kurse): `setParticipation`, `setHomeworkStatus`, `quickNote`, Stundennotizen, Rücklauf-Schnellaktionen (geschützt mit `guardCourseActions`) |
| `/klassen` | Klassenübersicht; nur Admin: Klassen anlegen (`create`), WebUntis-Import (`parseUpload` → `commitImport`), BGBB-Import (`bgbbLoadClasses` → `bgbbPreview` → `bgbbCommit`) |
| `/klassen/[id]` | Schülerliste & eigene Kurse der Klasse; nur Admin: `addStudent`, `toggleStatus`, `renumberAlphabetically`, `updateStudent` |
| `/kurse` | Eigene Kurse (Klasse + Fach) anlegen (`teacher_id` = aktueller Lehrer) |
| `/kurse/[id]?tab=…` | Kursseite mit Tabs (nur eigener Kurs, sonst 404), größte Action-Datei (geschützt mit `guardCourseActions`) |
| `/schueler/[id]` | Schülerkarte: Stammdaten + Kurse/Noten/Mitarbeit/Stundennotizen nur aus eigenen Kursen, eigene Notizen (`notes.author_id`); `updateStudent` nur für Admin |
| `/einstellungen` | Benutzereinstellungen (`user_settings`), Passwort, TOTP, eigene Notenschlüssel-Vorlagen; nur Admin: BGBB-Anbindung, Microsoft-365-Konfiguration (`updateEntraSettings`), Backup, `resetFictionalData` |
| `/benutzer` | Benutzerverwaltung (nur Admin): Benutzerliste, Lehrer/Admin/Schüler anlegen (inkl. E-Mail für M365), aktivieren/deaktivieren, Passwort/TOTP zurücksetzen, Kurse übertragen |
| `/meine-noten` | Schüler-Ansicht (nur `role = 'student'`, read-only): Kurse der eigenen Klasse mit gewerteten Schularbeiten/Tests und Endnoten |
| `/login`, `/logout` | Anmeldung (mit Passwort/TOTP oder Microsoft 365 SSO), Abmeldung (GET+POST) |
| `/auth/microsoft`, `/auth/microsoft/callback` | Microsoft 365 / Entra ID OIDC SSO Login-Flow |
| `/api/backup/download`, `/api/backup/upload` | SQLite-Backup herunterladen / wiederherstellen (max. 50 MB, nur Admin) |
| `/api/export/webuntis` | Notenliste als xlsx/csv (nur für eigene Kurse) |
| `/api/push/public-key`, `/api/push/subscribe` | Web-Push (Abos sind an `user_id` gebunden) |

Tab-IDs der Kursseite: `noten`, `hausuebungen`, `tests`, `beobachtungen` (Haupttabs), `stunden`, `fruehwarnungen`,
`gewichtung` (unter „Weiteres“). Weitere Query-Parameter: `assessmentId`, `studentId`.

`+layout.server.ts` lädt für Lehrer/Admins: aktuelles Schuljahr (`is_current`, sonst neuestes), Klassen, eigene Kurse, Anzahl Überfälliger in eigenen Kursen.

## Frontend

- Svelte 5 Runes (`$state`, `$derived`, `$props`, `$effect`); Formulare über `use:enhance` + Form Actions.
- Speichern zeigt **Toasts als fixe, schwebende Overlays** (keine Layout-Sprünge); Punkteingaben speichern automatisch,
  Fokus/Tab-Position darf dabei nicht verloren gehen.
- Hauptnavigation (`src/routes/+layout.svelte`): Hausübung, Tests & Schularbeiten, Beobachtungen springen direkt in den
  Kurs-Tab (aktueller Kurs, sonst erster Kurs); bei mehreren Kursen Auswahl über Dropdown. Für Admins erscheint zusätzlich `/benutzer`; für Schüler wird eine reduzierte Kopfzeile auf `/meine-noten` angezeigt.
- Kursseite `src/routes/kurse/[id]/+page.svelte` ist nur Tab-Leiste; Inhalte in `src/lib/components/course/Course*Tab.svelte`.
- PWA: `static/manifest.json`, `static/sw.js` (Push-Empfang).

## Datenmodell

IDs sind `TEXT` (`crypto.randomUUID()`), Datumsfelder `TEXT` im Format `YYYY-MM-DD`, Zeitstempel `INTEGER` (ms).
Booleans als `INTEGER 0/1`. Fremdschlüssel mit `ON DELETE CASCADE` (Ausnahmen: `notes.course_id` → `SET NULL`, `users.student_id` → `SET NULL`, `courses.teacher_id` → `SET NULL`, `notes.author_id` → `SET NULL`). `initDb()` baut `courses` und `notes` in bestehenden Datenbanken bei Bedarf neu auf (`migrateOwnerForeignKeys`, SQLite kann FK-Regeln nicht ändern): atomar in einer Transaktion mit `foreign_keys = OFF` und FK-Prüfung; bei einem Fehler wird zurückgerollt und die alte Tabelle bleibt unverändert. Neue Tabellen-Neuaufbauten nach demselben Muster schreiben (nie `BEGIN`/`COMMIT` per `exec` ohne Rollback).

| Tabelle | Zweck / Besonderheiten |
|---|---|
| `users`, `sessions` | Login, TOTP, `role` (`admin`/`teacher`/`student`), `display_name`, `email`, `entra_oid`, `is_active` (1/0), `student_id` → `students.id` |
| `school_years` | Semesterenden, Notenschluss- und Frühwarnfristen, `is_current` (schulweit) |
| `classes` → `students` | Schüler (schulweit): `catalog_number`, `webuntis_id`, `schkz` (aus BGBB Admin), `email` (M365 Benutzername), `status` `active`/`inactive` |
| `courses` | Klasse + Fach + `teacher_id` → `users.id` + Gewichte (`weight_schularbeiten` 40, `tests` 20, `participation` 25, `observations` 10, `homework` 5) |
| `participation_entries` | Mitarbeit `plus`/`tilde`/`minus`, **eindeutig je Kurs+Schüler+ISO-Woche** |
| `observations` → `observation_scores` | Beobachtungen mit Punkten; `note` global bzw. je Schüler |
| `assessments` → `assessment_results` | `type` `schularbeit`/`test`/`wiederholung`; `grading_scale` als JSON; `is_counted`; Ergebnis mit `is_absent`, `is_made_up` |
| `assessment_returns` | Rücklauf unterschriebener Arbeiten: `due_date`, `is_signed`, `snoozed_until` |
| `early_warnings` | Frühwarnungen, `status` `draft`/`issued`/`resolved`, eigener Rücklauf |
| `reminder_logs` | `asked`/`push_sent`/`snoozed` für Rückläufe und Frühwarnungen |
| `homeworks` → `homework_statuses` | `done`/`partial`/`forgotten` |
| `lesson_entries` → `lesson_student_notes` | Stundeneinträge (Thema, globale Notiz) + Notiz je Schüler |
| `notes` | Schülernotizen, `author_id` → `users.id`, `category` `elterngespraech`/`auffaelligkeit`/`foerderung`/`allgemein` |
| `course_final_grades` | Endnote je Kurs+Schüler+Semester (`manual_grade` überschreibt Vorschlag) |
| `settings` | Globale Key/Value-Einstellungen: Fallback-Werte, VAPID-Keys, BGBB-Konfiguration (`bgbb_api_url`, `bgbb_api_key`), Microsoft-365-Konfiguration (`entra_tenant_id`, `entra_client_id`, `entra_client_secret`) |
| `user_settings` | Benutzerspezifische Einstellungen `(user_id, key, value)` für `teacher_name`, `default_return_days`, `early_warning_threshold`, `email_summary_enabled` (fällt bei fehlendem Wert auf `settings` zurück) |
| `push_subscriptions` | Web-Push-Abos je Benutzer (`user_id` → `users.id`) |
| `grading_scale_templates` | Notenschlüssel-Vorlagen je Benutzer (`user_id` → `users.id`), eindeutiger Index `idx_grading_scale_templates_default_user` für höchstens eine Standard-Vorlage (`is_default = 1`) pro Benutzer |

Eindeutige Indizes je (Eltern-ID, `student_id`) auf Ergebnissen, Rückläufen, HÜ-Status, Beobachtungs-Punkten, Stunden-Notizen; eindeutiger Index `idx_users_entra_oid` auf `users.entra_oid`.

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
  (nur Float-Rauschen tolerieren, nie aufrunden). Vorlagen: `austrian-standard` (Default), `strict`, `lenient`, `linear-four-step` (pro Benutzer mit ID `<userId>:<slug>` angelegt).
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
  (Header `x-api-key`, Key mit Recht „read“). Übernommen werden Vorname, Familienname, SchKz und Benutzername/E-Mail; Katalognummern alphabetisch.
  Klassen werden über den Namen (ohne Groß/Klein) im aktuellen Schuljahr zugeordnet, fehlende neu angelegt.
  BGBB liefert die dort **aktive** Schuljahres-DB – passt sie nicht zum aktuellen Schuljahr hier, landen falsche Listen im Import.
  Der API-Key wird nur serverseitig verwendet und nie an den Browser geschickt (liegt aber in `settings` und damit im Backup).
- **Datum/Zeitzone**: `services/dates.ts` verwenden (`todayVienna`, `addDays` in UTC-Arithmetik, `getIsoWeekAndYear`).
  Achtung: einige Stellen nutzen noch `new Date().toISOString().slice(0, 10)` (UTC) – kann kurz nach Mitternacht abweichen.
- **Push** wird nur manuell ausgelöst (Action `triggerPushCheck` auf `/`), es gibt keinen Zeitplan im Server. `runReminderCheck` prüft je aktiver Lehrkraft deren eigene Kurse und sendet die Push-Benachrichtigung ausschließlich an die eigenen Push-Abos (`push_subscriptions.user_id`).
- **Seed**: nur wenn noch kein User existiert; Demo-Daten nur ohne `NODE_ENV=production` (inkl. zweitem Demo-Lehrer `lehrer2`), ausschließlich fiktive Namen.

## Arbeitsweise

- Commits: Conventional-Commit-Stil auf Englisch (`feat: …`, `fix: …`, `fix(docker): …`, `chore(deploy): …`);
  einzelne deutsche Commits kommen vor.
- Neue Fachlogik nach `src/lib/services/` mit `*.test.ts` daneben; DB-Zugriff in Repositories.
- Vor Commit: `npm run check` und `npm run test`.
- **Öffentliches Repo**: keine echten Schülerdaten committen. `.gitignore` sperrt `*.db`, `*.sqlite`, `data/`, `*.xlsx`, `*.csv`, `.env`.
- UI-Texte auf Deutsch (österreichische Begriffe: Schularbeit, Hausübung, Katalognummer).
