import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { pushConfigured, sendToUser } from "@/lib/push";
import { cutsFor } from "@/lib/state";
import { today } from "@/lib/dates";
import { allChapters, formatRefs } from "@/lib/bible";
import { weightOf } from "@/lib/weights";
import { formatMinutes } from "@/lib/dates";
import { DEFAULT_REMINDER_HOUR } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Scheduled work, triggered by an external cron hitting this endpoint with the
 * shared secret.
 *   ?job=evening — nudge anyone whose chosen hour it is and who has not read
 *
 * Deduped per reader per day through the meta store, so a double fire never
 * double notifies. The marker is written per person as each nudge goes out
 * rather than once for the whole run: a run that sends nothing must not burn
 * the day for everyone, and a run that dies halfway must still nudge the people
 * it had not reached yet.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const job = url.searchParams.get("job");
  if (job !== "evening") {
    return NextResponse.json({ error: "Unknown job" }, { status: 400 });
  }
  if (!pushConfigured()) {
    return NextResponse.json({ ok: true, skipped: "push not configured" });
  }

  const store = getStore();
  await store.init();
  const now = today();
  // Runs hourly and sends only to the people who picked this hour, so a dozen
  // readers are not all nudged at seven whatever their evenings look like.
  const hour = new Date().getHours();

  // Walk every plan that has a member, and nudge the members who are short.
  const chapters = allChapters();
  const plans = await store.listAllPlans();
  let sent = 0;
  let skipped = 0;

  for (const plan of plans) {
    const cuts = cutsFor(plan.startDay, plan.months);
    const days = cuts.length - 1;

    const [members, reads] = await Promise.all([
      store.listMembers(plan.id),
      store.listReads(plan.id),
    ]);
    // Done means every chapter of the day, so a half-finished morning still
    // gets the nudge.
    const readKeys = new Set(reads.map((r) => `${r.userId}|${r.book} ${r.chapter}`));

    for (const m of members) {
      if ((m.reminderHour ?? DEFAULT_REMINDER_HOUR) !== hour) continue;
      // Readers keep their own day 1, so each is on their own day of the plan.
      const elapsed =
        Math.round((new Date(now).getTime() - new Date(m.startDay).getTime()) / 86_400_000) + 1;
      if (elapsed < 1 || elapsed > days) continue;
      const refs = chapters.slice(cuts[elapsed - 1], cuts[elapsed]);
      const minutes = refs.reduce((a, r) => a + weightOf(r.book, r.chapter), 0);
      const reading = formatRefs(refs);
      const finishedToday = (userId: string) =>
        refs.every((r) => readKeys.has(`${userId}|${r.book} ${r.chapter}`));
      if (finishedToday(m.id)) continue;
      const marker = `evening:${plan.id}:${m.id}:${now}`;
      if (await store.getMeta(marker)) {
        skipped += 1;
        continue;
      }
      // Who else is already done, so the nudge carries the friendly pressure
      // that makes this work at all.
      const others = members.filter((x) => x.id !== m.id && finishedToday(x.id));
      const tail =
        others.length === 1
          ? ` ${others[0].displayName} has already read.`
          : others.length > 1
            ? ` ${others.length} others have already read.`
            : "";
      await sendToUser(m.id, {
        title: `Today's reading is still open`,
        body: `${reading}, about ${formatMinutes(minutes)}.${tail}`,
        url: "/",
        tag: "evening",
      });
      await store.setMeta(marker, "1");
      sent += 1;
    }
  }

  return NextResponse.json({ ok: true, hour, plans: plans.length, sent, skipped });
}
