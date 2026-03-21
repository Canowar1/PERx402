"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { type AgentConfig } from "@/components/AgentSelector";
import { initSession } from "@/lib/api";

const DEMO_AGENTS: AgentConfig[] = [
  {
    label: "Demo Agent A",
    pubkey: "HwupKzvXRfrxnfSQ3bNoYbXiWS7TWXBWURb6JpZq5kup",
    ata: "DDoKyjLzyaLbrWi9SaQ7nXKFWgH4QqjWsfN4StP4niJe",
    source: "demo",
  },
];

type InitStep = "idle" | "registering" | "done" | "error";

interface SessionGateProps {
  onSessionReady: (agent: AgentConfig) => void;
}

function truncate(s: string, n = 8) {
  return s.length > n * 2 + 3 ? `${s.slice(0, n)}...${s.slice(-6)}` : s;
}

export default function SessionGate({ onSessionReady }: SessionGateProps) {
  const [mode, setMode] = useState<"demo" | "wallet" | "custom">("demo");
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig>(DEMO_AGENTS[0]);
  const [customPubkey, setCustomPubkey] = useState("");
  const [customAta, setCustomAta] = useState("");
  const [initStep, setInitStep] = useState<InitStep>("idle");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const wallet = useWallet();

  const activeAgent: AgentConfig =
    mode === "wallet" && wallet.connected && wallet.publicKey
      ? {
          label: `Wallet: ${wallet.publicKey.toBase58().slice(0, 8)}...`,
          pubkey: wallet.publicKey.toBase58(),
          ata: wallet.publicKey.toBase58(),
          source: "wallet",
        }
      : mode === "custom" && customPubkey.length >= 32 && customAta.length >= 32
        ? {
            label: `Custom: ${customPubkey.slice(0, 8)}...`,
            pubkey: customPubkey,
            ata: customAta,
            source: "custom",
          }
        : selectedAgent;

  const canInit =
    mode === "demo" ||
    (mode === "wallet" && wallet.connected && wallet.publicKey) ||
    (mode === "custom" && customPubkey.length >= 32 && customAta.length >= 32);

  const handleInitSession = async () => {
    if (!canInit || initStep === "registering") return;
    setInitStep("registering");
    setErrorMsg(null);
    setTxSignature(null);
    setExplorerUrl(null);

    try {
      const res = await initSession();
      setInitStep("done");
      if (res.registrationTx) setTxSignature(res.registrationTx);
      if (res.explorerUrl) setExplorerUrl(res.explorerUrl);

      // Brief pause so user sees the success state, then transition
      await delay(1800);
      onSessionReady(activeAgent);
    } catch {
      setInitStep("error");
      setErrorMsg("Could not reach proxy. Make sure the proxy server is running.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F8] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#B6BAC3]/60 bg-white px-6 py-4 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 bg-[#11B2BA]/10 border border-[#11B2BA]/35 flex items-center justify-center text-xs font-bold text-[#11B2BA] font-[family-name:var(--font-mono)]"
              style={{ clipPath: "polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)" }}
            >
              SP
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-[0.1em] uppercase text-[#272D3E]">
                PERx402
              </h1>
              <p className="text-[10px] text-[#8E95A2] font-[family-name:var(--font-mono)] uppercase tracking-wider">
                Private x402 Gateway
              </p>
            </div>
          </div>
          <span className="text-[10px] text-[#8E95A2] font-[family-name:var(--font-mono)] uppercase tracking-wider border border-[#B6BAC3] px-2.5 py-1">
            Solana Devnet
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg space-y-8 animate-slide-in">

          {/* Title */}
          <div className="text-center space-y-3">
            <h2 className="text-2xl font-bold uppercase tracking-[0.15em] text-[#272D3E]">
              Connect Your Agent
            </h2>
            <p className="text-[#8E95A2] text-sm font-[family-name:var(--font-mono)] leading-relaxed">
              Select an agent to route private x402 payments through the TEE.
              <br />
              Your identity stays hidden — only a settlement hash reaches the chain.
            </p>
          </div>

          {/* Mode tabs */}
          <div className="border border-[#B6BAC3] bg-white shadow-sm">
            <div className="flex border-b border-[#B6BAC3]">
              {(["demo", "wallet", "custom"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setMode(tab)}
                  disabled={initStep === "registering"}
                  className={`flex-1 px-4 py-2.5 text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-widest transition-all cursor-pointer ${
                    mode === tab
                      ? "text-[#11B2BA] bg-[#11B2BA]/5 border-b-2 border-[#11B2BA]"
                      : "text-[#8E95A2] hover:text-[#272D3E] hover:bg-[#EDEEF1]"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {tab === "demo" ? "Demo Agent" : tab === "wallet" ? "My Wallet" : "Custom"}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-4">
              {/* Demo tab */}
              {mode === "demo" && (
                <div className="space-y-3">
                  {DEMO_AGENTS.map((agent) => (
                    <button
                      key={agent.pubkey}
                      onClick={() => setSelectedAgent(agent)}
                      disabled={initStep === "registering"}
                      className={`w-full flex items-center gap-3 px-4 py-3 border transition-all cursor-pointer ${
                        selectedAgent.pubkey === agent.pubkey
                          ? "border-[#11B2BA]/40 bg-[#11B2BA]/5"
                          : "border-[#B6BAC3] hover:border-[#11B2BA]/25"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${selectedAgent.pubkey === agent.pubkey ? "bg-[#11B2BA]" : "bg-[#B6BAC3]"}`} />
                      <div className="text-left min-w-0 flex-1">
                        <div className="text-xs font-semibold text-[#272D3E] font-[family-name:var(--font-mono)]">
                          {agent.label}
                        </div>
                        <div className="text-[9px] text-[#8E95A2] font-[family-name:var(--font-mono)] mt-0.5">
                          {agent.pubkey}
                        </div>
                      </div>
                      {selectedAgent.pubkey === agent.pubkey && (
                        <span className="text-[9px] text-[#12949D] font-[family-name:var(--font-mono)] uppercase tracking-wider shrink-0">
                          Selected
                        </span>
                      )}
                    </button>
                  ))}
                  <p className="text-[9px] text-[#7D7F82] font-[family-name:var(--font-mono)]">
                    Pre-funded with devnet USDC. Ready to use immediately.
                  </p>
                </div>
              )}

              {/* Wallet tab */}
              {mode === "wallet" && (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <WalletMultiButton
                      style={{
                        backgroundColor: "transparent",
                        border: "1px solid rgba(17,178,186,0.35)",
                        borderRadius: 0,
                        color: "#11B2BA",
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        textTransform: "uppercase",
                        letterSpacing: "0.15em",
                        padding: "10px 24px",
                        height: "auto",
                      }}
                    />
                  </div>
                  {wallet.connected && wallet.publicKey ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 border border-[#3BC171]/20 bg-[#3BC171]/5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3BC171]" />
                      <span className="text-[10px] text-[#3BC171] font-[family-name:var(--font-mono)]">
                        Connected: {wallet.publicKey.toBase58().slice(0, 16)}...
                      </span>
                    </div>
                  ) : (
                    <p className="text-[9px] text-[#7D7F82] font-[family-name:var(--font-mono)] text-center">
                      Connect Phantom or Solflare to use your own wallet as agent.
                      <br />Requires devnet USDC.
                    </p>
                  )}
                </div>
              )}

              {/* Custom tab */}
              {mode === "custom" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-[#7D7F82] font-[family-name:var(--font-mono)] uppercase tracking-widest">
                      Agent Public Key
                    </label>
                    <input
                      type="text"
                      value={customPubkey}
                      onChange={(e) => setCustomPubkey(e.target.value)}
                      placeholder="Enter agent pubkey (base58)"
                      className="w-full border border-[#B6BAC3] bg-white text-[#272D3E] text-[11px] font-[family-name:var(--font-mono)] px-3 py-2 outline-none focus:border-[#11B2BA]/60 transition-colors placeholder:text-[#B6BAC3]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] text-[#7D7F82] font-[family-name:var(--font-mono)] uppercase tracking-widest">
                      USDC ATA Address
                    </label>
                    <input
                      type="text"
                      value={customAta}
                      onChange={(e) => setCustomAta(e.target.value)}
                      placeholder="Enter USDC Associated Token Account"
                      className="w-full border border-[#B6BAC3] bg-white text-[#272D3E] text-[11px] font-[family-name:var(--font-mono)] px-3 py-2 outline-none focus:border-[#11B2BA]/60 transition-colors placeholder:text-[#B6BAC3]"
                    />
                  </div>
                  <p className="text-[9px] text-[#7D7F82] font-[family-name:var(--font-mono)]">
                    Agent must have devnet USDC deposited in the PER ephemeral rollup.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Agent preview card */}
          {initStep === "idle" && (
            <div className="border border-[#B6BAC3]/60 bg-white px-5 py-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#11B2BA]" />
                <span className="text-[9px] text-[#12949D] font-[family-name:var(--font-mono)] uppercase tracking-[0.2em]">
                  Agent Preview
                </span>
              </div>
              <div className="space-y-2">
                <Row label="Label" value={activeAgent.label} />
                <Row label="Pubkey" value={truncate(activeAgent.pubkey, 14)} mono />
                <Row label="USDC ATA" value={truncate(activeAgent.ata, 14)} mono />
                <Row label="Network" value="Solana Devnet" />
                <Row label="Privacy" value="TEE / Intel TDX" />
              </div>
            </div>
          )}

          {/* Status: registering */}
          {initStep === "registering" && (
            <div className="border border-[#11B2BA]/20 bg-[#11B2BA]/5 px-5 py-5 flex flex-col items-center gap-4 animate-slide-in">
              <svg className="animate-spin h-6 w-6 text-[#11B2BA]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <div className="text-center space-y-1">
                <p className="text-sm font-[family-name:var(--font-mono)] text-[#11B2BA] uppercase tracking-wider font-semibold">
                  Registering on Solana...
                </p>
                <p className="text-[10px] text-[#8E95A2] font-[family-name:var(--font-mono)]">
                  AgentIdentity PDA · TEE session · Private rollup
                </p>
              </div>
              <div className="w-full space-y-1.5 mt-1">
                {["Verifying TEE integrity", "Initializing TEE session", "Registering AgentIdentity PDA"].map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <svg className="animate-spin h-3 w-3 text-[#11B2BA]/60" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-[9px] text-[#8E95A2] font-[family-name:var(--font-mono)] uppercase tracking-wide">
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status: done */}
          {initStep === "done" && (
            <div className="border border-[#3BC171]/25 bg-[#3BC171]/5 px-5 py-5 flex flex-col items-center gap-4 animate-slide-in">
              <div className="w-10 h-10 rounded-full bg-[#3BC171]/15 border border-[#3BC171]/30 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3BC171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-[family-name:var(--font-mono)] text-[#3BC171] uppercase tracking-wider font-semibold">
                  Session Active
                </p>
                <p className="text-[10px] text-[#8E95A2] font-[family-name:var(--font-mono)]">
                  Agent registered · TEE session open · Ready to pay privately
                </p>
              </div>
              {txSignature && explorerUrl && (
                <div className="w-full border border-[#3BC171]/20 bg-white px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3BC171" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    <span className="text-[9px] text-[#3BC171] font-[family-name:var(--font-mono)] uppercase tracking-wider">
                      On-Chain Registration
                    </span>
                  </div>
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[10px] font-[family-name:var(--font-mono)] text-[#8E95A2] hover:text-[#11B2BA] underline underline-offset-2 break-all transition-colors"
                  >
                    {txSignature.slice(0, 28)}...{txSignature.slice(-8)} ↗
                  </a>
                </div>
              )}
              <p className="text-[9px] text-[#8E95A2] font-[family-name:var(--font-mono)]">
                Entering dashboard...
              </p>
            </div>
          )}

          {/* Status: error */}
          {initStep === "error" && (
            <div className="border border-[#FF647C]/25 bg-[#FF647C]/5 px-5 py-4 space-y-2 animate-slide-in">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF647C" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="text-[10px] text-[#FF647C] font-[family-name:var(--font-mono)] uppercase tracking-wider">
                  Connection Failed
                </span>
              </div>
              <p className="text-[10px] text-[#8E95A2] font-[family-name:var(--font-mono)] pl-5">
                {errorMsg}
              </p>
            </div>
          )}

          {/* CTA Button */}
          {(initStep === "idle" || initStep === "error") && (
            <button
              onClick={handleInitSession}
              disabled={!canInit}
              className={`w-full py-3.5 font-[family-name:var(--font-mono)] font-semibold text-sm uppercase tracking-[0.15em] transition-all duration-300 ${
                canInit
                  ? "bg-[#11B2BA] text-white hover:bg-[#12949D] hover:shadow-[0_4px_20px_rgba(17,178,186,0.3)] active:scale-[0.99] cursor-pointer"
                  : "bg-[#EDEEF1] text-[#B6BAC3] cursor-not-allowed"
              }`}
            >
              {initStep === "error" ? "Retry Session →" : "Initialize Session →"}
            </button>
          )}

          {/* Privacy note */}
          {initStep === "idle" && (
            <p className="text-center text-[9px] text-[#8E95A2] font-[family-name:var(--font-mono)] leading-relaxed">
              Only a settlement hash reaches Solana.
              Amount, API endpoint, and agent identity stay inside the TEE.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] text-[#7D7F82] font-[family-name:var(--font-mono)] uppercase tracking-widest">
        {label}
      </span>
      <span className={`text-[10px] text-[#272D3E] ${mono ? "font-[family-name:var(--font-mono)]" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
