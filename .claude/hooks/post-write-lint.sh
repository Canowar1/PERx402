#!/bin/bash
# .claude/hooks/post-write-lint.sh
# Lints TypeScript and Rust files after writes

FILE_PATH="$1"

if [[ "$FILE_PATH" == *.ts || "$FILE_PATH" == *.tsx ]]; then
  DIR=$(dirname "$FILE_PATH")
  # Find nearest tsconfig and run tsc check (no emit)
  if find "$DIR" -maxdepth 3 -name "tsconfig.json" | head -1 | grep -q tsconfig; then
    echo "[hook] TypeScript file written — running type check..."
    cd "$DIR" && npx tsc --noEmit 2>&1 | head -20 || true
  fi
fi

if [[ "$FILE_PATH" == *.rs ]]; then
  echo "[hook] Rust file written — consider running: cargo clippy in programs/"
fi

exit 0
