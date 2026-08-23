import { allChapters, type Ref } from "./bible";
import { weightOf } from "./weights";

/**
 * Turning 1,189 weighted chapters into a day-by-day plan.
 *
 * This is a levelling problem, not a division. Chapters have to stay in
 * canonical order and cannot be split, so the plan is a partition of one fixed
 * sequence into `days` contiguous runs. What we hold flat is minutes per day,
 * which means the chapter count per day moves around: five short psalms one
 * morning, one chapter of Romans the next.
 */

export interface DayPlan {
  /** 1-based day number within the plan. */
  day: number;
  chapters: Ref[];
  /** Total weighted study minutes for the day. */
  minutes: number;
}

/**
 * Partition the canonical chapter sequence into `days` non-empty contiguous
 * runs with the flattest possible minute load.
 *
 * This is solved exactly, not approximated. The obvious greedy fill (walk the
 * chapters, cut whenever the running total passes the day's share) lands in bad
 * local optima: measured against the exact answer it came out up to 93% worse,
 * because fixing one lumpy day often needs several boundaries to move together.
 *
 * So: dynamic programming over (day, chapter), minimising the summed squared
 * deviation from the mean daily load. The plain form is O(days x chapters^2),
 * which is too slow at this size, but the cost is convex in a run's total and
 * the optimal cut point is therefore monotonic across the layer, so
 * divide-and-conquer optimisation brings it to O(days x chapters x log chapters).
 * lib/schedule.test.ts checks this against a brute-force DP.
 */
export function buildSchedule(days: number): DayPlan[] {
  const chapters = allChapters();
  const weights = chapters.map((c) => weightOf(c.book, c.chapter));
  const cuts = partition(weights, days);

  const out: DayPlan[] = [];
  for (let d = 0; d < days; d++) {
    const slice = chapters.slice(cuts[d], cuts[d + 1]);
    out.push({
      day: d + 1,
      chapters: slice,
      minutes: slice.reduce((a, r) => a + weightOf(r.book, r.chapter), 0),
    });
  }
  return out;
}

/**
 * The levelling itself, over a bare list of weights. Returns `days + 1` cut
 * indices, so day d covers weights `[cuts[d], cuts[d + 1])`.
 *
 * Exported so lib/schedule.test.ts can hold it against a brute-force DP: the
 * divide-and-conquer step below is only valid if the optimal cut point really is
 * monotonic across a layer, and that deserves proving rather than asserting.
 */
export function partition(weights: number[], days: number): number[] {
  const n = weights.length;
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(`days must be a positive integer, got ${days}`);
  }
  if (days > n) {
    throw new Error(`cannot spread ${n} chapters over ${days} days without empty days`);
  }

  // prefix[i] = total minutes of the first i chapters.
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + weights[i];
  const mean = prefix[n] / days;

  /** Cost of making chapters [i, j) a single day. */
  const cost = (i: number, j: number) => {
    const d = prefix[j] - prefix[i] - mean;
    return d * d;
  };

  const INF = Infinity;
  let prev = new Float64Array(n + 1).fill(INF);
  // Layer 1: one day covering the first j chapters.
  for (let j = 1; j <= n; j++) prev[j] = cost(0, j);

  // choice[d][j] = where day d starts, when days 1..d cover the first j chapters.
  const choice: Int32Array[] = [new Int32Array(0)];

  for (let d = 2; d <= days; d++) {
    const cur = new Float64Array(n + 1).fill(INF);
    const pick = new Int32Array(n + 1).fill(-1);

    // Solve j in [lo, hi] knowing the optimal split lies in [optLo, optHi].
    const solve = (lo: number, hi: number, optLo: number, optHi: number): void => {
      if (lo > hi) return;
      const mid = (lo + hi) >> 1;
      let best = INF;
      let bestI = -1;
      const from = Math.max(optLo, d - 1);
      const to = Math.min(optHi, mid - 1);
      for (let i = from; i <= to; i++) {
        const left = prev[i];
        if (left === INF) continue;
        const v = left + cost(i, mid);
        if (v < best) {
          best = v;
          bestI = i;
        }
      }
      cur[mid] = best;
      pick[mid] = bestI;
      const split = bestI === -1 ? optLo : bestI;
      solve(lo, mid - 1, optLo, split);
      solve(mid + 1, hi, split, optHi);
    };
    solve(d, n, d - 1, n - 1);

    choice[d] = pick;
    prev = cur;
  }

  // Walk the choices back to recover the cut points.
  const cuts = new Array<number>(days + 1);
  cuts[days] = n;
  let j = n;
  for (let d = days; d >= 2; d--) {
    const i = choice[d][j];
    cuts[d - 1] = i;
    j = i;
  }
  cuts[0] = 0;

  return cuts;
}

/** Total weighted minutes of a set of chapter references. */
export function minutesFor(refs: Ref[]): number {
  return refs.reduce((a, r) => a + weightOf(r.book, r.chapter), 0);
}
