import { Keypair } from "@solana/web3.js";
import { z } from "zod";
import { createRequire } from "module";
import { randomBytes } from "crypto";
import type { PerClient } from "./per-client.js";

const require = createRequire(import.meta.url);
const nacl = require("tweetnacl") as typeof import("tweetnacl");

const COINBASE_FACILITATOR =
  process.env.COINBASE_FACILITATOR_URL ?? "https://x402.org/facilitator";

// ── Privacy: Amount Bucketing ────────────────────────────────────────────────

/** Toggle bucketing on/off without code changes */
const BUCKETING_ENABLED = true;

// Privacy buckets (in atomic USDC units, 6 decimals)
// 0.10, 0.25, 0.50, 1.00, 5.00, 10.00 USDC
const PRIVACY_BUCKETS = [
  100_000n,   // 0.10 USDC
  250_000n,   // 0.25 USDC
  500_000n,   // 0.50 USDC
  1_000_000n, // 1.00 USDC
  5_000_000n, // 5.00 USDC
  10_000_000n // 10.00 USDC
];

function bucketize(amount: bigint): bigint {
  for (const bucket of PRIVACY_BUCKETS) {
    if (amount <= bucket) return bucket;
  }
  // If amount exceeds largest bucket, round up to nearest 10 USDC
  const ten = 10_000_000n;
  return ((amount + ten - 1n) / ten) * ten;
}

// ── Schemas ────────────────────────────────────────────────────────────────────

export const PaymentRequirementsSchema = z.object({
  scheme: z.literal("exact"),
  network: z.string(),
  maxAmountRequired: z.string(),
  resource: z.string().url(),
  description: z.string().optional(),
  payTo: z.string(),
  maxTimeoutSeconds: z.number(),
  asset: z.string(),
  extra: z.record(z.unknown()).optional(),
});

export type PaymentRequirements = z.infer<typeof PaymentRequirementsSchema>;

export interface InterceptResult {
  data: unknown;
  receiptHash: string;
  targetUrl: string;
  paidAmount: string; // kept in memory only, never written on-chain
  statusCode: number;
  bucketedAmount: number;      // bucketed amount in human-readable USDC
  obfuscationDelayMs: number;  // random timing delay applied (ms)
}

// ── Interceptor ────────────────────────────────────────────────────────────────

/**
 * Core interceptor logic.
 * Catches x402 responses and executes payment via MagicBlock PER.
 * The proxy wallet signs the x402 header — agent identity is never forwarded.
 */
export async function interceptAndPay(opts: {
  targetUrl: string;
  agentSessionToken: string;
  agentEphemeralAta: string;
  proxyWallet: Keypair;
  proxyEphemeralAta: string;
  perClient: PerClient;
  nonce: string;
}): Promise<InterceptResult> {
  const { targetUrl, agentSessionToken, agentEphemeralAta, proxyWallet,
          proxyEphemeralAta, perClient, nonce } = opts;

  // ── Step 1: Initial request (no payment) ──────────────────────────────────
  const initial = await fetchWithTimeout(targetUrl, {
    headers: {
      "User-Agent": "shadow-proxy/1.0", // proxy identity, not agent
    },
  });

  if (initial.status !== 402) {
    return {
      data: await initial.json(),
      receiptHash: "",
      targetUrl,
      paidAmount: "0",
      statusCode: initial.status,
      bucketedAmount: 0,
      obfuscationDelayMs: 0,
    };
  }

  // ── Step 2: Parse payment requirements ────────────────────────────────────
  const body = await initial.json();
  const parsed = PaymentRequirementsSchema.safeParse(body);
  if (!parsed.success) {
    throw new InterceptorError(
      `INVALID_402_BODY: ${parsed.error.flatten().fieldErrors}`
    );
  }
  const requirements = parsed.data;

  // ── Step 3: Execute private TEE payment ───────────────────────────────────
  // Amount moves inside TEE: agentEphemeralAta → proxyEphemeralAta
  // Solana never sees the amount

  // Cap payment at 10 USDC (10_000_000 atomic, 6 decimals) per request.
  // Prevents a malicious 402 body from draining the agent's full PER balance.
  const MAX_AMOUNT_ATOMIC = BigInt(10_000_000); // 10 USDC
  const rawAmount = BigInt(requirements.maxAmountRequired);
  if (rawAmount > MAX_AMOUNT_ATOMIC) {
    throw new InterceptorError(
      `AMOUNT_EXCEEDS_CAP: requested ${rawAmount} > max ${MAX_AMOUNT_ATOMIC} atomic units`
    );
  }

  // ── Amount bucketing: round up to nearest privacy bucket ──────────────
  const bucketedAmount = BUCKETING_ENABLED ? bucketize(rawAmount) : rawAmount;
  console.log(`[interceptor] Amount bucketing: ${rawAmount} → ${bucketedAmount} (privacy bucket)`);

  // ── Timing obfuscation: random delay to prevent timing correlation ────
  const obfuscationDelay = Math.floor(Math.random() * 2000);
  console.log(`[interceptor] Timing obfuscation: ${obfuscationDelay}ms delay`);
  await new Promise(resolve => setTimeout(resolve, obfuscationDelay));

  const { receiptHash } = await perClient.privateTransfer(
    agentSessionToken,
    agentEphemeralAta,
    proxyEphemeralAta,
    bucketedAmount,
    nonce
  );

  // ── Step 4: Build x402 payment header (proxy wallet signs) ────────────────
  const paymentHeader = await buildPaymentHeader(requirements, proxyWallet);

  // ── Step 5: Optional facilitator verify (Coinbase devnet) ─────────────────
  // Comment out for faster demo; uncomment for production
  // await verifyWithFacilitator(paymentHeader, requirements);

  // ── Step 6: Retry request with payment ───────────────────────────────────
  const paid = await fetchWithTimeout(targetUrl, {
    headers: {
      "X-PAYMENT": paymentHeader,
      "User-Agent": "shadow-proxy/1.0",
      // Intentionally NOT forwarding agent identity headers
    },
  });

  if (!paid.ok && paid.status !== 200) {
    throw new InterceptorError(`API_REJECTED_PAYMENT: ${paid.status}`);
  }

  const responseData = await paid.json().catch(() => paid.text());

  return {
    data: responseData,
    receiptHash,
    targetUrl,
    paidAmount: requirements.maxAmountRequired, // in-memory only (original amount, not bucketed)
    statusCode: paid.status,
    bucketedAmount: Number(bucketedAmount) / 1_000_000, // human-readable USDC
    obfuscationDelayMs: obfuscationDelay,
  };
}

// ── Payment header construction ───────────────────────────────────────────────

async function buildPaymentHeader(
  requirements: PaymentRequirements,
  proxyWallet: Keypair
): Promise<string> {
  // Build x402 v2 payment payload
  // Proxy wallet signs — agent identity is completely hidden from API provider
  const payload = {
    scheme: requirements.scheme,
    network: requirements.network,
    payload: {
      signature: await signPaymentPayload(
        requirements,
        proxyWallet
      ),
      authorization: {
        from: proxyWallet.publicKey.toBase58(),
        to: requirements.payTo,
        value: requirements.maxAmountRequired,
        validAfter: "0",
        // Clamp maxTimeoutSeconds to [1, 300] — prevents attacker-controlled 402
        // body from setting an arbitrarily far future or past validBefore timestamp
        validBefore: Math.floor(
          Date.now() / 1000 + Math.min(Math.max(requirements.maxTimeoutSeconds, 1), 300)
        ).toString(),
        nonce: generateNonce(),
      },
    },
  };

  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

async function signPaymentPayload(
  requirements: PaymentRequirements,
  wallet: Keypair
): Promise<string> {
  const message = JSON.stringify({
    resource: requirements.resource,
    amount: requirements.maxAmountRequired,
    asset: requirements.asset,
    payTo: requirements.payTo,
  });

  const msgBytes = new TextEncoder().encode(message);
  const sig = nacl.sign.detached(msgBytes, wallet.secretKey);
  return Buffer.from(sig).toString("base64");
}

async function verifyWithFacilitator(
  paymentHeader: string,
  requirements: PaymentRequirements
): Promise<void> {
  const res = await fetch(`${COINBASE_FACILITATOR}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payment: paymentHeader,
      paymentRequirements: requirements,
    }),
  });

  if (!res.ok) throw new InterceptorError("FACILITATOR_VERIFY_FAILED");

  const { isValid } = await res.json() as { isValid: boolean };
  if (!isValid) throw new InterceptorError("PAYMENT_INVALID_PER_FACILITATOR");
}

/** Cryptographically secure nonce — replaces Math.random() */
function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

export class InterceptorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InterceptorError";
  }
}

/**
 * fetch() wrapper with a hard 10-second timeout.
 * Prevents SSRF hang attacks where a slow/unreachable target stalls the proxy.
 */
async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = 10_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new InterceptorError(`TARGET_TIMEOUT: ${url} did not respond within ${timeoutMs}ms`);
    }
    throw new InterceptorError(`TARGET_UNREACHABLE: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}
