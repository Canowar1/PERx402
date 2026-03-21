"use client";

interface PublicViewProps {
  receiptHash: string | null;
  timestamp: number | null;
  explorerUrl: string | null;
  txSignature: string | null;
  isLoading: boolean;
}

function RedactedField({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#B6BAC3]/40">
      <span className="text-[#7D7F82] text-sm uppercase tracking-wide font-[family-name:var(--font-mono)] text-xs">
        {label}
      </span>
      <div className="flex items-center gap-2.5">
        <span className="text-[10px] font-[family-name:var(--font-mono)] tracking-widest text-[#FF647C]/70 uppercase">
          [REDACTED]
        </span>
        <span className="redacted-bar font-[family-name:var(--font-mono)] text-sm">
          ██████████████
        </span>
      </div>
    </div>
  );
}

export default function PublicView({
  receiptHash,
  timestamp,
  explorerUrl,
  txSignature,
  isLoading,
}: PublicViewProps) {
  const displayHash = receiptHash ?? "\u2014";
  const displayTime = timestamp
    ? new Date(timestamp).toLocaleString()
    : "\u2014";

  return (
    <div className="flex-1 border border-[#B6BAC3] bg-white p-6 relative overflow-hidden watermark-classified">
      <div className="relative z-10">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            {/* Lock icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E95A2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <h2 className="text-sm font-[family-name:var(--font-mono)] uppercase tracking-[0.2em] text-[#8E95A2] font-semibold">
              Solana Explorer &mdash; Public Record
            </h2>
          </div>
          <div className="h-px bg-[#B6BAC3] mt-3" />
        </div>

        {/* Content */}
        <div className="space-y-0">
          {/* Settlement Hash - visible */}
          <div className="flex flex-col gap-1.5 py-3 border-b border-[#B6BAC3]/40">
            <span className="text-[#7D7F82] text-xs font-[family-name:var(--font-mono)] uppercase tracking-wide">
              Settlement Hash
            </span>
            {isLoading ? (
              <div className="h-4 w-full bg-[#EDEEF1] animate-pulse" />
            ) : (
              <span className="font-[family-name:var(--font-mono)] text-xs text-[#272D3E] break-all leading-relaxed">
                {displayHash}
              </span>
            )}
          </div>

          {/* Timestamp - visible */}
          <div className="flex items-center justify-between py-3 border-b border-[#B6BAC3]/40">
            <span className="text-[#7D7F82] text-xs font-[family-name:var(--font-mono)] uppercase tracking-wide">
              Timestamp
            </span>
            {isLoading ? (
              <div className="h-4 w-28 bg-[#EDEEF1] animate-pulse" />
            ) : (
              <span className="text-[#272D3E] text-sm font-[family-name:var(--font-mono)]">
                {displayTime}
              </span>
            )}
          </div>

          {/* On-chain verification */}
          {txSignature && (
            <div className="flex flex-col gap-1.5 py-3 border-b border-[#B6BAC3]/40">
              <span className="text-[#7D7F82] text-xs font-[family-name:var(--font-mono)] uppercase tracking-wide">
                On-Chain Transaction
              </span>
              <div className="flex items-center gap-2">
                {/* Chain link icon */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3BC171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                <span className="text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider text-[#3BC171] bg-[#3BC171]/10 px-2 py-0.5">
                  VERIFIED ON-CHAIN
                </span>
              </div>
              <a
                href={explorerUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="font-[family-name:var(--font-mono)] text-xs text-[#8E95A2] hover:text-[#11B2BA] underline underline-offset-2 break-all transition-colors"
              >
                {txSignature.slice(0, 24)}...{txSignature.slice(-8)}
              </a>
            </div>
          )}

          {!txSignature && receiptHash && !isLoading && (
            <div className="flex items-center gap-2 py-3 border-b border-[#B6BAC3]/40">
              <svg className="animate-spin h-3 w-3 text-[#8E95A2]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-[#8E95A2] text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider">
                Storing receipt on-chain...
              </span>
            </div>
          )}

          {/* Redacted fields */}
          <RedactedField label="Amount" />
          <RedactedField label="Target API" />
          <RedactedField label="Agent Identity" />
          <RedactedField label="Response Data" />
        </div>

        {/* Footer */}
        <div className="mt-6 py-3 border-t border-[#B6BAC3]/40">
          <p className="text-[11px] text-[#7D7F82] text-center font-[family-name:var(--font-mono)] uppercase tracking-wider leading-relaxed">
            Information restricted to settlement hash only.
          </p>
        </div>
      </div>
    </div>
  );
}
