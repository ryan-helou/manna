import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { readState } from "@/lib/state";
import { isTranslation } from "@/lib/bible";
import { isMonths, MAX_MONTHS, MAX_NAME_LENGTH, MIN_MONTHS } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Plan settings. The creator can always edit; anyone else needs the per-person
 * flag the creator granted them. Changing the duration regenerates the schedule
 * implicitly, because the schedule is derived from it rather than stored.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { id } = await ctx.params;
  const store = getStore();
  const plan = await store.getPlan(id);
  if (!plan) return NextResponse.json({ error: "No such plan." }, { status: 404 });

  const members = await store.listMembers(id);
  const mine = members.find((m) => m.id === me.id);
  if (!mine) return NextResponse.json({ error: "You are not in that plan." }, { status: 403 });
  if (!mine.canEdit) {
    return NextResponse.json({ error: "You do not have edit rights on this plan." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown;
    months?: unknown;
    translation?: unknown;
  };
  const patch: { name?: string; months?: number; translation?: "ESV" | "NKJV" } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > MAX_NAME_LENGTH) {
      return NextResponse.json({ error: "Give the plan a name." }, { status: 400 });
    }
    patch.name = name;
  }
  if (body.months !== undefined) {
    const months = Number(body.months);
    if (!isMonths(months)) {
      return NextResponse.json(
        { error: `Pick a length between ${MIN_MONTHS} and ${MAX_MONTHS} months.` },
        { status: 400 },
      );
    }
    patch.months = months;
  }
  if (body.translation !== undefined) {
    if (!isTranslation(body.translation)) {
      return NextResponse.json({ error: "Pick ESV or NKJV." }, { status: 400 });
    }
    patch.translation = body.translation;
  }

  await store.updatePlan(id, patch);
  return NextResponse.json(await readState());
}
