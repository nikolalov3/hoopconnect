#!/usr/bin/env bash
# HoopConnect — uruchamia lokalną apkę generatora umów (Streamlit).
# Pierwsze uruchomienie: zainstaluje brakujące zależności.

set -euo pipefail
cd "$(dirname "$0")"

# Sprawdź czy streamlit jest zainstalowany; jeśli nie — doinstaluj
if ! python3 -c "import streamlit" 2>/dev/null; then
  echo "→ Instaluję streamlit (jednorazowo, ~1 minuta)..."
  pip3 install --quiet streamlit reportlab
fi

# Sprawdź reportlab niezależnie (gdyby streamlit był a reportlab nie)
if ! python3 -c "import reportlab" 2>/dev/null; then
  pip3 install --quiet reportlab
fi

echo ""
echo "Generator umów HoopConnect"
echo "──────────────────────────"
echo "Apka otworzy się w przeglądarce za chwilę."
echo "Żeby zamknąć: Ctrl+C w tym oknie."
echo ""

# --server.headless=false każe Streamlitowi otworzyć browser sam
exec streamlit run app.py --server.port=8501 --server.headless=false
