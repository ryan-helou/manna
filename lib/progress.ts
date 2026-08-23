import { allChapters, BOOKS, SECTIONS, type Ref } from "./bible";
import { weightOf } from "./weights";
import { verseCount } from "./verses";
import { addDays, daysBetween, type DayKey } from "./dates";
import type { ActivePlan, Completion } from "./types";

/**
 * Everything the app tells you about how a plan is going: what is due today,
 * whether you are ahead or behind, the streak, the stats and the badges.
 *
 * Kept pure and free of React or the database so it can be unit tested, which
 * matters because these are the numbers a person reads every morning.
 */

/** Expand the compact cut list back into a day-by-day schedule. */
export function scheduleFromCuts(cuts: number[]): Ref[][] {
  const chapters = allChapters();
  const out: Ref[][] = [];
  for (let d = 0; d + 1 < cuts.length; d++) out.push(chapters.slice(cuts[d], cuts[d + 1]));
  return out;
}

export const totalDays = (plan: ActivePlan): number => plan.cuts.length - 1;

/** Chapters due on a given 1-based plan day. */
export function chaptersForDay(plan: ActivePlan, day: number): Ref[] {
  if (day < 1 || day > totalDays(plan)) return [];
  return allChapters().slice(plan.cuts[day - 1], plan.cuts[day]);
}

export function minutesForDay(plan: ActivePlan, day: number): number {
  return chaptersForDay(plan, day).reduce((a, r) => a + weightOf(r.book, r.chapter), 0);
}

/** The calendar date a plan day falls on. */
export const dateOfDay = (plan: ActivePlan, day: number): DayKey =>
  addDays(plan.startDay, day - 1);

/**
 * Which plan day `today` is. Clamped into the plan: before it starts you are on
 * day 1, after it ends you are on the last day.
 */
export function currentDay(plan: ActivePlan, today: DayKey): number {
  const raw = daysBetween(plan.startDay, today) + 1;
  return Math.max(1, Math.min(totalDays(plan), raw));
}

/** True once the plan's final day is behind us. */
export const planEnded = (plan: ActivePlan, today: DayKey): boolean =>
  daysBetween(plan.startDay, today) + 1 > totalDays(plan);

const completionsOf = (plan: ActivePlan, userId: string): Completion[] =>
  plan.completions.filter((c) => c.userId === userId);

export const completedDays = (plan: ActivePlan, userId: string): Set<number> =>
  new Set(completionsOf(plan, userId).map((c) => c.day));

// ---------------------------------------------------------------------------
// Pace
// ---------------------------------------------------------------------------

export interface Pace {
  /** Plan days finished, however out of order they were ticked off. */
  done: number;
  /** Days that should be finished by the end of today. */
  expected: number;
  /** Positive means ahead, negative means behind. */
  delta: number;
  status: "ahead" | "on-pace" | "behind";
  /** Weighted minutes of reading still owed to catch up. Zero when not behind. */
  minutesBehind: number;
}

export function paceFor(plan: ActivePlan, userId: string, today: DayKey): Pace {
  const done = completedDays(plan, userId);
  const expected = currentDay(plan, today);
  const delta = done.size - expected;

  // Behind is measured in the reading actually missed, not in day count: three
  // skipped days of Chronicles is not the same debt as three of Romans.
  let minutesBehind = 0;
  if (delta < 0) {
    for (let d = 1; d <= expected; d++) {
      if (!done.has(d)) minutesBehind += minutesForDay(plan, d);
    }
  }
  return {
    done: done.size,
    expected,
    delta,
    status: delta > 0 ? "ahead" : delta === 0 ? "on-pace" : "behind",
    minutesBehind,
  };
}

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------

/**
 * Consecutive calendar days on which a reading was logged, counting back from
 * today. Yesterday still counts as alive, so opening the app before you have
 * read does not show the streak already broken. The day rolls over at 3 AM,
 * which `today` has already applied.
 */
export function streakFor(plan: ActivePlan, userId: string, today: DayKey): number {
  const logged = new Set(completionsOf(plan, userId).map((c) => c.completedOn));
  if (logged.size === 0) return 0;
  let cursor = logged.has(today) ? today : addDays(today, -1);
  if (!logged.has(cursor)) return 0;
  let n = 0;
  while (logged.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** The longest run of logged days the plan has ever seen for this reader. */
export function longestStreakFor(plan: ActivePlan, userId: string): number {
  const days = [...new Set(completionsOf(plan, userId).map((c) => c.completedOn))].sort();
  let best = 0;
  let run = 0;
  let prev: DayKey | null = null;
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    prev = d;
    if (run > best) best = run;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Running stats
// ---------------------------------------------------------------------------

export interface Stats {
  minutesInvested: number;
  chaptersRead: number;
  booksFinished: number;
  daysDone: number;
  totalDays: number;
  /** Share of the whole Bible's weighted minutes completed, 0..1. */
  fraction: number;
  /** Plan days completed per calendar day since the plan started. */
  averagePace: number;
  /** Where the current rate puts the finish, or null before there is a rate. */
  projectedFinish: DayKey | null;
}

export function statsFor(plan: ActivePlan, userId: string, today: DayKey): Stats {
  const done = completedDays(plan, userId);
  const days = totalDays(plan);

  let minutes = 0;
  let chapters = 0;
  const readChapters = new Set<string>();
  for (const d of done) {
    for (const r of chaptersForDay(plan, d)) {
      minutes += weightOf(r.book, r.chapter);
      chapters++;
      readChapters.add(`${r.book} ${r.chapter}`);
    }
  }

  let booksFinished = 0;
  for (const b of BOOKS) {
    let all = true;
    for (let c = 1; c <= b.chapters; c++) {
      if (!readChapters.has(`${b.name} ${c}`)) { all = false; break; }
    }
    if (all) booksFinished++;
  }

  const elapsed = Math.max(1, daysBetween(plan.startDay, today) + 1);
  const averagePace = done.size / elapsed;
  const remaining = days - done.size;
  const projectedFinish =
    done.size === 0 || averagePace <= 0
      ? null
      : addDays(today, Math.ceil(remaining / averagePace));

  const totalMinutes = allChapters().reduce((a, r) => a + weightOf(r.book, r.chapter), 0);
  return {
    minutesInvested: minutes,
    chaptersRead: chapters,
    booksFinished,
    daysDone: done.size,
    totalDays: days,
    fraction: totalMinutes ? minutes / totalMinutes : 0,
    averagePace,
    projectedFinish,
  };
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export interface Milestone {
  id: string;
  label: string;
  earned: boolean;
  /** Chapters done out of the section's total, for the ones still in progress. */
  done: number;
  total: number;
}

export function milestonesFor(plan: ActivePlan, userId: string): Milestone[] {
  const read = new Set<string>();
  for (const d of completedDays(plan, userId)) {
    for (const r of chaptersForDay(plan, d)) read.add(`${r.book} ${r.chapter}`);
  }
  return SECTIONS.map((s) => {
    let done = 0;
    let total = 0;
    for (const name of s.books) {
      const book = BOOKS.find((b) => b.name === name)!;
      total += book.chapters;
      for (let c = 1; c <= book.chapters; c++) if (read.has(`${name} ${c}`)) done++;
    }
    return { id: s.id, label: s.label, earned: done === total, done, total };
  });
}

// ---------------------------------------------------------------------------
// Head to head
// ---------------------------------------------------------------------------

export interface Standing {
  userId: string;
  displayName: string;
  daysDone: number;
  minutes: number;
  streak: number;
  pace: Pace;
}

export function standings(plan: ActivePlan, today: DayKey): Standing[] {
  return plan.members
    .map((m) => {
      const s = statsFor(plan, m.id, today);
      return {
        userId: m.id,
        displayName: m.displayName,
        daysDone: s.daysDone,
        minutes: s.minutesInvested,
        streak: streakFor(plan, m.id, today),
        pace: paceFor(plan, m.id, today),
      };
    })
    .sort((a, b) => b.daysDone - a.daysDone || b.minutes - a.minutes);
}

// ---------------------------------------------------------------------------
// Verse of the day
// ---------------------------------------------------------------------------

/**
 * One verse from today's reading, the same for everyone in the plan. Chosen by
 * hashing the plan id and the day so it is stable, shared, and not the first
 * verse of the chapter every single morning.
 */
export function verseOfTheDay(plan: ActivePlan, day: number): { ref: Ref; verse: number } | null {
  const chapters = chaptersForDay(plan, day);
  if (chapters.length === 0) return null;
  let h = 2166136261;
  for (const ch of `${plan.id}:${day}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // Weight the pick towards the heavier chapter of the day: that is where the
  // line worth carrying around usually is.
  const weights = chapters.map((r) => weightOf(r.book, r.chapter));
  const total = weights.reduce((a, b) => a + b, 0);
  let target = (h % total) + 1;
  let idx = 0;
  for (let i = 0; i < chapters.length; i++) {
    target -= weights[i];
    if (target <= 0) { idx = i; break; }
  }
  const ref = chapters[idx];
  // A second pass of the hash picks the verse, bounded by how many the chapter
  // actually has: Psalm 117 has two, and pointing at verse nine of it would be
  // a broken link every time it came round.
  const verse = ((Math.imul(h, 2654435761) >>> 0) % verseCount(ref.book, ref.chapter)) + 1;
  return { ref, verse };
}
