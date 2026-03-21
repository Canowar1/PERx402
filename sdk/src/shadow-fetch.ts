import { ShadowProxyClient } from "./client.js";
import type { ShadowProxyConfig, PayResult } from "./types.js";

/**
 * A pre-configured fetch-like function returned by `shadowFetch()`.
 * Pass a target URL and get back the full PayResult.
 */
export type ShadowFetchFn = (targetUrl: string) => Promise<PayResult>;

/**
 * Create a pre-configured fetch function for making private x402 payments.
 *
 * @example
 * ```ts
 * import { shadowFetch } from "@shadow-proxy/sdk";
 *
 * const client = shadowFetch({
 *   proxyUrl: "http://localhost:3001",
 *   agentPubkey: "HwupK...",
 *   agentAta: "DDoKy...",
 * });
 *
 * const data = await client("https://any-x402-api.com/market-data");
 * console.log(data); // PayResult { data, receiptHash, amount, ... }
 * ```
 */
export function shadowFetch(config: ShadowProxyConfig): ShadowFetchFn {
  const client = new ShadowProxyClient(config);

  return (targetUrl: string): Promise<PayResult> => {
    return client.pay(targetUrl);
  };
}
