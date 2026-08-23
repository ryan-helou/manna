import { allChapters, BOOKS, SECTIONS, type Ref } from "./bible";
import { weightOf } from "./weights";
import { versePick } from "./verse-picks";
import { addDays, daysBetween, type DayKey } from "./dates";
import type { ActivePlan, ChapterRead, Standing } from "./types";

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

/**
 * When this reader's day 1 falls. Everyone reads the same schedule, but a late
 * joiner starts at the beginning of it on the day they join rather than being
 * dropped into the middle already behind.
 */
export function startDayFor(plan: ActivePlan, userId: string): DayKey {
  return plan.members.find((m) => m.id === userId)?.startDay ?? plan.startDay;
}

/** The calendar date a plan day falls on, for this reader. */
export const dateOfDay = (plan: ActivePlan, day: number, userId: string): DayKey =>
  addDays(startDayFor(plan, userId), day - 1);

/**
 * Which plan day `today` is for this reader. Clamped into the plan: before it
 * starts you are on day 1, after it ends you are on the last day.
 */
export function currentDay(plan: ActivePlan, today: DayKey, userId: string): number {
  const raw = daysBetween(startDayFor(plan, userId), today) + 1;
  return Math.max(1, Math.min(totalDays(plan), raw));
}

/** True once this reader's final day is behind them. */
export const planEnded = (plan: ActivePlan, today: DayKey, userId: string): boolean =>
  daysBetween(startDayFor(plan, userId), today) + 1 > totalDays(plan);

const readsOf = (plan: ActivePlan, userId: string): ChapterRead[] =>
  plan.reads.filter((r) => r.userId === userId);

const key = (book: string, chapter: number) => `${book} ${chapter}`;

/** Every chapter this reader has ticked, as "Book N". */
export function readChapters(plan: ActivePlan, userId: string): Set<string> {
  return new Set(readsOf(plan, userId).map((r) => key(r.book, r.chapter)));
}

export function isChapterRead(plan: ActivePlan, userId: string, ref: Ref): boolean {
  return plan.reads.some(
    (r) => r.userId === userId && r.book === ref.book && r.chapter === ref.chapter,
  );
}

/** How much of a day is done, in chapters. */
export function dayProgress(
  plan: ActivePlan,
  userId: string,
  day: number,
): { done: number; total: number } {
  return dayProgressWith(readChapters(plan, userId), plan, day);
}

/**
 * The same, given a set you already built. The heatmap asks this for every day
 * of the plan at once, and rebuilding the reader's whole set of chapters inside
 * each of four hundred cells is four hundred times more work than it needs.
 */
export function dayProgressWith(
  read: Set<string>,
  plan: ActivePlan,
  day: number,
): { done: number; total: number } {
  const chapters = chaptersForDay(plan, day);
  let done = 0;
  for (const c of chapters) if (read.has(key(c.book, c.chapter))) done++;
  return { done, total: chapters.length };
}

export function dayComplete(plan: ActivePlan, userId: string, day: number): boolean {
  const { done, total } = dayProgress(plan, userId, day);
  return total > 0 && done === total;
}

/** Every plan day this reader has finished outright. */
export function completedDays(plan: ActivePlan, userId: string): Set<number> {
  const read = readChapters(plan, userId);
  const out = new Set<number>();
  for (let d = 1; d <= totalDays(plan); d++) {
    const chapters = chaptersForDay(plan, d);
    if (chapters.length && chapters.every((c) => read.has(key(c.book, c.chapter)))) out.add(d);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pace
// ---------------------------------------------------------------------------

export interface Pace {
  /** Plan days finished, however out of order they were ticked off. */
  done: number;
  /** Days already past. Today is not one of them until it is over. */
  expected: number;
  /** Positive means ahead, negative means behind. */
  delta: number;
  status: "ahead" | "on-pace" | "behind";
  /** Weighted minutes of reading still owed to catch up. Zero when not behind. */
  minutesBehind: number;
}

/**
 * Where you stand.
 *
 * Judged on the days that are actually over, never on today. Today's reading is
 * due by tonight, not by the moment you open the app, and an earlier version
 * counted it immediately: it greeted you at seven in the morning on day one,
 * before you had read a word, with "one day behind". Finishing today reads as on
 * pace; only genuinely skipped days put you behind, and reading past today puts
 * you ahead.
 */
export function paceFor(plan: ActivePlan, userId: string, today: DayKey): Pace {
  const done = completedDays(plan, userId);
  const read = readChapters(plan, userId);
  const cur = currentDay(plan, today, userId);
  const pastDue = cur - 1;

  let missedDays = 0;
  for (let d = 1; d <= pastDue; d++) if (!done.has(d)) missedDays++;
  const aheadDays = missedDays === 0 ? Math.max(0, done.size - cur) : 0;
  const delta = missedDays > 0 ? -missedDays : aheadDays;

  // The debt is the reading actually missed, not a day count: three skipped days
  // of Chronicles is not the same as three of Romans. Counted per chapter, so a
  // half-finished day only owes its remaining half.
  let minutesBehind = 0;
  if (missedDays > 0) {
    for (let d = 1; d <= pastDue; d++) {
      for (const c of chaptersForDay(plan, d)) {
        if (!read.has(key(c.book, c.chapter))) minutesBehind += weightOf(c.book, c.chapter);
      }
    }
  }
  return {
    done: done.size,
    expected: pastDue,
    delta,
    status: delta > 0 ? "ahead" : delta === 0 ? "on-pace" : "behind",
    minutesBehind,
  };
}

/**
 * The days that are over and unfinished, earliest first.
 *
 * `paceFor` has always worked this out in order to say "three days behind" and
 * then thrown the list away, leaving the reader to hunt for them a day at a
 * time with the back arrow. Same walk, list kept.
 */
export function missedDays(plan: ActivePlan, userId: string, today: DayKey): number[] {
  const done = completedDays(plan, userId);
  const pastDue = currentDay(plan, today, userId) - 1;
  const out: number[] = [];
  for (let d = 1; d <= pastDue; d++) if (!done.has(d)) out.push(d);
  return out;
}

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------

/**
 * Consecutive calendar days on which something was read, counting back from
 * today. Yesterday still counts as alive, so opening the app before you have
 * read does not show the streak already broken. The day rolls over at 3 AM,
 * which `today` has already applied.
 */
export function streakFor(plan: ActivePlan, userId: string, today: DayKey): number {
  const logged = new Set(readsOf(plan, userId).map((r) => r.readOn));
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

/** The longest run of days with reading logged that this plan has ever seen. */
export function longestStreakFor(plan: ActivePlan, userId: string): number {
  const days = [...new Set(readsOf(plan, userId).map((r) => r.readOn))].sort();
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
  /** Plan days completed per calendar day since this reader started. */
  averagePace: number;
  /** Where the current rate puts the finish, or null before there is a rate. */
  projectedFinish: DayKey | null;
}

export function statsFor(plan: ActivePlan, userId: string, today: DayKey): Stats {
  const read = readChapters(plan, userId);
  const days = totalDays(plan);

  // Straight off the chapters read, so it stays true when the plan length moves.
  let minutes = 0;
  for (const k of read) {
    const i = k.lastIndexOf(" ");
    minutes += weightOf(k.slice(0, i), Number(k.slice(i + 1)));
  }

  let booksFinished = 0;
  for (const b of BOOKS) {
    let all = true;
    for (let c = 1; c <= b.chapters; c++) {
      if (!read.has(key(b.name, c))) { all = false; break; }
    }
    if (all) booksFinished++;
  }

  const daysDone = completedDays(plan, userId).size;
  const elapsed = Math.max(1, daysBetween(startDayFor(plan, userId), today) + 1);
  const averagePace = daysDone / elapsed;
  const remaining = days - daysDone;
  const projectedFinish =
    daysDone === 0 || averagePace <= 0 ? null : addDays(today, Math.ceil(remaining / averagePace));

  const totalMinutes = allChapters().reduce((a, r) => a + weightOf(r.book, r.chapter), 0);
  return {
    minutesInvested: minutes,
    chaptersRead: read.size,
    booksFinished,
    daysDone,
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
  const read = readChapters(plan, userId);
  return SECTIONS.map((s) => {
    let done = 0;
    let total = 0;
    for (const name of s.books) {
      const book = BOOKS.find((b) => b.name === name)!;
      total += book.chapters;
      for (let c = 1; c <= book.chapters; c++) if (read.has(key(name, c))) done++;
    }
    return { id: s.id, label: s.label, earned: done === total, done, total };
  });
}

// ---------------------------------------------------------------------------
// The group
// ---------------------------------------------------------------------------

/**
 * Everyone's position, worked out from the full set of reads.
 *
 * Runs on the server. The client is given the result rather than the raw ticks,
 * because twelve people's ticks are close to a megabyte and this is the only
 * thing they were ever used for.
 */
export function computeStandings(
  plan: Omit<ActivePlan, "reads" | "standings" | "notes">,
  allReads: ChapterRead[],
  today: DayKey,
): Standing[] {
  const byUser = new Map<string, ChapterRead[]>();
  for (const r of allReads) {
    if (!byUser.has(r.userId)) byUser.set(r.userId, []);
    byUser.get(r.userId)!.push(r);
  }

  return plan.members
    .map((m) => {
      // A view of the plan holding just this person's reads, so the same
      // functions that answer for you answer for them.
      const view = {
        ...plan,
        reads: byUser.get(m.id) ?? [],
        standings: [],
        notes: [],
      } as ActivePlan;
      const stats = statsFor(view, m.id, today);
      const pace = paceFor(view, m.id, today);
      const day = currentDay(view, today, m.id);
      const progress = dayProgress(view, m.id, day);
      return {
        userId: m.id,
        displayName: m.displayName,
        daysDone: stats.daysDone,
        chaptersRead: stats.chaptersRead,
        minutes: stats.minutesInvested,
        streak: streakFor(view, m.id, today),
        delta: pace.delta,
        status: pace.status,
        day,
        readToday: progress.total > 0 && progress.done === progress.total,
      };
    })
    .sort((a, b) => b.daysDone - a.daysDone || b.chaptersRead - a.chaptersRead);
}

// ---------------------------------------------------------------------------
// Verse of the day
// ---------------------------------------------------------------------------

/**
 * One verse from the day's reading, the same for everyone on that day.
 *
 * Every chapter carries a pre-scored best verse: the line that survives being
 * lifted out of its paragraph. We take the strongest of the day's chapters, so
 * a morning in Leviticus surfaces the one thing worth carrying rather than a
 * measurement. Ties break towards the earlier chapter, keeping it deterministic.
 */
export function verseOfTheDay(plan: ActivePlan, day: number): { ref: Ref; verse: number } | null {
  const chapters = chaptersForDay(plan, day);
  if (chapters.length === 0) return null;
  let best: { ref: Ref; verse: number; score: number } | null = null;
  for (const ref of chapters) {
    const pick = versePick(ref.book, ref.chapter);
    if (!best || pick.score > best.score) best = { ref, verse: pick.verse, score: pick.score };
  }
  return best ? { ref: best.ref, verse: best.verse } : null;
}
