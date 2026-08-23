"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pull down anywhere to refresh.
 *
 * A home-screen app has no browser chrome, so the operating system's own pull
 * gesture never fires and there is no reload button to fall back on. This drives
 * it: at the very top of any tab, dragging down past a threshold refetches the
 * whole state. The listeners sit on the window rather than on a scroller, so it
 * works on Today, Together and Journey alike.
 *
 * Held back while a sheet is open, so it never fights a modal's own scrolling.
 */

const TRIGGER = 70; // pixels of pull, after damping, that commit a refresh
const MAX = 100; // how far the indicator is allowed to travel
const RESIST = 0.5; // damping, so the pull feels like it is under tension

export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Refs mirror the state so the listeners, attached once, never read a stale
  // value out of their closure.
  const startY = useRef(0);
  const engaged = useRef(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);
  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    const apply = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };

    function start(e: TouchEvent) {
      if (refreshingRef.current || e.touches.length !== 1) return;
      // Only from the very top, and never over an open sheet.
      if (window.scrollY > 0 || document.querySelector('[role="dialog"]')) {
        engaged.current = false;
        return;
      }
      engaged.current = true;
      startY.current = e.touches[0].clientY;
    }

    function move(e: TouchEvent) {
      if (!engaged.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        if (pullRef.current) apply(0);
        setDragging(false);
        return;
      }
      // If the page started scrolling underneath, hand the gesture back.
      if (window.scrollY > 0) {
        engaged.current = false;
        apply(0);
        setDragging(false);
        return;
      }
      setDragging(true);
      apply(Math.min(MAX, dy * RESIST));
      // Suppress the browser's own overscroll while we are driving it.
      if (e.cancelable) e.preventDefault();
    }

    async function end() {
      if (!engaged.current) return;
      engaged.current = false;
      setDragging(false);
      const committed = pullRef.current >= TRIGGER;
      if (committed) {
        setRefreshing(true);
        apply(TRIGGER);
        try {
          await onRefreshRef.current();
        } catch {
          // A failed refresh must not leave the spinner stuck on screen.
        }
        setRefreshing(false);
      }
      apply(0);
    }

    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end, { passive: true });
    window.addEventListener("touchcancel", end, { passive: true });
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
    };
  }, []);

  const progress = Math.min(1, pull / TRIGGER);
  const y = refreshing ? TRIGGER : pull;
  const visible = pull > 0 || refreshing;

  // The ring fills as you pull; once it commits, the arc becomes a fixed sweep
  // and the whole thing turns.
  const R = 16;
  const C = 2 * Math.PI * R;
  const sweep = refreshing ? 0.28 : progress;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-40 mx-auto flex w-full max-w-md justify-center"
      style={{
        transform: `translateY(${y}px) scale(${refreshing ? 1 : 0.55 + 0.45 * progress})`,
        opacity: visible ? (refreshing ? 1 : Math.max(0.3, progress)) : 0,
        transition: dragging
          ? "none"
          : "transform 240ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease",
      }}
    >
      <div className="mt-2 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-card shadow-lg">
        <svg
          viewBox="0 0 40 40"
          className={`h-7 w-7 ${refreshing ? "animate-spin" : ""}`}
          style={{ transformOrigin: "center" }}
        >
          <circle cx="20" cy="20" r={R} fill="none" stroke="var(--line)" strokeWidth="4" />
          <circle
            cx="20"
            cy="20"
            r={R}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - sweep)}
            transform="rotate(-90 20 20)"
          />
        </svg>
      </div>
    </div>
  );
}
