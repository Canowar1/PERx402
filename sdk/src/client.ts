/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { EventEmitter } from "events";
import type {
  ShadowProxyConfig,
  PayResult,
  PayOptions,
  HealthStatus,
  Receipt,
  SessionResult,
  StreamOptions,
  StreamSummary,
  ShadowProxyErrorCode,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 30_000;

/** Custom error class for all Shadow Proxy errors. */
export class ShadowProxyError extends Error {
  readonly code: ShadowProxyErrorCode;

  constructor(code: ShadowProxyErrorCode, message: string) {
    super(message);
    this.name = "ShadowProxyError";
    this.code = code;
  }
}

/**
 * A streaming payment object that makes interval-based payments to a target URL.
 * Extends EventEmitter so consumers can listen for `data`, `receipt`, `error`, and `stopped`.
 */
export class PaymentStream extends EventEmitter {
  private readonly client: ShadowProxyClient;
  private readonly targetUrl: string;
  private readonly options: StreamOptions;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private totalPaid = 0;
  private paymentsCount = 0;
  private receiptHashes: string[] = [];

  constructor(
    client: ShadowProxyClient,
    targetUrl: string,
    options: StreamOptions,
  ) {
    super();
    this.client = client;
    this.targetUrl = targetUrl;
    this.options = options;
  }

  /** Start interval-based payments. Resolves once the stream is running. */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;

    // Make the first payment immediately.
    await this.tick();

    if (!this.running) {
      // tick() may have stopped the stream (e.g. maxPayments === 1).
      return;
    }

    this.intervalHandle = setInterval(() => {
      void this.tick();
    }, this.options.intervalMs);
  }

  /** Stop the stream and return a summary of all payments made. */
  async stop(): Promise<StreamSummary> {
    this.running = false;
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    const summary: StreamSummary = {
      totalPaid: this.totalPaid,
      paymentsCount: this.paymentsCount,
      receipts: [...this.receiptHashes],
    };
    this.emit("stopped", summary);
    return summary;
  }

  private async tick(): Promise<void> {
    if (!this.running) {
      return;
    }

    // Check max payments.
    if (
      this.options.maxPayments !== undefined &&
      this.paymentsCount >= this.options.maxPayments
    ) {
      await this.stop();
      return;
    }

    // Check max spend.
    if (
      this.options.maxSpend !== undefined &&
      this.totalPaid >= this.options.maxSpend
    ) {
      await this.stop();
      return;
    }

    try {
      const result = await this.client.pay(this.targetUrl);
      this.paymentsCount += 1;
      this.totalPaid += result.amount;
      this.receiptHashes.push(result.receiptHash);

      this.emit("data", result.data);
      this.emit("receipt", {
        receiptHash: result.receiptHash,
        amount: result.amount,
        timestamp: result.timestamp,
      });
    } catch (err: unknown) {
      const proxyErr =
        err instanceof ShadowProxyError
          ? err
          : new ShadowProxyError(
              "STREAM_ERROR",
              err instanceof Error ? err.message : String(err),
            );
      this.emit("error", proxyErr);
    }
  }
}

/**
 * Full-featured client for the Shadow Proxy server.
 *
 * Handles session initialization, single payments, receipt lookup, health
 * checks, and streaming micropayments.
 */
export class ShadowProxyClient {
  private readonly config: ShadowProxyConfig;
  private readonly baseUrl: string;
  private sessionInitialized = false;
  private sessionInitPromise: Promise<SessionResult> | null = null;

  constructor(config: ShadowProxyConfig) {
    if (!config.proxyUrl) {
      throw new ShadowProxyError("INVALID_CONFIG", "proxyUrl is required");
    }
    if (!config.agentPubkey) {
      throw new ShadowProxyError("INVALID_CONFIG", "agentPubkey is required");
    }
    if (!config.agentAta) {
      throw new ShadowProxyError("INVALID_CONFIG", "agentAta is required");
    }

    this.config = {
      autoInitSession: true,
      ...config,
    };
    // Strip trailing slash.
    this.baseUrl = config.proxyUrl.replace(/\/+$/, "");
  }

  /**
   * Make a single payment to a target x402-protected URL.
   * On the first call, automatically initializes a session (unless disabled).
   */
  async pay(targetUrl: string, options?: PayOptions): Promise<PayResult> {
    await this.ensureSession();

    const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;

    const response = await this.fetchWithErrors(`${this.baseUrl}/proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: targetUrl,
        agentPubkey: this.config.agentPubkey,
        ata: this.config.agentAta,
      }),
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ShadowProxyError(
        "PAYMENT_FAILED",
        `Payment failed (HTTP ${String(response.status)}): ${body}`,
      );
    }

    const result = (await response.json()) as PayResult;
    return result;
  }

  /** Call GET /health on the proxy server. */
  async health(): Promise<HealthStatus> {
    const response = await this.fetchWithErrors(`${this.baseUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new ShadowProxyError(
        "PROXY_UNREACHABLE",
        `Health check failed (HTTP ${String(response.status)})`,
      );
    }

    return (await response.json()) as HealthStatus;
  }

  /** Look up a receipt by its settlement hash. */
  async getReceipt(hash: string): Promise<Receipt | null> {
    const response = await this.fetchWithErrors(
      `${this.baseUrl}/receipts/${encodeURIComponent(hash)}`,
      {
        method: "GET",
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new ShadowProxyError(
        "RECEIPT_NOT_FOUND",
        `Receipt lookup failed (HTTP ${String(response.status)})`,
      );
    }

    return (await response.json()) as Receipt;
  }

  /** Get all receipts for this agent. */
  async getReceipts(): Promise<Receipt[]> {
    const response = await this.fetchWithErrors(`${this.baseUrl}/receipts`, {
      method: "GET",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new ShadowProxyError(
        "RECEIPT_NOT_FOUND",
        `Receipts lookup failed (HTTP ${String(response.status)})`,
      );
    }

    return (await response.json()) as Receipt[];
  }

  /** Initialize a session with the proxy server. */
  async initSession(): Promise<SessionResult> {
    const response = await this.fetchWithErrors(`${this.baseUrl}/session/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentPubkey: this.config.agentPubkey,
        ata: this.config.agentAta,
      }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ShadowProxyError(
        "SESSION_INIT_FAILED",
        `Session init failed (HTTP ${String(response.status)}): ${body}`,
      );
    }

    const result = (await response.json()) as SessionResult;
    this.sessionInitialized = true;
    return result;
  }

  /**
   * Create a streaming payment object for interval-based micropayments.
   * The stream does not start until you call `.start()`.
   */
  createStream(targetUrl: string, options: StreamOptions): PaymentStream {
    return new PaymentStream(this, targetUrl, options);
  }

  /**
   * Ensures a session is initialized before making a payment.
   * Uses a shared promise to avoid duplicate init calls.
   */
  private async ensureSession(): Promise<void> {
    if (this.sessionInitialized || !this.config.autoInitSession) {
      return;
    }

    if (this.sessionInitPromise === null) {
      this.sessionInitPromise = this.initSession();
    }

    try {
      await this.sessionInitPromise;
    } catch (err: unknown) {
      // Reset so the next call retries.
      this.sessionInitPromise = null;
      throw err;
    }
  }

  /**
   * Internal fetch wrapper. Catches network/timeout errors and wraps them
   * in ShadowProxyError.
   */
  private async fetchWithErrors(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        throw new ShadowProxyError("TIMEOUT", `Request timed out: ${url}`);
      }
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ShadowProxyError("TIMEOUT", `Request aborted: ${url}`);
      }
      throw new ShadowProxyError(
        "PROXY_UNREACHABLE",
        `Cannot reach proxy at ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
