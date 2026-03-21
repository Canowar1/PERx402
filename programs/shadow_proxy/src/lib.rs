use anchor_lang::prelude::*;

declare_id!("AVrFfzTREffC188KtCrJ2kf7AGgZFWcrzzRrYMku7k2n");

// ── Seeds ────────────────────────────────────────────────────────────────────
pub const AGENT_IDENTITY_SEED: &[u8] = b"agent_identity";
pub const RECEIPT_VAULT_SEED: &[u8] = b"receipt_vault";

// ── Validator addresses ───────────────────────────────────────────────────────
// Devnet TEE validator (used by off-chain proxy, kept here for reference)
pub const TEE_VALIDATOR_DEVNET: Pubkey =
    pubkey!("FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA");

// ── Program ───────────────────────────────────────────────────────────────────
#[program]
pub mod shadow_proxy {
    use super::*;

    /// Register a new agent identity with its role and spending limits.
    /// Called once per agent during onboarding.
    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        role: AgentRole,
        daily_limit: u64,
    ) -> Result<()> {
        let identity = &mut ctx.accounts.agent_identity;
        identity.agent = ctx.accounts.agent.key();
        identity.role = role;
        identity.daily_limit = daily_limit;
        identity.spent_today = 0;
        identity.last_reset_ts = Clock::get()?.unix_timestamp;
        identity.bump = ctx.bumps.agent_identity;

        emit!(AgentRegistered {
            agent: identity.agent,
            role: identity.role.clone(),
            daily_limit,
        });

        Ok(())
    }

    /// Store a receipt hash after a private TEE payment.
    /// INVARIANT: amount is NEVER stored — only the hash.
    pub fn store_receipt(
        ctx: Context<StoreReceipt>,
        receipt_hash: [u8; 32],
        nonce: u64,
    ) -> Result<()> {
        require!(
            receipt_hash != [0u8; 32],
            ShadowProxyError::EmptyReceiptHash
        );

        // Reset daily counter if new day
        let now = Clock::get()?.unix_timestamp;
        let identity = &mut ctx.accounts.agent_identity;
        if now - identity.last_reset_ts >= 86_400 {
            identity.spent_today = 0;
            identity.last_reset_ts = now;
        }

        // Store receipt — hash only, no amount
        let vault = &mut ctx.accounts.receipt_vault;
        vault.agent = ctx.accounts.agent.key();
        vault.receipt_hash = receipt_hash;
        vault.timestamp = now;
        vault.nonce = nonce;
        vault.bump = ctx.bumps.receipt_vault;

        emit!(ReceiptStored {
            agent: vault.agent,
            receipt_hash,
            timestamp: now,
        });

        Ok(())
    }
}

// ── Accounts ──────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + AgentIdentity::LEN,
        seeds = [AGENT_IDENTITY_SEED, agent.key().as_ref()],
        bump
    )]
    pub agent_identity: Account<'info, AgentIdentity>,

    pub agent: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(receipt_hash: [u8; 32], nonce: u64)]
pub struct StoreReceipt<'info> {
    #[account(
        mut,
        seeds = [AGENT_IDENTITY_SEED, agent.key().as_ref()],
        bump = agent_identity.bump,
        has_one = agent
    )]
    pub agent_identity: Account<'info, AgentIdentity>,

    #[account(
        init,
        payer = payer,
        space = 8 + ReceiptVault::LEN,
        seeds = [RECEIPT_VAULT_SEED, agent.key().as_ref(), &nonce.to_le_bytes()],
        bump
    )]
    pub receipt_vault: Account<'info, ReceiptVault>,

    pub agent: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ── State ─────────────────────────────────────────────────────────────────────

#[account]
pub struct AgentIdentity {
    pub agent: Pubkey,        // agent's wallet pubkey
    pub role: AgentRole,      // Payer | Receiver | Observer
    pub daily_limit: u64,     // max USDC per day (atomic units, 6 decimals)
    pub spent_today: u64,     // running total (reset daily) — NOT stored amounts, just counter
    pub last_reset_ts: i64,   // unix timestamp of last daily reset
    pub bump: u8,
}

impl AgentIdentity {
    pub const LEN: usize = 32 + 1 + 8 + 8 + 8 + 1 + 10; // + buffer
}

#[account]
pub struct ReceiptVault {
    pub agent: Pubkey,           // who triggered this payment
    pub receipt_hash: [u8; 32],  // SHA256(sender:recipient:nonce) — NO amount
    pub timestamp: i64,
    pub nonce: u64,              // unique per receipt
    pub bump: u8,
}

impl ReceiptVault {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 1 + 8; // + buffer
}

// ── Enums ─────────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum AgentRole {
    Payer,    // can initiate private payments via Shadow Proxy
    Receiver, // can receive private payments
    Observer, // read-only access to receipt hashes
}

// ── Events ────────────────────────────────────────────────────────────────────

#[event]
pub struct AgentRegistered {
    pub agent: Pubkey,
    pub role: AgentRole,
    pub daily_limit: u64,
}

#[event]
pub struct ReceiptStored {
    pub agent: Pubkey,
    pub receipt_hash: [u8; 32],
    pub timestamp: i64,
}

// ── Errors ────────────────────────────────────────────────────────────────────

#[error_code]
pub enum ShadowProxyError {
    #[msg("Agent role does not permit this operation")]
    UnauthorizedRole,
    #[msg("Daily spending limit exceeded")]
    DailyLimitExceeded,
    #[msg("Receipt hash cannot be all zeros")]
    EmptyReceiptHash,
    #[msg("Arithmetic overflow in limit check")]
    ArithmeticOverflow,
}
