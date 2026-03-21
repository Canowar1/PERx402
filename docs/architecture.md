# Shadow Proxy — Architecture

## Privacy guarantee

Solana is fully transparent. Every normal x402 payment writes:
- sender pubkey
- recipient pubkey
- amount
- token mint

Shadow Proxy eliminates all of these from the public chain.
What Solana sees after a Shadow Proxy payment: **settlement hash only**.

## System components

```
┌─────────────────────────────────────────────────────────┐
│  AI Agent                                               │
│  • calls shadowFetch(url)                               │
│  • has NO knowledge of x402 or PER internals            │
└─────────────┬───────────────────────────────────────────┘
              │ POST /proxy { target, agentPubkey, ata }
              ▼
┌─────────────────────────────────────────────────────────┐
│  Shadow Proxy (Express server)                          │
│  • intercepts 402 response                              │
│  • calls PER for private payment                        │
│  • builds x402 header (proxy wallet signs)              │
│  • forwards to real API                                 │
│  • returns data + receiptHash to agent                  │
└─────────────┬───────────────────────────────────────────┘
              │ POST /transferAmount (TEE only)
              ▼
┌─────────────────────────────────────────────────────────┐
│  MagicBlock Private Ephemeral Rollup (Intel TDX)        │
│  • amount and intent stay inside TEE                    │
│  • only settlement hash exits to Solana                 │
│  • OFAC + geofencing enforced at node level             │
└─────────────┬───────────────────────────────────────────┘
              │ commit_and_undelegate (settlement hash)
              ▼
┌─────────────────────────────────────────────────────────┐
│  Solana Mainnet                                         │
│  • ReceiptVault: hash stored (no amount)                │
│  • AgentIdentity: role + daily limit                    │
│  • SPL balances: aggregate delta only                   │
└─────────────────────────────────────────────────────────┘
```

## What is visible vs hidden

| Data point      | On Solana | In Shadow Proxy | In TEE |
|-----------------|-----------|-----------------|--------|
| Payment occurred | ✓ (hash)  | ✓               | ✓      |
| Amount          | ✗ hidden  | in-memory only  | ✓      |
| Target API URL  | ✗ hidden  | in-memory only  | ✓      |
| Agent identity  | ✗ hidden  | ✓               | ✓      |
| Receipt hash    | ✓ public  | ✓               | ✓      |
| Timestamp       | ✓ public  | ✓               | ✓      |

## MagicBlock products used

| Product               | Role in Shadow Proxy                        |
|-----------------------|---------------------------------------------|
| Private Ephemeral Rollup (PER) | Executes private SPL transfers inside TEE |
| Private SPL API       | REST endpoints for deposit/transfer/withdraw |
| Permission Program    | ACL for agent roles and access control      |
| Delegation Program    | Delegates agent ATAs to TEE validator       |
| Ephemeral Rollup SDK  | Session key auth, TEE integrity check       |

## x402 integration

Shadow Proxy is a **private x402 facilitator**. It:
1. Receives normal x402 402 responses
2. Routes payment through MagicBlock PER (hidden from chain)
3. Signs the x402 payment header with the proxy wallet (not agent wallet)
4. The API provider never learns the agent's identity

This makes Shadow Proxy the **first private x402 implementation on Solana**.
