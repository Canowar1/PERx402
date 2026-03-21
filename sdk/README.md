# @shadow-proxy/sdk

Dead-simple SDK for Shadow Proxy -- private x402 payments for AI agents on Solana.

Shadow Proxy intercepts x402 payment flows and routes them through MagicBlock's Private Ephemeral Rollup (TEE), hiding amount, service identity, and agent identity from the public chain.

## Installation

```bash
npm install @shadow-proxy/sdk
```

## Quick start

### Two-line usage with `shadowFetch`

```typescript
import { shadowFetch } from "@shadow-proxy/sdk";

const pay = shadowFetch({
  proxyUrl: "http://localhost:3001",
  agentPubkey: "HwupK...",
  agentAta: "DDoKy...",
});

const result = await pay("https://any-x402-api.com/market-data");
console.log(result.data);          // { symbol: "SOL/USDC", price: 178.42, ... }
console.log(result.receiptHash);   // "abc123..."
console.log(result.amount);        // 0.1
```

### Full client

```typescript
import { ShadowProxyClient } from "@shadow-proxy/sdk";

const shadow = new ShadowProxyClient({
  proxyUrl: "http://localhost:3001",
  agentPubkey: "HwupK...",
  agentAta: "DDoKy...",
  autoInitSession: true, // default, calls /session/init on first request
});

// Single payment
const result = await shadow.pay("https://api.example.com/data");
console.log(result.data);
console.log(result.receiptHash);

// Health check
const health = await shadow.health();
console.log(health.status); // "ok"

// Look up a receipt
const receipt = await shadow.getReceipt("abc123...");

// Get all receipts
const receipts = await shadow.getReceipts();
```

### Streaming micropayments

```typescript
import { ShadowProxyClient } from "@shadow-proxy/sdk";

const shadow = new ShadowProxyClient({
  proxyUrl: "http://localhost:3001",
  agentPubkey: "HwupK...",
  agentAta: "DDoKy...",
});

const stream = shadow.createStream("https://api.example.com/feed", {
  intervalMs: 1000,        // pay once per second
  maxPayments: 60,         // stop after 60 payments
  maxSpend: 5.0,           // or stop after 5 USDC
});

stream.on("data", (chunk) => {
  console.log("Received:", chunk);
});

stream.on("receipt", (r) => {
  console.log("Paid:", r.receiptHash, "Amount:", r.amount);
});

stream.on("error", (err) => {
  console.error("Stream error:", err.code, err.message);
});

stream.on("stopped", (summary) => {
  console.log("Total paid:", summary.totalPaid);
  console.log("Payments:", summary.paymentsCount);
});

await stream.start();

// Later, stop manually:
const summary = await stream.stop();
```

## Error handling

All errors are instances of `ShadowProxyError` with a `code` property:

```typescript
import { ShadowProxyError } from "@shadow-proxy/sdk";

try {
  await shadow.pay("https://api.example.com/data");
} catch (err) {
  if (err instanceof ShadowProxyError) {
    switch (err.code) {
      case "PROXY_UNREACHABLE":
        console.error("Cannot reach the proxy server");
        break;
      case "SESSION_INIT_FAILED":
        console.error("Failed to initialize session");
        break;
      case "PAYMENT_FAILED":
        console.error("Payment rejected:", err.message);
        break;
      case "TIMEOUT":
        console.error("Request timed out");
        break;
    }
  }
}
```

### Error codes

| Code                  | Meaning                                      |
|-----------------------|----------------------------------------------|
| `PROXY_UNREACHABLE`   | Cannot connect to the Shadow Proxy server    |
| `SESSION_INIT_FAILED` | POST /session/init returned an error         |
| `PAYMENT_FAILED`      | POST /proxy returned a non-200 status        |
| `RECEIPT_NOT_FOUND`   | GET /receipts/:hash returned an error        |
| `STREAM_ERROR`        | Error during a streaming payment tick        |
| `TIMEOUT`             | Request exceeded the timeout                 |
| `INVALID_CONFIG`      | Missing or invalid configuration values      |

## API reference

### `shadowFetch(config: ShadowProxyConfig): ShadowFetchFn`

Returns a function `(targetUrl: string) => Promise<PayResult>`. Creates a `ShadowProxyClient` internally with `autoInitSession: true`.

### `ShadowProxyClient`

| Method                          | Description                                  |
|---------------------------------|----------------------------------------------|
| `pay(url, options?)`            | Make a single private payment                |
| `health()`                      | GET /health                                  |
| `getReceipt(hash)`              | GET /receipts/:hash                          |
| `getReceipts()`                 | GET /receipts                                |
| `initSession()`                 | POST /session/init                           |
| `createStream(url, options)`    | Create a PaymentStream (call .start() next)  |

### `PaymentStream` (extends EventEmitter)

| Method    | Description                                         |
|-----------|-----------------------------------------------------|
| `start()` | Begin interval-based payments                       |
| `stop()`  | Stop the stream, returns `StreamSummary`            |

| Event     | Payload                                              |
|-----------|------------------------------------------------------|
| `data`    | Response data from the target API                    |
| `receipt` | `{ receiptHash, amount, timestamp }`                 |
| `error`   | `ShadowProxyError`                                   |
| `stopped` | `StreamSummary`                                      |

## Requirements

- Node.js >= 18 (uses built-in `fetch` and `AbortSignal.timeout`)
- A running Shadow Proxy server (default: `http://localhost:3001`)
- Agent wallet funded with USDC on devnet

## License

MIT
