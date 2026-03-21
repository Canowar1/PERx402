# Skill: x402-integration

x402 v2 protocol integration patterns for Shadow Proxy.
Load this skill when writing x402-related code.

## Installation

```bash
npm install x402-solana @coinbase/x402-fetch
```

## 402 response parsing

```typescript
interface PaymentRequirements {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;  // atomic units string
  resource: string;
  description?: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;              // token mint address
  extra?: Record<string, unknown>;
}

export function parsePaymentRequirements(
  response: Response
): PaymentRequirements | null {
  if (response.status !== 402) return null;
  // x402 v2: requirements in response body as JSON
  return response.json() as Promise<PaymentRequirements>;
}
```

## Building payment header (proxy wallet signs)

```typescript
import { createPaymentHeader } from "x402-solana/client";
import { Keypair } from "@solana/web3.js";

export async function buildPaymentHeader(
  requirements: PaymentRequirements,
  proxyWallet: Keypair   // ALWAYS proxy wallet, NEVER agent wallet
): Promise<string> {
  return createPaymentHeader({
    paymentRequirements: requirements,
    wallet: {
      publicKey: { toString: () => proxyWallet.publicKey.toBase58() },
      signTransaction: async (tx) => {
        // sign with proxy keypair
        tx.sign([proxyWallet]);
        return tx;
      },
    },
    network: requirements.network,
  });
}
```

## Facilitator verification (Coinbase, free on devnet)

```typescript
const FACILITATOR_URL = process.env.COINBASE_FACILITATOR_URL
  ?? "https://x402.org/facilitator";

export async function verifyPaymentWithFacilitator(
  paymentHeader: string,
  requirements: PaymentRequirements
): Promise<boolean> {
  const res = await fetch(`${FACILITATOR_URL}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payment: paymentHeader, paymentRequirements: requirements }),
  });
  const { isValid } = await res.json();
  return isValid;
}
```

## Using x402-fetch wrapper (simplified client)

```typescript
import { wrapFetchWithPayment } from "@coinbase/x402-fetch";

// For agent — wrap fetch with shadow proxy wallet
// In Shadow Proxy, we DON'T use this directly (we intercept manually)
// But agents connecting to normal x402 APIs can use this
const x402Fetch = wrapFetchWithPayment(fetch, agentWallet);
const data = await x402Fetch("https://api.example.com/protected");
```

## Testing against a mock x402 server

```typescript
// In tests, run a local x402 server that always returns 402
import { createMockX402Server } from "./test-helpers";

const mockServer = createMockX402Server({
  port: 9999,
  price: "100000",   // 0.10 USDC
  payTo: "devnet-wallet-address",
});

// Then point shadowFetch at http://localhost:9999/data
```

## Network identifiers (x402 v2 CAIP-2)

| Environment | Network string |
|-------------|----------------|
| Solana devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |
| Solana mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |

## Amount handling

x402 uses atomic units (USDC has 6 decimals):
- `"100000"` = 0.10 USDC
- `"1000000"` = 1.00 USDC
- `"10000000"` = 10.00 USDC

Always use `BigInt` for amount arithmetic to avoid precision loss.
