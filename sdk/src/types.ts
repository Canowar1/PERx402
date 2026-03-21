/** Configuration for the Shadow Proxy client. */
export interface ShadowProxyConfig {
  /** URL of the Shadow Proxy server. */
  proxyUrl: string;
  /** Solana public key of the AI agent. */
  agentPubkey: string;
  /** Associated token account (ATA) of the agent for USDC. */
  agentAta: string;
  /** Whether to automatically call /session/init on the first request. Defaults to true. */
  autoInitSession?: boolean;
}

/** Result of a single payment through the proxy. */
export interface PayResult {
  /** The response data from the target API. */
  data: unknown;
  /** On-chain receipt hash (settlement hash). */
  receiptHash: string;
  /** USDC amount paid. */
  amount: number;
  /** Unix timestamp (ms) of the payment. */
  timestamp: number;
  /** Nonce used for this payment. */
  nonce: number;
  /** Solana transaction signature, if available. */
  txSignature?: string;
  /** Solana explorer URL for the transaction. */
  explorerUrl?: string;
}

/** Options for a single pay() call. */
export interface PayOptions {
  /** Request timeout in milliseconds. Defaults to 30000. */
  timeout?: number;
}

/** Options for creating a streaming payment. */
export interface StreamOptions {
  /** How often to make a payment, in milliseconds. */
  intervalMs: number;
  /** Stop after this many payments. */
  maxPayments?: number;
  /** Stop after spending this much USDC total. */
  maxSpend?: number;
}

/** Summary returned when a payment stream is stopped. */
export interface StreamSummary {
  /** Total USDC spent across all payments. */
  totalPaid: number;
  /** Number of successful payments made. */
  paymentsCount: number;
  /** All receipt hashes collected. */
  receipts: string[];
}

/** Health check response from the proxy server. */
export interface HealthStatus {
  /** Overall status (e.g. "ok"). */
  status: string;
  /** TEE connection status. */
  tee: string;
  /** Proxy server status. */
  proxy: string;
  /** Whether the agent is registered in the system. */
  agentRegistered?: boolean;
}

/** A stored receipt for a past payment. */
export interface Receipt {
  /** Settlement hash. */
  receiptHash: string;
  /** USDC amount paid. */
  amount: number;
  /** Unix timestamp (ms). */
  timestamp: number;
  /** Target API URL that was called. */
  targetUrl: string;
  /** Solana transaction signature. */
  txSignature?: string;
}

/** Result of initializing a session with the proxy. */
export interface SessionResult {
  /** Whether the session was successfully created. */
  success: boolean;
  /** Session identifier. */
  sessionId: string;
  /** Session expiry time (Unix ms). */
  expiresAt: number;
}

/** Error codes emitted by ShadowProxyError. */
export type ShadowProxyErrorCode =
  | "PROXY_UNREACHABLE"
  | "SESSION_INIT_FAILED"
  | "PAYMENT_FAILED"
  | "RECEIPT_NOT_FOUND"
  | "STREAM_ERROR"
  | "TIMEOUT"
  | "INVALID_CONFIG"
  | "UNKNOWN";
