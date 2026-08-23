import "server-only";
import { cookies } from "next/headers";
import { getStore } from "./db";
import { currentUser } from "./session";
import { partition } from "./schedule";
import { allChapters } from "./bible";
import { weightOf } from "./weights";
import { planLengthDays } from "./dates";
import { pushConfigured } from "./push";
import { chaptersForDay, currentDay, verseOfTheDay } from "./progress";
import { quizForDay } from "./quiz";
import { fetchVerseText } from "./verse-text";
import { today } from "./dates";
import type { ActivePlan, AppState } from "./types";

/**
 * The whole app is one payload. Two readers and a year of ticks is a few
 * kilobytes, so the client holds everything and works out pace, streaks and
 * badges locally. The schedule travels as its cut points rather than as 1,189
 * chapter objects, because the client already has the canon and the weights
 * compiled into it.
 */

const ACTIVE_COOKIE = "manna_plan";

export async function setActivePlan(planId: string): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_COOKIE, planId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
}

/** Cut points for a plan. Recomputed from its duration, never stored. */
export function cutsFor(startDay: string, months: number): number[] {
  const weights = allChapters().map((c) => weightOf(c.book, c.chapter));
  return partition(weights, planLengthDays(startDay, months));
}

export async function readState(): Promise<AppState> {
  const store = getStore();
  const me = await currentUser();
  if (!me) {
    return { me: null, plans: [], active: null, verse: null, quiz: [], push: { configured: pushConfigured() } };
  }

  const plans = await store.listPlansFor(me.id);
  const jar = await cookies();
  const wanted = jar.get(ACTIVE_COOKIE)?.value;
  // Fall back to the first plan when the cookie points at one they have left.
  const chosen = plans.find((p) => p.id === wanted) ?? plans[0] ?? null;

  let active: ActivePlan | null = null;
  let verse: AppState["verse"] = null;
  let quiz: AppState["quiz"] = [];
  if (chosen) {
    const [plan, members, reads, notes] = await Promise.all([
      store.getPlan(chosen.id),
      store.listMembers(chosen.id),
      store.listReads(chosen.id),
      store.listNotes(chosen.id),
    ]);
    if (plan) {
      const mine = members.find((m) => m.id === me.id);
      active = {
        id: plan.id,
        name: plan.name,
        joinCode: plan.joinCode,
        months: plan.months,
        startDay: plan.startDay,
        translation: plan.translation,
        creatorId: plan.creatorId,
        canEdit: !!mine?.canEdit,
        members,
        cuts: cutsFor(plan.startDay, plan.months),
        reads,
        notes,
      };
      const day = currentDay(active, today(), me.id);
      quiz = quizForDay(active.id, day, chaptersForDay(active, day));
      const pick = verseOfTheDay(active, day);
      if (pick) {
        verse = {
          book: pick.ref.book,
          chapter: pick.ref.chapter,
          verse: pick.verse,
          text: await fetchVerseText(pick.ref, pick.verse, plan.translation),
        };
      }
    }
  }

  return { me, plans, active, verse, quiz, push: { configured: pushConfigured() } };
}
