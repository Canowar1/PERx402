/**
 * anchor-client.ts — TypeScript client for the Shadow Proxy Anchor program.
 *
 * Wraps register_agent and store_receipt instructions.
 * Uses @coral-xyz/anchor with the generated IDL.
 *
 * HACKATHON ONLY: Proxy holds agent keypair to sign on behalf.
 * In production, agent would sign via wallet adapter or session keys.
 */

import { AnchorProvider, Program, setProvider, Wallet, type Idl } from "@coral-xyz/anchor";
import BN from "bn.js";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const IDL = require("./shadow_proxy.json") as Idl;

const PROGRAM_ID = new PublicKey("AVrFfzTREffC188KtCrJ2kf7AGgZFWcrzzRrYMku7k2n");
const AGENT_IDENTITY_SEED = Buffer.from("agent_identity");
const RECEIPT_VAULT_SEED = Buffer.from("receipt_vault");

export type AgentRole = "Payer" | "Receiver" | "Observer";

export interface ReceiptVaultData {
  agent: PublicKey;
  receiptHash: number[];
  timestamp: BN;
  nonce: BN;
  bump: number;
}

export class ShadowProxyClient {
  private program: Program;
  private connection: Connection;

  constructor(
    private readonly proxyWallet: Keypair,
    private readonly agentWallet: Keypair,
    rpcUrl: string = "https://api.devnet.solana.com"
  ) {
    this.connection = new Connection(rpcUrl, "confirmed");

    const walletAdapter = new Wallet(proxyWallet);
    const provider = new AnchorProvider(this.connection, walletAdapter, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
    setProvider(provider);

    this.program = new Program(IDL, provider);
  }

  // ── PDA derivation ──────────────────────────────────────────────────────────

  deriveAgentIdentityPDA(agentPubkey: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [AGENT_IDENTITY_SEED, agentPubkey.toBuffer()],
      PROGRAM_ID
    );
  }

  deriveReceiptVaultPDA(agentPubkey: PublicKey, nonce: bigint): [PublicKey, number] {
    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(nonce);
    return PublicKey.findProgramAddressSync(
      [RECEIPT_VAULT_SEED, agentPubkey.toBuffer(), nonceBuffer],
      PROGRAM_ID
    );
  }

  // ── Instructions ────────────────────────────────────────────────────────────

  /**
   * Register an agent identity on-chain.
   * Creates the AgentIdentity PDA with role and daily spending limit.
   */
  async registerAgent(
    role: AgentRole = "Payer",
    dailyLimit: bigint = BigInt(100_000_000) // 100 USDC
  ): Promise<string> {
    const agentPubkey = this.agentWallet.publicKey;
    const [agentIdentityPDA] = this.deriveAgentIdentityPDA(agentPubkey);

    // Check if already registered
    const existing = await this.connection.getAccountInfo(agentIdentityPDA);
    if (existing) {
      console.log("[anchor-client] Agent already registered on-chain:", agentPubkey.toBase58().slice(0, 12));
      return "already_registered";
    }

    // Build the role enum variant for Anchor
    const roleVariant = { [role.toLowerCase()]: {} } as Record<string, Record<string, never>>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const methods = this.program.methods as any;
    const tx = await methods
      .registerAgent(roleVariant, new BN(dailyLimit.toString()))
      .accounts({
        agentIdentity: agentIdentityPDA,
        agent: agentPubkey,
        payer: this.proxyWallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.proxyWallet, this.agentWallet])
      .rpc() as string;

    console.log("[anchor-client] Agent registered on-chain:", tx);
    return tx;
  }

  /**
   * Store a receipt hash on-chain after a private TEE payment.
   * INVARIANT: amount is NEVER stored — only the hash.
   */
  async storeReceipt(
    receiptHashHex: string,
    nonce: bigint
  ): Promise<string> {
    const agentPubkey = this.agentWallet.publicKey;
    const [agentIdentityPDA] = this.deriveAgentIdentityPDA(agentPubkey);
    const [receiptVaultPDA] = this.deriveReceiptVaultPDA(agentPubkey, nonce);

    // Convert hex hash to 32-byte array
    const hashBytes = Array.from(Buffer.from(receiptHashHex, "hex"));
    if (hashBytes.length !== 32) {
      throw new Error(`Receipt hash must be 32 bytes, got ${hashBytes.length}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const methods = this.program.methods as any;
    const tx = await methods
      .storeReceipt(hashBytes, new BN(nonce.toString()))
      .accounts({
        agentIdentity: agentIdentityPDA,
        receiptVault: receiptVaultPDA,
        agent: agentPubkey,
        payer: this.proxyWallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([this.proxyWallet, this.agentWallet])
      .rpc() as string;

    console.log("[anchor-client] Receipt stored on-chain:", tx);
    return tx;
  }

  /**
   * Fetch a ReceiptVault account by agent + nonce.
   */
  async fetchReceipt(nonce: bigint): Promise<ReceiptVaultData | null> {
    const agentPubkey = this.agentWallet.publicKey;
    const [receiptVaultPDA] = this.deriveReceiptVaultPDA(agentPubkey, nonce);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accounts = this.program.account as any;
      const account = await accounts.receiptVault.fetch(receiptVaultPDA);
      return account as ReceiptVaultData;
    } catch {
      return null;
    }
  }

  /**
   * Check if agent is registered on-chain.
   */
  async isAgentRegistered(): Promise<boolean> {
    const [pda] = this.deriveAgentIdentityPDA(this.agentWallet.publicKey);
    const info = await this.connection.getAccountInfo(pda);
    return info !== null;
  }

  /**
   * Get Solana Explorer URL for a transaction.
   */
  explorerUrl(txSignature: string): string {
    return `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`;
  }
}
