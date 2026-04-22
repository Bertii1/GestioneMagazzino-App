#!/bin/bash
set -e

ANDROID_HOME="$HOME/Android/Sdk"
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
PLATFORM="android-35"
BUILD_TOOLS="35.0.0"
NDK="26.1.10909125"

echo "=== Setup Android SDK per build locale EAS ==="
echo "Installazione in: $ANDROID_HOME"
echo ""

# Dipendenze di sistema
echo "[1/5] Dipendenze di sistema..."
sudo apt-get update -q && sudo apt-get install -y -q wget unzip lib32z1 lib32stdc++6

# Scarica command-line tools
echo "[2/5] Download Android command-line tools..."
mkdir -p "$ANDROID_HOME/cmdline-tools"
wget -q --show-progress "$CMDLINE_TOOLS_URL" -O /tmp/cmdline-tools.zip
unzip -q /tmp/cmdline-tools.zip -d /tmp/cmdline-tools-tmp
mkdir -p "$ANDROID_HOME/cmdline-tools/latest"
cp -r /tmp/cmdline-tools-tmp/cmdline-tools/* "$ANDROID_HOME/cmdline-tools/latest/"
rm -rf /tmp/cmdline-tools.zip /tmp/cmdline-tools-tmp

# Configura PATH temporaneo
export ANDROID_HOME
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"

# Accetta licenze e installa componenti
echo "[3/5] Accettazione licenze SDK..."
yes | sdkmanager --licenses > /dev/null 2>&1 || true

echo "[4/5] Installazione componenti SDK (platform-tools, platform, build-tools, NDK)..."
sdkmanager \
  "platform-tools" \
  "platforms;$PLATFORM" \
  "build-tools;$BUILD_TOOLS" \
  "ndk;$NDK"

# Aggiunge variabili a ~/.bashrc
echo "[5/5] Configurazione variabili d'ambiente in ~/.bashrc..."
MARKER="# Android SDK (aggiunto da setup-android-sdk.sh)"
if ! grep -q "$MARKER" ~/.bashrc; then
  cat >> ~/.bashrc <<EOF

$MARKER
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="\$PATH:\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools:\$ANDROID_HOME/build-tools/$BUILD_TOOLS"
EOF
fi

echo ""
echo "=== Completato ==="
echo ""
echo "Applica le variabili nella sessione corrente:"
echo "  source ~/.bashrc"
echo ""
echo "Poi lancia la build locale:"
echo "  ./release.sh --android --local"
