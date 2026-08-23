import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { cutsFor, readState } from "@/lib/state";
import { today } from "@/lib/dates";
import { allChapters, bookByName, type Ref } from "@/lib/bible";

export const dynamic = "force-dynamic";

/**
 * Tick reading off, or put it back. Takes either a whole day or a single
 * chapter, because a six chapter morning where you managed four should have
 * somewhere to go other than a lie.
 */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    planId?: unknown;
    day?: unknown;
    book?: unknown;
    chapter?: unknown;
    done?: unknown;
  };
  const planId = typeof body.planId === "string" ? body.planId : "";
  const store = getStore();

  if (!(await store.isMember(planId, me.id))) {
    return NextResponse.json({ error: "You are not in that plan." }, { status: 403 });
  }
  const plan = await store.getPlan(planId);
  if (!plan) return NextResponse.json({ error: "No such plan." }, { status: 404 });

  let refs: Ref[];
  if (body.book !== undefined || body.chapter !== undefined) {
    // A single chapter.
    const book = typeof body.book === "string" ? body.book : "";
    const chapter = Number(body.chapter);
    const meta = bookByName(book);
    if (!meta || !Number.isInteger(chapter) || chapter < 1 || chapter > meta.chapters) {
      return NextResponse.json({ error: "That is not a chapter." }, { status: 400 });
    }
    refs = [{ book, chapter }];
  } else {
    // A whole day of the schedule.
    const day = Number(body.day);
    const cuts = cutsFor(plan.startDay, plan.months);
    if (!Number.isInteger(day) || day < 1 || day > cuts.length - 1) {
      return NextResponse.json({ error: "That day is not in the plan." }, { status: 400 });
    }
    refs = allChapters().slice(cuts[day - 1], cuts[day]);
  }

  if (body.done === false) await store.clearRead(planId, me.id, refs);
  // Stamped with the calendar day it was ticked, which is what streaks count.
  // Catching up on Thursday is still showing up on Thursday.
  else await store.markRead(planId, me.id, refs, today());

  return NextResponse.json(await readState());
}
