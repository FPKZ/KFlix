#!/usr/bin/env bash
set -e

# ==============================================================================
# KFlix - Script de Empacotamento W3C / Tizen Widget (.wgt)
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIZEN_DIR="$PROJECT_ROOT/tizen"
DIST_DIR="$PROJECT_ROOT/dist"
OUTPUT_WGT="$DIST_DIR/kflix-tizen.wgt"

echo "=================================================="
echo " [KFlix] Empacotando aplicação Samsung Tizen (.wgt)"
echo " Diretório Tizen: $TIZEN_DIR"
echo " Pacote destino:  $OUTPUT_WGT"
echo "=================================================="

mkdir -p "$DIST_DIR"
rm -f "$OUTPUT_WGT"

# Sincronizar assets do shared/engine para tizen/shared antes de empacotar
echo "==> Sincronizando arquivos do motor compartilhado..."
mkdir -p "$TIZEN_DIR/shared"
cp -f "$PROJECT_ROOT/shared/engine/kflix-spatnav.js" "$TIZEN_DIR/shared/"
cp -f "$PROJECT_ROOT/shared/engine/kflix-tv-theme.css" "$TIZEN_DIR/shared/"
cp -f "$PROJECT_ROOT/shared/engine/kflix-player.js" "$TIZEN_DIR/shared/"

echo "==> Criando pacote W3C / Tizen (.wgt)..."
python3 - <<EOF
import os
import zipfile

tizen_dir = "$TIZEN_DIR"
output_wgt = "$OUTPUT_WGT"

ignore_names = {"__tests__", ".DS_Store", "__pycache__", ".git"}

with zipfile.ZipFile(output_wgt, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(tizen_dir):
        # Filtrar diretórios ignorados in-place
        dirs[:] = [d for d in dirs if d not in ignore_names]
        
        for file in sorted(files):
            if file in ignore_names or file.endswith('.test.js') or file.endswith('.swp'):
                continue
            full_path = os.path.join(root, file)
            arcname = os.path.relpath(full_path, tizen_dir)
            zf.write(full_path, arcname)

print("Empacotamento concluído via python zipfile.")
EOF

# Testar integridade do zip gerado
echo "==> Validando integridade do arquivo .wgt gerado..."
python3 -m zipfile -t "$OUTPUT_WGT"

# Exibir conteúdo do pacote
echo "==> Conteúdo do pacote Tizen (.wgt):"
python3 -m zipfile -l "$OUTPUT_WGT"

WGT_SIZE_BYTES=$(stat -c%s "$OUTPUT_WGT" 2>/dev/null || stat -f%z "$OUTPUT_WGT" 2>/dev/null)
WGT_SIZE_KB=$(awk "BEGIN {printf \"%.2f\", $WGT_SIZE_BYTES / 1024}")

echo "=================================================="
echo " [KFlix] Pacote Tizen gerado com sucesso!"
echo " Arquivo: $OUTPUT_WGT"
echo " Tamanho: ${WGT_SIZE_KB} KB ($WGT_SIZE_BYTES bytes)"
echo "=================================================="

exit 0
