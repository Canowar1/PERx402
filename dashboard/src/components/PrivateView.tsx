"use client";

interface PrivateViewProps {
  receiptHash: string | null;
  amount: number | null;
  targetUrl: string | null;
  agentPubkey: string | null;
  responsePreview: string | null;
  timestamp: number | null;
  isLoading: boolean;
}

function LockOpenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#11B2BA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

function RevealedField({
  label,
  value,
  isMono,
}: {
  label: string;
  value: string;
  isMono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 py-3 border-b border-[#B6BAC3]/40 opacity-0 animate-typewriter">
      <div className="flex items-center gap-2">
        <LockOpenIcon />
        <span className="text-[#12949D] text-xs font-[family-name:var(--font-mono)] uppercase tracking-wide">
          {label}
        </span>
      </div>
      <span
        className={`text-[#272D3E] text-sm break-all pl-[22px] ${
          isMono ? "font-[family-name:var(--font-mono)] text-xs" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function PrivateView({
  receiptHash,
  amount,
  targetUrl,
  agentPubkey,
  responsePreview,
  timestamp,
  isLoading,
}: PrivateViewProps) {
  const hasData = receiptHash !== null;

  return (
    <div className="flex-1 border border-[#11B2BA]/25 bg-[#F7F8F8] p-6 relative overflow-hidden scan-lines">
      {/* Brand accent glow — top edge */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#11B2BA]/50 to-transparent" />

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#11B2BA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
            <h2
              className="text-sm font-[family-name:var(--font-mono)] uppercase tracking-[0.2em] text-[#11B2BA] font-semibold"
              style={{ textShadow: "0 0 20px rgba(17,178,186,0.2)" }}
            >
              Shadow Proxy &mdash; Decrypted
            </h2>
          </div>
          <div className="h-px bg-[#11B2BA]/20 mt-3" />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2 py-3">
                <div className="h-3 w-20 bg-[#11B2BA]/10 animate-pulse" />
                <div className="h-4 w-full bg-[#11B2BA]/5 animate-pulse" />
              </div>
            ))}
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#B6BAC3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <p className="text-[#8E95A2] text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider">
              Awaiting private payment
            </p>
          </div>
        ) : (
          <div className="space-y-0 typewriter-stagger">
            <RevealedField
              label="Receipt Hash"
              value={receiptHash ?? "\u2014"}
              isMono
            />
            <RevealedField
              label="Amount"
              value={amount !== null ? `${amount} USDC` : "\u2014"}
            />
            <RevealedField
              label="Target API"
              value={targetUrl ?? "\u2014"}
            />
            <RevealedField
              label="Agent Pubkey"
              value={agentPubkey ?? "\u2014"}
              isMono
            />
            <RevealedField
              label="Timestamp"
              value={
                timestamp
                  ? new Date(timestamp).toLocaleString()
                  : "\u2014"
              }
            />
            {/* Response preview in terminal window */}
            <div className="py-3 opacity-0 animate-typewriter" style={{ animationDelay: "0.55s" }}>
              <div className="flex items-center gap-2 mb-2">
                <LockOpenIcon />
                <span className="text-[#12949D] text-xs font-[family-name:var(--font-mono)] uppercase tracking-wide">
                  Response Preview
                </span>
              </div>
              <div className="border border-[#11B2BA]/20 overflow-hidden ml-[22px]">
                <div className="terminal-titlebar">
                  <span className="text-[10px] font-[family-name:var(--font-mono)] text-[#8E95A2] ml-12 uppercase tracking-wider">
                    output
                  </span>
                </div>
                <pre className="text-xs text-[#272D3E]/70 font-[family-name:var(--font-mono)] bg-[#EDEEF1] p-3 overflow-x-auto max-h-32 leading-relaxed">
                  {responsePreview ?? "\u2014"}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {hasData && (
          <div className="mt-4 py-3 border-t border-[#11B2BA]/20">
            <p className="text-[11px] text-[#7D7F82] text-center font-[family-name:var(--font-mono)] uppercase tracking-wider leading-relaxed">
              Full payment details visible only inside MagicBlock&apos;s PER + Shadow Proxy.
              <br />
              Amount, API URL, and agent identity are{" "}
              <span className="text-[#11B2BA] font-semibold">never written to chain</span>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
