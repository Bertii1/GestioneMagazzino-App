#!/usr/bin/env bash
set -euo pipefail

# ─── Colori ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step()  { echo -e "\n${CYAN}${BOLD}▶ $*${NC}"; }

MOBILE_DIR="$(cd "$(dirname "$0")/mobile" && pwd)"
APP_JSON="$MOBILE_DIR/app.json"

# ─── Uso ──────────────────────────────────────────────────────────────────────
usage() {
  echo -e "${BOLD}Uso:${NC} ./release.sh [opzioni]"
  echo ""
  echo -e "${BOLD}Piattaforme:${NC}"
  echo "  --android       Build APK Android (default)"
  echo "  --ios           Build IPA iOS"
  echo "  --all           Build entrambe"
  echo "  --simulator     Build iOS per simulatore (Mac)"
  echo ""
  echo -e "${BOLD}Modalità:${NC}"
  echo "  --local         Build locale (solo Android, richiede SDK)"
  echo "  --cloud         Build su server Expo (default)"
  echo ""
  echo -e "${BOLD}Versione:${NC}"
  echo "  --bump-patch    1.0.0 → 1.0.1"
  echo "  --bump-minor    1.0.0 → 1.1.0"
  echo "  --bump-major    1.0.0 → 2.0.0"
  echo ""
  echo -e "${BOLD}Esempi:${NC}"
  echo "  ./release.sh --android --local"
  echo "  ./release.sh --all --bump-patch"
  echo "  ./release.sh --simulator"
}

# ─── Defaults ────────────────────────────────────────────────────────────────
PLATFORM="android"
BUMP=""
SIMULATOR=false
LOCAL=false

for arg in "$@"; do
  case "$arg" in
    --android)    PLATFORM="android" ;;
    --ios)        PLATFORM="ios" ;;
    --all)        PLATFORM="all" ;;
    --simulator)  PLATFORM="ios"; SIMULATOR=true ;;
    --local)      LOCAL=true ;;
    --cloud)      LOCAL=false ;;
    --bump-patch) BUMP="patch" ;;
    --bump-minor) BUMP="minor" ;;
    --bump-major) BUMP="major" ;;
    --help)       usage; exit 0 ;;
    *)            error "Argomento sconosciuto: $arg. Usa --help." ;;
  esac
done

# ─── Prerequisiti ─────────────────────────────────────────────────────────────
step "Verifica prerequisiti"

command -v node &>/dev/null || error "Node.js non trovato"

if ! command -v eas &>/dev/null; then
  warn "eas-cli non trovato — installo..."
  npm install -g eas-cli
fi

info "Node: $(node --version) — EAS CLI: $(eas --version)"

if $LOCAL; then
  command -v java &>/dev/null || error "Java non trovato (richiesto per build locale)"
  [ -n "${ANDROID_HOME:-}" ] || warn "ANDROID_HOME non impostata. La build locale potrebbe fallire."
else
  if ! eas whoami &>/dev/null; then
    warn "Non autenticato su EAS. Avvio login..."
    eas login
  fi
  info "EAS account: $(eas whoami)"
fi

# ─── Bump versione ────────────────────────────────────────────────────────────
if [ -n "$BUMP" ]; then
  step "Bump versione ($BUMP)"

  CURRENT=$(node -e "console.log(require('$APP_JSON').expo.version)")
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

  case "$BUMP" in
    patch) PATCH=$((PATCH + 1)) ;;
    minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
    major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  esac

  NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"

  node -e "
    const fs = require('fs');
    const json = require('$APP_JSON');
    json.expo.version = '$NEW_VERSION';
    const build = parseInt(json.expo.ios?.buildNumber || '0') + 1;
    json.expo.ios = { ...json.expo.ios, buildNumber: String(build) };
    json.expo.android = { ...json.expo.android, versionCode: build };
    fs.writeFileSync('$APP_JSON', JSON.stringify(json, null, 2) + '\n');
  "

  cd "$MOBILE_DIR" && npm version "$NEW_VERSION" --no-git-tag-version --silent
  info "${CURRENT} → ${NEW_VERSION}"
fi

# ─── Riepilogo ───────────────────────────────────────────────────────────────
VERSION=$(node -e "console.log(require('$APP_JSON').expo.version)")

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Versione   : ${BOLD}${VERSION}${NC}"
echo -e "  Piattaforma: ${BOLD}${PLATFORM}${NC}"
$LOCAL && echo -e "  Metodo     : ${BOLD}Locale${NC}" || echo -e "  Metodo     : ${BOLD}Cloud (EAS)${NC}"
$SIMULATOR && echo -e "  Target     : ${BOLD}Simulatore iOS${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
read -rp "Continuare? [s/N] " confirm
[[ "$confirm" =~ ^[sS]$ ]] || { info "Annullato."; exit 0; }

# ─── TypeScript check ─────────────────────────────────────────────────────────
step "TypeScript check"
cd "$MOBILE_DIR"
npx tsc --noEmit && info "TypeScript OK" || error "Errori TypeScript — correggi prima di buildare"

# ─── Build ────────────────────────────────────────────────────────────────────
step "Build"
cd "$MOBILE_DIR"

build_android() {
  if $LOCAL; then
    info "Building Android APK locally..."
    eas build --platform android --profile preview --local --non-interactive
  else
    info "Building Android APK on cloud..."
    eas build --platform android --profile preview --non-interactive
  fi
}

build_ios() {
  local profile="preview"
  $SIMULATOR && profile="simulator"
  if $LOCAL; then
    error "Build locale iOS non supportata in questo script. Usa cloud."
  fi
  info "Building iOS ($profile) on cloud..."
  eas build --platform ios --profile "$profile" --non-interactive
}

case "$PLATFORM" in
  android) build_android ;;
  ios)     build_ios ;;
  all)
    build_android &
    PID_A=$!
    build_ios &
    PID_I=$!
    wait $PID_A || error "Build Android fallita"
    wait $PID_I || error "Build iOS fallita"
    ;;
esac

# ─── Output ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}✓ Build completata — v${VERSION}${NC}"
echo ""

if $LOCAL; then
  echo -e "  File generato localmente."
  echo -e "  Cerca il file APK nella cartella ${BOLD}mobile/${NC}"
else
  echo -e "  Scarica i file da:"
  echo -e "  ${BOLD}https://expo.dev/accounts/[account]/projects/gestione-magazzino/builds${NC}"
fi
echo ""

if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "all" ]; then
  echo -e "  ${BOLD}Android${NC}: installa l'APK con:"
  echo -e "  adb install gestione-magazzino.apk"
  echo -e "  oppure trasferisci il file sul telefono e aprilo"
  echo ""
fi

if ([ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "all" ]) && ! $SIMULATOR; then
  echo -e "  ${BOLD}iOS${NC}: installa tramite link EAS o con:"
  echo -e "  xcrun simctl install booted <path>.ipa  (simulatore)"
  echo ""
fi
