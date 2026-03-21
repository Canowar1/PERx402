#!/bin/bash
# .claude/hooks/post-bash-check.sh
# Runs after every Bash tool call to catch common issues

EXIT_CODE=${CLAUDE_TOOL_EXIT_CODE:-0}

if [ "$EXIT_CODE" != "0" ]; then
  echo "[hook] Bash command exited with $EXIT_CODE — check output above"

  # Detect anchor build failure
  if echo "$CLAUDE_TOOL_OUTPUT" | grep -q "error\[E"; then
    echo "[hook] Rust compile error detected. Run /anchor-engineer to debug."
  fi

  # Detect missing env vars
  if echo "$CLAUDE_TOOL_OUTPUT" | grep -q "ANCHOR_WALLET\|TEE_RPC_URL\|USDC_MINT"; then
    echo "[hook] Missing env var. Check .env and README for required variables."
  fi
fi

exit 0
