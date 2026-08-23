import "server-only";
import webpush from "web-push";
import { getStore, type PushSub } from "./db";

/**
 * Web Push fan-out. VAPID keys come from the environment; when they are absent
 * the app still runs and pushes simply no-op.
 */

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@manna.app";
  if (pub && priv) {
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
  } else {
    configured = false;
  }
  return configured;
}

export const pushConfigured = (): boolean => ensureConfigured();
export const vapidPublicKey = (): string => process.env.VAPID_PUBLIC_KEY || "";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

async function sendOne(sub: PushSub, payload: PushPayload): Promise<void> {
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // 404 and 410 mean the subscription is dead, so stop trying it.
    if (status === 404 || status === 410) {
      await getStore().deletePushSub(sub.endpoint).catch(() => {});
    }
  }
}

/** Send to every device a reader has registered. */
export async function sendToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;
  const subs = await getStore().listPushSubsFor(userId);
  await Promise.all(subs.map((s) => sendOne(s, payload)));
}
