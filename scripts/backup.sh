#!/usr/bin/env bash
set -euo pipefail

# UnterrichtsManager – Nächtliches verschlüsseltes Backup-Skript
# Kann per cron (z.B. täglich um 02:00 Uhr) auf dem Host ausgeführt werden:
# 0 2 * * * /opt/notenmanager/scripts/backup.sh >> /var/log/notenmanager-backup.log 2>&1

BACKUP_DIR="${BACKUP_DIR:-/var/backups/notenmanager}"
CONTAINER_NAME="${CONTAINER_NAME:-notenmanager}"
DB_PATH_IN_CONTAINER="/app/data/notenmanager.db"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
RAW_BACKUP="${BACKUP_DIR}/notenmanager_${TIMESTAMP}.sqlite"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Starte Notenmanager-Backup..."

# 1. Hot-Backup der SQLite-Datei über SQLite online backup API
# Das garantiert Konsistenz auch während Schreibzugriffen im laufenden Betrieb
docker exec "${CONTAINER_NAME}" node -e "
const Database = require('better-sqlite3');
const db = new Database('${DB_PATH_IN_CONTAINER}');
db.backup('/app/data/backup_temp.sqlite')
  .then(() => { db.close(); process.exit(0); })
  .catch((err) => { console.error(err); process.exit(1); });
"

docker cp "${CONTAINER_NAME}:/app/data/backup_temp.sqlite" "${RAW_BACKUP}"
docker exec "${CONTAINER_NAME}" rm -f /app/data/backup_temp.sqlite

echo "[$(date -Iseconds)] Unverschlüsseltes Backup erstellt: ${RAW_BACKUP}"

# 2. Verschlüsselungsmöglichkeit A: age (asymmetrische Verschlüsselung)
# Falls AGE_RECIPIENT gesetzt ist (z.B. age1...):
if [ -n "${AGE_RECIPIENT:-}" ] && command -v age >/dev/null 2>&1; then
    ENCRYPTED_FILE="${RAW_BACKUP}.age"
    age -r "${AGE_RECIPIENT}" -o "${ENCRYPTED_FILE}" "${RAW_BACKUP}"
    rm -f "${RAW_BACKUP}"
    echo "[$(date -Iseconds)] Backup erfolgreich mit age verschlüsselt: ${ENCRYPTED_FILE}"
fi

# 3. Verschlüsselungsmöglichkeit B: restic
# Falls RESTIC_REPOSITORY gesetzt ist:
if [ -n "${RESTIC_REPOSITORY:-}" ] && command -v restic >/dev/null 2>&1; then
    restic backup "${RAW_BACKUP}"
    echo "[$(date -Iseconds)] Backup erfolgreich im restic-Repository abgelegt"
fi

# 4. Alte Backups bereinigen (z.B. älter als 30 Tage)
find "${BACKUP_DIR}" -type f \( -name "*.sqlite" -o -name "*.age" \) -mtime +30 -delete

echo "[$(date -Iseconds)] Backup-Prozess erfolgreich abgeschlossen."
