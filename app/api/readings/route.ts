import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { cutsFor, readState } from "@/lib/state";
import { today } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Tick today's reading off, or put it back. */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    planId?: unknown;
    day?: unknown;
    done?: unknown;
  };
  const planId = typeof body.planId === "string" ? body.planId : "";
  const day = Number(body.day);
  const store = getStore();

  if (!(await store.isMember(planId, me.id))) {
    return NextResponse.json({ error: "You are not in that plan." }, { status: 403 });
  }
  const plan = await store.getPlan(planId);
  if (!plan) return NextResponse.json({ error: "No such plan." }, { status: 404 });

  const days = cutsFor(plan.startDay, plan.months).length - 1;
  if (!Number.isInteger(day) || day < 1 || day > days) {
    return NextResponse.json({ error: "That day is not in the plan." }, { status: 400 });
  }

  if (body.done === false) await store.clearCompletion(planId, me.id, day);
  // The calendar day it was ticked, which is what streaks count. Not the day
  // it was due: catching up on Thursday is still showing up on Thursday.
  else await store.setCompletion(planId, me.id, day, today());

  return NextResponse.json(await readState());
}
