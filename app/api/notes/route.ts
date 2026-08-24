import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { cutsFor, readState } from "@/lib/state";
import { MAX_NOTE_LENGTH } from "@/lib/types";
import { allChapters } from "@/lib/bible";
import { buildThreads } from "@/lib/notes";

export const dynamic = "force-dynamic";

/**
 * The threads on one day, replies and reactions included.
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
  const plan = await store.getPlan(planId);
  if (!plan) return NextResponse.json({ error: "No such plan." }, { status: 404 });
  if (!Number.isInteger(day) || day < 1) {
    return NextResponse.json({ error: "That day is not in the plan." }, { status: 400 });
  }

  const [all, reactions, members] = await Promise.all([
    store.listNotes(planId),
    store.listReactions(planId),
    store.listMembers(planId),
  ]);
  const notes = buildThreads(
    all.filter((n) => n.day === day),
    reactions,
    members,
    cutsFor(plan.startDay, plan.months),
  );
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
    parentId?: unknown;
    book?: unknown;
    chapter?: unknown;
  };
  const planId = typeof body.planId === "string" ? body.planId : "";
  const day = Number(body.day);
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const parentId = typeof body.parentId === "string" ? body.parentId : null;
  const store = getStore();

  if (!(await store.isMember(planId, me.id))) {
    return NextResponse.json({ error: "You are not in that plan." }, { status: 403 });
  }
  const plan = await store.getPlan(planId);
  if (!plan) return NextResponse.json({ error: "No such plan." }, { status: 404 });

  // A reply carries no day of its own: it inherits the one its parent is on.
  // Checking the day first rejected every reply ever posted.
  const days = cutsFor(plan.startDay, plan.months).length - 1;
  if (!parentId && (!Number.isInteger(day) || day < 1 || day > days)) {
    return NextResponse.json({ error: "That day is not in the plan." }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });
  if (text.length > MAX_NOTE_LENGTH) {
    return NextResponse.json(
      { error: `Notes cap out at ${MAX_NOTE_LENGTH} characters.` },
      { status: 400 },
    );
  }

  // A note may be about one chapter rather than the whole day's reading. The
  // chapter has to be one actually on that day, or the note would appear under
  // a passage nobody read.
  let ref: { book: string; chapter: number } | null = null;
  if (!parentId && typeof body.book === "string" && body.chapter !== undefined) {
    const chapter = Number(body.chapter);
    const cuts = cutsFor(plan.startDay, plan.months);
    const onThisDay = allChapters()
      .slice(cuts[day - 1], cuts[day])
      .some((r) => r.book === body.book && r.chapter === chapter);
    if (!onThisDay) {
      return NextResponse.json(
        { error: "That chapter is not in this day's reading." },
        { status: 400 },
      );
    }
    ref = { book: body.book, chapter };
  }

  if (parentId) {
    // Threads stay one level deep: replying to a reply attaches to the note it
    // was answering, so a conversation never becomes a tree nobody can follow.
    const notes = await store.listNotes(planId);
    const parent = notes.find((n) => n.id === parentId);
    if (!parent) {
      return NextResponse.json({ error: "That note is gone." }, { status: 404 });
    }
    await store.addNote(planId, me.id, parent.day, text, parent.parentId ?? parent.id);
  } else {
    await store.addNote(planId, me.id, day, text, null, ref);
  }
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
