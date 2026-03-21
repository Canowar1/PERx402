"use client";

export type FlowStep = 0 | 1 | 2 | 3;

interface PaymentFlowProps {
  currentStep: FlowStep;
  agentPubkey?: string;
  proxyPubkey?: string;
  amount?: number;
}

const steps = [
  {
    label: "402 INTERCEPTED",
    icon: "!",
    subtitle: "API requires payment · agent bypassed",
    detail: (agent?: string) =>
      agent
        ? `Agent ${agent.slice(0, 6)}… called shadowFetch — proxy caught the 402`
        : "Proxy caught the 402 before the agent saw it",
  },
  {
    label: "TEE TRANSFER",
    icon: "\u21BB",
    subtitle: "Amount moves inside Intel TDX · invisible on-chain",
    detail: (agent?: string, proxy?: string, amount?: number) =>
      agent && proxy
        ? `${agent.slice(0, 6)}… → ${proxy.slice(0, 6)}… · ${amount ?? 0.1} USDC · Solana sees: nothing`
        : "USDC routed privately inside MagicBlock TEE",
  },
  {
    label: "200 DELIVERED",
    icon: "\u2713",
    subtitle: "Proxy signed x402 header · agent identity sealed",
    detail: (proxy?: string) =>
      proxy
        ? `Proxy ${proxy.slice(0, 6)}… signed — agent identity never forwarded`
        : "API returned 200 — agent never knew about the 402",
  },
] as const;

export default function PaymentFlow({
  currentStep,
  agentPubkey,
  proxyPubkey,
  amount,
}: PaymentFlowProps) {
  return (
    <div className="w-full py-6 space-y-6">
      {/* Node row */}
      <div className="flex items-center justify-center">
        {steps.map((step, idx) => {
          const stepNum = (idx + 1) as 1 | 2 | 3;
          const isActive = currentStep >= stepNum;
          const isCurrent = currentStep === stepNum;

          return (
            <div key={step.label} className="flex items-center">
              <div className="flex flex-col items-center gap-2.5">
                {/* Hexagonal node */}
                <div
                  className={`relative w-11 h-11 flex items-center justify-center transition-all duration-500 ${
                    isActive
                      ? "border-[#11B2BA] bg-[#11B2BA]/10"
                      : "border-[#B6BAC3] bg-[#EDEEF1]"
                  } ${isCurrent ? "animate-amber-pulse" : ""}`}
                  style={{
                    clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                  }}
                >
                  <span
                    className={`text-sm font-bold font-[family-name:var(--font-mono)] ${
                      isActive ? "text-[#11B2BA]" : "text-[#8E95A2]"
                    }`}
                  >
                    {step.icon}
                  </span>
                </div>

                {/* Label */}
                <span
                  className={`text-[10px] font-[family-name:var(--font-mono)] font-medium tracking-widest transition-colors duration-300 whitespace-nowrap ${
                    isActive ? "text-[#11B2BA]" : "text-[#8E95A2]"
                  }`}
                >
                  {step.label}
                </span>

                {/* Subtitle */}
                <span
                  className={`text-[9px] font-[family-name:var(--font-mono)] text-center max-w-[110px] leading-relaxed tracking-wide transition-all duration-500 ${
                    isActive ? "text-[#272D3E]/70" : "text-[#8E95A2]/60"
                  }`}
                >
                  {step.subtitle}
                </span>
              </div>

              {/* Dashed connector */}
              {idx < steps.length - 1 && (
                <div className="flex items-start pt-2 pb-[3.5rem]">
                  <svg width="100" height="8" className="mx-1 sm:mx-2">
                    <line
                      x1="0"
                      y1="4"
                      x2="100"
                      y2="4"
                      stroke={currentStep > stepNum ? "#11B2BA" : "#B6BAC3"}
                      strokeWidth="1.5"
                      strokeDasharray="6 6"
                      style={
                        currentStep > stepNum
                          ? { animation: "dash-flow 0.8s linear infinite" }
                          : undefined
                      }
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active step detail strip */}
      {currentStep > 0 && (
        <div className="flex justify-center">
          <div className="border border-[#11B2BA]/20 bg-[#11B2BA]/5 px-4 py-2 max-w-xl w-full text-center animate-slide-in">
            <p className="text-[10px] text-[#12949D] font-[family-name:var(--font-mono)] tracking-wide leading-relaxed">
              {currentStep === 1 && steps[0].detail(agentPubkey)}
              {currentStep === 2 && steps[1].detail(agentPubkey, proxyPubkey, amount)}
              {currentStep === 3 && steps[2].detail(proxyPubkey)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
