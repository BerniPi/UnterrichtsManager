# UnterrichtsManager 🎓

> Online-Plattform für Unterrichtsaufzeichnungen, Mitarbeit, Noten und Frühwarnungen im österreichischen Schulsystem (Mathematik, Physik).

[![Tests](https://img.shields.io/badge/Vitest-Passing-emerald)](https://vitest.dev)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-3.0-orange)](https://svelte.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-blue)](https://tailwindcss.com)
[![SQLite](https://img.shields.io/badge/Database-SQLite-003B57)](https://sqlite.org)

---

## 📌 Übersicht & Funktionen

1. **Stundenansicht (Mobil-optimiert / PWA):**
   - Schnelle Erfassung von Mitarbeit (`+` / `~` / `−`) direkt im Unterricht am Smartphone oder Tablet.
   - HÜ-Erledigungsstatus (`✓`, `~`, `✗`) und Schnellnotizen (Elterngespräch, Auffälligkeit, Förderung).
   - Wöchentliches Monitoring: Schüler ohne Eintrag in der aktuellen Kalenderwoche werden hervorgehoben.
   - **Direkte Fristenerinnerung:** Schüler mit überfälligen Schularbeits- oder Frühwarnungsunterschriften sind rot markiert mit Schnellaktionen (*„Nachgefragt“*, *„Zurück ✓“*, *„+3 Tage Snooze“*).

2. **Klassen & WebUntis-Import:**
   - Import von Schülerlisten via CSV- oder Excel-Export aus WebUntis.
   - Flexible Spaltenzuordnung (Vorname, Nachname, WebUntis-ID, Katalognummer) mit Vorschau.
   - Intelligenter Roster-Abgleich bei erneutem Import: Erkennt neu hinzugekommene, aktualisierte und ausgetretene Schüler.

3. **Schularbeiten & Tests:**
   - Erfassung von Punkten mit automatischer Notenberechnung nach konfigurierbarem österreichischen Notenschlüssel (Standard: 88% / 75% / 60% / 50%).
   - **Notenschlüssel-Vorlagen (Templates):** Direktauswahl vordefinierter Vorlagen beim Anlegen von Tests mit Live-Notenstufen-Vorschau; Vorlagen-Editor in den Einstellungen zum Erstellen, Bearbeiten und Festlegen des Standards.
   - Klassenstatistik mit Notenverteilungsdiagramm, Notenschnitt und Punkte-Durchschnitt.
   - Rücklaufliste für unterschriebene Schularbeiten mit Fristenverwaltung (Standard: 7 Tage).

4. **Frühwarnungen (§ 19 Abs 4 SchUG):**
   - Automatische Vorschläge bei Unterschreiten der Notenschwelle (z.B. Notenschnitt &ge; 4.5 oder Schularbeit mit Nicht genügend).
   - Ausstellen, Rücklauf-Abhaken und Warnung vor dem Notenschluss bei noch offenen Frühwarnungen.

5. **Schülerkarte:**
   - Gesamtübersicht aller Leistungen, Notizen, Frühwarnungen und Mitarbeitshistorie eines Schülers auf einer Seite.
   - Transparenter, gewichteter Notenvorschlag mit einstellbaren Teilleistungsgewichtungen (Schularbeiten, Tests, Mitarbeit, Beobachtungen, HÜ).
   - Manuelle Endnotenfestlegung durch die Lehrkraft.
   - Druckansicht / PDF-Export für Elterngespräche.

6. **WebUntis-Export & Backup:**
   - Export der Notenliste als Excel- (.xlsx) oder CSV-Datei für die Übernahme in WebUntis.
   - 100% vollständiges, portables Datenbank-Backup als SQLite-Datei zum Download und Wiederherstellen.

---

## 🏗️ Modulare Architektur (Keine Monolithen)

Das Projekt ist konsequent modular in Schichten unterteilt:

```
src/
├── lib/
│   ├── server/
│   │   ├── db/                 # SQLite-Verbindung (better-sqlite3), Drizzle Schema & Seed
│   │   ├── auth/               # Session-Verwaltung, Argon2-Hashing & TOTP 2FA
│   │   ├── reminders/          # Fristenscanner & Web-Push-Dispatcher
│   │   └── repositories/       # Datenzugriffsschicht (Data Access Layer)
│   │       ├── student.repository.ts
│   │       ├── course.repository.ts
│   │       ├── assessment.repository.ts
│   │       ├── observation.repository.ts
│   │       ├── earlywarning.repository.ts
│   │       ├── homework.repository.ts
│   │       ├── note.repository.ts
│   │       └── participation.repository.ts
│   ├── services/               # Reines Domain-Business-Logic Layer (unabhängig von HTTP)
│   │   ├── grading.ts          # Notenberechnung & Gewichtung
│   │   ├── earlywarning.ts     # Kriterien für §19 Frühwarnung
│   │   ├── reminders.ts        # Fälligkeits- & Snooze-Logik
│   │   ├── reconciliation.ts   # WebUntis-Roster-Abgleich
│   │   ├── student-evaluator.ts# Leistungsaggregierung
│   │   └── export/             # WebUntis Excel & CSV Generierung
│   └── components/             # Modulare Svelte-5-Komponenten
│       ├── assessments/        # Notenschlüssel, Punkteingabe, Statistik-Chart
│       └── course/             # Tabs für Noten, Tests, Beobachtungen, HÜ, Frühwarnungen
└── routes/                     # SvelteKit Routen & API-Endpunkte
```

---

## 🔒 Datenschutz & Öffentliches Repository

Weil dieses GitHub-Repository öffentlich ist:
- **Keine echten Schülerdaten auf GitHub:** Das integrierte Seed-Skript verwendet ausschließlich fiktive Namen (*Max Mustermann, Sophie Weber etc.*).
- `.gitignore` schließt strikt alle SQLite-Dateien (`*.sqlite`, `*.db`, `data/`), Backups (`backups/`), Umgebungsvariablen (`.env`) und Import-Dateien (`uploads/`, `*.xlsx`, `*.csv`) aus.

---

## 🚀 Lokale Entwicklung

### Voraussetzungen
- Node.js &ge; 22 (empfohlen: Node 22 oder 24)
- npm

### Installation & Start
```bash
# Abhängigkeiten installieren
npm install

# Entwicklungsserver starten
npm run dev

# Tests ausführen (Vitest)
npm run test

# Produktions-Build erstellen
npm run build
```

### Standard-Anmeldedaten für lokale Tests
- **Benutzername:** `lehrer`
- **Passwort:** `notenmanager123`

---

## 🐳 Docker Deployment hinter vorhandenem Caddy

### 1. Container starten (Docker Compose)
```bash
# .env aus Vorlage erstellen
cp .env.example .env

# Container bauen und starten
docker compose up -d --build
```
Der Container lauscht intern an `127.0.0.1:3000` (kein eigener Port ins öffentliche Internet).

### 2. Caddyfile Snippet
Füge folgenden Block in dein vorhandenes `Caddyfile` auf dem Server ein:

```caddy
noten.example.at {
    reverse_proxy 127.0.0.1:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-Proto https
    }

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    encode zstd gzip
}
```

Danach Caddy neu laden:
```bash
caddy reload
```

### 3. Nächtliches verschlüsseltes Backup
Das mitgelieferte Skript [`scripts/backup.sh`](file:///D:/Coden/Notenmanager/scripts/backup.sh) führt ein sicheres Online-Hotbackup der SQLite-Datenbank durch und kann optional mit `age` (asymmetrische Verschlüsselung) oder `restic` verschlüsselt werden:

```bash
# Crontab-Eintrag für nächtliches Backup um 02:00 Uhr
0 2 * * * /opt/notenmanager/scripts/backup.sh >> /var/log/notenmanager-backup.log 2>&1
```
