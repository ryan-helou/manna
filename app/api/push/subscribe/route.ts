import { NextResponse } from "next/server";
import { getStore, type PushSub } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function isSub(v: unknown): v is PushSub {
  const s = v as PushSub;
  return (
    !!s && typeof s.endpoint === "string" && !!s.keys &&
    typeof s.keys.p256dh === "string" && typeof s.keys.auth === "string"
  );
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { subscription?: unknown };
  if (!isSub(body.subscription)) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }
  await getStore().savePushSub(me.id, body.subscription);
  return NextResponse.json({ ok: true });
}
