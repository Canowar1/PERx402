"use client";

interface AgentInfoBarProps {
  agentPubkey: string;
  agentAta: string;
  proxyPubkey?: string;
  balance?: string | null;
  prevBalance?: string | null;
  balanceLoading?: boolean;
}

function truncate(addr: string, head = 6, tail = 4) {
  if (addr.length <= head + tail + 3) return addr;
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}

function AddressChip({
  label,
  address,
  color = "gray",
}: {
  label: string;
  address: string;
  color?: "brand" | "success" | "gray";
}) {
  const palette = {
    brand: "text-[#11B2BA] border-[#11B2BA]/25 bg-[#11B2BA]/5",
    success: "text-[#3BC171] border-[#3BC171]/25 bg-[#3BC171]/5",
    gray: "text-[#8E95A2] border-[#B6BAC3]/50 bg-[#EDEEF1]",
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-[#7D7F82] uppercase tracking-widest font-[family-name:var(--font-mono)]">
        {label}
      </span>
      <span
        className={`font-[family-name:var(--font-mono)] text-[10px] border px-2 py-0.5 tracking-wide ${palette[color]}`}
        title={address}
      >
        {truncate(address)}
      </span>
    </div>
  );
}

export default function AgentInfoBar({
  agentPubkey,
  agentAta,
  proxyPubkey,
  balance,
  prevBalance,
  balanceLoading,
}: AgentInfoBarProps) {
  const balanceDecreased =
    balance !== null &&
    prevBalance !== null &&
    balance !== undefined &&
    prevBalance !== undefined &&
    parseFloat(balance) < parseFloat(prevBalance);

  const balanceDelta =
    balanceDecreased && prevBalance && balance
      ? (parseFloat(balance) - parseFloat(prevBalance)).toFixed(2)
      : null;

  return (
    <div className="border-b border-[#11B2BA]/15 bg-[#11B2BA]/5 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-x-5 gap-y-2">
        {/* Left label */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[#11B2BA] animate-pulse" />
          <span className="text-[9px] text-[#12949D] font-[family-name:var(--font-mono)] uppercase tracking-[0.2em]">
            Active Session
          </span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-4 bg-[#11B2BA]/20" />

        {/* Addresses */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <AddressChip label="Agent" address={agentPubkey} color="brand" />
          <AddressChip label="ATA" address={agentAta} color="brand" />
          {proxyPubkey && (
            <AddressChip label="Proxy" address={proxyPubkey} color="gray" />
          )}
        </div>

        {/* Balance */}
        <div className="ml-auto flex items-center gap-2">
          {balanceLoading ? (
            <span className="text-[9px] text-[#8E95A2] font-[family-name:var(--font-mono)] animate-pulse">
              Loading...
            </span>
          ) : balance !== null && balance !== undefined ? (
            <div className="flex items-center gap-2">
              <span
                className={`font-[family-name:var(--font-mono)] text-[11px] font-semibold transition-all duration-700 ${
                  balanceDecreased
                    ? "text-[#11B2BA] animate-balance-flash"
                    : "text-[#3BC171]"
                }`}
              >
                {balance} USDC
              </span>
              {balanceDelta && (
                <span className="text-[9px] text-[#FF647C] font-[family-name:var(--font-mono)] animate-slide-in">
                  {balanceDelta} USDC
                </span>
              )}
            </div>
          ) : (
            <span className="text-[9px] text-[#7D7F82] font-[family-name:var(--font-mono)]">
              x402 &middot; TEE &middot; Devnet
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
