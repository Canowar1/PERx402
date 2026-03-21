/**
 * agentA.ts — Mock AI agent that pays for APIs privately via Shadow Proxy.
 *
 * This agent has ZERO knowledge of:
 * - MagicBlock PER internals
 * - TEE session tokens
 * - x402 payment flow details
 *
 * It only calls shadowFetch() — the rest is handled by the proxy.
 */

import { ShadowFetchClient } from "./shadow-fetch.js";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

// ── Agent wallet ──────────────────────────────────────────────────────────────
const agentKeypair = process.env.AGENT_SECRET_KEY
  ? Keypair.fromSecretKey(bs58.decode(process.env.AGENT_SECRET_KEY))
  : Keypair.generate();

const PROXY_URL = process.env.PROXY_URL ?? "http://localhost:3001";
const MOCK_API = "http://localhost:9999/api/market-data";

// ── Initialize shadow client ───────────────────────────────────────────────────
const client = new ShadowFetchClient({
  proxyUrl: PROXY_URL,
  agentKeypair,
  usdcMint: process.env.USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
});

// ── Demo flow ──────────────────────────────────────────────────────────────────
async function runDemo(): Promise<void> {
  console.log("");
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║         SHADOW PROXY — AI AGENT DEMO                ║");
  console.log("║         Private x402 Payments on Solana             ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`  Agent:     ${agentKeypair.publicKey.toBase58()}`);
  console.log(`  Proxy:     ${PROXY_URL}`);
  console.log(`  Target:    ${MOCK_API}`);
  console.log("");

  // Step 1: Initialize session (registers agent on-chain if needed)
  console.log("─── Step 1/3: Initialize TEE Session ───────────────────");
  try {
    const initRes = await fetch(`${PROXY_URL}/session/init`, { method: "POST" });
    const initData = await initRes.json() as {
      initialized: boolean;
      registeredOnChain: boolean;
      explorerUrl?: string;
    };
    console.log(`  Session:    ${initData.initialized ? "✓ Active" : "✗ Failed"}`);
    console.log(`  On-chain:   ${initData.registeredOnChain ? "✓ Agent registered" : "○ Skipped"}`);
    if (initData.explorerUrl) {
      console.log(`  Explorer:   ${initData.explorerUrl}`);
    }
  } catch {
    console.log("  Session init failed — proxy may not be running");
  }
  console.log("");

  // Step 2: Skip deposit in demo (agent already has USDC on devnet)
  // In production: client.deposit(BigInt(1_000_000)) would fund the PER balance
  console.log("─── Step 2/3: Deposit (skipped — agent pre-funded) ─────");
  console.log(`  Agent USDC: pre-funded on devnet`);
  // Set a mock ephemeral ATA for the demo flow
  client.ephemeralAta = "DDoKyjLzyaLbrWi9SaQ7nXKFWgH4QqjWsfN4StP4niJe";
  console.log("");

  // Step 3: Pay for a market data API — privately
  console.log("─── Step 3/3: Private Payment via Shadow Proxy ─────────");
  console.log(`  Target:     ${MOCK_API}`);
  console.log(`  Calling shadowFetch()...`);
  console.log("");

  try {
    const result = await client.fetch(MOCK_API);

    console.log("  ✓ Payment completed privately!");
    console.log("");
    console.log("  ┌─────────────────────────────────────────────────┐");
    console.log("  │ RESPONSE DATA                                   │");
    console.log("  ├─────────────────────────────────────────────────┤");
    const dataStr = JSON.stringify(result.data, null, 2);
    for (const line of dataStr.split("\n")) {
      console.log(`  │ ${line.padEnd(49)}│`);
    }
    console.log("  └─────────────────────────────────────────────────┘");
    console.log("");

    // Poll for on-chain receipt
    console.log("  Waiting for on-chain confirmation...");
    let explorerUrl = "";
    for (let i = 0; i < 10; i++) {
      await delay(2000);
      try {
        const receiptRes = await fetch(`${PROXY_URL}/receipts/${result.receiptHash}`);
        const receipt = await receiptRes.json() as { txSignature?: string; explorerUrl?: string };
        if (receipt.txSignature) {
          explorerUrl = receipt.explorerUrl ?? "";
          break;
        }
      } catch {
        // keep polling
      }
    }

    console.log("");
    console.log("╔══════════════════════════════════════════════════════╗");
    console.log("║                   RESULTS                           ║");
    console.log("╠══════════════════════════════════════════════════════╣");
    console.log("║                                                     ║");
    console.log("║  What Solana sees:                                   ║");
    console.log(`║    Receipt hash: ${result.receiptHash.slice(0, 24)}...  ║`);
    console.log("║    Amount:       [NOT ON CHAIN]                     ║");
    console.log("║    Target API:   [NOT ON CHAIN]                     ║");
    console.log("║    Agent ID:     [NOT ON CHAIN]                     ║");
    console.log("║                                                     ║");
    console.log("║  What Shadow Proxy knows:                           ║");
    console.log("║    Amount:       0.10 USDC                          ║");
    console.log(`║    Target API:   ${MOCK_API.padEnd(35)}║`);
    console.log(`║    Agent:        ${agentKeypair.publicKey.toBase58().slice(0, 30)}... ║`);
    console.log("║                                                     ║");
    if (explorerUrl) {
      console.log("║  Verify on-chain:                                    ║");
      console.log(`║    ${explorerUrl.slice(0, 51)}║`);
    }
    console.log("║                                                     ║");
    console.log("╚══════════════════════════════════════════════════════╝");
    console.log("");
    console.log("  Demo complete. Amount and intent never visible on-chain.");
  } catch (err) {
    console.error("  ✗ Payment failed:", (err as Error).message);
    console.error("  Make sure proxy and mock-api are running:");
    console.error("    npm run dev:mock-api");
    console.error("    npm run dev:proxy");
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

runDemo().catch(console.error);
