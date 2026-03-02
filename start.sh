#!/usr/bin/env bash
set -euo pipefail

# ─── Colori ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ─── Prerequisiti ─────────────────────────────────────────────────────────────
command -v docker &>/dev/null || error "Docker non trovato. Installalo da https://docs.docker.com/get-docker/"
docker compose version &>/dev/null || error "Docker Compose v2 non trovato."

# ─── File .env ────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  warn ".env non trovato — copio .env.example in .env"
  cp .env.example .env

  # Rileva l'IP LAN automaticamente
  HOST_IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}' || \
            ipconfig getifaddr en0 2>/dev/null || \
            echo "127.0.0.1")
  sed -i "s/HOST_IP=.*/HOST_IP=${HOST_IP}/" .env

  warn "Modifica .env con le tue credenziali prima di continuare."
  warn "  -> JWT_SECRET e MONGO_PASSWORD devono essere cambiati in produzione!"
  echo ""
  read -rp "Premi INVIO per continuare o Ctrl+C per annullare..."
fi

# ─── Modalità ─────────────────────────────────────────────────────────────────
MODE="${1:-server}"   # server | dev | down | logs | status

case "$MODE" in
  server)
    info "Avvio: MongoDB + Server API"
    docker compose up -d --build mongo server
    info "Server disponibile su http://localhost:3000"
    info "Health check: http://localhost:3000/health"
    ;;

  dev)
    info "Avvio: MongoDB + Server API + Expo Dev Server"
    docker compose --profile dev up -d --build
    echo ""
    info "Expo Metro Bundler su http://localhost:8081"
    info "Expo DevTools su http://localhost:19002"
    HOST_IP=$(grep HOST_IP .env | cut -d= -f2)
    warn "Sul dispositivo: apri Expo Go e connettiti a ${HOST_IP}:8081"
    ;;

  down)
    info "Fermo tutti i container..."
    docker compose --profile dev down
    ;;

  logs)
    SERVICE="${2:-server}"
    info "Log di: ${SERVICE}"
    docker compose logs -f "$SERVICE"
    ;;

  status)
    docker compose ps
    ;;

  *)
    echo "Uso: ./start.sh [server|dev|down|logs|status]"
    echo ""
    echo "  server  → avvia MongoDB + Server API (default)"
    echo "  dev     → avvia tutto + Expo dev server"
    echo "  down    → ferma tutti i container"
    echo "  logs    → segui i log (es: ./start.sh logs server)"
    echo "  status  → mostra stato container"
    ;;
esac
