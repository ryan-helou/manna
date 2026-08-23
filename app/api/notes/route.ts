import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { cutsFor, readState } from "@/lib/state";
import { MAX_NOTE_LENGTH } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * The notes on one day.
 *
 * The state payload carries only today's, because a year of a dozen people
 * writing would put notes where the chapter ticks used to be. Navigating to
 * another day fetches that day's instead of showing an empty field over the top
 * of something somebody wrote.
 */
export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const url = new URL(req.url);
  const planId = url.searchParams.get("planId") ?? "";
  const day = Number(url.searchParams.get("day"));
  const store = getStore();

  if (!(await store.isMember(planId, me.id))) {
    return NextResponse.json({ error: "You are not in that plan." }, { status: 403 });
  }
  if (!Number.isInteger(day) || day < 1) {
    return NextResponse.json({ error: "That day is not in the plan." }, { status: 400 });
  }
  const notes = (await store.listNotes(planId)).filter((n) => n.day === day);
  return NextResponse.json({ notes });
}

/** Anyone in the plan can write on a day; everyone in the plan can read it. */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    planId?: unknown;
    day?: unknown;
    body?: unknown;
  };
  const planId = typeof body.planId === "string" ? body.planId : "";
  const day = Number(body.day);
  const text = typeof body.body === "string" ? body.body.trim() : "";
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
  if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });
  if (text.length > MAX_NOTE_LENGTH) {
    return NextResponse.json(
      { error: `Notes cap out at ${MAX_NOTE_LENGTH} characters.` },
      { status: 400 },
    );
  }

  await store.addNote(planId, me.id, day, text);
  return NextResponse.json(await readState());
}

/** You can delete your own note, and only your own. */
export async function DELETE(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const url = new URL(req.url);
  const planId = url.searchParams.get("planId") ?? "";
  const id = url.searchParams.get("id") ?? "";
  const store = getStore();

  if (!(await store.isMember(planId, me.id))) {
    return NextResponse.json({ error: "You are not in that plan." }, { status: 403 });
  }
  const removed = await store.deleteNote(planId, id, me.id);
  if (!removed) {
    return NextResponse.json({ error: "That note is not yours to delete." }, { status: 403 });
  }
  return NextResponse.json(await readState());
}
