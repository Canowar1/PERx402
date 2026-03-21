"use client";

import { useEffect, useState, useCallback } from "react";
import { checkHealth } from "@/lib/api";

interface ConnectionState {
  tee: boolean;
  proxy: boolean;
  checking: boolean;
}

export default function ConnectionStatus() {
  const [connection, setConnection] = useState<ConnectionState>({
    tee: false,
    proxy: false,
    checking: true,
  });

  const poll = useCallback(async () => {
    try {
      const health = await checkHealth();
      setConnection({
        tee: health.tee === "connected",
        proxy: health.status === "ok",
        checking: false,
      });
    } catch {
      setConnection({ tee: false, proxy: false, checking: false });
    }
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, [poll]);

  const isConnected = connection.tee && connection.proxy;

  return (
    <div className="flex items-center gap-2.5 font-[family-name:var(--font-mono)] text-xs uppercase tracking-wider">
      {/* Radar / signal icon */}
      <div className="relative w-4 h-4 flex items-center justify-center">
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className={
            connection.checking
              ? "text-[#FFB800]"
              : isConnected
                ? "text-[#3BC171]"
                : "text-[#FF647C]"
          }
        >
          <circle cx="7" cy="7" r="2.5" fill="currentColor" />
          <path
            d="M3.5 3.5C2.1 4.9 2.1 9.1 3.5 10.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.6"
          />
          <path
            d="M10.5 3.5C11.9 4.9 11.9 9.1 10.5 10.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.6"
          />
        </svg>
        {/* Ping animation */}
        {isConnected && !connection.checking && (
          <span className="absolute inset-0 rounded-full bg-[#3BC171]/30" style={{ animation: "radar-ping 2s ease-out infinite" }} />
        )}
      </div>
      <span
        className={
          connection.checking
            ? "text-[#FFB800]/80"
            : isConnected
              ? "text-[#3BC171]/80"
              : "text-[#FF647C]/80"
        }
      >
        {connection.checking
          ? "SCANNING..."
          : isConnected
            ? "PER ONLINE"
            : "PER OFFLINE"}
      </span>
    </div>
  );
}
