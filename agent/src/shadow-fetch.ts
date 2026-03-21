import { Keypair } from "@solana/web3.js";

export interface ShadowFetchOptions {
  proxyUrl: string;
  agentPubkey: string;
  agentEphemeralAta: string;
}

export interface ShadowFetchResult {
  data: unknown;
  receiptHash: string;
  statusCode: number;
}

/**
 * shadowFetch — drop-in replacement for fetch() that routes through Shadow Proxy.
 * Payment happens privately via PER. Caller never sees x402 details.
 */
export async function shadowFetch(
  targetUrl: string,
  opts: ShadowFetchOptions
): Promise<ShadowFetchResult> {
  const res = await fetch(`${opts.proxyUrl}/proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      target: targetUrl,
      agentPubkey: opts.agentPubkey,
      agentEphemeralAta: opts.agentEphemeralAta,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new ShadowFetchError(`PROXY_ERROR: ${(err as { error: string }).error}`);
  }

  return res.json() as Promise<ShadowFetchResult>;
}

// ── Higher-level client with state ───────────────────────────────────────────

export interface ShadowFetchClientConfig {
  proxyUrl: string;
  agentKeypair: Keypair;
  usdcMint: string;
}

export class ShadowFetchClient {
  readonly proxyUrl: string;
  readonly agentKeypair: Keypair;
  readonly usdcMint: string;
  ephemeralAta: string | null = null;

  constructor(config: ShadowFetchClientConfig) {
    this.proxyUrl = config.proxyUrl;
    this.agentKeypair = config.agentKeypair;
    this.usdcMint = config.usdcMint;
  }

  /**
   * One-time deposit to fund the agent's PER balance.
   * This is the ONLY visible on-chain action — subsequent payments are private.
   */
  async deposit(amount: bigint): Promise<string> {
    const res = await fetch(`${this.proxyUrl}/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentPubkey: this.agentKeypair.publicKey.toBase58(),
        amount: amount.toString(),
      }),
    });

    if (!res.ok) throw new ShadowFetchError("DEPOSIT_FAILED");

    const { ephemeralAta, txSignature } = await res.json() as {
      ephemeralAta: string;
      txSignature: string;
    };

    this.ephemeralAta = ephemeralAta;
    console.log(`[shadow-fetch] deposited. ephemeral ATA: ${ephemeralAta}`);
    console.log(`[shadow-fetch] deposit tx: ${txSignature} (visible on Solana)`);
    return txSignature;
  }

  /**
   * Fetch a URL with private payment — main agent-facing method.
   */
  async fetch(targetUrl: string): Promise<ShadowFetchResult> {
    if (!this.ephemeralAta) {
      throw new ShadowFetchError("Must call deposit() before fetch()");
    }

    return shadowFetch(targetUrl, {
      proxyUrl: this.proxyUrl,
      agentPubkey: this.agentKeypair.publicKey.toBase58(),
      agentEphemeralAta: this.ephemeralAta,
    });
  }
}

export class ShadowFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShadowFetchError";
  }
}
