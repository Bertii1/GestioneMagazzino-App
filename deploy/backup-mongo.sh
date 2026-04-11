#!/usr/bin/env bash
set -euo pipefail

# ─── Configurazione ──────────────────────────────────────────────────────────
SERVER_URL="https://YOUR_SERVER_URL"
BACKUP_API_KEY="REDACTED_BACKUP_API_KEY"
BACKUP_DIR="$HOME/magazzino-backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="magazzino_${TIMESTAMP}.archive.gz"

# ─── Colori ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $(date '+%H:%M:%S') $*"; }
error() { echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') $*"; exit 1; }

# ─── Prerequisiti ────────────────────────────────────────────────────────────
command -v curl &>/dev/null || error "curl non trovato"
mkdir -p "$BACKUP_DIR"

# ─── Download dump via HTTPS ─────────────────────────────────────────────────
info "Download backup da ${SERVER_URL}..."

HTTP_CODE=$(curl -sS -w '%{http_code}' \
  -o "${BACKUP_DIR}/${BACKUP_NAME}" \
  -H "Authorization: Bearer ${BACKUP_API_KEY}" \
  --insecure \
  "${SERVER_URL}/api/backup/dump")

if [ "$HTTP_CODE" != "200" ]; then
  MSG=$(cat "${BACKUP_DIR}/${BACKUP_NAME}" 2>/dev/null || echo "")
  rm -f "${BACKUP_DIR}/${BACKUP_NAME}"
  error "Download fallito (HTTP ${HTTP_CODE}): ${MSG}"
fi

FILESIZE=$(stat -c%s "${BACKUP_DIR}/${BACKUP_NAME}" 2>/dev/null || stat -f%z "${BACKUP_DIR}/${BACKUP_NAME}")
if [ "$FILESIZE" -eq 0 ]; then
  rm -f "${BACKUP_DIR}/${BACKUP_NAME}"
  error "File scaricato vuoto"
fi

info "Backup salvato: ${BACKUP_DIR}/${BACKUP_NAME} ($(numfmt --to=iec "$FILESIZE"))"

# ─── Retention locale ───────────────────────────────────────────────────────
DELETED=$(find "$BACKUP_DIR" -name "magazzino_*.archive.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
[ "$DELETED" -gt 0 ] && info "Eliminati $DELETED backup più vecchi di $RETENTION_DAYS giorni"

info "Backup completato!"
