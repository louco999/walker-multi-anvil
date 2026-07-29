#!/usr/bin/env bash
# Build Walker module with FreeCAD (headless).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT="$ROOT/cad/scripts/build_walker_module.py"
EXPORT="$ROOT/cad/exports"
mkdir -p "$EXPORT"

candidates=(
  "${FREECADCMD:-}"
  "/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd"
  "/Applications/FreeCAD.app/Contents/MacOS/FreeCADCmd"
  "$(command -v freecadcmd 2>/dev/null || true)"
  "$(command -v FreeCADCmd 2>/dev/null || true)"
)

CMD=""
for c in "${candidates[@]}"; do
  if [[ -n "$c" && -x "$c" ]]; then
    CMD="$c"
    break
  fi
done

if [[ -z "$CMD" ]]; then
  echo "FreeCAD CLI not found. Install with:"
  echo "  brew install --cask freecad"
  echo "Or set FREECADCMD=/path/to/freecadcmd"
  exit 1
fi

echo "Using: $CMD"
echo "Script: $SCRIPT"
# FreeCAD 1.x headless: execute via -c + runpy (argv file open is unreliable)
"$CMD" -c "import runpy,sys; sys.argv=['build_walker_module.py']; runpy.run_path(r'$SCRIPT', run_name='__main__')"

# Mirror mesh into web public if STL exists
WEB_CAD="$ROOT/public/cad"
mkdir -p "$WEB_CAD"
if [[ -f "$EXPORT/WalkerTypeModule.stl" ]]; then
  cp -f "$EXPORT/WalkerTypeModule.stl" "$WEB_CAD/WalkerTypeModule.stl"
  echo "Copied STL → $WEB_CAD/WalkerTypeModule.stl"
fi

echo "Done. Exports in: $EXPORT"
ls -la "$EXPORT"
