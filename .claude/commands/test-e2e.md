# Command: /test-e2e

Runs a full end-to-end test of the Shadow Proxy flow on devnet.

## Prerequisites

- Proxy server running locally (port 3001)
- Devnet wallets funded (run `scripts/fund-devnet.ts` first)
- TEE devnet endpoint reachable

## Test sequence

1. **TEE health check** — `curl https://tee.magicblock.app/health`
2. **Agent deposit** — call `scripts/test-deposit.ts` to fund ephemeral ATA
3. **Session init** — verify TEE auth flow completes in < 2s
4. **Mock 402 request** — send request to local mock API that returns 402
5. **Intercept + pay** — verify proxy intercepts, calls TEE, forwards with payment
6. **Receipt check** — verify receipt hash is written on-chain (not amount)
7. **Explorer verification** — open `https://explorer.solana.com/tx/{hash}?cluster=devnet`
   and verify NO amount visible in transaction data
8. **Dashboard check** — verify public panel shows only hash, private panel shows full details

## Expected output

```
[1/8] TEE health: OK
[2/8] Agent deposit: tx confirmed (visible on-chain — expected)
[3/8] Session token: obtained in 847ms
[4/8] 402 intercepted: payment_requirements parsed
[5/8] TEE transfer: receipt_hash = 0xabc...def
[6/8] API response: 200 OK, data received
[7/8] On-chain: settlement hash confirmed, amount = NOT PRESENT ✓
[8/8] Dashboard: public/private contrast verified ✓

PASS: Full flow complete. Demo ready.
```

## On failure

- TEE timeout: check `TEE_RPC_URL` in `.env`, try mainnet-tee endpoint
- 402 not intercepted: check proxy server logs, verify `PROXY_PORT=3001`
- Amount visible on-chain: CRITICAL — stop and investigate per-client.ts
