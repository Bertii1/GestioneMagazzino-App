#!/usr/bin/env bash
set -euo pipefail

# ── Configurazione ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/mobile/screenshots/output"
FLOWS_DIR="$ROOT_DIR/mobile/screenshots/flows"
COMPOSE_FILE="$ROOT_DIR/docker-compose.screenshots.yml"
APK_PATH="${APK_PATH:-}"          # percorso APK, obbligatorio
SERVER_HOST="${SERVER_HOST:-}"    # hostname server, es. api.mioserver.com
USERNAME="${USERNAME:-}"          # email utente
PASSWORD="${PASSWORD:-}"          # password
SHELF_CODE="${SHELF_CODE:-}"        # codice scaffale esistente (es. "A1"), opzionale
WAREHOUSE_NAME="${WAREHOUSE_NAME:-}" # nome magazzino da aprire (es. "Magazzino Principale"), obbligatorio

# ── Controllo prerequisiti ──────────────────────────────────────────────────
check_prereqs() {
  local missing=()

  [[ -e /dev/kvm ]]              || missing+=("KVM (/dev/kvm non trovato — virtualizzazione hardware richiesta)")
  command -v docker  &>/dev/null || missing+=("docker")
  command -v adb     &>/dev/null || missing+=("adb (android-tools-adb)")
  command -v maestro &>/dev/null || missing+=("maestro (curl -Ls https://get.maestro.mobile.dev | bash)")

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "❌ Prerequisiti mancanti:"
    for m in "${missing[@]}"; do echo "   - $m"; done
    exit 1
  fi
}

usage() {
  echo "Utilizzo: APK_PATH=app.apk SERVER_HOST=api.mioserver.com USERNAME=email PASSWORD=pwd $0"
  echo ""
  echo "Variabili ambiente:"
  echo "  APK_PATH      Percorso al file .apk (obbligatorio)"
  echo "  SERVER_HOST   Hostname del server senza schema, es. api.mioserver.com"
  echo "  USERNAME      Email di accesso"
  echo "  PASSWORD      Password di accesso"
  exit 1
}

# ── Attendi che l'emulatore sia pronto ────────────────────────────────────
wait_for_emulator() {
  echo "⏳ Attendo boot emulatore..."
  local timeout=300
  local elapsed=0
  while [[ $elapsed -lt $timeout ]]; do
    if adb -s emulator-5554 shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; then
      echo "✅ Emulatore pronto"
      return 0
    fi
    sleep 5
    elapsed=$((elapsed + 5))
    echo "   ${elapsed}s / ${timeout}s"
  done
  echo "❌ Timeout: emulatore non pronto dopo ${timeout}s"
  exit 1
}

# ── Main ────────────────────────────────────────────────────────────────────
main() {
  [[ -z "$APK_PATH" || -z "$SERVER_HOST" || -z "$USERNAME" || -z "$PASSWORD" ]] && usage
  [[ -f "$APK_PATH" ]] || { echo "❌ APK non trovato: $APK_PATH"; exit 1; }

  check_prereqs

  mkdir -p "$OUTPUT_DIR"

  # 1. Avvia emulatore Docker
  echo "🚀 Avvio emulatore Android..."
  docker compose -f "$COMPOSE_FILE" up -d
  echo "   VNC web: http://localhost:6080"

  # 2. Connetti ADB
  sleep 10
  adb connect localhost:5555 || true
  wait_for_emulator

  # 3. Installa APK
  echo "📦 Installo APK..."
  adb -s emulator-5554 install -r "$APK_PATH"

  # 4. Esegui flows Maestro (cd in OUTPUT_DIR: takeScreenshot salva in CWD)
  echo "📸 Avvio Maestro flows..."
  cd "$OUTPUT_DIR"
  maestro test \
    --output "$OUTPUT_DIR" \
    --env SERVER_HOST="$SERVER_HOST" \
    --env USERNAME="$USERNAME" \
    --env PASSWORD="$PASSWORD" \
    --env WAREHOUSE_NAME="${WAREHOUSE_NAME:-}" \
    --env SHELF_CODE="${SHELF_CODE:-}" \
    "$FLOWS_DIR/all_screenshots.yaml"
  cd "$ROOT_DIR"

  echo ""
  echo "✅ Screenshot salvati in: $OUTPUT_DIR"
  ls -1 "$OUTPUT_DIR"/*.png 2>/dev/null || echo "   (nessun file .png trovato)"

  # 5. Ferma emulatore
  echo "🛑 Fermo emulatore..."
  docker compose -f "$COMPOSE_FILE" down
}

main "$@"
