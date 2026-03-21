#!/bin/bash
# .claude/hooks/pre-deploy-guard.sh
# Blocks accidental mainnet deploys

COMMAND="${CLAUDE_TOOL_INPUT_COMMAND:-}"

if echo "$COMMAND" | grep -q "mainnet-beta"; then
  echo "ERROR: Mainnet deploy blocked by hook."
  echo "Shadow Proxy is devnet-only during hackathon."
  echo "Remove this restriction in .claude/hooks/pre-deploy-guard.sh for mainnet."
  exit 1
fi

if echo "$COMMAND" | grep -q "anchor deploy" && ! echo "$COMMAND" | grep -q "devnet"; then
  echo "WARNING: Deploy without explicit --provider.cluster devnet flag."
  echo "Add --provider.cluster devnet to your anchor deploy command."
  exit 1
fi

exit 0
