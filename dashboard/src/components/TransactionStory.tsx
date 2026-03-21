"use client";

interface TransactionStoryProps {
  agentPubkey: string;
  agentAta: string;
  proxyPubkey: string;
  targetUrl: string;
  amount: number;
  receiptHash: string;
  timestamp: number;
  txSignature?: string;
  explorerUrl?: string;
}

function truncate(s: string, n = 10) {
  return s.length > n * 2 + 3 ? `${s.slice(0, n)}...${s.slice(-6)}` : s;
}

interface StepProps {
  index: number;
  title: string;
  detail: React.ReactNode;
  tag?: string;
  tagColor?: "brand" | "success" | "error" | "gray";
  delay?: string;
}

function TraceStep({ index, title, detail, tag, tagColor = "gray", delay = "0s" }: StepProps) {
  const tagPalette = {
    brand: "text-[#11B2BA] border-[#11B2BA]/30 bg-[#11B2BA]/8",
    success: "text-[#3BC171] border-[#3BC171]/30 bg-[#3BC171]/8",
    error: "text-[#FF647C] border-[#FF647C]/30 bg-[#FF647C]/8",
    gray: "text-[#8E95A2] border-[#B6BAC3]/50 bg-[#EDEEF1]",
  };

  return (
    <div
      className="flex gap-4 opacity-0 animate-typewriter"
      style={{ animationDelay: delay }}
    >
      {/* Step number + connector */}
      <div className="flex flex-col items-center gap-0 shrink-0">
        <div className="w-6 h-6 border border-[#11B2BA]/30 bg-[#11B2BA]/5 flex items-center justify-center shrink-0">
          <span className="text-[9px] font-bold text-[#11B2BA] font-[family-name:var(--font-mono)]">
            {String(index).padStart(2, "0")}
          </span>
        </div>
        <div className="w-px flex-1 bg-[#11B2BA]/15 mt-1" />
      </div>

      {/* Content */}
      <div className="pb-5 min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-semibold text-[#272D3E] font-[family-name:var(--font-mono)] uppercase tracking-wide">
            {title}
          </span>
          {tag && (
            <span className={`text-[9px] border px-1.5 py-0.5 font-[family-name:var(--font-mono)] uppercase tracking-wider ${tagPalette[tagColor]}`}>
              {tag}
            </span>
          )}
        </div>
        <div className="text-[11px] text-[#7D7F82] font-[family-name:var(--font-mono)] leading-relaxed">
          {detail}
        </div>
      </div>
    </div>
  );
}

export default function TransactionStory({
  agentPubkey,
  agentAta,
  proxyPubkey,
  targetUrl,
  amount,
  receiptHash,
  timestamp,
  txSignature,
  explorerUrl,
}: TransactionStoryProps) {
  const time = new Date(timestamp).toLocaleTimeString();

  let displayTarget = targetUrl;
  try {
    const u = new URL(targetUrl);
    displayTarget = u.hostname + u.pathname;
  } catch {
    // keep raw
  }

  return (
    <div className="border border-[#11B2BA]/20 bg-white p-6 animate-slide-in shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#11B2BA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <h3 className="text-xs font-[family-name:var(--font-mono)] uppercase tracking-[0.2em] text-[#11B2BA] font-semibold">
            Transaction Trace
          </h3>
        </div>
        <span className="text-[9px] text-[#8E95A2] font-[family-name:var(--font-mono)] uppercase tracking-wider">
          {time}
        </span>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        <TraceStep
          index={1}
          title="Agent Request"
          tag="shadowFetch()"
          tagColor="gray"
          delay="0.05s"
          detail={
            <>
              Agent <span className="text-[#11B2BA]/80">{truncate(agentPubkey)}</span> called{" "}
              <span className="text-[#272D3E]/60">shadowFetch</span> — no knowledge of x402 required.
              <br />
              Target: <span className="text-[#8E95A2]">{displayTarget}</span>
            </>
          }
        />

        <TraceStep
          index={2}
          title="HTTP 402 Intercepted"
          tag="Payment Required"
          tagColor="error"
          delay="0.15s"
          detail={
            <>
              API returned <span className="text-[#FF647C]">HTTP 402</span>.{" "}
              Proxy intercepted before agent saw it.
              <br />
              Amount demanded: <span className="text-[#272D3E]/70">{amount} USDC</span>{" "}
              <span className="text-[#8E95A2]">— agent bypassed entirely</span>
            </>
          }
        />

        <TraceStep
          index={3}
          title="MagicBlock PER Transfer"
          tag="MagicBlock's PER"
          tagColor="brand"
          delay="0.25s"
          detail={
            <>
              <span className="text-[#11B2BA]/80">{truncate(agentAta, 8)}</span>
              <span className="text-[#8E95A2] mx-1">→</span>
              <span className="text-[#8E95A2]">{truncate(proxyPubkey, 8)}</span>
              <br />
              <span className="text-[#11B2BA]/70">{amount} USDC</span> moved inside MagicBlock&apos;s Private Ephemeral Rollup.{" "}
              <span className="text-[#8E95A2]">Solana sees: nothing.</span>
            </>
          }
        />

        <TraceStep
          index={4}
          title="x402 Header Signed"
          tag="Proxy Identity Only"
          tagColor="gray"
          delay="0.35s"
          detail={
            <>
              Signed by proxy <span className="text-[#8E95A2]">{truncate(proxyPubkey)}</span> — not the agent.
              <br />
              Agent identity forwarded to API:{" "}
              <span className="text-[#FF647C]/70 font-bold">[SEALED]</span>
            </>
          }
        />

        <TraceStep
          index={5}
          title="HTTP 200 Delivered"
          tag="Success"
          tagColor="success"
          delay="0.45s"
          detail={
            <>
              API returned <span className="text-[#3BC171]">HTTP 200</span> with data.
              <br />
              Agent received response — never saw 402, never exposed identity.
            </>
          }
        />

        <TraceStep
          index={6}
          title="On-Chain Settlement"
          tag={txSignature ? "Confirmed" : "Pending..."}
          tagColor={txSignature ? "success" : "brand"}
          delay="0.55s"
          detail={
            <>
              Receipt hash:{" "}
              <span className="text-[#8E95A2] break-all">{truncate(receiptHash, 12)}</span>
              <br />
              Amount on Solana:{" "}
              <span className="text-[#FF647C]/70 font-bold">[REDACTED]</span>
              {" · "}Agent identity on Solana:{" "}
              <span className="text-[#FF647C]/70 font-bold">[REDACTED]</span>
              {txSignature && explorerUrl && (
                <>
                  <br />
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#3BC171] hover:text-[#12949D] underline underline-offset-2 transition-colors"
                  >
                    View on Solana Explorer ↗
                  </a>
                </>
              )}
            </>
          }
        />
      </div>
    </div>
  );
}
