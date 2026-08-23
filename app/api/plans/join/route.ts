import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { readState, setActivePlan } from "@/lib/state";
import { isJoinCode, normalizeCode } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const raw = typeof body.code === "string" ? body.code : "";
  if (!isJoinCode(raw)) {
    return NextResponse.json({ error: "Join codes are four characters." }, { status: 400 });
  }

  const store = getStore();
  const plan = await store.getPlanByCode(normalizeCode(raw));
  if (!plan) {
    return NextResponse.json({ error: "No plan with that code." }, { status: 404 });
  }
  // Joining twice is a no-op rather than an error: the code still works.
  await store.addMember(plan.id, me.id, false);
  await setActivePlan(plan.id);
  return NextResponse.json(await readState());
}
