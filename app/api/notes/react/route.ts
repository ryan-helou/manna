import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { readState } from "@/lib/state";
import { isReaction } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Leave a reaction on a note, or take it back. The same call does both. */
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    planId?: unknown;
    noteId?: unknown;
    emoji?: unknown;
  };
  const planId = typeof body.planId === "string" ? body.planId : "";
  const noteId = typeof body.noteId === "string" ? body.noteId : "";
  const store = getStore();

  if (!(await store.isMember(planId, me.id))) {
    return NextResponse.json({ error: "You are not in that plan." }, { status: 403 });
  }
  // Only the six the app offers. An open field here would put arbitrary text
  // from one reader onto everyone else's screen.
  if (!isReaction(body.emoji)) {
    return NextResponse.json({ error: "That is not one of the reactions." }, { status: 400 });
  }
  if (!noteId) return NextResponse.json({ error: "Which note?" }, { status: 400 });

  await store.toggleReaction(planId, noteId, me.id, body.emoji);
  return NextResponse.json(await readState());
}
