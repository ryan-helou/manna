"use client";

import { useCallback, useRef, useState } from "react";
import type { AppState } from "@/lib/types";

export interface Manna {
  state: AppState;
  busy: boolean;
  /** Sends a mutation and swaps in the fresh state it returns. */
  send: (url: string, init?: RequestInit) => Promise<string | null>;
  /**
   * Applies a change locally, straight away, then sends it.
   *
   * Ticking a chapter is the thing this app is for, and waiting on a round trip
   * before the box fills makes the whole morning feel unresponsive on a phone.
   * The server's reply still wins when it lands; if the request fails, the local
   * change is rolled back so the screen never keeps a tick the database refused.
   */
  sendOptimistic: (
    patch: (state: AppState) => AppState,
    url: string,
    init?: RequestInit,
  ) => Promise<string | null>;
}

export function useManna(initial: AppState): Manna {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  // Requests can land out of order; only the newest may write the state.
  const seq = useRef(0);

  const request = useCallback(
    async (url: string, init: RequestInit | undefined, onFail: () => void) => {
      const mine = ++seq.current;
      setBusy(true);
      try {
        const res = await fetch(url, {
          ...init,
          headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          onFail();
          return (payload as { error?: string } | null)?.error ?? "Something went wrong.";
        }
        if (payload && mine === seq.current) setState(payload as AppState);
        return null;
      } catch {
        onFail();
        return "No connection. Check your signal and try again.";
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const send = useCallback(
    (url: string, init?: RequestInit) => request(url, init, () => {}),
    [request],
  );

  const sendOptimistic = useCallback(
    (patch: (state: AppState) => AppState, url: string, init?: RequestInit) => {
      let before: AppState | null = null;
      setState((current) => {
        before = current;
        return patch(current);
      });
      return request(url, init, () => {
        if (before) setState(before);
      });
    },
    [request],
  );

  return { state, busy, send, sendOptimistic };
}
