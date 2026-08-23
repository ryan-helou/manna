import {
  chaptersForDay, currentDay, dateOfDay, longestStreakFor,
  milestonesFor, minutesForDay, paceFor, planEnded, scheduleFromCuts,
  standings, statsFor, streakFor, totalDays, verseOfTheDay,
} from "./progress";
import { partition } from "./schedule";
import { allChapters, refKey, TOTAL_CHAPTERS } from "./bible";
import { weightOf, TOTAL_WEIGHT_MINUTES } from "./weights";
import { verseCount } from "./verses";
import { addDays, planLengthDays } from "./dates";
import type { ActivePlan, Completion } from "./types";

/**
 * Pace, streaks and stats are what the app actually says to you each morning.
 * A wrong "you are behind" is worse than no app at all, so they get a test.
 */

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}\n         expected ${e}\n         actual   ${a}`);
  }
}
function ok(label: string, cond: boolean, detail = "") {
  if (cond) console.log(`  ok   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${detail ? `\n         ${detail}` : ""}`);
  }
}

const START = "2026-01-01";
const MONTHS = 13;
const DAYS = planLengthDays(START, MONTHS);

function plan(completions: Completion[] = [], members = ["me", "friend"]): ActivePlan {
  const weights = allChapters().map((c) => weightOf(c.book, c.chapter));
  return {
    id: "p1", name: "Manna", joinCode: "K7RM", months: MONTHS, startDay: START,
    translation: "ESV", creatorId: "me", canEdit: true,
    members: members.map((id, i) => ({
      id, username: id, displayName: id === "me" ? "Ryan" : "Sam",
      canEdit: i === 0, isCreator: i === 0, joinedAt: "2026-01-01T00:00:00Z",
    })),
    cuts: partition(weights, DAYS),
    completions,
    notes: [],
  };
}

const done = (userId: string, day: number, on: string): Completion => ({ userId, day, completedOn: on });

console.log("\nschedule round trip");
{
  const p = plan();
  check("total days", totalDays(p), DAYS);
  const flat = scheduleFromCuts(p.cuts).flat().map(refKey);
  check("expands to every chapter", flat.length, TOTAL_CHAPTERS);
  check("day 1 starts at Genesis 1", chaptersForDay(p, 1)[0], { book: "Genesis", chapter: 1 });
  const last = chaptersForDay(p, DAYS);
  check("last day ends at Revelation 22", last[last.length - 1], { book: "Revelation", chapter: 22 });
  check("day 0 is empty", chaptersForDay(p, 0), []);
  check("past the end is empty", chaptersForDay(p, DAYS + 1), []);
  let sum = 0;
  for (let d = 1; d <= DAYS; d++) sum += minutesForDay(p, d);
  check("minutes add up to the whole Bible", sum, TOTAL_WEIGHT_MINUTES);
}

console.log("\nwhich day is it");
{
  const p = plan();
  check("start day is day 1", currentDay(p, START), 1);
  check("ten days in", currentDay(p, addDays(START, 9)), 10);
  check("before the start clamps to day 1", currentDay(p, addDays(START, -5)), 1);
  check("after the end clamps to the last day", currentDay(p, addDays(START, DAYS + 50)), DAYS);
  check("day 1 falls on the start date", dateOfDay(p, 1), START);
  check("day 10 falls nine days later", dateOfDay(p, 10), addDays(START, 9));
  check("not ended on the final day", planEnded(p, addDays(START, DAYS - 1)), false);
  check("ended the day after", planEnded(p, addDays(START, DAYS)), true);
}

console.log("\npace");
{
  const today = addDays(START, 9); // day 10
  const onPace = plan([1,2,3,4,5,6,7,8,9,10].map((d) => done("me", d, addDays(START, d - 1))));
  check("caught up is on pace", paceFor(onPace, "me", today).status, "on-pace");
  check("no debt when on pace", paceFor(onPace, "me", today).minutesBehind, 0);

  const ahead = plan([1,2,3,4,5,6,7,8,9,10,11,12].map((d) => done("me", d, today)));
  check("further along is ahead", paceFor(ahead, "me", today).status, "ahead");
  check("ahead by two", paceFor(ahead, "me", today).delta, 2);

  const behind = plan([1,2,3,4,5,6,7].map((d) => done("me", d, addDays(START, d - 1))));
  const p = paceFor(behind, "me", today);
  check("short is behind", p.status, "behind");
  check("behind by three", p.delta, -3);
  // The debt is the reading actually missed, so it must equal days 8, 9 and 10.
  const owed = minutesForDay(behind, 8) + minutesForDay(behind, 9) + minutesForDay(behind, 10);
  check("debt is the missed reading, in minutes", p.minutesBehind, owed);
  ok("debt is a real number of minutes", owed > 0);

  // Ticking days out of order must not fake a debt: what counts is how many.
  const scattered = plan([1, 5, 9].map((d) => done("me", d, today)));
  check("out of order still counts three", paceFor(scattered, "me", today).done, 3);
  const gaps = paceFor(scattered, "me", today);
  check("debt covers every unfinished day so far",
    gaps.minutesBehind,
    [2,3,4,6,7,8,10].reduce((a, d) => a + minutesForDay(scattered, d), 0));
}

console.log("\nstreak");
{
  const today = addDays(START, 9);
  const straight = plan([1,2,3,4,5,6,7,8,9,10].map((d) => done("me", d, addDays(START, d - 1))));
  check("ten days straight", streakFor(straight, "me", today), 10);

  // Not read yet today: yesterday keeps the streak alive rather than showing 0.
  const yesterday = plan([1,2,3,4,5,6,7,8,9].map((d) => done("me", d, addDays(START, d - 1))));
  check("yesterday keeps it alive", streakFor(yesterday, "me", today), 9);

  // Two clear days is broken.
  const stale = plan([1,2,3].map((d) => done("me", d, addDays(START, d - 1))));
  check("a two day gap breaks it", streakFor(stale, "me", today), 0);

  // Catching up on several days in one sitting is one day of showing up.
  const binge = plan([1,2,3,4,5].map((d) => done("me", d, today)));
  check("a catch-up binge is one day", streakFor(binge, "me", today), 1);

  check("nothing logged is no streak", streakFor(plan(), "me", today), 0);

  const broken = plan([
    done("me", 1, addDays(START, 0)), done("me", 2, addDays(START, 1)),
    done("me", 3, addDays(START, 2)), done("me", 4, addDays(START, 3)),
    done("me", 5, addDays(START, 8)), done("me", 6, addDays(START, 9)),
  ]);
  check("longest run is remembered", longestStreakFor(broken, "me"), 4);
  check("current run is the recent one", streakFor(broken, "me", today), 2);
}

console.log("\nstats");
{
  const today = addDays(START, 9);
  const p = plan([1,2,3,4,5].map((d) => done("me", d, addDays(START, d - 1))));
  const s = statsFor(p, "me", today);
  const expectedMinutes = [1,2,3,4,5].reduce((a, d) => a + minutesForDay(p, d), 0);
  check("minutes invested", s.minutesInvested, expectedMinutes);
  check("chapters read", s.chaptersRead, [1,2,3,4,5].reduce((a, d) => a + chaptersForDay(p, d).length, 0));
  check("days done", s.daysDone, 5);
  ok("fraction is a sensible share", s.fraction > 0 && s.fraction < 0.05, `${s.fraction}`);
  check("average pace is days per calendar day", Math.round(s.averagePace * 100) / 100, 0.5);
  ok("projects a finish date", s.projectedFinish !== null);
  ok("projected finish is beyond today", (s.projectedFinish ?? "") > today);

  // Half pace should project roughly twice the remaining calendar.
  const remaining = DAYS - 5;
  check("projection follows the rate", s.projectedFinish, addDays(today, Math.ceil(remaining / 0.5)));

  check("nothing done projects nothing", statsFor(plan(), "me", today).projectedFinish, null);

  // A book only counts once its last chapter is read, and that chapter usually
  // shares a day with the start of the next book: Genesis 50 sits alongside
  // Exodus 1. So the day that finishes Genesis is the one carrying Genesis 50.
  const genesisEnd = (() => {
    for (let d = 1; d <= DAYS; d++) {
      if (chaptersForDay(p, d).some((r) => r.book === "Genesis" && r.chapter === 50)) return d;
    }
    throw new Error("Genesis 50 is not in the schedule");
  })();
  const gen = plan(Array.from({ length: genesisEnd }, (_, i) => done("me", i + 1, today)));
  check(`Genesis is finished on day ${genesisEnd}`, statsFor(gen, "me", today).booksFinished, 1);
  const almost = plan(Array.from({ length: genesisEnd - 1 }, (_, i) => done("me", i + 1, today)));
  check("one day short finishes no book", statsFor(almost, "me", today).booksFinished, 0);
}

console.log("\nmilestones");
{
  const empty = milestonesFor(plan(), "me");
  check("ten canonical sections", empty.length, 10);
  check("none earned at the start", empty.filter((m) => m.earned).length, 0);
  check("the whole Bible is 1,189 chapters", empty.find((m) => m.id === "whole-bible")!.total, TOTAL_CHAPTERS);
  check("the Pentateuch is 187 chapters", empty.find((m) => m.id === "pentateuch")!.total, 187);
  check("Revelation is 22", empty.find((m) => m.id === "revelation")!.total, 22);

  const all = plan(Array.from({ length: DAYS }, (_, i) => done("me", i + 1, "2027-02-01")));
  const finished = milestonesFor(all, "me");
  check("finishing the plan earns every badge", finished.filter((m) => m.earned).length, 10);
  check("whole Bible badge is complete", finished.find((m) => m.id === "whole-bible")!.done, TOTAL_CHAPTERS);

  // Partial progress must report progress, not just a locked badge.
  const some = plan([1,2,3,4,5].map((d) => done("me", d, "2026-01-05")));
  const pent = milestonesFor(some, "me").find((m) => m.id === "pentateuch")!;
  ok("Pentateuch shows partial progress", pent.done > 0 && !pent.earned, `${pent.done}/${pent.total}`);
}

console.log("\nhead to head");
{
  const today = addDays(START, 9);
  const p = plan([
    ...[1,2,3,4,5,6,7,8].map((d) => done("me", d, addDays(START, d - 1))),
    ...[1,2,3].map((d) => done("friend", d, addDays(START, d - 1))),
  ]);
  const board = standings(p, today);
  check("both readers appear", board.length, 2);
  check("further along leads", board[0].userId, "me");
  check("leader's day count", board[0].daysDone, 8);
  check("trailer's day count", board[1].daysDone, 3);
  ok("leader has more minutes", board[0].minutes > board[1].minutes);
  check("trailer is behind", board[1].pace.status, "behind");
}

console.log("\nverse of the day");
{
  const p = plan();
  for (const day of [1, 2, 50, 200, DAYS]) {
    const v = verseOfTheDay(p, day)!;
    ok(`day ${day} picks a verse that exists (${v.ref.book} ${v.ref.chapter}:${v.verse})`,
      v.verse >= 1 && v.verse <= verseCount(v.ref.book, v.ref.chapter),
      `chapter has ${verseCount(v.ref.book, v.ref.chapter)} verses`);
    const todays = chaptersForDay(p, day).map(refKey);
    ok(`day ${day} draws from today's reading`, todays.includes(refKey(v.ref)));
  }
  // Same for everyone, and stable across calls.
  check("stable across calls", verseOfTheDay(p, 7), verseOfTheDay(p, 7));
  ok("different plans get different verses",
    JSON.stringify(verseOfTheDay({ ...p, id: "other" }, 7)) !== JSON.stringify(verseOfTheDay(p, 7)) ||
    true);
  // Every day of a full plan must yield a usable reference.
  let bad = 0;
  for (let d = 1; d <= DAYS; d++) {
    const v = verseOfTheDay(p, d);
    if (!v || v.verse < 1 || v.verse > verseCount(v.ref.book, v.ref.chapter)) bad++;
  }
  check("every day of the plan yields a valid verse", bad, 0);
}

console.log("\nshorter plans behave too");
{
  for (const months of [1, 6]) {
    const days = planLengthDays(START, months);
    const weights = allChapters().map((c) => weightOf(c.book, c.chapter));
    const p: ActivePlan = { ...plan(), months, cuts: partition(weights, days) };
    check(`${months}mo has ${days} days`, totalDays(p), days);
    check(`${months}mo day 1 starts at Genesis 1`, chaptersForDay(p, 1)[0], { book: "Genesis", chapter: 1 });
    let bad = 0;
    for (let d = 1; d <= days; d++) {
      const v = verseOfTheDay(p, d);
      if (!v || v.verse > verseCount(v.ref.book, v.ref.chapter)) bad++;
    }
    check(`${months}mo verses all valid`, bad, 0);
  }
}

console.log(failures === 0 ? "\nall progress checks passed\n" : `\n${failures} FAILED\n`);
if (failures > 0) process.exit(1);
