import { readFileSync } from "node:fs";
import { quizForDay } from "./quiz";
import { partition } from "./schedule";
import { allChapters, refKey, type Ref } from "./bible";
import { weightOf } from "./weights";
import { planLengthDays } from "./dates";

/**
 * The daily questions are generated, not written, so the thing that matters is
 * that every one of them is actually right about the Bible. A quiz that marks a
 * correct answer wrong is worse than no quiz.
 *
 * Every question is checked here against the same text it was built from, for
 * every day of a full year plan, rather than spot-checked.
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

const rows = JSON.parse(
  readFileSync(new URL("../data/chapter-names.json", import.meta.url), "utf8"),
) as { b: string; c: number; n: string[] }[];
const NAMES = new Map(rows.map((r) => [`${r.b} ${r.c}`, r.n]));
const namesIn = (ref: Ref) => NAMES.get(refKey(ref)) ?? [];

const chapters = allChapters();
const weights = chapters.map((c) => weightOf(c.book, c.chapter));
const START = "2026-01-01";

function daysOf(months: number) {
  const n = planLengthDays(START, months);
  const cuts = partition(weights, n);
  return Array.from({ length: n }, (_, i) => chapters.slice(cuts[i], cuts[i + 1]));
}

console.log("\nevery question is answerable and well formed");
{
  const bad: string[] = [];
  let total = 0;
  for (const [i, refs] of daysOf(12).entries()) {
    for (const q of quizForDay("p1", i + 1, refs)) {
      total++;
      if (q.options.length < 3) bad.push(`day ${i + 1}: only ${q.options.length} options`);
      if (q.answer < 0 || q.answer >= q.options.length) bad.push(`day ${i + 1}: answer out of range`);
      if (new Set(q.options).size !== q.options.length) bad.push(`day ${i + 1}: duplicate options`);
      if (!q.prompt.trim()) bad.push(`day ${i + 1}: empty prompt`);
      if (q.options.some((o) => !o.trim())) bad.push(`day ${i + 1}: empty option`);
    }
  }
  ok(`${total} questions across a year are well formed`, bad.length === 0, bad.slice(0, 4).join("; "));
}

console.log("\nthe marked answer is the true one");
{
  const wrong: string[] = [];
  for (const [i, refs] of daysOf(12).entries()) {
    const day = i + 1;
    const todayNames = new Set(refs.flatMap(namesIn));
    const todayKeys = new Set(refs.map(refKey));

    for (const q of quizForDay("p1", day, refs)) {
      const right = q.options[q.answer];
      const others = q.options.filter((_, j) => j !== q.answer);

      if (q.id.endsWith("appears")) {
        // The answer must be in today's reading, and nothing else may be.
        if (!todayNames.has(right)) wrong.push(`day ${day} appears: ${right} is not in today`);
        for (const o of others) {
          if (todayNames.has(o)) wrong.push(`day ${day} appears: ${o} IS in today`);
        }
      } else if (q.id.endsWith("absent")) {
        // The answer must be absent, and every other option present.
        if (todayNames.has(right)) wrong.push(`day ${day} absent: ${right} IS in today`);
        for (const o of others) {
          if (!todayNames.has(o)) wrong.push(`day ${day} absent: ${o} is not in today either`);
        }
      } else if (q.id.endsWith("order")) {
        // The answer must genuinely be the earliest, judged by first appearance.
        const firstAt = (name: string) => refs.findIndex((r) => namesIn(r).includes(name));
        const rightAt = firstAt(right);
        for (const o of others) {
          const at = firstAt(o);
          if (at < 0) wrong.push(`day ${day} order: ${o} is not in today`);
          else if (at <= rightAt) wrong.push(`day ${day} order: ${o} (${at}) is not after ${right} (${rightAt})`);
        }
      } else if (q.id.endsWith("locate")) {
        // The named person belongs to the answer's chapter and no other.
        const name = q.prompt.replace(/^Which of today's chapters mentions /, "").replace(/\?$/, "");
        const home = refs.find((r) => `${r.book} ${r.chapter}` === right);
        if (!home || !namesIn(home).includes(name)) {
          wrong.push(`day ${day} locate: ${name} is not in ${right}`);
        }
        for (const o of others) {
          const ref = refs.find((r) => `${r.book} ${r.chapter}` === o);
          if (ref && namesIn(ref).includes(name)) wrong.push(`day ${day} locate: ${name} is also in ${o}`);
        }
      } else if (q.id.includes("which")) {
        // The answer is one of today's chapters; no other option is.
        if (!todayKeys.has(right)) wrong.push(`day ${day} which: ${right} was not read today`);
        for (const o of others) {
          if (todayKeys.has(o)) wrong.push(`day ${day} which: ${o} WAS read today`);
        }
      } else {
        wrong.push(`day ${day}: unrecognised question type ${q.id}`);
      }
    }
  }
  ok("no question is wrong about the Bible", wrong.length === 0, wrong.slice(0, 6).join("\n         "));
}

console.log("\nwrong answers are not merely yesterday's reading");
{
  // A distractor lifted from an adjacent chapter would be unfair: nobody can
  // reasonably separate today's names from the ones a day either side.
  const order = chapters.map(refKey);
  const tooClose: string[] = [];
  for (const [i, refs] of daysOf(12).entries()) {
    const day = i + 1;
    const firstIdx = order.indexOf(refKey(refs[0]));
    for (const q of quizForDay("p1", day, refs)) {
      if (!q.id.includes("which")) continue;
      for (const [j, o] of q.options.entries()) {
        if (j === q.answer) continue;
        const at = order.indexOf(o);
        if (at >= 0 && Math.abs(at - firstIdx) < 60) tooClose.push(`day ${day}: ${o}`);
      }
    }
  }
  check("reference distractors come from far off", tooClose, []);
}

console.log("\nthe same day always asks the same thing");
{
  const refs = daysOf(12)[9];
  check("stable across calls", quizForDay("p1", 10, refs), quizForDay("p1", 10, refs));
  ok(
    "a different plan asks differently",
    JSON.stringify(quizForDay("p2", 10, refs)) !== JSON.stringify(quizForDay("p1", 10, refs)),
  );
}

console.log("\nthere is always something to ask");
{
  for (const months of [1, 3, 6, 12, 13]) {
    const days = daysOf(months);
    const counts = days.map((refs, i) => quizForDay("p1", i + 1, refs).length);
    const empty = counts.filter((c) => c === 0).length;
    const thin = counts.filter((c) => c === 1).length;
    check(`${months}mo: no day is left with nothing`, empty, 0);
    ok(
      `${months}mo: at least 2 questions on 98% of days`,
      (days.length - thin) / days.length >= 0.98,
      `${thin} of ${days.length} days have only one`,
    );
    ok(`${months}mo: never more than 3`, counts.every((c) => c <= 3));
  }
}

console.log("\nedges");
{
  check("no chapters means no questions", quizForDay("p1", 1, []), []);
  const one = quizForDay("p1", 1, [{ book: "Psalms", chapter: 119 }]);
  ok("a lone chapter still gets asked something", one.length >= 1, `${one.length}`);
}

console.log(failures === 0 ? "\nall quiz checks passed\n" : `\n${failures} FAILED\n`);
if (failures > 0) process.exit(1);
