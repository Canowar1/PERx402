# Skill: per-integration

MagicBlock Private Ephemeral Rollup integration patterns for Shadow Proxy.
Load this skill when writing PER-related code.

## SDK installation

```bash
npm install @magicblock-labs/ephemeral-rollups-sdk
npm install tweetnacl  # for signing
```

## Full TypeScript session flow

```typescript
import {
  verifyTeeRpcIntegrity,
  getAuthToken,
  commitAndUndelegateAccounts,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import * as nacl from "tweetnacl";
import { Keypair, Connection } from "@solana/web3.js";

const TEE_URL = process.env.TEE_RPC_URL!;

export async function initTeeSession(wallet: Keypair): Promise<string> {
  const isValid = await verifyTeeRpcIntegrity(TEE_URL);
  if (!isValid) throw new Error("TEE_INTEGRITY_FAILED");

  const token = await getAuthToken(
    TEE_URL,
    wallet.publicKey,
    (msg: Uint8Array) =>
      Promise.resolve(nacl.sign.detached(msg, wallet.secretKey))
  );

  return token;
}

export function getTeeConnection(token: string): Connection {
  return new Connection(`${TEE_URL}?token=${token}`, "confirmed");
}
```

## Private SPL transfer via REST API

```typescript
export interface TransferResult {
  receiptHash: string;
  transactionBase64: string;
}

export async function privateTransfer(
  token: string,
  from: string,   // ephemeral ATA pubkey
  to: string,     // recipient ephemeral ATA pubkey
  amount: bigint  // in atomic units (USDC: 6 decimals)
): Promise<TransferResult> {
  const res = await fetch(`${TEE_URL}/transferAmount?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, amount: amount.toString() }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`PER_TRANSFER_FAILED: ${err.message}`);
  }

  const { transaction, message } = await res.json();

  // Execute transaction on Solana (NOT TEE)
  const connection = new Connection(process.env.SOLANA_RPC_URL!);
  // ... sign and send transaction

  // Compute receipt hash (SHA256 of transaction signature)
  const receiptHash = computeReceiptHash(transaction);
  return { receiptHash, transactionBase64: transaction };
}
```

## Deposit pattern

```typescript
export async function depositToTee(
  wallet: Keypair,
  amount: bigint,
  usdcMint: string
): Promise<{ ephemeralAta: string; txSignature: string }> {
  const res = await fetch(`${process.env.PER_API_URL}/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet: wallet.publicKey.toBase58(),
      amount: amount.toString(),
      token_mint: usdcMint,
    }),
  });

  const { transaction } = await res.json();
  // Sign and send on Solana mainnet
  // This IS visible on-chain (deposit amount visible) — expected behavior
}
```

## Receipt hash computation

```typescript
import { createHash } from "crypto";

export function computeReceiptHash(
  sender: string,
  recipient: string,
  nonce: string
): string {
  // IMPORTANT: amount is intentionally NOT included in hash inputs
  // The hash proves a payment occurred without revealing the amount
  return createHash("sha256")
    .update(`${sender}:${recipient}:${nonce}`)
    .digest("hex");
}
```

## Common errors and fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `TEE_INTEGRITY_FAILED` | Wrong endpoint or network issue | Check TEE_RPC_URL, try mainnet-tee |
| `TOKEN_EXPIRED` | Session > 15 min | Call getAuthToken() again |
| `INSUFFICIENT_BALANCE` | Agent ephemeral ATA empty | Call deposit first |
| `OFAC_BLOCKED` | Wallet on sanctions list | Do not retry, surface to user |
| `DELEGATION_REQUIRED` | ATA not delegated to TEE | Run deposit flow first |
