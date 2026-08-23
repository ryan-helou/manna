import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * One person's reading, for the view you get by tapping them on the board.
 *
 * Fetched rather than shipped with the state: everybody's ticks in one payload
 * is exactly what we stopped doing, and this is a page you open occasionally
 * rather than something the app needs to have on hand.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; userId: string }> },
) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { id, userId } = await ctx.params;
  const store = getStore();
  // Only people in the plan can look at people in the plan.
  if (!(await store.isMember(id, me.id))) {
    return NextResponse.json({ error: "You are not in that plan." }, { status: 403 });
  }
  if (!(await store.isMember(id, userId))) {
    return NextResponse.json({ error: "They are not in this plan." }, { status: 404 });
  }

  const reads = (await store.listReads(id)).filter((r) => r.userId === userId);
  return NextResponse.json({ reads });
}
