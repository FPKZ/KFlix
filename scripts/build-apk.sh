#!/usr/bin/env bash
set -e

# ==============================================================================
# KFlix - Script de Compilação do APK Android (Fire TV / Universal Android)
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
DIST_DIR="$PROJECT_ROOT/dist"

DEBUG_APK_SRC="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
DEBUG_APK_DEST="$DIST_DIR/kflix-tv-debug.apk"

RELEASE_APK_SRC="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
RELEASE_APK_DEST="$DIST_DIR/kflix-tv-release.apk"

echo "=================================================="
echo " [KFlix] Iniciando compilação do APK Android TV"
echo " Diretório raiz: $PROJECT_ROOT"
echo " Diretório dist: $DIST_DIR"
echo "=================================================="

mkdir -p "$DIST_DIR"

cd "$ANDROID_DIR"

echo "==> Executando compilação limpa (assembleDebug assembleRelease)..."
./gradlew assembleDebug assembleRelease --no-daemon

if [ ! -f "$DEBUG_APK_SRC" ]; then
    echo "ERRO: O arquivo Debug APK não foi encontrado em $DEBUG_APK_SRC"
    exit 1
fi

# Copiar Debug APK para dist
cp "$DEBUG_APK_SRC" "$DEBUG_APK_DEST"

# Copiar Release APK se existir
if [ -f "$RELEASE_APK_SRC" ]; then
    cp "$RELEASE_APK_SRC" "$RELEASE_APK_DEST"
fi

# Tamanhos
DEBUG_SIZE_BYTES=$(stat -c%s "$DEBUG_APK_DEST" 2>/dev/null || stat -f%z "$DEBUG_APK_DEST" 2>/dev/null)
DEBUG_SIZE_MB=$(awk "BEGIN {printf \"%.2f\", $DEBUG_SIZE_BYTES / 1048576}")

echo "=================================================="
echo " [KFlix] Build concluído com sucesso!"
echo " Debug APK:   $DEBUG_APK_DEST"
echo " Tamanho:     ${DEBUG_SIZE_MB} MB ($DEBUG_SIZE_BYTES bytes)"

if [ -f "$RELEASE_APK_DEST" ]; then
    RELEASE_SIZE_BYTES=$(stat -c%s "$RELEASE_APK_DEST" 2>/dev/null || stat -f%z "$RELEASE_APK_DEST" 2>/dev/null)
    RELEASE_SIZE_MB=$(awk "BEGIN {printf \"%.2f\", $RELEASE_SIZE_BYTES / 1048576}")
    echo " Release APK: $RELEASE_APK_DEST (Minificado / R8)"
    echo " Tamanho:     ${RELEASE_SIZE_MB} MB ($RELEASE_SIZE_BYTES bytes)"
fi
echo "=================================================="

# Verificação do critério (< 5MB)
LIMIT_MB=5
if [ -f "$RELEASE_APK_DEST" ]; then
    IS_LIGHT=$(awk "BEGIN {print ($RELEASE_SIZE_MB < $LIMIT_MB) ? 1 : 0}")
    if [ "$IS_LIGHT" -eq 1 ]; then
        echo "✔ CRITÉRIO ATENDIDO: Release APK ultra-leve (${RELEASE_SIZE_MB} MB < ${LIMIT_MB} MB)"
    fi
fi

exit 0
