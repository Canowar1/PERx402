# Command: /demo-prep

Prepares the project for hackathon demo presentation.

## Steps

1. Run `/test-e2e` — all 8 checks must pass
2. Generate fresh devnet wallets with test USDC (run `scripts/fund-devnet.ts`)
3. Start proxy server in demo mode: `DEMO_MODE=true npm run start`
4. Open dashboard at `http://localhost:3000`
5. Verify both panels are visible and labeled clearly
6. Record backup demo video with `npm run record-demo` (fallback if live demo fails)
7. Print one-page architecture diagram from `docs/architecture.md`

## Demo script (2 minutes)

**Minute 1 — Problem**
"Every x402 payment on Solana is fully public. Agent A pays for market data —
any competitor watching the chain knows exactly what data source it uses,
how often, and how much it pays. That's a strategy leak."

**Minute 2 — Demo**
"Watch the left panel — Solana Explorer. Watch the right panel — Shadow Proxy.
[trigger payment] On-chain: a transaction confirmed. Amount? Not there.
Which API? Not there. Who paid? Not there.
The agent on the right panel sees everything. Nobody else does."

## Checklist before demo

- [ ] TEE endpoint responding (green dot in dashboard)
- [ ] Devnet USDC balance > 10 USDC in agent wallet
- [ ] Proxy server running, no errors in logs
- [ ] Dashboard loaded, session connected
- [ ] Backup video ready in `docs/demo-backup.mp4`
- [ ] GitHub repo is public
- [ ] README has one-click devnet setup instructions
