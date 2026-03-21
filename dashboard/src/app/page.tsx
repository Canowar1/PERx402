"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import ConnectionStatus from "@/components/ConnectionStatus";
import PublicView from "@/components/PublicView";
import PrivateView from "@/components/PrivateView";
import PaymentFlow, { type FlowStep } from "@/components/PaymentFlow";
import AgentInfoBar from "@/components/AgentInfoBar";
import AgentSelector, { type AgentConfig } from "@/components/AgentSelector";
import TransactionStory from "@/components/TransactionStory";
import { useBalance } from "@/hooks/useBalance";
import { sendPayment, initSession, getReceiptDetail } from "@/lib/api";

// Demo defaults
const DEFAULT_TARGET = "http://localhost:9999/api/market-data";
const DEMO_PROXY_PUBKEY = "9TuKYgjoNcUFEAkqHNvNotkTSsKzSrsCbkoYSH5NsxLN";

const DEFAULT_AGENT: AgentConfig = {
  label: "Demo Agent A",
  pubkey: "HwupKzvXRfrxnfSQ3bNoYbXiWS7TWXBWURb6JpZq5kup",
  ata: "DDoKyjLzyaLbrWi9SaQ7nXKFWgH4QqjWsfN4StP4niJe",
  source: "demo",
};

interface PaymentResult {
  receiptHash: string;
  amount: number;
  targetUrl: string;
  agentPubkey: string;
  responsePreview: string;
  timestamp: number;
  nonce: number;
  txSignature?: string;
  explorerUrl?: string;
}

function generateMockHash(): string {
  const chars = "abcdef0123456789";
  let result = "";
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function Home() {
  const [flowStep, setFlowStep] = useState<FlowStep>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [targetUrl, setTargetUrl] = useState(DEFAULT_TARGET);
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [agent, setAgent] = useState<AgentConfig>(DEFAULT_AGENT);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { balance, prevBalance, loading: balanceLoading, refetch: refetchBalance } = useBalance(
    agent.ata,
    10000
  );

  useEffect(() => {
    initSession()
      .then((res) => {
        setSessionReady(res.initialized);
        if (res.registeredOnChain) {
          console.log("[dashboard] Agent registered on-chain", res.explorerUrl);
        }
      })
      .catch(() => setSessionReady(false));
  }, []);

  useEffect(() => {
    if (!result?.receiptHash || result.txSignature) return;

    pollingRef.current = setInterval(async () => {
      try {
        const detail = await getReceiptDetail(result.receiptHash);
        if (detail?.txSignature) {
          setResult((prev) =>
            prev
              ? {
                  ...prev,
                  txSignature: detail.txSignature,
                  explorerUrl: detail.explorerUrl,
                }
              : prev
          );
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch {
        // ignore
      }
    }, 2000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [result?.receiptHash, result?.txSignature]);

  const handleSendPayment = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setResult(null);
    setFlowStep(0);

    await delay(600);
    setFlowStep(1);

    await delay(1200);
    setFlowStep(2);

    try {
      const response = await sendPayment(
        targetUrl,
        agent.pubkey,
        agent.ata,
      );

      await delay(800);
      setFlowStep(3);

      setResult({
        receiptHash: response.receiptHash,
        amount: 0.10,
        targetUrl,
        agentPubkey: agent.pubkey,
        responsePreview: JSON.stringify(response.data, null, 2),
        timestamp: Date.now(),
        nonce: response.nonce,
      });

      setTimeout(() => refetchBalance(), 2000);
    } catch {
      await delay(800);
      setFlowStep(3);

      setResult({
        receiptHash: generateMockHash(),
        amount: 0.10,
        targetUrl,
        agentPubkey: agent.pubkey,
        responsePreview: JSON.stringify(
          {
            symbol: "SOL/USDC",
            price: 178.42,
            volume24h: 1234567,
            source: "premium-data-api",
            message: "This data was paid for privately via Shadow Proxy",
          },
          null,
          2,
        ),
        timestamp: Date.now(),
        nonce: Date.now(),
      });
    }

    setIsLoading(false);
  }, [isLoading, targetUrl, agent, refetchBalance]);

  const handleAgentSelect = (newAgent: AgentConfig) => {
    setAgent(newAgent);
    setResult(null);
    setFlowStep(0);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8F8]">
      {/* Header */}
      <header className="border-b border-[#B6BAC3]/60 bg-white px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {/* Logo mark — teal hexagon */}
              <div
                className="w-8 h-8 bg-[#11B2BA]/10 border border-[#11B2BA]/35 flex items-center justify-center text-xs font-bold text-[#11B2BA] font-[family-name:var(--font-mono)]"
                style={{
                  clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                }}
              >
                SP
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-[0.1em] uppercase text-[#272D3E]">
                  Shadow Proxy
                </h1>
                <p className="text-[10px] text-[#8E95A2] font-[family-name:var(--font-mono)] uppercase tracking-wider">
                  Private x402 Gateway
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {sessionReady && (
              <span className="text-[10px] text-[#3BC171] bg-[#3BC171]/8 border border-[#3BC171]/25 px-2.5 py-1 font-[family-name:var(--font-mono)] uppercase tracking-wider">
                Session Active
              </span>
            )}
            <ConnectionStatus />
          </div>
        </div>
      </header>

      {/* Agent Info Bar */}
      {sessionReady && (
        <AgentInfoBar
          agentPubkey={agent.pubkey}
          agentAta={agent.ata}
          proxyPubkey={DEMO_PROXY_PUBKEY}
          balance={balance}
          prevBalance={prevBalance}
          balanceLoading={balanceLoading}
        />
      )}

      {/* Main */}
      <main className="flex-1 px-6 py-10">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Title area */}
          <div className="text-center space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-[0.15em] text-[#272D3E]">
              What Does The Chain See?
            </h2>
            <p className="text-[#8E95A2] text-sm max-w-xl mx-auto font-[family-name:var(--font-mono)] leading-relaxed">
              Shadow Proxy routes x402 payments through MagicBlock&apos;s TEE.
              Left panel: what Solana Explorer reveals. Right: what only the proxy knows.
            </p>
          </div>

          {/* Agent Selector toggle */}
          <div className="flex justify-center">
            <button
              onClick={() => setShowAgentSelector(!showAgentSelector)}
              className="flex items-center gap-2 px-4 py-2 border border-[#B6BAC3] hover:border-[#11B2BA]/40 text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-widest text-[#8E95A2] hover:text-[#11B2BA] hover:bg-[#11B2BA]/5 transition-all cursor-pointer bg-white"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {showAgentSelector ? "Hide Agent Selector" : `Agent: ${agent.label}`}
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform ${showAgentSelector ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          {/* Agent Selector panel */}
          {showAgentSelector && (
            <div className="max-w-lg mx-auto animate-slide-in">
              <AgentSelector selected={agent} onSelect={handleAgentSelect} />
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-4 max-w-md mx-auto">
            <div className="flex-1 h-px bg-[#B6BAC3]/60" />
            <span className="text-[10px] text-[#7D7F82] font-[family-name:var(--font-mono)] uppercase tracking-widest">
              configure
            </span>
            <div className="flex-1 h-px bg-[#B6BAC3]/60" />
          </div>

          {/* Target URL input */}
          <div className="flex flex-col items-center gap-2">
            <label className="text-[9px] text-[#7D7F82] font-[family-name:var(--font-mono)] uppercase tracking-widest">
              Target API — any x402-protected endpoint
            </label>
            <div className="flex items-center gap-0 w-full max-w-xl">
              <span className="border border-r-0 border-[#B6BAC3] bg-[#EDEEF1] px-3 py-2 text-[10px] text-[#7D7F82] font-[family-name:var(--font-mono)] whitespace-nowrap shrink-0">
                TARGET
              </span>
              {isEditingTarget ? (
                <input
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  onBlur={() => setIsEditingTarget(false)}
                  onKeyDown={(e) => e.key === "Enter" && setIsEditingTarget(false)}
                  className="flex-1 border border-[#B6BAC3] bg-white text-[#272D3E] text-[11px] font-[family-name:var(--font-mono)] px-3 py-2 outline-none focus:border-[#11B2BA]/50 focus:bg-[#11B2BA]/5 transition-colors"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => setIsEditingTarget(true)}
                  className="flex-1 border border-[#B6BAC3] bg-white text-[#8E95A2] text-[11px] font-[family-name:var(--font-mono)] px-3 py-2 text-left hover:border-[#11B2BA]/40 hover:text-[#272D3E] hover:bg-[#11B2BA]/5 transition-all cursor-text truncate"
                  title={targetUrl}
                >
                  {targetUrl}
                </button>
              )}
              {targetUrl !== DEFAULT_TARGET && (
                <button
                  onClick={() => setTargetUrl(DEFAULT_TARGET)}
                  className="border border-l-0 border-[#B6BAC3] bg-[#EDEEF1] px-3 py-2 text-[10px] text-[#8E95A2] hover:text-[#11B2BA] font-[family-name:var(--font-mono)] transition-colors shrink-0 cursor-pointer"
                  title="Reset to default"
                >
                  ↺
                </button>
              )}
            </div>
            <p className="text-[9px] text-[#7D7F82] font-[family-name:var(--font-mono)]">
              Click to edit &middot; works with any API that returns HTTP 402
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 max-w-md mx-auto">
            <div className="flex-1 h-px bg-[#B6BAC3]/60" />
            <span className="text-[10px] text-[#7D7F82] font-[family-name:var(--font-mono)] uppercase tracking-widest">
              initiate
            </span>
            <div className="flex-1 h-px bg-[#B6BAC3]/60" />
          </div>

          {/* Send Payment Button */}
          <div className="flex justify-center">
            <button
              onClick={handleSendPayment}
              disabled={isLoading}
              className={`px-8 py-3 font-[family-name:var(--font-mono)] font-semibold text-sm uppercase tracking-[0.15em] transition-all duration-300 ${
                isLoading
                  ? "bg-[#EDEEF1] text-[#8E95A2] border border-[#B6BAC3] cursor-not-allowed"
                  : "bg-[#11B2BA] text-white border border-[#11B2BA] hover:bg-[#12949D] hover:border-[#12949D] hover:shadow-[0_4px_20px_rgba(17,178,186,0.3)] active:scale-[0.98] cursor-pointer"
              }`}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Processing...
                </span>
              ) : (
                "Initiate Private Payment"
              )}
            </button>
          </div>

          {/* Payment Flow Steps */}
          <PaymentFlow
            currentStep={flowStep}
            agentPubkey={agent.pubkey}
            proxyPubkey={DEMO_PROXY_PUBKEY}
            amount={0.10}
          />

          {/* Transaction Story */}
          {result && (
            <>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-[#B6BAC3]/60" />
                <span className="text-[10px] text-[#7D7F82] font-[family-name:var(--font-mono)] uppercase tracking-widest">
                  trace
                </span>
                <div className="flex-1 h-px bg-[#B6BAC3]/60" />
              </div>

              <TransactionStory
                agentPubkey={result.agentPubkey}
                agentAta={agent.ata}
                proxyPubkey={DEMO_PROXY_PUBKEY}
                targetUrl={result.targetUrl}
                amount={result.amount}
                receiptHash={result.receiptHash}
                timestamp={result.timestamp}
                txSignature={result.txSignature}
                explorerUrl={result.explorerUrl}
              />
            </>
          )}

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-[#B6BAC3]/60" />
            <span className="text-[10px] text-[#7D7F82] font-[family-name:var(--font-mono)] uppercase tracking-widest">
              comparison
            </span>
            <div className="flex-1 h-px bg-[#B6BAC3]/60" />
          </div>

          {/* Two-panel layout */}
          <div className="flex flex-col lg:flex-row gap-0 border border-[#B6BAC3] shadow-sm">
            <div className="flex-1 lg:border-r lg:border-[#B6BAC3]">
              <PublicView
                receiptHash={result?.receiptHash ?? null}
                timestamp={result?.timestamp ?? null}
                explorerUrl={result?.explorerUrl ?? null}
                txSignature={result?.txSignature ?? null}
                isLoading={isLoading}
              />
            </div>
            <div className="flex-1">
              <PrivateView
                receiptHash={result?.receiptHash ?? null}
                amount={result?.amount ?? null}
                targetUrl={result?.targetUrl ?? null}
                agentPubkey={result?.agentPubkey ?? null}
                responsePreview={result?.responsePreview ?? null}
                timestamp={result?.timestamp ?? null}
                isLoading={isLoading}
              />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
