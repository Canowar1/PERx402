"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export interface AgentConfig {
  label: string;
  pubkey: string;
  ata: string;
  source: "demo" | "custom" | "wallet";
}

const DEMO_AGENTS: AgentConfig[] = [
  {
    label: "Demo Agent A",
    pubkey: "HwupKzvXRfrxnfSQ3bNoYbXiWS7TWXBWURb6JpZq5kup",
    ata: "DDoKyjLzyaLbrWi9SaQ7nXKFWgH4QqjWsfN4StP4niJe",
    source: "demo",
  },
];

interface AgentSelectorProps {
  selected: AgentConfig;
  onSelect: (agent: AgentConfig) => void;
}

export default function AgentSelector({ selected, onSelect }: AgentSelectorProps) {
  const [mode, setMode] = useState<"demo" | "custom" | "wallet">(selected.source);
  const [customPubkey, setCustomPubkey] = useState("");
  const [customAta, setCustomAta] = useState("");
  const wallet = useWallet();

  const handleUseWallet = () => {
    if (!wallet.publicKey) return;
    onSelect({
      label: `Wallet: ${wallet.publicKey.toBase58().slice(0, 8)}...`,
      pubkey: wallet.publicKey.toBase58(),
      ata: wallet.publicKey.toBase58(),
      source: "wallet",
    });
    setMode("wallet");
  };

  const handleUseCustom = () => {
    if (customPubkey.length < 32 || customAta.length < 32) return;
    onSelect({
      label: `Custom: ${customPubkey.slice(0, 8)}...`,
      pubkey: customPubkey,
      ata: customAta,
      source: "custom",
    });
    setMode("custom");
  };

  return (
    <div className="border border-[#B6BAC3] bg-white overflow-hidden shadow-sm">
      {/* Tabs */}
      <div className="flex border-b border-[#B6BAC3]">
        {(["demo", "wallet", "custom"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMode(tab)}
            className={`flex-1 px-4 py-2 text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-widest transition-all cursor-pointer ${
              mode === tab
                ? "text-[#11B2BA] bg-[#11B2BA]/5 border-b-2 border-[#11B2BA]"
                : "text-[#8E95A2] hover:text-[#272D3E] hover:bg-[#EDEEF1]"
            }`}
          >
            {tab === "demo"
              ? "Demo Agent"
              : tab === "wallet"
                ? "Connect Wallet"
                : "Custom Agent"}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="p-4">
        {mode === "demo" && (
          <div className="space-y-2">
            {DEMO_AGENTS.map((agent) => (
              <button
                key={agent.pubkey}
                onClick={() => onSelect(agent)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 border transition-all cursor-pointer ${
                  selected.pubkey === agent.pubkey
                    ? "border-[#11B2BA]/40 bg-[#11B2BA]/5"
                    : "border-[#B6BAC3] hover:border-[#11B2BA]/25 bg-transparent hover:bg-[#F7F8F8]"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    selected.pubkey === agent.pubkey ? "bg-[#11B2BA]" : "bg-[#B6BAC3]"
                  }`}
                />
                <div className="text-left min-w-0">
                  <div className="text-xs text-[#272D3E] font-[family-name:var(--font-mono)]">
                    {agent.label}
                  </div>
                  <div className="text-[9px] text-[#8E95A2] font-[family-name:var(--font-mono)] truncate">
                    {agent.pubkey}
                  </div>
                </div>
                {selected.pubkey === agent.pubkey && (
                  <span className="ml-auto text-[9px] text-[#12949D] font-[family-name:var(--font-mono)] uppercase tracking-wider shrink-0">
                    Active
                  </span>
                )}
              </button>
            ))}
            <p className="text-[9px] text-[#7D7F82] font-[family-name:var(--font-mono)] mt-2">
              Pre-funded with devnet USDC. Ready to use immediately.
            </p>
          </div>
        )}

        {mode === "wallet" && (
          <div className="space-y-3">
            <div className="flex justify-center">
              <WalletMultiButton
                style={{
                  backgroundColor: "transparent",
                  border: "1px solid rgba(17, 178, 186, 0.35)",
                  borderRadius: 0,
                  color: "#11B2BA",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                  padding: "8px 20px",
                  height: "auto",
                }}
              />
            </div>
            {wallet.connected && wallet.publicKey && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 border border-[#3BC171]/20 bg-[#3BC171]/5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3BC171]" />
                  <span className="text-[10px] text-[#3BC171] font-[family-name:var(--font-mono)]">
                    Connected: {wallet.publicKey.toBase58().slice(0, 12)}...
                  </span>
                </div>
                <button
                  onClick={handleUseWallet}
                  className="w-full px-4 py-2 border border-[#11B2BA]/30 text-[#11B2BA] text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider hover:bg-[#11B2BA]/5 transition-all cursor-pointer"
                >
                  Use This Wallet as Agent
                </button>
              </div>
            )}
            <p className="text-[9px] text-[#7D7F82] font-[family-name:var(--font-mono)]">
              Connect Phantom or Solflare. Requires devnet USDC.
            </p>
          </div>
        )}

        {mode === "custom" && (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-[9px] text-[#7D7F82] font-[family-name:var(--font-mono)] uppercase tracking-widest">
                Agent Public Key
              </label>
              <input
                type="text"
                value={customPubkey}
                onChange={(e) => setCustomPubkey(e.target.value)}
                placeholder="Enter agent pubkey (base58)"
                className="w-full border border-[#B6BAC3] bg-white text-[#272D3E] text-[11px] font-[family-name:var(--font-mono)] px-3 py-2 outline-none focus:border-[#11B2BA]/50 transition-colors placeholder:text-[#B6BAC3]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] text-[#7D7F82] font-[family-name:var(--font-mono)] uppercase tracking-widest">
                Agent USDC ATA
              </label>
              <input
                type="text"
                value={customAta}
                onChange={(e) => setCustomAta(e.target.value)}
                placeholder="Enter agent ephemeral ATA (base58)"
                className="w-full border border-[#B6BAC3] bg-white text-[#272D3E] text-[11px] font-[family-name:var(--font-mono)] px-3 py-2 outline-none focus:border-[#11B2BA]/50 transition-colors placeholder:text-[#B6BAC3]"
              />
            </div>
            <button
              onClick={handleUseCustom}
              disabled={customPubkey.length < 32 || customAta.length < 32}
              className="w-full px-4 py-2 border border-[#11B2BA]/30 text-[#11B2BA] text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-wider hover:bg-[#11B2BA]/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              Use Custom Agent
            </button>
            <p className="text-[9px] text-[#7D7F82] font-[family-name:var(--font-mono)]">
              Paste any Solana agent pubkey + USDC ATA. Agent must have devnet USDC deposited in PER.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
