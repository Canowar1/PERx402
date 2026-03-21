const PROXY_URL =
  process.env.NEXT_PUBLIC_PROXY_URL ?? "http://localhost:3001";

export interface HealthResponse {
  status: string;
  tee: string;
  proxy: string;
  agent: string | null;
  agentRegistered: boolean;
  programId: string;
}

export interface PaymentResponse {
  data: unknown;
  receiptHash: string;
  statusCode: number;
  nonce: number;
}

export interface Receipt {
  hash: string;
  timestamp: number;
  txSignature?: string;
  explorerUrl?: string;
}

export interface ReceiptDetail extends Receipt {
  targetUrl: string;
  agentPubkey: string;
  nonce: number;
}

export interface ReceiptsResponse {
  receipts: Receipt[];
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${PROXY_URL}/health`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return res.json() as Promise<HealthResponse>;
}

export async function initSession(): Promise<{
  initialized: boolean;
  registeredOnChain: boolean;
  registrationTx?: string;
  explorerUrl?: string;
}> {
  const res = await fetch(`${PROXY_URL}/session/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15_000), // session init may register on-chain — allow 15s
  });
  if (!res.ok) {
    throw new Error(`Session init failed: ${res.status}`);
  }
  return res.json() as Promise<{
    initialized: boolean;
    registeredOnChain: boolean;
    registrationTx?: string;
    explorerUrl?: string;
  }>;
}

export async function sendPayment(
  target: string,
  agentPubkey: string,
  agentEphemeralAta: string,
): Promise<PaymentResponse> {
  const res = await fetch(`${PROXY_URL}/proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, agentPubkey, agentEphemeralAta }),
    signal: AbortSignal.timeout(20_000), // proxy fetches target + TEE — allow 20s
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error: string };
    throw new Error(errBody.error ?? `Payment failed: ${res.status}`);
  }
  return res.json() as Promise<PaymentResponse>;
}

export async function getReceiptDetail(hash: string): Promise<ReceiptDetail | null> {
  const res = await fetch(`${PROXY_URL}/receipts/${hash}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  return res.json() as Promise<ReceiptDetail>;
}

export async function getReceipts(): Promise<ReceiptsResponse> {
  const res = await fetch(`${PROXY_URL}/receipts`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch receipts: ${res.status}`);
  }
  return res.json() as Promise<ReceiptsResponse>;
}
