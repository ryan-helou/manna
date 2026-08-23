import {
  chaptersForDay, currentDay, dateOfDay, dayComplete, dayProgress,
  longestStreakFor, milestonesFor, minutesForDay, paceFor, planEnded,
  computeStandings, scheduleFromCuts, statsFor, streakFor, totalDays, verseOfTheDay,
} from "./progress";
import { partition } from "./schedule";
import { allChapters, refKey, TOTAL_CHAPTERS } from "./bible";
import { weightOf, TOTAL_WEIGHT_MINUTES } from "./weights";
import { verseCount } from "./verses";
import { versePick } from "./verse-picks";
import { addDays, planLengthDays } from "./dates";
import type { ActivePlan, ChapterRead } from "./types";

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

function plan(
  reads: ChapterRead[] = [],
  members = ["me", "friend"],
  starts: Record<string, string> = {},
): ActivePlan {
  const weights = allChapters().map((c) => weightOf(c.book, c.chapter));
  return {
    id: "p1", name: "Manna", months: MONTHS, startDay: START,
    translation: "ESV", creatorId: "me", canEdit: true,
    members: members.map((id, i) => ({
      id, username: id, displayName: id === "me" ? "Ryan" : "Sam",
      canEdit: i === 0, isCreator: i === 0, joinedAt: "2026-01-01T00:00:00Z",
      startDay: starts[id] ?? START,
    })),
    cuts: partition(weights, DAYS),
    reads,
    standings: [],
    notes: [],
  };
}

/** Every chapter of a plan day, ticked on the given calendar day. */
function done(userId: string, day: number, on: string): ChapterRead[] {
  const p = plan();
  return chaptersForDay(p, day).map((r) => ({
    userId, book: r.book, chapter: r.chapter, readOn: on,
  }));
}
const days = (userId: string, list: number[], on: (d: number) => string): ChapterRead[] =>
  list.flatMap((d) => done(userId, d, on(d)));

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
  check("start day is day 1", currentDay(p, START, "me"), 1);
  check("ten days in", currentDay(p, addDays(START, 9), "me"), 10);
  check("before the start clamps to day 1", currentDay(p, addDays(START, -5), "me"), 1);
  check("after the end clamps to the last day", currentDay(p, addDays(START, DAYS + 50), "me"), DAYS);
  check("day 1 falls on the start date", dateOfDay(p, 1, "me"), START);
  check("day 10 falls nine days later", dateOfDay(p, 10, "me"), addDays(START, 9));
  check("not ended on the final day", planEnded(p, addDays(START, DAYS - 1), "me"), false);
  check("ended the day after", planEnded(p, addDays(START, DAYS), "me"), true);
}

console.log("\npace");
{
  const today = addDays(START, 9); // day 10
  const onPace = plan(days("me", [1,2,3,4,5,6,7,8,9,10], (d) => addDays(START, d - 1)));
  check("caught up is on pace", paceFor(onPace, "me", today).status, "on-pace");
  check("no debt when on pace", paceFor(onPace, "me", today).minutesBehind, 0);

  const ahead = plan(days("me", [1,2,3,4,5,6,7,8,9,10,11,12], () => today));
  check("further along is ahead", paceFor(ahead, "me", today).status, "ahead");
  check("ahead by two", paceFor(ahead, "me", today).delta, 2);

  const behind = plan(days("me", [1,2,3,4,5,6,7], (d) => addDays(START, d - 1)));
  const p = paceFor(behind, "me", today);
  check("short is behind", p.status, "behind");
  // Days 8 and 9 are missed. Day 10 is today: still due, not yet late.
  check("behind by the days actually missed", p.delta, -2);
  const owed = minutesForDay(behind, 8) + minutesForDay(behind, 9);
  check("debt is the missed reading, in minutes", p.minutesBehind, owed);
  ok("debt is a real number of minutes", owed > 0);
  // Today is never counted against you until it is over.
  check("today is not part of the debt", paceFor(plan(days("me", [1], () => START)), "me", START).status, "on-pace");
  check("nothing read on day one is still on pace", paceFor(plan(), "me", START).status, "on-pace");
  check("and owes nothing", paceFor(plan(), "me", START).minutesBehind, 0);

  // Ticking days out of order must not fake a debt: what counts is how many.
  const scattered = plan(days("me", [1, 5, 9], () => today));
  check("out of order still counts three", paceFor(scattered, "me", today).done, 3);
  const gaps = paceFor(scattered, "me", today);
  check("debt covers every unfinished day that is past",
    gaps.minutesBehind,
    [2,3,4,6,7,8].reduce((a, d) => a + minutesForDay(scattered, d), 0));
}

console.log("\nstreak");
{
  const today = addDays(START, 9);
  const straight = plan(days("me", [1,2,3,4,5,6,7,8,9,10], (d) => addDays(START, d - 1)));
  check("ten days straight", streakFor(straight, "me", today), 10);

  // Not read yet today: yesterday keeps the streak alive rather than showing 0.
  const yesterday = plan(days("me", [1,2,3,4,5,6,7,8,9], (d) => addDays(START, d - 1)));
  check("yesterday keeps it alive", streakFor(yesterday, "me", today), 9);

  // Two clear days is broken.
  const stale = plan(days("me", [1,2,3], (d) => addDays(START, d - 1)));
  check("a two day gap breaks it", streakFor(stale, "me", today), 0);

  // Catching up on several days in one sitting is one day of showing up.
  const binge = plan(days("me", [1,2,3,4,5], () => today));
  check("a catch-up binge is one day", streakFor(binge, "me", today), 1);

  check("nothing logged is no streak", streakFor(plan(), "me", today), 0);

  const broken = plan([
    ...done("me", 1, addDays(START, 0)), ...done("me", 2, addDays(START, 1)),
    ...done("me", 3, addDays(START, 2)), ...done("me", 4, addDays(START, 3)),
    ...done("me", 5, addDays(START, 8)), ...done("me", 6, addDays(START, 9)),
  ]);
  check("longest run is remembered", longestStreakFor(broken, "me"), 4);
  check("current run is the recent one", streakFor(broken, "me", today), 2);
}

console.log("\nstats");
{
  const today = addDays(START, 9);
  const p = plan(days("me", [1,2,3,4,5], (d) => addDays(START, d - 1)));
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
  const gen = plan(days("me", Array.from({ length: genesisEnd }, (_, i) => i + 1), () => today));
  check(`Genesis is finished on day ${genesisEnd}`, statsFor(gen, "me", today).booksFinished, 1);
  const almost = plan(days("me", Array.from({ length: genesisEnd - 1 }, (_, i) => i + 1), () => today));
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

  const all = plan(days("me", Array.from({ length: DAYS }, (_, i) => i + 1), () => "2027-02-01"));
  const finished = milestonesFor(all, "me");
  check("finishing the plan earns every badge", finished.filter((m) => m.earned).length, 10);
  check("whole Bible badge is complete", finished.find((m) => m.id === "whole-bible")!.done, TOTAL_CHAPTERS);

  // Partial progress must report progress, not just a locked badge.
  const some = plan(days("me", [1,2,3,4,5], () => "2026-01-05"));
  const pent = milestonesFor(some, "me").find((m) => m.id === "pentateuch")!;
  ok("Pentateuch shows partial progress", pent.done > 0 && !pent.earned, `${pent.done}/${pent.total}`);
}

console.log("\nhead to head");
{
  const today = addDays(START, 9);
  const p = plan([
    ...days("me", [1,2,3,4,5,6,7,8], (d) => addDays(START, d - 1)),
    ...days("friend", [1,2,3], (d) => addDays(START, d - 1)),
  ]);
  const board = computeStandings(p, p.reads, today);
  check("both readers appear", board.length, 2);
  check("further along leads", board[0].userId, "me");
  check("leader's day count", board[0].daysDone, 8);
  check("trailer's day count", board[1].daysDone, 3);
  ok("leader has more minutes", board[0].minutes > board[1].minutes);
  check("trailer is behind", board[1].status, "behind");
  check("leader has read today", board[0].readToday, false);
  // The board is built from everyone's reads, but only your own travel to the
  // client. A member with no reads in the payload must still be reported.
  const sparse = computeStandings({ ...p, members: p.members }, [], today);
  check("nobody read, nobody ranked above zero", sparse.map((s) => s.daysDone), [0, 0]);
}

console.log("\nprogress survives a change of plan length");
{
  // Days are slices of a schedule that moves; chapters are not. Storing progress
  // per day meant switching a twelve month plan to three re-pointed every
  // finished day at different chapters and credited hundreds never opened.
  const today = addDays(START, 39);
  const read = days("me", Array.from({ length: 40 }, (_, i) => i + 1), () => today);
  const twelve = plan(read);
  const before = statsFor(twelve, "me", today);

  const weights = allChapters().map((c) => weightOf(c.book, c.chapter));
  const short: ActivePlan = {
    ...twelve, months: 3, cuts: partition(weights, planLengthDays(START, 3)),
  };
  const after = statsFor(short, "me", today);

  check("the same chapters are still read", after.chaptersRead, before.chaptersRead);
  check("no minutes are invented", after.minutesInvested, before.minutesInvested);
  ok(
    "nothing is credited that was never opened",
    after.chaptersRead === before.chaptersRead,
    `credited ${after.chaptersRead}, actually read ${before.chaptersRead}`,
  );
}

console.log("\npartial days");
{
  const today = addDays(START, 2);
  const p0 = plan();
  const chapters = chaptersForDay(p0, 1);
  ok("day one has several chapters to part-finish", chapters.length >= 3, `${chapters.length}`);

  const partial = plan(
    chapters.slice(0, -1).map((r) => ({
      userId: "me", book: r.book, chapter: r.chapter, readOn: today,
    })),
  );
  check("progress counts the chapters read", dayProgress(partial, "me", 1).done, chapters.length - 1);
  check("out of the day's total", dayProgress(partial, "me", 1).total, chapters.length);
  check("a part-read day is not complete", dayComplete(partial, "me", 1), false);
  check("and does not count towards pace", paceFor(partial, "me", today).done, 0);

  // Once day one is past, the debt is only what is left of it, not the whole
  // day over again.
  const last = chapters[chapters.length - 1];
  const tomorrow = addDays(START, 1);
  check(
    "only the unread chapter is owed",
    paceFor(partial, "me", tomorrow).minutesBehind,
    weightOf(last.book, last.chapter),
  );
  check("chapters read counts them individually", statsFor(partial, "me", today).chaptersRead, chapters.length - 1);

  const whole = plan(done("me", 1, today));
  check("finishing the last one completes the day", dayComplete(whole, "me", 1), true);
  check("and clears the debt", paceFor(whole, "me", addDays(START, 1)).minutesBehind, 0);
}

console.log("\na late joiner starts at day one");
{
  // Ryan starts on the 1st. Sam joins thirty days later. Sam should open the app
  // on pace at day 1, not thirty days in the hole.
  const joined = addDays(START, 30);
  const p = plan([], ["me", "friend"], { friend: joined });
  check("the creator is where the plan is", currentDay(p, joined, "me"), 31);
  check("the joiner is on their own day 1", currentDay(p, joined, "friend"), 1);
  check("and is on pace, not behind", paceFor(p, "friend", joined).status, "on-pace");
  check("with nothing owed", paceFor(p, "friend", joined).minutesBehind, 0);
  check("their day 1 falls on the day they joined", dateOfDay(p, 1, "friend"), joined);
  check("they still start at Genesis 1", chaptersForDay(p, 1)[0], { book: "Genesis", chapter: 1 });
  check("ten days on they are on day 11", currentDay(p, addDays(joined, 10), "friend"), 11);
  // The creator is unaffected by someone joining late.
  check("the creator keeps their own day", currentDay(p, addDays(joined, 10), "me"), 41);
}

console.log("\nverse of the day is the best of the day's chapters");
{
  const p = plan();
  for (const day of [1, 30, 200, DAYS]) {
    const v = verseOfTheDay(p, day)!;
    const todays = chaptersForDay(p, day);
    ok(
      `day ${day} draws from today's reading`,
      todays.some((r) => r.book === v.ref.book && r.chapter === v.ref.chapter),
    );
    // It must be the strongest chapter of the day, not merely one of them.
    const bestScore = Math.max(...todays.map((r) => versePick(r.book, r.chapter).score));
    check(`day ${day} picks the strongest chapter`, versePick(v.ref.book, v.ref.chapter).score, bestScore);
    check(`day ${day} uses that chapter's best verse`, v.verse, versePick(v.ref.book, v.ref.chapter).verse);
    ok(`day ${day} verse exists`, v.verse >= 1 && v.verse <= verseCount(v.ref.book, v.ref.chapter));
  }
  check("day one is let there be light", verseOfTheDay(p, 1), {
    ref: { book: "Genesis", chapter: 1 }, verse: 3,
  });
  check("stable across calls", verseOfTheDay(p, 7), verseOfTheDay(p, 7));
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
