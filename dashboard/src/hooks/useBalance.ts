"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const PROXY_URL =
  process.env.NEXT_PUBLIC_PROXY_URL ?? "http://localhost:3001";

interface BalanceState {
  balance: string | null;
  prevBalance: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch and poll a Solana token account balance via the proxy.
 * Returns the current balance, previous balance (for delta animation),
 * and a refetch function.
 */
export function useBalance(address: string | null, pollIntervalMs = 8000) {
  const [state, setState] = useState<BalanceState>({
    balance: null,
    prevBalance: null,
    loading: true,
    error: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!address) {
      setState({ balance: null, prevBalance: null, loading: false, error: null });
      return;
    }

    try {
      const res = await fetch(`${PROXY_URL}/balance/${address}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { balance: string };
      setState((prev) => ({
        balance: data.balance,
        prevBalance: prev.balance,
        loading: false,
        error: null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: (err as Error).message,
      }));
    }
  }, [address]);

  useEffect(() => {
    fetchBalance();
    intervalRef.current = setInterval(fetchBalance, pollIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchBalance, pollIntervalMs]);

  return {
    ...state,
    refetch: fetchBalance,
  };
}
