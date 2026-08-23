"use client";

import { useCallback, useState } from "react";
import type { AppState } from "@/lib/types";

export interface Manna {
  state: AppState;
  busy: boolean;
  /** Sends a mutation and swaps in the fresh state it returns. */
  send: (url: string, init?: RequestInit) => Promise<string | null>;
}

export function useManna(initial: AppState): Manna {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);

  const send = useCallback(async (url: string, init?: RequestInit) => {
    setBusy(true);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        return (payload as { error?: string } | null)?.error ?? "Something went wrong.";
      }
      if (payload) setState(payload as AppState);
      return null;
    } catch {
      return "No connection. Check your signal and try again.";
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, send };
}
