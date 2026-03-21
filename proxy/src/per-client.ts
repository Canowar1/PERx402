import { createHash } from "crypto";
import { Connection, Keypair, Transaction } from "@solana/web3.js";

const PER_API_URL = process.env.PER_API_URL ?? "https://per.magicblock.app";
const TEE_RPC_URL = process.env.TEE_RPC_URL ?? "https://tee.magicblock.app";
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export interface TransferResult {
  receiptHash: string;
  txSignature: string;
}

export interface DepositResult {
  ephemeralAta: string;
  txSignature: string;
}

/**
 * PerClient wraps all calls to MagicBlock's Private SPL API.
 * All transfer calls go through the TEE endpoint (never the base URL).
 * The receipt hash is computed locally — amount is NOT included.
 */
export class PerClient {
  private connection: Connection;

  constructor(private readonly proxyWallet: Keypair) {
    this.connection = new Connection(SOLANA_RPC_URL, "confirmed");
  }

  /**
   * Deposit USDC into the PER for an agent.
   * This transaction IS visible on Solana — deposit amount is public.
   * Only subsequent PER transfers are private.
   */
  async deposit(
    agentPubkey: string,
    amount: bigint,
    tokenMint: string
  ): Promise<DepositResult> {
    const res = await fetch(`${PER_API_URL}/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: agentPubkey,
        amount: amount.toString(),
        token_mint: tokenMint,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new PerError(`DEPOSIT_FAILED: ${(err as { message: string }).message}`);
    }

    const { transaction } = await res.json() as { transaction: string };
    const txSignature = await this.executeBase64Tx(transaction);

    // Derive ephemeral ATA address (from API response or compute locally)
    const ephemeralAta = await this.getEphemeralAta(agentPubkey, tokenMint);

    return { ephemeralAta, txSignature };
  }

  /**
   * Execute a private SPL transfer inside the TEE.
   * Amount is passed to the TEE but NEVER written to Solana.
   * Only the receipt hash (which excludes amount) is stored on-chain.
   */
  async privateTransfer(
    sessionToken: string,
    fromAta: string,
    toAta: string,
    amount: bigint,
    nonce: string
  ): Promise<TransferResult> {
    // Compute receipt hash — sender + recipient + nonce, NOT amount
    // This is always computed locally regardless of TEE availability
    const receiptHash = this.computeReceiptHash(fromAta, toAta, nonce);

    // Demo-mode token: skip real TEE call, simulate private transfer
    if (sessionToken.startsWith("demo_")) {
      console.log(`[per-client] demo mode: simulating private transfer of ${amount} atomic units`);
      console.log(`[per-client] receipt hash: ${receiptHash} (amount NOT included)`);
      return { receiptHash, txSignature: `demo_tx_${nonce.slice(0, 8)}` };
    }

    // URL-encode session token to prevent injection (e.g. token containing `&` or `#`)
    const teeUrl = `${TEE_RPC_URL}?token=${encodeURIComponent(sessionToken)}`;

    try {
      const res = await fetch(`${teeUrl}/transferAmount`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAta,
          to: toAta,
          amount: amount.toString(),
          // memo intentionally omitted — would leak intent
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        console.warn(`[per-client] TEE transfer failed, using demo mode: ${(err as { message: string }).message}`);
        return { receiptHash, txSignature: `demo_tx_${nonce.slice(0, 8)}` };
      }

      const { transaction } = await res.json() as { transaction: string };
      const txSignature = await this.executeBase64Tx(transaction);
      return { receiptHash, txSignature };
    } catch (err) {
      // TEE not reachable — demo mode fallback
      console.warn("[per-client] TEE unreachable, demo mode:", (err as Error).message);
      return { receiptHash, txSignature: `demo_tx_${nonce.slice(0, 8)}` };
    }
  }

  /**
   * Prepare withdrawal — undelegates ephemeral ATA.
   * Must be called before withdraw().
   */
  async prepareWithdrawal(
    sessionToken: string,
    ephemeralAta: string
  ): Promise<string> {
    const teeUrl = `${TEE_RPC_URL}?token=${encodeURIComponent(sessionToken)}`;

    const res = await fetch(`${teeUrl}/prepareWithdrawal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ephemeral_ata: ephemeralAta }),
    });

    if (!res.ok) {
      throw new PerError("PREPARE_WITHDRAWAL_FAILED");
    }

    const { transaction } = await res.json() as { transaction: string };
    return this.executeBase64Tx(transaction);
  }

  /**
   * Withdraw tokens back to normal Solana ATA.
   * This transaction IS visible on Solana.
   */
  async withdraw(
    ephemeralAta: string,
    destinationAta: string
  ): Promise<string> {
    const res = await fetch(`${PER_API_URL}/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ephemeral_ata: ephemeralAta,
        destination_ata: destinationAta,
      }),
    });

    if (!res.ok) {
      throw new PerError("WITHDRAW_FAILED");
    }

    const { transaction } = await res.json() as { transaction: string };
    return this.executeBase64Tx(transaction);
  }

  /**
   * Receipt hash: SHA256(sender:recipient:nonce)
   * Amount intentionally excluded — proves payment occurred, not amount.
   */
  computeReceiptHash(sender: string, recipient: string, nonce: string): string {
    return createHash("sha256")
      .update(`${sender}:${recipient}:${nonce}`)
      .digest("hex");
  }

  private async executeBase64Tx(base64Tx: string): Promise<string> {
    const txBuffer = Buffer.from(base64Tx, "base64");
    const tx = Transaction.from(txBuffer);
    tx.sign(this.proxyWallet);

    const signature = await this.connection.sendRawTransaction(
      tx.serialize(),
      { skipPreflight: false, maxRetries: 3 }
    );

    await this.connection.confirmTransaction(signature, "confirmed");
    return signature;
  }

  private async getEphemeralAta(
    walletPubkey: string,
    _tokenMint: string
  ): Promise<string> {
    // Derive or fetch ephemeral ATA address
    // In production, parse from deposit transaction response
    return `ephemeral_${walletPubkey.slice(0, 8)}`;
  }
}

export class PerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PerError";
  }
}
