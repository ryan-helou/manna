import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { readState } from "@/lib/state";

export const dynamic = "force-dynamic";

/** Grant or revoke edit rights on a plan. Only the creator may do this. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { id } = await ctx.params;
  const store = getStore();
  const plan = await store.getPlan(id);
  if (!plan) return NextResponse.json({ error: "No such plan." }, { status: 404 });
  if (plan.creatorId !== me.id) {
    return NextResponse.json(
      { error: "Only the person who made the plan can change who edits it." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { userId?: unknown; canEdit?: unknown };
  const userId = typeof body.userId === "string" ? body.userId : "";
  const canEdit = body.canEdit === true;
  if (!userId) return NextResponse.json({ error: "Which person?" }, { status: 400 });
  if (userId === plan.creatorId) {
    return NextResponse.json(
      { error: "The creator always keeps edit rights." },
      { status: 400 },
    );
  }
  if (!(await store.isMember(id, userId))) {
    return NextResponse.json({ error: "They are not in this plan." }, { status: 404 });
  }

  await store.setCanEdit(id, userId, canEdit);
  return NextResponse.json(await readState());
}

/** Remove someone from the plan, along with everything of theirs. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { id } = await ctx.params;
  const store = getStore();
  const plan = await store.getPlan(id);
  if (!plan) return NextResponse.json({ error: "No such plan." }, { status: 404 });
  if (plan.creatorId !== me.id) {
    return NextResponse.json(
      { error: "Only the person who made the plan can remove people." },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? "";
  if (userId === plan.creatorId) {
    return NextResponse.json(
      { error: "You cannot remove yourself from your own plan." },
      { status: 400 },
    );
  }
  if (!(await store.isMember(id, userId))) {
    return NextResponse.json({ error: "They are not in this plan." }, { status: 404 });
  }

  await store.removeMember(id, userId);
  return NextResponse.json(await readState());
}
