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
  echo "  --android       Build APK Android (installazione diretta)"
  echo "  --ios           Build IPA iOS (installazione diretta)"
  echo "  --all           Build entrambe (default)"
  echo "  --simulator     Build iOS per simulatore (Mac)"
  echo ""
  echo -e "${BOLD}Versione:${NC}"
  echo "  --bump-patch    1.0.0 → 1.0.1"
  echo "  --bump-minor    1.0.0 → 1.1.0"
  echo "  --bump-major    1.0.0 → 2.0.0"
  echo ""
  echo -e "${BOLD}Esempi:${NC}"
  echo "  ./release.sh --android"
  echo "  ./release.sh --all --bump-patch"
  echo "  ./release.sh --simulator"
}

# ─── Defaults ────────────────────────────────────────────────────────────────
PLATFORM="all"
BUMP=""
SIMULATOR=false

for arg in "$@"; do
  case "$arg" in
    --android)    PLATFORM="android" ;;
    --ios)        PLATFORM="ios" ;;
    --all)        PLATFORM="all" ;;
    --simulator)  PLATFORM="ios"; SIMULATOR=true ;;
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

if ! eas whoami &>/dev/null; then
  warn "Non autenticato su EAS. Avvio login..."
  eas login
fi
info "EAS account: $(eas whoami)"

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
  info "Building Android APK..."
  eas build --platform android --profile preview --non-interactive
}

build_ios() {
  local profile="preview"
  $SIMULATOR && profile="simulator"
  info "Building iOS ($profile)..."
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
echo -e "  Scarica i file da:"
echo -e "  ${BOLD}https://expo.dev/accounts/[account]/projects/gestione-magazzino/builds${NC}"
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
