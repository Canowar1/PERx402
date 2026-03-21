# Shadow Proxy — CLAUDE.md

## Project overview

Shadow Proxy is a private x402 payment gateway for AI agents on Solana. It intercepts
x402 payment flows and routes them through MagicBlock's Private Ephemeral Rollup (TEE/Intel TDX),
hiding amount, service identity, and agent identity from the public chain.

**One-line pitch:** Any x402-protected API, paid privately on Solana — amount and intent never visible on-chain.

## Quick reference

| Layer        | Stack                                              |
|--------------|----------------------------------------------------|
| On-chain     | Anchor 0.32.1, Rust 1.85, Solana 2.3.13           |
| TEE privacy  | MagicBlock PER, Private SPL API, ephemeral-rollups-sdk |
| Payment std  | x402 v2 (Coinbase), x402-solana npm package        |
| Proxy server | Node 24, Express, TypeScript strict                |
| Dashboard    | Next.js 15, @solana/kit, React 19                  |
| Testing      | LiteSVM (programs), Vitest (TS), Playwright (e2e)  |

## Architecture in one paragraph

Agent calls `shadowFetch(url, opts)` → Shadow Proxy Express server receives it →
proxy intercepts 402 response → calls MagicBlock Private SPL API `/transferAmount`
inside TEE to move USDC from agent ephemeral ATA to proxy settlement ATA →
proxy builds x402 payment header with its own key → forwards to real API →
returns 200 + data to agent. Solana sees only a settlement hash. Amount never written on-chain.

## Repo structure

```
shadow-proxy/
├── CLAUDE.md                    ← you are here
├── .claude/
│   ├── agents/                  ← specialized subagents (invoke by name)
│   ├── commands/                ← /slash-commands
│   ├── skills/                  ← progressive-load knowledge
│   ├── rules/                   ← auto-loaded per file pattern
│   └── settings.json            ← MCP servers, hooks, permissions
├── programs/shadow_proxy/       ← Anchor program (Rust)
│   └── src/lib.rs
├── proxy/                       ← Express gateway (TypeScript)
│   └── src/
│       ├── server.ts
│       ├── interceptor.ts       ← x402 intercept logic
│       ├── per-client.ts        ← MagicBlock PER wrapper
│       └── session-manager.ts
├── agent/                       ← Mock AI agent (TypeScript)
│   └── src/
│       ├── agentA.ts
│       └── shadow-fetch.ts
├── dashboard/                   ← Next.js dashboard
│   └── src/
├── scripts/                     ← devnet setup, funding, deploy
└── docs/                        ← architecture diagrams, notes
```

## Essential commands

```bash
# Build Anchor program
anchor build

# Run on devnet (TEE)
anchor deploy --provider.cluster devnet

# Start proxy server
cd proxy && npm run dev

# Fund devnet wallets
npx ts-node scripts/fund-devnet.ts

# Run agent demo
npx ts-node agent/src/agentA.ts

# Full test suite
npm test

# Devnet end-to-end
npm run test:e2e
```

## Environment variables required

```
ANCHOR_WALLET=~/.config/solana/id.json
SOLANA_RPC_URL=https://api.devnet.solana.com
TEE_RPC_URL=https://tee.magicblock.app
COINBASE_FACILITATOR_URL=https://x402.org/facilitator
USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU   # devnet
PROXY_PORT=3001
```

## Critical rules — Claude MUST follow these

- NEVER hardcode private keys or wallet secrets anywhere in source files
- ALWAYS use `--break-system-packages` when installing pip packages
- ALWAYS run `anchor build` before `anchor deploy`; never deploy unbuilt code
- ALWAYS target devnet first; mainnet deploy requires explicit human approval
- ALWAYS use TypeScript strict mode in proxy/ and agent/; no `any` types
- TEE session tokens expire in 15 min — refresh logic must be in session-manager.ts
- MagicBlock Private SPL API calls go through TEE_RPC_URL endpoint ONLY
- x402 payment headers must be signed by proxy wallet, NEVER agent wallet
- `commit_and_undelegate_accounts` must be called after every PER transfer sequence

## MagicBlock SDK — key facts

- SDK: `@magicblock-labs/ephemeral-rollups-sdk`
- TEE devnet endpoint: `https://tee.magicblock.app?token={authToken}`
- Permission Program: `ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1`
- Delegation Program: `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh`
- TEE validator (devnet): `FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA`
- Private SPL API base: `https://per.magicblock.app` (beta)
- Auth flow: verifyTeeRpcIntegrity() → getAuthToken() → use token in URL

## x402 key facts

- Protocol: x402 v2 (Dec 2025)
- Solana facilitator: `https://x402.org/facilitator` (free on devnet)
- npm: `x402-solana`, `@coinbase/x402-fetch`
- Payment header: `X-PAYMENT: base64(paymentPayload)`
- 402 response body contains: amount, asset, recipient, network
- WalletAdapter interface required: { publicKey, signTransaction }

## When to use which agent

| Task                                | Agent                     |
|-------------------------------------|---------------------------|
| Design new PDA or account struct    | `/anchor-engineer`        |
| Write Anchor instruction            | `/anchor-engineer`        |
| Write proxy server logic (TS)       | `/proxy-engineer`         |
| Write x402 interceptor              | `/proxy-engineer`         |
| Write MagicBlock PER calls          | `/per-engineer`           |
| Write React dashboard component     | `/frontend-engineer`      |
| Write LiteSVM tests                 | `/solana-qa`              |
| Security review                     | `/solana-qa`              |
| Architecture decision               | `/solana-architect`       |

## Import additional context

@docs/architecture.md
@docs/per-api-reference.md
