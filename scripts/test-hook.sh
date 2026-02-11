#!/bin/sh
ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
echo "ROOT=$ROOT"
node "$ROOT/scripts/format-staged.js" 2>&1
echo "EXIT=$?"
