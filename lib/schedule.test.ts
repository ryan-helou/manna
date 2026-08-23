import { buildSchedule, partition } from "./schedule";
import { allChapters, refKey, TOTAL_CHAPTERS } from "./bible";
import { TOTAL_WEIGHT_MINUTES, weightOf } from "./weights";
import { planLengthDays } from "./dates";

/**
 * The schedule is the one piece of this app where a bug is silent: a plan that
 * quietly drops Obadiah, or that piles 90 minutes onto a Tuesday, still looks
 * fine on screen. Run with `npm test`.
 */

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${label}`);
  } else {
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

// A one, six and thirteen month plan, measured off a real calendar.
const START = "2026-01-01";
const CASES = [
  { months: 1, days: planLengthDays(START, 1) },
  { months: 6, days: planLengthDays(START, 6) },
  { months: 13, days: planLengthDays(START, 13) },
];

console.log("\ncoverage");
for (const { months, days } of CASES) {
  const plan = buildSchedule(days);
  check(`${months}mo -> ${days} days`, plan.length, days);

  const seen = plan.flatMap((d) => d.chapters).map(refKey);
  check(`${months}mo covers every chapter exactly once`, seen.length, TOTAL_CHAPTERS);
  check(`${months}mo has no duplicates`, new Set(seen).size, TOTAL_CHAPTERS);

  const expected = allChapters().map(refKey);
  ok(`${months}mo preserves canonical order`, seen.every((r, i) => r === expected[i]));

  ok(
    `${months}mo has no empty days`,
    plan.every((d) => d.chapters.length > 0),
    `empty days: ${plan.filter((d) => d.chapters.length === 0).map((d) => d.day).join(", ")}`,
  );

  const totalMinutes = plan.reduce((a, d) => a + d.minutes, 0);
  check(`${months}mo minutes total to the weight table`, totalMinutes, TOTAL_WEIGHT_MINUTES);
}

console.log("\nnever splits or reorders a book");
{
  const plan = buildSchedule(planLengthDays(START, 13));
  // Within a day, chapters must be contiguous and ascending.
  const bad: string[] = [];
  for (const day of plan) {
    for (let i = 1; i < day.chapters.length; i++) {
      const prev = day.chapters[i - 1];
      const cur = day.chapters[i];
      const sameBookNext = cur.book === prev.book && cur.chapter === prev.chapter + 1;
      const newBookStart = cur.book !== prev.book && cur.chapter === 1;
      if (!sameBookNext && !newBookStart) bad.push(`day ${day.day}: ${refKey(prev)} -> ${refKey(cur)}`);
    }
  }
  check("every day is a contiguous run", bad, []);
}

console.log("\nlevel daily load");
for (const { months, days } of CASES) {
  const plan = buildSchedule(days);
  const loads = plan.map((d) => d.minutes);
  const mean = loads.reduce((a, b) => a + b, 0) / days;
  const sd = Math.sqrt(loads.reduce((a, l) => a + (l - mean) ** 2, 0) / days);
  const rel = sd / mean;
  const within = loads.filter((l) => Math.abs(l - mean) / mean <= 0.25).length / days;

  // Tolerance widens as the plan lengthens, and it has to: at three chapters a
  // day the weight of one chapter is most of a day's load, and a chapter cannot
  // be split. A one-month plan packs ~40 chapters a day and can be near-perfect.
  const sdLimit = months === 1 ? 0.03 : months === 6 ? 0.08 : 0.13;
  ok(
    `${months}mo spread within ${(sdLimit * 100).toFixed(0)}% of mean`,
    rel <= sdLimit,
    `sd ${(rel * 100).toFixed(1)}% of mean (${mean.toFixed(1)} min/day)`,
  );
  ok(
    `${months}mo keeps 95% of days inside +/-25%`,
    within >= 0.95,
    `only ${(within * 100).toFixed(1)}% of days inside the band`,
  );

  // No single chapter can be shifted across a day boundary to flatten the plan
  // further. Global optimality is proven against brute force further down, but
  // that only runs on slices; this checks the real schedule that ships.
  let betterMove = "";
  for (let d = 0; d + 1 < plan.length && !betterMove; d++) {
    const a = plan[d];
    const b = plan[d + 1];
    const before = (a.minutes - mean) ** 2 + (b.minutes - mean) ** 2;
    if (b.chapters.length > 1) {
      const w = weightOf(b.chapters[0].book, b.chapters[0].chapter);
      if ((a.minutes + w - mean) ** 2 + (b.minutes - w - mean) ** 2 < before - 1e-9) {
        betterMove = `day ${b.day}'s first chapter should move back to day ${a.day}`;
      }
    }
    if (a.chapters.length > 1 && !betterMove) {
      const w = weightOf(a.chapters[a.chapters.length - 1].book, a.chapters[a.chapters.length - 1].chapter);
      if ((a.minutes - w - mean) ** 2 + (b.minutes + w - mean) ** 2 < before - 1e-9) {
        betterMove = `day ${a.day}'s last chapter should move on to day ${b.day}`;
      }
    }
  }
  ok(`${months}mo cannot be flattened by moving one chapter`, betterMove === "", betterMove);
}

console.log("\nPsalm 119, the heaviest chapter in the Bible");
{
  // 56 minutes: heavier than a whole day on a thirteen-month plan, comfortably
  // inside one on a six-month plan. It should be isolated in the first case and
  // read alongside its neighbours in the second, which is the difference between
  // a leveller and a fixed rule about long chapters.
  const weight = weightOf("Psalms", 119);
  check("is the heaviest chapter", weight, Math.max(
    ...allChapters().map((c) => weightOf(c.book, c.chapter)),
  ));
  for (const months of [6, 13]) {
    const days = planLengthDays(START, months);
    const plan = buildSchedule(days);
    const mean = TOTAL_WEIGHT_MINUTES / days;
    const day = plan.find((d) => d.chapters.some((c) => c.book === "Psalms" && c.chapter === 119))!;
    const alone = day.chapters.length === 1;
    ok(
      `${months}mo: ${weight} min vs a ${mean.toFixed(0)} min day -> ${weight > mean ? "alone" : "shared"}`,
      alone === weight > mean,
      `it is ${alone ? "alone" : `with ${day.chapters.length - 1} other chapters`}`,
    );
  }
}

console.log("\ndivide-and-conquer matches a brute-force optimum");
{
  /** Plain O(n^2 k) DP: the definition of the answer, too slow for real sizes. */
  function bruteForce(w: number[], k: number): number {
    const n = w.length;
    const pre = [0];
    for (let i = 0; i < n; i++) pre.push(pre[i] + w[i]);
    const mean = pre[n] / k;
    const cost = (i: number, j: number) => (pre[j] - pre[i] - mean) ** 2;
    let prev = new Array(n + 1).fill(Infinity);
    for (let j = 1; j <= n; j++) prev[j] = cost(0, j);
    for (let d = 2; d <= k; d++) {
      const cur = new Array(n + 1).fill(Infinity);
      for (let j = d; j <= n; j++) {
        for (let i = d - 1; i < j; i++) {
          const v = prev[i] + cost(i, j);
          if (v < cur[j]) cur[j] = v;
        }
      }
      prev = cur;
    }
    return prev[n];
  }

  const scoreOf = (w: number[], cuts: number[], k: number) => {
    const pre = [0];
    for (let i = 0; i < w.length; i++) pre.push(pre[i] + w[i]);
    const mean = pre[w.length] / k;
    let s = 0;
    for (let d = 0; d < k; d++) s += (pre[cuts[d + 1]] - pre[cuts[d]] - mean) ** 2;
    return s;
  };

  const all = allChapters().map((c) => weightOf(c.book, c.chapter));
  // Slices from across the canon: narrative, poetry, prophecy, epistle.
  const slices: [number, number, number][] = [
    [0, 200, 60],
    [0, 300, 100],
    [400, 250, 80],
    [900, 289, 96],
    [1100, 89, 30],
  ];
  for (const [from, len, k] of slices) {
    const w = all.slice(from, from + len);
    const mine = scoreOf(w, partition(w, k), k);
    const best = bruteForce(w, k);
    ok(
      `chapters ${from}..${from + len} over ${k} days is optimal`,
      Math.abs(mine - best) < 1e-6,
      `dp gave ${mine.toFixed(4)}, optimum is ${best.toFixed(4)}`,
    );
  }
}

console.log("\nedges");
{
  check("one day takes the whole Bible", buildSchedule(1)[0].chapters.length, TOTAL_CHAPTERS);
  check("one day weighs the full total", buildSchedule(1)[0].minutes, TOTAL_WEIGHT_MINUTES);
  let threw = "";
  try { partition([1, 2, 3], 4); } catch (e) { threw = (e as Error).message; }
  ok("refuses more days than chapters", threw.includes("without empty days"), threw);
  threw = "";
  try { partition([1, 2, 3], 0); } catch (e) { threw = (e as Error).message; }
  ok("refuses zero days", threw.includes("positive integer"), threw);
}

console.log(failures === 0 ? "\nall schedule checks passed\n" : `\n${failures} FAILED\n`);
if (failures > 0) process.exit(1);
