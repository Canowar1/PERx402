# Agent: frontend-engineer

You build the Shadow Proxy dashboard in Next.js 15 with @solana/kit.
The dashboard's job: show the contrast between what Solana sees vs what only the agent sees.

## Dashboard purpose

Two-panel layout:
- **Left — Public view**: what anyone with Solana Explorer access can see
  (settlement hash, timestamp, "payment occurred" — NO amount, NO API, NO agent)
- **Right — Private view**: what the agent sees after decrypting with session key
  (exact amount, which API was called, receipt hash, service response)

This contrast IS the demo. Make it visually obvious.

## Stack

- Next.js 15 App Router, React 19
- `@solana/kit` (NOT web3.js legacy — use kit)
- `@solana/react-hooks` for wallet and connection
- Tailwind CSS (core utilities only, no custom config needed for hackathon)
- Zustand for client state

## Key components to build

```
dashboard/src/components/
├── PublicView.tsx       — Explorer-style, shows only hash + timestamp
├── PrivateView.tsx      — Decrypted view, shows full details
├── AgentPanel.tsx       — Controls: connect wallet, init session, send request
├── ReceiptCard.tsx      — Single receipt display (reused in both views)
├── PaymentFlow.tsx      — Animated step indicator (shows 402 → TEE → 200 flow)
└── ConnectionStatus.tsx — TEE health indicator
```

## Component rules

- Every component: explicit return type
- Client components: `"use client"` directive
- No default exports for components (named exports only)
- Loading states always handled (skeleton, not spinner where possible)
- Error states always handled with user-friendly message

## PublicView data shape

```typescript
interface PublicReceipt {
  settlementHash: string;    // visible on Solana
  timestamp: number;
  status: "confirmed" | "pending";
  // NOTE: amount, api, agent — all undefined in this view
}
```

## PrivateView data shape

```typescript
interface PrivateReceipt {
  settlementHash: string;
  timestamp: number;
  amount: string;            // "0.42 USDC"
  targetApi: string;         // "https://api.example.com/data"
  agentPubkey: string;
  sessionKey: string;        // last 8 chars only for display
  serviceResponse: unknown;  // the actual API data returned
}
```

## Demo animation

The `PaymentFlow` component shows:
`Agent request → 402 captured → TEE payment → API forward → 200 OK`

Use CSS transitions only (no animation libraries). Each step lights up in sequence
when the proxy processes a real payment. Connect to proxy via WebSocket or polling.

## Color coding (important for demo)

- Public data: gray tones — visually "empty", "hidden"
- Private data: purple/teal — visually "rich", "decrypted"
- Settlement hash: monospace, truncated, clickable → opens Solana Explorer
- TEE status indicator: green dot when active, red when disconnected

## What to avoid

- No web3.js direct usage — use @solana/kit
- No hardcoded RPC URLs — use environment variables
- No console.log in components
- No inline styles — Tailwind only
