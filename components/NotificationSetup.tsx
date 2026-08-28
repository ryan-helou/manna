"use client";

import { useEffect, useState } from "react";
import { Glyph } from "./Glyph";
import { DEFAULT_REMINDER_HOUR } from "@/lib/types";

type State = "checking" | "unsupported" | "need-standalone" | "off" | "on" | "denied" | "working";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

const isStandalone = (): boolean =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (window.navigator as { standalone?: boolean }).standalone === true;

/** The evening nudge, if today's reading is still unticked. */
function hourLabel(h: number): string {
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

export function NotificationSetup({
  configured,
  reminderHour,
  onHour,
}: {
  configured: boolean;
  reminderHour: number | null;
  onHour: (hour: number) => void;
}) {
  const [state, setState] = useState<State>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        // iOS only exposes Push once the app is on the home screen.
        setState(isStandalone() ? "unsupported" : "need-standalone");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("off");
      }
    })();
  }, []);

  async function enable() {
    setError(null);
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const { publicKey, enabled } = await fetch("/api/push/vapid").then((r) => r.json());
      if (!enabled || !publicKey) {
        setError("Notifications are not switched on server side yet.");
        setState("off");
        return;
      }
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error();
      setState("on");
    } catch {
      setError("Could not turn on the reminder. Try again.");
      setState("off");
    }
  }

  async function disable() {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }

  const note = (text: string) => <p className="mt-1.5 text-sm text-ink-2">{text}</p>;

  return (
    <div className="rounded-xl border border-line bg-page-2 px-4 py-3.5">
      <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink">
        <Glyph name="bell" className="h-4 w-4 text-ink-2" />
        Evening reminder
      </p>

      {state === "checking" && note("Checking.")}
      {state === "need-standalone" &&
        note("Add Manna to your home screen first, then turn this on from there.")}
      {state === "unsupported" && note("This browser cannot do push notifications.")}
      {state === "denied" &&
        note("Notifications are blocked for this site in your browser settings.")}
      {!configured && (state === "off" || state === "on") &&
        note("Push is not configured on the server yet.")}

      {(state === "off" || state === "on" || state === "working") && (
        <>
          {state !== "working" &&
            note(
              state === "on"
                ? "You will get a nudge in the evening if today is still unticked."
                : "Get a nudge in the evening if today is still unticked.",
            )}
          <button
            onClick={state === "on" ? disable : enable}
            disabled={state === "working" || !configured}
            className={`mt-3 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
              state === "on"
                ? "border border-line-2 bg-transparent text-ink-2"
                : "bg-accent text-page"
            }`}
          >
            {state === "working" ? "Working" : state === "on" ? "Turn off" : "Turn on"}
          </button>
        </>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-warn">
          {error}
        </p>
      )}

      {state === "on" && (
        <div className="mt-4 border-t border-line pt-3">
          <label htmlFor="reminder-hour" className="block text-sm text-ink-2">
            Nudge me at
          </label>
          <select
            id="reminder-hour"
            value={reminderHour ?? DEFAULT_REMINDER_HOUR}
            onChange={(e) => onHour(Number(e.target.value))}
            className="mt-2 w-full rounded-xl border border-line-2 bg-page-2 px-4 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {Array.from({ length: 24 }, (_, h) => h).map((h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-ink-3">
            Only if the day is still unticked by then.
          </p>
        </div>
      )}
    </div>
  );
}
