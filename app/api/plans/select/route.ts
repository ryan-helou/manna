import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { readState, setActivePlan } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { planId?: unknown };
  const planId = typeof body.planId === "string" ? body.planId : "";
  if (!(await getStore().isMember(planId, me.id))) {
    return NextResponse.json({ error: "You are not in that plan." }, { status: 403 });
  }
  await setActivePlan(planId);
  return NextResponse.json(await readState());
}
