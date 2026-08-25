import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser, isAdmin } from "@/lib/session";
import { readState } from "@/lib/state";

export const dynamic = "force-dynamic";

/** Grant or revoke edit rights on a plan. The creator, or the admin. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { id } = await ctx.params;
  const store = getStore();
  const plan = await store.getPlan(id);
  if (!plan) return NextResponse.json({ error: "No such plan." }, { status: 404 });
  if (plan.creatorId !== me.id && !isAdmin(me)) {
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

/**
 * Remove someone from the plan, along with everything of theirs.
 *
 * The plan's creator, or the admin, who can moderate any plan rather than only
 * the ones they started. Neither can remove a plan's creator: the plan hangs off
 * that account, and taking it out would leave the whole thing orphaned.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { id } = await ctx.params;
  const store = getStore();
  const plan = await store.getPlan(id);
  if (!plan) return NextResponse.json({ error: "No such plan." }, { status: 404 });
  if (plan.creatorId !== me.id && !isAdmin(me)) {
    return NextResponse.json(
      { error: "Only the person who made the plan can remove people." },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? "";
  if (userId === plan.creatorId) {
    return NextResponse.json(
      {
        error:
          userId === me.id
            ? "You cannot remove yourself from your own plan."
            : "The person who started this plan cannot be removed from it.",
      },
      { status: 400 },
    );
  }
  if (!(await store.isMember(id, userId))) {
    return NextResponse.json({ error: "They are not in this plan." }, { status: 404 });
  }

  await store.removeMember(id, userId);
  return NextResponse.json(await readState());
}
