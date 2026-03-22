import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { z } from "zod";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { SessionManager } from "./session-manager.js";
import { PerClient } from "./per-client.js";
import { interceptAndPay, InterceptorError } from "./interceptor.js";
import { ShadowProxyClient } from "./anchor-client.js";
import { randomUUID, randomBytes } from "crypto";

// ── Config ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PROXY_PORT ?? "3001");
const USDC_MINT = process.env.USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

// Load proxy wallet from env — NEVER hardcode
if (!process.env.PROXY_WALLET_SECRET_KEY) {
  throw new Error("PROXY_WALLET_SECRET_KEY env var required");
}
const proxyWallet = Keypair.fromSecretKey(
  bs58.decode(process.env.PROXY_WALLET_SECRET_KEY)
);

// HACKATHON ONLY: Load agent wallet so proxy can sign on agent's behalf.
// In production, agent would sign via wallet adapter or session keys.
let agentWallet: Keypair | null = null;
if (process.env.AGENT_SECRET_KEY) {
  agentWallet = Keypair.fromSecretKey(
    bs58.decode(process.env.AGENT_SECRET_KEY)
  );
  console.log(`[shadow-proxy] agent wallet loaded: ${agentWallet.publicKey.toBase58()}`);
}

const sessionManager = new SessionManager();
const perClient = new PerClient(proxyWallet);

// On-chain client (only if agent wallet available)
let anchorClient: ShadowProxyClient | null = null;
if (agentWallet) {
  anchorClient = new ShadowProxyClient(proxyWallet, agentWallet, SOLANA_RPC_URL);
}

// ── Request schemas ─────────────────────────────────────────────────────────────

const ProxyRequestSchema = z.object({
  target: z.string().url(),
  agentPubkey: z.string().min(32).max(44),
  agentEphemeralAta: z.string().min(32).max(44),
});

const DepositRequestSchema = z.object({
  agentPubkey: z.string().min(32).max(44),
  amount: z.string().regex(/^\d+$/),
});

// ── In-memory receipt store (replace with DB for production) ─────────────────
const RECEIPT_STORE_MAX = 1_000; // hard cap — prevents OOM under load

type ReceiptEntry = {
  hash: string;
  targetUrl: string;
  timestamp: number;
  agentPubkey: string;
  nonce: number;
  txSignature?: string;
  explorerUrl?: string;
  // NOTE: amount intentionally NOT stored — privacy guarantee
};

const receiptStore = new Map<string, ReceiptEntry>();

/** FIFO eviction: drop the oldest entry when the store hits the cap */
function receiptStoreSet(key: string, value: ReceiptEntry): void {
  if (!receiptStore.has(key) && receiptStore.size >= RECEIPT_STORE_MAX) {
    const oldestKey = receiptStore.keys().next().value;
    if (oldestKey !== undefined) receiptStore.delete(oldestKey);
  }
  receiptStore.set(key, value);
}

// ── App ────────────────────────────────────────────────────────────────────────

const app = express();
app.use(cors({ origin: "*" })); // Allow all origins for hackathon demo
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * Health check — also reports TEE + on-chain status
 */
app.get("/health", async (_req: Request, res: Response) => {
  const teeHealthy = sessionManager.isHealthy();
  const agentRegistered = anchorClient ? await anchorClient.isAgentRegistered().catch(() => false) : false;

  res.json({
    status: "ok",
    tee: teeHealthy ? "connected" : "initializing",
    proxy: proxyWallet.publicKey.toBase58(),
    agent: agentWallet?.publicKey.toBase58() ?? null,
    agentRegistered,
    programId: "AVrFfzTREffC188KtCrJ2kf7AGgZFWcrzzRrYMku7k2n",
    timestamp: Date.now(),
  });
});

/**
 * Get USDC token balance for any ATA (Associated Token Account).
 * Used by dashboard to show real-time balance changes.
 */
app.get("/balance/:address", async (req: Request<{ address: string }>, res: Response) => {
  try {
    const { Connection, PublicKey } = await import("@solana/web3.js");
    const conn = new Connection(SOLANA_RPC_URL, "confirmed");
    const pubkey = new PublicKey(req.params.address);

    // Try as SPL token account first, fall back to SOL balance
    try {
      const tokenBalance = await conn.getTokenAccountBalance(pubkey);
      res.json({
        address: req.params.address,
        balance: tokenBalance.value.uiAmountString,
        decimals: tokenBalance.value.decimals,
        raw: tokenBalance.value.amount,
      });
    } catch {
      // Not a token account — return SOL balance
      const lamports = await conn.getBalance(pubkey);
      res.json({
        address: req.params.address,
        balance: (lamports / 1e9).toFixed(4),
        decimals: 9,
        raw: lamports.toString(),
        token: "SOL",
      });
    }
  } catch (err) {
    res.status(400).json({ error: "INVALID_ADDRESS", message: (err as Error).message });
  }
});

/**
 * Initialize a TEE session for an agent wallet.
 * Also registers agent on-chain if not already registered.
 */
app.post("/session/init", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = await sessionManager.getToken(proxyWallet);
    void token; // used internally

    // Register agent on-chain if not already done
    let registeredOnChain = false;
    let registrationTx: string | undefined;
    if (anchorClient) {
      try {
        const tx = await anchorClient.registerAgent("Payer", BigInt(100_000_000));
        registeredOnChain = true;
        registrationTx = tx !== "already_registered" ? tx : undefined;
      } catch (err) {
        console.warn("[session/init] Agent registration failed:", (err as Error).message);
      }
    }

    res.json({
      initialized: true,
      expiresInMs: 14 * 60 * 1000,
      registeredOnChain,
      registrationTx,
      explorerUrl: registrationTx && registrationTx !== "already_registered"
        ? `https://explorer.solana.com/tx/${registrationTx}?cluster=devnet`
        : undefined,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Deposit USDC into PER for an agent.
 */
app.post("/deposit", async (req: Request, res: Response, next: NextFunction) => {
  const parsed = DepositRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await perClient.deposit(
      parsed.data.agentPubkey,
      BigInt(parsed.data.amount),
      USDC_MINT
    );
    res.json({ ephemeralAta: result.ephemeralAta, txSignature: result.txSignature });
  } catch (err) {
    next(err);
  }
});

/**
 * Main proxy endpoint.
 * Intercepts x402, executes private payment via PER, forwards request.
 * Stores receipt hash ON-CHAIN (amount NEVER stored).
 */
app.post("/proxy", async (req: Request, res: Response, next: NextFunction) => {
  const parsed = ProxyRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "INVALID_REQUEST", details: parsed.error.flatten() });
    return;
  }

  const { target, agentPubkey, agentEphemeralAta } = parsed.data;
  const nonce = randomUUID();
  // Cryptographically random u64 — avoids PDA collision when two requests
  // arrive in the same millisecond (timestamp-based nonces would collide).
  const nonceU64 = randomBytes(8).readBigUInt64LE(0);

  try {
    const sessionToken = await sessionManager.getToken(proxyWallet);

    const result = await interceptAndPay({
      targetUrl: target,
      agentSessionToken: sessionToken,
      agentEphemeralAta,
      proxyWallet,
      proxyEphemeralAta: proxyWallet.publicKey.toBase58(), // simplified for MVP
      perClient,
      nonce,
    });

    let txSignature: string | undefined;
    let explorerUrl: string | undefined;

    // Store receipt in-memory (bounded FIFO — see receiptStoreSet)
    if (result.receiptHash) {
      receiptStoreSet(result.receiptHash, {
        hash: result.receiptHash,
        targetUrl: target,
        timestamp: Date.now(),
        agentPubkey,
        nonce: Number(nonceU64),
      });

      // Store receipt hash ON-CHAIN (fire-and-forget, non-blocking)
      if (anchorClient) {
        anchorClient
          .storeReceipt(result.receiptHash, nonceU64)
          .then((sig) => {
            txSignature = sig;
            explorerUrl = `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
            // Update the in-memory store with tx info
            const entry = receiptStore.get(result.receiptHash);
            if (entry) {
              entry.txSignature = sig;
              entry.explorerUrl = explorerUrl;
            }
            console.log(`[proxy] Receipt stored on-chain: ${explorerUrl}`);
          })
          .catch((err: unknown) => {
            console.warn("[proxy] On-chain receipt storage failed:", (err as Error).message);
          });
      }
    }

    res.json({
      data: result.data,
      receiptHash: result.receiptHash,
      statusCode: result.statusCode,
      nonce: Number(nonceU64),
      // txSignature may not be available yet (async), fetch via /receipts/:hash
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Look up a receipt by hash.
 * Returns metadata but NOT amount (never stored).
 */
app.get("/receipts/:hash", (req: Request<{ hash: string }>, res: Response) => {
  const receipt = receiptStore.get(req.params.hash);
  if (!receipt) {
    res.status(404).json({ error: "RECEIPT_NOT_FOUND" });
    return;
  }
  res.json(receipt);
});

/**
 * List recent receipts (public metadata only).
 */
app.get("/receipts", (_req: Request, res: Response) => {
  const recent = Array.from(receiptStore.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20)
    .map(r => ({
      hash: r.hash,
      timestamp: r.timestamp,
      txSignature: r.txSignature,
      explorerUrl: r.explorerUrl,
      // agentPubkey, targetUrl, and amount NOT included in public listing
    }));
  res.json({ receipts: recent });
});

// ── Demo x402 endpoint ────────────────────────────────────────────────────────
// A self-contained x402-protected API for live demos.
// Returns 402 without X-PAYMENT, returns market data with X-PAYMENT.

const DEMO_USDC_AMOUNT = "100000"; // 0.1 USDC (6 decimals)
const DEMO_PAY_TO = proxyWallet.publicKey.toBase58();

app.get("/demo/market-data", (req: Request, res: Response) => {
  const payment = req.headers["x-payment"];

  if (!payment) {
    // No payment header — return 402 with requirements
    res.status(402).json({
      scheme: "exact",
      network: "solana-devnet",
      maxAmountRequired: DEMO_USDC_AMOUNT,
      resource: `${req.protocol}://${req.get("host")}/demo/market-data`,
      description: "Premium market data feed — PERx402 demo endpoint",
      payTo: DEMO_PAY_TO,
      maxTimeoutSeconds: 60,
      asset: USDC_MINT,
    });
    return;
  }

  // Payment header present — return premium data
  res.json({
    symbol: "SOL/USDC",
    price: 178.42 + (Math.random() * 4 - 2),
    change24h: "+3.21%",
    volume24h: 1_234_567 + Math.floor(Math.random() * 100_000),
    high24h: 181.50,
    low24h: 174.80,
    source: "perx402-demo-feed",
    paidVia: "MagicBlock PER · Private x402",
    message: "This data was paid for privately — amount and agent identity hidden from Solana.",
    timestamp: new Date().toISOString(),
  });
});

// ── Streaming micropayments ───────────────────────────────────────────────────

interface StreamPayment {
  receiptHash: string;
  amount: number;
  timestamp: number;
}

interface StreamSession {
  id: string;
  target: string;
  agentPubkey: string;
  agentEphemeralAta: string;
  intervalMs: number;
  maxPayments?: number;
  maxSpend?: number;
  startedAt: number;
  payments: StreamPayment[];
  totalAmount: number;
  status: "active" | "stopped";
  intervalHandle: ReturnType<typeof setInterval>;
}

const streamingSessions = new Map<string, StreamSession>();

/**
 * Start a streaming micropayment session.
 * Repeatedly calls interceptAndPay at the given interval.
 */
app.post("/stream/start", async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  // ── Validate required fields ──────────────────────────────────────────────
  if (typeof body.target !== "string" || !body.target) {
    res.status(400).json({ error: "target is required and must be a valid URL string", code: "INVALID_TARGET" });
    return;
  }
  if (typeof body.agentPubkey !== "string" || body.agentPubkey.length < 32 || body.agentPubkey.length > 44) {
    res.status(400).json({ error: "agentPubkey must be a base58 string (32-44 chars)", code: "INVALID_AGENT_PUBKEY" });
    return;
  }
  if (typeof body.agentEphemeralAta !== "string" || body.agentEphemeralAta.length < 32 || body.agentEphemeralAta.length > 44) {
    res.status(400).json({ error: "agentEphemeralAta must be a base58 string (32-44 chars)", code: "INVALID_ATA" });
    return;
  }
  if (typeof body.intervalMs !== "number" || body.intervalMs < 500) {
    res.status(400).json({ error: "intervalMs must be a number >= 500", code: "INVALID_INTERVAL" });
    return;
  }
  if (body.maxPayments !== undefined && (typeof body.maxPayments !== "number" || body.maxPayments <= 0)) {
    res.status(400).json({ error: "maxPayments must be a positive number if provided", code: "INVALID_MAX_PAYMENTS" });
    return;
  }
  if (body.maxSpend !== undefined && (typeof body.maxSpend !== "number" || body.maxSpend <= 0)) {
    res.status(400).json({ error: "maxSpend must be a positive number if provided", code: "INVALID_MAX_SPEND" });
    return;
  }

  const target = body.target as string;
  const agentPubkey = body.agentPubkey as string;
  const agentEphemeralAta = body.agentEphemeralAta as string;
  const intervalMs = body.intervalMs as number;
  const maxPayments = body.maxPayments as number | undefined;
  const maxSpend = body.maxSpend as number | undefined;

  const streamId = randomUUID();
  const startedAt = Date.now();

  console.log(`[stream] Starting stream ${streamId} → ${target} every ${intervalMs}ms`);

  const session: StreamSession = {
    id: streamId,
    target,
    agentPubkey,
    agentEphemeralAta,
    intervalMs,
    maxPayments,
    maxSpend,
    startedAt,
    payments: [],
    totalAmount: 0,
    status: "active",
    intervalHandle: null as unknown as ReturnType<typeof setInterval>, // set below
  };

  const stopStream = (reason: string): void => {
    if (session.status === "stopped") return;
    clearInterval(session.intervalHandle);
    session.status = "stopped";
    console.log(`[stream] Stream ${streamId} stopped: ${reason} (${session.payments.length} payments, total ${session.totalAmount})`);
  };

  const executePayment = async (): Promise<void> => {
    if (session.status === "stopped") return;

    // Check maxPayments limit
    if (maxPayments !== undefined && session.payments.length >= maxPayments) {
      stopStream("maxPayments reached");
      return;
    }

    // Check maxSpend limit before attempting payment
    if (maxSpend !== undefined && session.totalAmount >= maxSpend) {
      stopStream("maxSpend reached");
      return;
    }

    const nonce = randomUUID();
    const nonceU64 = randomBytes(8).readBigUInt64LE(0);

    try {
      const sessionToken = await sessionManager.getToken(proxyWallet);

      const result = await interceptAndPay({
        targetUrl: target,
        agentSessionToken: sessionToken,
        agentEphemeralAta,
        proxyWallet,
        proxyEphemeralAta: proxyWallet.publicKey.toBase58(),
        perClient,
        nonce,
      });

      const paidAmount = Number(result.paidAmount);

      // Check maxSpend after knowing the amount
      if (maxSpend !== undefined && session.totalAmount + paidAmount > maxSpend) {
        stopStream("maxSpend would be exceeded");
        return;
      }

      const payment: StreamPayment = {
        receiptHash: result.receiptHash,
        amount: paidAmount,
        timestamp: Date.now(),
      };

      session.payments.push(payment);
      session.totalAmount += paidAmount;

      // Store receipt in the shared receipt store
      if (result.receiptHash) {
        receiptStoreSet(result.receiptHash, {
          hash: result.receiptHash,
          targetUrl: target,
          timestamp: Date.now(),
          agentPubkey,
          nonce: Number(nonceU64),
        });

        // Store on-chain (fire-and-forget)
        if (anchorClient) {
          anchorClient
            .storeReceipt(result.receiptHash, nonceU64)
            .then((sig) => {
              const entry = receiptStore.get(result.receiptHash);
              if (entry) {
                entry.txSignature = sig;
                entry.explorerUrl = `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
              }
              console.log(`[stream] Receipt ${result.receiptHash} stored on-chain`);
            })
            .catch((err: unknown) => {
              console.warn(`[stream] On-chain receipt storage failed: ${(err as Error).message}`);
            });
        }
      }

      console.log(`[stream] Stream ${streamId} payment #${session.payments.length}: receipt=${result.receiptHash}, amount=${paidAmount}`);

      // Re-check maxPayments after adding payment
      if (maxPayments !== undefined && session.payments.length >= maxPayments) {
        stopStream("maxPayments reached");
      }
    } catch (err) {
      console.error(`[stream] Stream ${streamId} payment failed: ${(err as Error).message}`);
      stopStream(`payment error: ${(err as Error).message}`);
    }
  };

  session.intervalHandle = setInterval(() => void executePayment(), intervalMs);
  streamingSessions.set(streamId, session);

  // Fire the first payment immediately
  void executePayment();

  res.json({ streamId, status: "active", intervalMs });
});

/**
 * Stop a streaming micropayment session.
 */
app.post("/stream/stop", (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  if (typeof body.streamId !== "string" || !body.streamId) {
    res.status(400).json({ error: "streamId is required", code: "INVALID_STREAM_ID" });
    return;
  }

  const streamId = body.streamId as string;
  const session = streamingSessions.get(streamId);

  if (!session) {
    res.status(404).json({ error: "Stream not found", code: "STREAM_NOT_FOUND" });
    return;
  }

  clearInterval(session.intervalHandle);
  session.status = "stopped";
  const durationMs = Date.now() - session.startedAt;

  console.log(`[stream] Stream ${streamId} manually stopped after ${durationMs}ms (${session.payments.length} payments)`);

  res.json({
    streamId,
    status: "stopped",
    summary: {
      totalPayments: session.payments.length,
      totalAmount: session.totalAmount,
      receipts: session.payments.map((p) => p.receiptHash),
      durationMs,
    },
  });
});

/**
 * Get current status of a streaming session.
 */
app.get("/stream/:id", (req: Request<{ id: string }>, res: Response) => {
  const session = streamingSessions.get(req.params.id);

  if (!session) {
    res.status(404).json({ error: "Stream not found", code: "STREAM_NOT_FOUND" });
    return;
  }

  res.json({
    streamId: session.id,
    status: session.status,
    target: session.target,
    intervalMs: session.intervalMs,
    maxPayments: session.maxPayments ?? null,
    maxSpend: session.maxSpend ?? null,
    startedAt: session.startedAt,
    durationMs: Date.now() - session.startedAt,
    totalPayments: session.payments.length,
    totalAmount: session.totalAmount,
    payments: session.payments.map((p) => ({
      receiptHash: p.receiptHash,
      amount: p.amount,
      timestamp: p.timestamp,
    })),
  });
});

// ── Error handler ──────────────────────────────────────────────────────────────

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof InterceptorError) {
    // Map known error codes to client-safe messages — don't leak stack traces
    const code = err.message.split(":")[0] ?? "INTERCEPTOR_ERROR";
    const clientSafe: Record<string, { status: number; message: string }> = {
      TARGET_TIMEOUT:          { status: 504, message: "Target did not respond in time" },
      TARGET_UNREACHABLE:      { status: 502, message: "Target is unreachable" },
      INVALID_402_BODY:        { status: 502, message: "Target returned invalid payment requirements" },
      API_REJECTED_PAYMENT:    { status: 502, message: "Target rejected payment" },
      FACILITATOR_VERIFY_FAILED: { status: 502, message: "Payment facilitator error" },
      PAYMENT_INVALID_PER_FACILITATOR: { status: 402, message: "Payment validation failed" },
      AMOUNT_EXCEEDS_CAP:      { status: 402, message: "Requested payment amount exceeds the per-request cap" },
    };
    const mapped = clientSafe[code];
    console.warn(`[proxy] interceptor error: ${err.message}`);
    res.status(mapped?.status ?? 402).json({ error: mapped?.message ?? "Payment flow error" });
    return;
  }

  console.error("[proxy] unhandled error:", err instanceof Error ? err.message : "unknown");
  res.status(500).json({ error: "INTERNAL_ERROR" });
});

// ── Start ──────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[shadow-proxy] listening on :${PORT}`);
  console.log(`[shadow-proxy] proxy wallet: ${proxyWallet.publicKey.toBase58()}`);
  console.log(`[shadow-proxy] agent wallet: ${agentWallet?.publicKey.toBase58() ?? "not loaded"}`);
  console.log(`[shadow-proxy] program ID:   AVrFfzTREffC188KtCrJ2kf7AGgZFWcrzzRrYMku7k2n`);
  console.log(`[shadow-proxy] TEE endpoint: ${process.env.TEE_RPC_URL}`);
  console.log(`[shadow-proxy] on-chain:     ${anchorClient ? "enabled" : "disabled (no agent key)"}`);
});

export default app;
