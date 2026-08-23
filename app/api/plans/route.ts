import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { readState, setActivePlan } from "@/lib/state";
import { DEFAULT_TRANSLATION, isTranslation } from "@/lib/bible";
import { today } from "@/lib/dates";
import { isMonths, MAX_MONTHS, MAX_NAME_LENGTH, MIN_MONTHS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown;
    months?: unknown;
    translation?: unknown;
  };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const months = Number(body.months);
  const translation = isTranslation(body.translation) ? body.translation : DEFAULT_TRANSLATION;

  if (!name || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json(
      { error: `Give the plan a name, up to ${MAX_NAME_LENGTH} characters.` },
      { status: 400 },
    );
  }
  if (!isMonths(months)) {
    return NextResponse.json(
      { error: `Pick a length between ${MIN_MONTHS} and ${MAX_MONTHS} months.` },
      { status: 400 },
    );
  }

  const store = getStore();
  const plan = await store.createPlan({
    name,
    months,
    startDay: today(),
    translation,
    creatorId: me.id,
  });
  await store.addMember(plan.id, me.id, true);
  await setActivePlan(plan.id);
  return NextResponse.json(await readState());
}
