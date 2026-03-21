# PERx402 — Private Payments for AI Agents on Solana

> **Built for [MagicBlock Solana Blitz V2 Hackathon](https://luma.com/olf99o4i?tk=WPBgB2) — Private Payments Track**

[![npm](https://img.shields.io/npm/v/perx402-sdk?color=11B2BA&label=perx402-sdk)](https://www.npmjs.com/package/perx402-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Solana Devnet](https://img.shields.io/badge/Solana-Devnet-9945FF)](https://explorer.solana.com/address/AVrFfzTREffC188KtCrJ2kf7AGgZFWcrzzRrYMku7k2n?cluster=devnet)

PERx402 is a privacy-preserving payment gateway that enables AI agents to pay for x402-protected APIs on Solana without revealing **who paid, how much, or what they accessed** on-chain. It leverages MagicBlock's Private Ephemeral Rollup (PER) running inside Intel TDX to keep payment details confidential while maintaining on-chain verifiability through settlement hashes.

---

## The Problem

The [x402 protocol](https://www.x402.org/) enables HTTP-native payments — an API returns `HTTP 402`, the client pays, and gets data. Simple and elegant. But on Solana, every payment is **fully transparent**:

| On-chain data point | Visible? |
|---------------------|----------|
| Sender wallet | ✅ Yes — who is this agent? |
| Recipient wallet | ✅ Yes — which API provider? |
| Amount | ✅ Yes — how much was paid? |
| Timestamp | ✅ Yes — when was it accessed? |

A competitor watching the chain can learn: *"This trading bot queries this premium data API 50x/hour and spends $X/month on market intelligence."*

## The Solution

PERx402 intercepts x402 payment flows and routes them through MagicBlock's **Private Ephemeral Rollup** (PER/Intel TDX). The agent calls `shadowFetch(url)` — everything else is handled automatically. After the payment:

| On-chain data point | Visible? |
|---------------------|----------|
| Settlement hash | ✅ Yes — proof of payment |
| Timestamp | ✅ Yes — when |
| Sender identity | ❌ **HIDDEN** |
| Recipient identity | ❌ **HIDDEN** |
| Amount | ❌ **HIDDEN** |
| API endpoint | ❌ **HIDDEN** |

---

## Architecture

```
Agent                          PERx402 Proxy                 MagicBlock PER (TEE)
  │                               │                               │
  │── shadowFetch(url) ──────────▶│                               │
  │                               │── GET url ────────────────▶ API Server
  │                               │◀─ HTTP 402 ──────────────── (pay me!)
  │                               │                               │
  │                               │── transferAmount ────────────▶│ ← inside Intel TDX
  │                               │   (amount stays in PER)       │
  │                               │◀─ settlement hash ────────────│ ← only hash exits
  │                               │                               │
  │                               │── GET url + X-PAYMENT ────▶ API Server
  │                               │◀─ HTTP 200 + data ─────────  (verified!)
  │                               │                               │
  │◀─ data + receiptHash ────────│                               │
  │   (never saw the 402)         │── store_receipt on-chain ──▶ Solana
  │                               │   (hash only, no amount)      │
```

**Key privacy guarantees:**
- The **agent** never sees the 402 response or knows about x402
- The **proxy** signs the payment header with its own key — agent identity never forwarded to the API
- **Solana** only sees a settlement hash — no amount, no sender, no recipient
- **MagicBlock's PER** executes the transfer inside hardware-encrypted memory

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| On-chain program | Anchor 0.32.1, Rust, Solana 2.3 |
| Privacy layer | MagicBlock Private Ephemeral Rollup (PER), Intel TDX |
| Payment standard | x402 v2 (Coinbase) |
| Proxy server | Node.js, Express, TypeScript (strict) |
| SDK | [`perx402-sdk`](https://www.npmjs.com/package/perx402-sdk) — published on npm, zero-dependency TypeScript |
| Dashboard | Next.js 15, React 19, Tailwind CSS v4 |
| Wallet adapter | Solana Wallet Adapter (Phantom, Solflare) |

---

## Features

### Core Protocol
- **x402 Interception** — Automatically catches HTTP 402 responses and handles payment
- **MagicBlock PER Transfer** — USDC moves inside MagicBlock's ephemeral rollup, invisible on-chain
- **On-chain Receipts** — Settlement hashes stored via Anchor program (amount excluded by design)
- **Proxy-signed Headers** — Agent identity never reaches the API provider

### Privacy Enhancements
- **Amount Bucketing** — Payments rounded to fixed tiers (0.10 / 0.25 / 0.50 / 1.00 / 5.00 / 10.00 USDC) to prevent amount fingerprinting
- **Timing Obfuscation** — Random 0-2s delay before PER transfer to break timing correlation
- **Identity Separation** — Agent pubkey ≠ proxy pubkey ≠ on-chain signer

### Streaming Micropayments
- **Pay-per-second** model for long-running agent tasks
- `POST /stream/start` — configurable interval, max payments, max spend cap
- Each tick generates a separate settlement hash → higher anonymity set

### SDK — [perx402-sdk on npm](https://www.npmjs.com/package/perx402-sdk)

```bash
npm install perx402-sdk
```

```typescript
import { shadowFetch } from "perx402-sdk";

const fetch = shadowFetch({
  proxyUrl: "http://localhost:3001",
  agentPubkey: "HwupK...",
  agentAta: "DDoKy...",
});

const data = await fetch("https://any-x402-api.com/data");
// → Agent never sees 402, never exposes identity
```

### Dashboard
- **Session Gate** — Connect agent flow with on-chain registration TX visible in real-time
- **Side-by-side comparison**: Public View (what Solana sees) vs Private View (what the proxy knows)
- **Live USDC balance** tracking from Solana RPC
- **Transaction trace timeline** — step-by-step visualization of the privacy flow
- **Wallet adapter** — connect Phantom/Solflare or use pre-funded demo agents

---

## Repository Structure

```
PERx402/
├── programs/shadow_proxy/       # Anchor on-chain program (Rust)
│   └── src/lib.rs               #   AgentIdentity + ReceiptVault PDAs
├── proxy/                       # Express gateway server (TypeScript)
│   └── src/
│       ├── server.ts            #   Main server + streaming endpoints
│       ├── interceptor.ts       #   x402 intercept + bucketing + timing obfuscation
│       ├── per-client.ts        #   MagicBlock PER wrapper
│       ├── session-manager.ts   #   PER auth + session refresh
│       ├── anchor-client.ts     #   On-chain receipt storage
│       └── mock-x402-server.ts  #   Mock API for demo (port 9999)
├── sdk/                         # perx402-sdk — published on npm
│   └── src/
│       ├── client.ts            #   ShadowProxyClient + PaymentStream
│       ├── shadow-fetch.ts      #   shadowFetch() convenience wrapper
│       └── types.ts             #   Full TypeScript types
├── agent/                       # Demo AI agent
│   └── src/
│       ├── agentA.ts            #   CLI demo with ASCII output
│       └── shadow-fetch.ts      #   Agent-side fetch wrapper
├── dashboard/                   # Next.js 15 dashboard
│   └── src/
│       ├── app/page.tsx         #   Main demo page
│       ├── components/          #   SessionGate, PublicView, PrivateView, PaymentFlow…
│       ├── hooks/useBalance.ts  #   Live USDC balance hook
│       └── lib/api.ts           #   Proxy API client
├── scripts/
│   ├── fund-devnet.ts           #   Wallet generation + SOL airdrop
│   └── demo.sh                  #   One-command demo launcher
├── docs/
│   └── architecture.md          #   Detailed architecture doc
├── Anchor.toml                  #   Anchor workspace config
└── .env.example                 #   Environment template
```

---

## On-Chain Program

**Program ID:** `AVrFfzTREffC188KtCrJ2kf7AGgZFWcrzzRrYMku7k2n` (devnet)

### PDAs

**AgentIdentity** — `seeds: ["agent_identity", agent_pubkey]`
```rust
pub struct AgentIdentity {
    pub agent: Pubkey,
    pub role: AgentRole,        // Payer | Viewer | Admin
    pub daily_limit: u64,
    pub spent_today: u64,
    pub last_reset_ts: i64,
    pub bump: u8,
}
```

**ReceiptVault** — `seeds: ["receipt_vault", agent_pubkey, nonce_bytes]`
```rust
pub struct ReceiptVault {
    pub agent: Pubkey,
    pub receipt_hash: [u8; 32],  // SHA256(sender:recipient:nonce) — NO amount
    pub timestamp: i64,
    pub nonce: u64,
    pub bump: u8,
}
```

The receipt hash is computed as `SHA256(fromAta:toAta:nonce)` — the amount is **intentionally excluded** to maintain privacy.

---

## Getting Started

### Prerequisites

- Node.js >= 20
- Rust + Solana CLI (`solana-install init 2.3.13`)
- Anchor CLI (`avm install 0.32.1`)

### 1. Clone & Install

```bash
git clone https://github.com/Canowar1/PERx402.git
cd PERx402
npm install
cd proxy && npm install && cd ..
cd dashboard && npm install && cd ..
cd agent && npm install && cd ..
```

### 2. Environment Setup

```bash
cp .env.example .env
# Generate wallets, airdrop devnet SOL, write keys to .env:
npx tsx scripts/fund-devnet.ts
```

### 3. Build the Anchor Program

```bash
anchor build
anchor deploy --provider.cluster devnet
```

### 4. Run the Demo

**Option A — One command:**
```bash
bash scripts/demo.sh
```

**Option B — Manual (3 terminals):**
```bash
# Terminal 1: Mock x402 API (port 9999)
cd proxy && npx tsx src/mock-x402-server.ts

# Terminal 2: PERx402 proxy server (port 3001)
cd proxy && npx tsx src/server.ts

# Terminal 3: Dashboard (port 3000)
cd dashboard && npm run dev
```

Open `http://localhost:3000`, click **"Initialize Session →"**, then **"Initiate Private Payment"**.

### 5. Run the Agent CLI

```bash
cd agent && npx tsx src/agentA.ts
```

---

## API Reference

### Proxy Server (port 3001)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server status, PER connection, agent registration |
| `POST` | `/session/init` | Initialize PER session + register agent on-chain |
| `POST` | `/proxy` | Execute a single private payment |
| `GET` | `/receipts` | List all settlement hashes (no amounts) |
| `GET` | `/receipts/:hash` | Get receipt detail + on-chain tx signature |
| `POST` | `/stream/start` | Start streaming micropayments |
| `POST` | `/stream/stop` | Stop a payment stream |
| `GET` | `/stream/:id` | Query stream status |

### Single Payment

```bash
curl -X POST http://localhost:3001/proxy \
  -H "Content-Type: application/json" \
  -d '{
    "target": "http://localhost:9999/api/market-data",
    "agentPubkey": "HwupKzvXRfrxnfSQ3bNoYbXiWS7TWXBWURb6JpZq5kup",
    "agentEphemeralAta": "DDoKyjLzyaLbrWi9SaQ7nXKFWgH4QqjWsfN4StP4niJe"
  }'
```

### Streaming Micropayments

```bash
# Start — 1 payment/second, max 60 payments
curl -X POST http://localhost:3001/stream/start \
  -H "Content-Type: application/json" \
  -d '{
    "target": "http://localhost:9999/api/market-data",
    "agentPubkey": "HwupKzvXRfrxnfSQ3bNoYbXiWS7TWXBWURb6JpZq5kup",
    "agentEphemeralAta": "DDoKyjLzyaLbrWi9SaQ7nXKFWgH4QqjWsfN4StP4niJe",
    "intervalMs": 1000,
    "maxPayments": 60
  }'

# Stop
curl -X POST http://localhost:3001/stream/stop \
  -H "Content-Type: application/json" \
  -d '{ "streamId": "abc-123" }'
```

---

## MagicBlock Integration

PERx402 is built on top of MagicBlock's infrastructure:

| Product | Role in PERx402 |
|---------|-----------------|
| **Private Ephemeral Rollup (PER)** | Executes private SPL transfers inside Intel TDX |
| **Private SPL API** | REST endpoints for deposit / transfer / withdraw |
| **Permission Program** | ACL for agent roles and access control |
| **Delegation Program** | Delegates agent ATAs to PER validator |
| **Ephemeral Rollups SDK** | Session key auth, PER integrity verification |

**Auth flow:**
1. `verifyTeeRpcIntegrity()` — Confirm PER node is genuine Intel TDX
2. `getAuthToken()` — Obtain session token (15 min TTL, auto-refreshed)
3. `transferAmount()` — Move USDC inside PER (invisible on-chain)
4. `commit_and_undelegate_accounts()` — Settle delta back to Solana

---

## Privacy Model

### What Solana sees after a PERx402 payment:

```
Transaction: 5xKm...a9f2
  Program: AVrFfzTREffC188KtCrJ2kf7AGgZFWcrzzRrYMku7k2n
  Instruction: store_receipt
  Fields:
    receipt_hash: a3f7c2e1...  ← SHA256 hash, no payment info
    timestamp:    1774096226
    nonce:        11469085198446617

  Who paid?     ████████ [HIDDEN — inside MagicBlock's PER]
  To whom?      ████████ [HIDDEN — inside MagicBlock's PER]
  How much?     ████████ [HIDDEN — inside MagicBlock's PER]
  Which API?    ████████ [HIDDEN — inside MagicBlock's PER]
```

### Privacy layers:
1. **MagicBlock PER** — Transfer executes inside hardware-encrypted memory
2. **Identity separation** — Proxy signs x402 header, agent pubkey never forwarded
3. **Amount bucketing** — Exact amount replaced with privacy-tier bucket
4. **Timing obfuscation** — Random delay breaks temporal correlation attacks
5. **Hash-only receipts** — On-chain receipt contains no payment details

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SOLANA_RPC_URL` | Solana RPC endpoint | Yes |
| `TEE_RPC_URL` | MagicBlock PER endpoint | Yes |
| `PER_API_URL` | Private SPL API base URL | Yes |
| `PROXY_WALLET_SECRET_KEY` | Proxy signing wallet (base58) | Yes |
| `AGENT_SECRET_KEY` | Agent wallet for demo (base58) | Yes |
| `USDC_MINT` | USDC token mint address | Yes |
| `PROXY_PORT` | Proxy server port (default: 3001) | No |
| `COINBASE_FACILITATOR_URL` | x402 facilitator URL | No |

---

## Test Results

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PERx402 — Final Test Suite
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Health Check              ✅ PASS
  Session Init              ✅ PASS
  Single Payment            ✅ PASS
  Privacy Invariant         ✅ PASS
  Streaming (3 payments)    ✅ PASS
  5 Concurrent Payments     ✅ PASS
  Input Validation          ✅ PASS
  Amount Bucketing          ✅ PASS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  8/8 PASS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Future Roadmap

- **~~SDK on npm~~** — ✅ [`perx402-sdk`](https://www.npmjs.com/package/perx402-sdk) published — works with any agent framework (LangChain, Eliza, AutoGPT)
- **Multi-proxy pool** — expanded anonymity set across multiple proxy nodes
- **ZK receipt proofs** — prove payment occurred without revealing identity
- **Cross-chain** — EVM chains via Aztec / zkSync
- **x402 API marketplace** — discover and pay for APIs privately

---

## Team

Built by **Caner Budak** for MagicBlock Solana Blitz V2 Hackathon.

## License

MIT
