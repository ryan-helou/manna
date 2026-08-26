import { readFileSync } from "node:fs";
import { quizForDay, QUESTIONS_PER_DAY } from "./quiz";
import { partition } from "./schedule";
import { allChapters, BOOKS, refKey, type Ref } from "./bible";
import { weightOf } from "./weights";
import { planLengthDays } from "./dates";

/**
 * The daily questions are generated, not written, so the first thing that
 * matters is that every one of them is actually right about the Bible. A quiz
 * that marks a correct answer wrong is worse than no quiz. Every question is
 * checked here against the same text it was built from, for every day of a full
 * year plan, rather than spot-checked.
 *
 * The second thing that matters is that a question cannot be answered without
 * having read. That does not show up as a wrong answer, so it needs its own
 * checks: nothing repeats inside a day, wrong options are plausible, and the
 * day's questions come from different angles. Each of those was measured
 * failing before it was fixed, and the numbers are in the comments below.
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

const testamentOf = (book: string) => BOOKS.find((b) => b.name === book)!.testament;
/** Which halves of the canon a name turns up in at all. */
const LIVES_IN = new Map<string, Set<string>>();
for (const r of rows) {
  for (const n of r.n) {
    if (!LIVES_IN.has(n)) LIVES_IN.set(n, new Set());
    LIVES_IN.get(n)!.add(testamentOf(r.b));
  }
}

const chapters = allChapters();
const weights = chapters.map((c) => weightOf(c.book, c.chapter));
const START = "2026-01-01";

function daysOf(months: number) {
  const n = planLengthDays(START, months);
  const cuts = partition(weights, n);
  return Array.from({ length: n }, (_, i) => chapters.slice(cuts[i], cuts[i + 1]));
}

/** The lane a question came from, e.g. "3-cooccur" -> "cooccur". */
const shapeOf = (id: string) => id.match(/^\d+-([a-z]+)/)?.[1] ?? "";

console.log("\nevery question is answerable and well formed");
{
  const bad: string[] = [];
  let total = 0;
  let four = 0;
  for (const [i, refs] of daysOf(12).entries()) {
    for (const q of quizForDay("p1", i + 1, refs)) {
      total++;
      if (q.options.length === 4) four++;
      // Four options where the day can fill them, three where it cannot, and
      // never anything else. A day of twelve psalms used to produce a
      // twelve-option question, which is unreadable on a phone.
      if (q.options.length < 3 || q.options.length > 4) {
        bad.push(`day ${i + 1}: ${q.options.length} options`);
      }
      if (q.answer < 0 || q.answer >= q.options.length) bad.push(`day ${i + 1}: answer out of range`);
      if (new Set(q.options).size !== q.options.length) bad.push(`day ${i + 1}: duplicate options`);
      if (!q.prompt.trim()) bad.push(`day ${i + 1}: empty prompt`);
      if (q.options.some((o) => !o.trim())) bad.push(`day ${i + 1}: empty option`);
      if (!shapeOf(q.id)) bad.push(`day ${i + 1}: unreadable id ${q.id}`);
    }
  }
  ok(`${total} questions across a year are well formed`, bad.length === 0, bad.slice(0, 4).join("; "));
  ok(
    `four options on most of them (${((four / total) * 100).toFixed(1)}%)`,
    four / total >= 0.8,
    `only ${four} of ${total}`,
  );
}

console.log("\nthe marked answer is the true one");
{
  const wrong: string[] = [];
  for (const [i, refs] of daysOf(12).entries()) {
    const day = i + 1;
    const todayNames = new Set(refs.flatMap(namesIn));
    const todayKeys = new Set(refs.map(refKey));
    /** Which of today's chapters a name turns up in. */
    const homesOf = (name: string) => refs.filter((r) => namesIn(r).includes(name));

    for (const q of quizForDay("p1", day, refs)) {
      const right = q.options[q.answer];
      const others = q.options.filter((_, j) => j !== q.answer);
      const shape = shapeOf(q.id);

      if (shape === "appears") {
        // The answer must be in today's reading, and nothing else may be.
        if (!todayNames.has(right)) wrong.push(`day ${day} appears: ${right} is not in today`);
        for (const o of others) {
          if (todayNames.has(o)) wrong.push(`day ${day} appears: ${o} IS in today`);
        }
      } else if (shape === "absent") {
        // The answer must be absent, and every other option present.
        if (todayNames.has(right)) wrong.push(`day ${day} absent: ${right} IS in today`);
        for (const o of others) {
          if (!todayNames.has(o)) wrong.push(`day ${day} absent: ${o} is not in today either`);
        }
      } else if (shape === "order") {
        // The answer must genuinely be the earliest, judged by first appearance.
        const firstAt = (name: string) => refs.findIndex((r) => namesIn(r).includes(name));
        const rightAt = firstAt(right);
        for (const o of others) {
          const at = firstAt(o);
          if (at < 0) wrong.push(`day ${day} order: ${o} is not in today`);
          else if (at <= rightAt) wrong.push(`day ${day} order: ${o} (${at}) is not after ${right} (${rightAt})`);
        }
      } else if (shape === "locate") {
        // The named person belongs to the answer's chapter and no other.
        const name = q.prompt.replace(/^Which of today's chapters mentions /, "").replace(/\?$/, "");
        const home = refs.find((r) => refKey(r) === right);
        if (!home || !namesIn(home).includes(name)) {
          wrong.push(`day ${day} locate: ${name} is not in ${right}`);
        }
        for (const o of others) {
          const ref = refs.find((r) => refKey(r) === o);
          if (ref && namesIn(ref).includes(name)) wrong.push(`day ${day} locate: ${name} is also in ${o}`);
        }
      } else if (shape === "cooccur") {
        // The subject sits in exactly one of today's chapters, the answer sits
        // in that same chapter, and no other option does.
        const subject = q.prompt
          .replace(/^Which of these appears in the same chapter as /, "")
          .replace(/\?$/, "");
        const homes = homesOf(subject);
        if (homes.length !== 1) {
          wrong.push(`day ${day} cooccur: ${subject} is in ${homes.length} of today's chapters`);
        } else {
          if (!namesIn(homes[0]).includes(right)) {
            wrong.push(`day ${day} cooccur: ${right} is not in ${refKey(homes[0])} with ${subject}`);
          }
          for (const o of others) {
            if (namesIn(homes[0]).includes(o)) {
              wrong.push(`day ${day} cooccur: ${o} is ALSO in ${refKey(homes[0])}`);
            }
          }
        }
      } else if (shape === "multi") {
        // The answer spans more than one of today's chapters; nothing else does.
        if (homesOf(right).length < 2) {
          wrong.push(`day ${day} multi: ${right} is in only ${homesOf(right).length} chapter`);
        }
        for (const o of others) {
          const n = homesOf(o).length;
          if (n !== 1) wrong.push(`day ${day} multi: ${o} is in ${n} of today's chapters, not 1`);
        }
      } else if (shape === "notread") {
        // The stray was not read; every other option was.
        if (todayKeys.has(right)) wrong.push(`day ${day} notread: ${right} WAS read today`);
        for (const o of others) {
          if (!todayKeys.has(o)) wrong.push(`day ${day} notread: ${o} was not read either`);
        }
      } else if (shape === "book") {
        // The answer is a book read today; no other option is.
        const mine = new Set(refs.map((r) => r.book));
        if (!mine.has(right)) wrong.push(`day ${day} book: ${right} was not read today`);
        for (const o of others) {
          if (mine.has(o)) wrong.push(`day ${day} book: ${o} WAS read today`);
        }
      } else if (shape === "which") {
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

console.log("\nno question gives away another");
{
  // Measured before the day kept a record of what it had already spent: the
  // answer to the first question was an option in the second on 354 of 365
  // days, because both lanes drew from the top of the same shuffled pool.
  const shared: string[] = [];
  for (const months of [6, 12, 13]) {
    for (const [i, refs] of daysOf(months).entries()) {
      const qs = quizForDay("p1", i + 1, refs);
      for (let a = 0; a < qs.length; a++) {
        for (let b = a + 1; b < qs.length; b++) {
          for (const o of qs[a].options) {
            if (qs[b].options.includes(o)) shared.push(`${months}mo day ${i + 1}: "${o}" in two questions`);
          }
        }
      }
    }
  }
  check("nothing appears in two of a day's questions", shared.slice(0, 4), []);
}

console.log("\nwrong answers cannot be spotted without reading");
{
  // A distractor from an adjacent chapter would be unfair, and one from the
  // other half of the canon is free: "Aristarchus" beside three names out of
  // Genesis is answerable by someone who has never opened the book. Measured
  // before the rule: a third of name distractors came from the wrong
  // testament, and one "appears" question in twelve could be answered on that
  // alone.
  const order = chapters.map(refKey);
  const tooClose: string[] = [];
  const wrongEra: string[] = [];
  for (const [i, refs] of daysOf(12).entries()) {
    const day = i + 1;
    const firstIdx = order.indexOf(refKey(refs[0]));
    const mine = testamentOf(refs[0].book);
    const todayNames = new Set(refs.flatMap(namesIn));

    for (const q of quizForDay("p1", day, refs)) {
      const shape = shapeOf(q.id);
      if (shape === "which" || shape === "notread") {
        for (const [j, o] of q.options.entries()) {
          if (j === q.answer && shape === "which") continue;
          if (refs.some((r) => refKey(r) === o)) continue;
          const at = order.indexOf(o);
          if (at >= 0 && Math.abs(at - firstIdx) < 60) tooClose.push(`day ${day}: ${o}`);
        }
      }
      if (shape !== "appears" && shape !== "absent") continue;
      // The name that is not in today's reading, whichever side it sits on.
      const foreign = q.options.filter((o) => !todayNames.has(o));
      for (const o of foreign) {
        if (!LIVES_IN.get(o)?.has(mine)) wrongEra.push(`day ${day}: ${o} never appears in the ${mine} testament`);
      }
    }
  }
  check("reference distractors come from far off", tooClose.slice(0, 4), []);
  check("name distractors come from the testament being read", wrongEra.slice(0, 4), []);
}

console.log("\na day asks three different things, and a year is not three prompts");
{
  // Measured before the lane order was shuffled per day: 41% of days ran the
  // identical trio of prompts, and two prompts accounted for 59% of every
  // question asked in a year.
  for (const months of [6, 12, 13]) {
    const days = daysOf(months);
    const repeated: string[] = [];
    const signatures = new Map<string, number>();
    const lanes = new Set<string>();
    for (const [i, refs] of days.entries()) {
      const shapes = quizForDay("p1", i + 1, refs).map((q) => shapeOf(q.id));
      shapes.forEach((s) => lanes.add(s));
      if (new Set(shapes).size !== shapes.length) repeated.push(`day ${i + 1}: ${shapes.join("+")}`);
      const sig = shapes.join("+");
      signatures.set(sig, (signatures.get(sig) ?? 0) + 1);
    }
    check(`${months}mo: no day asks the same lane twice`, repeated.slice(0, 3), []);
    const commonest = Math.max(...signatures.values());
    ok(
      `${months}mo: no run of prompts dominates (${((commonest / days.length) * 100).toFixed(1)}% of days)`,
      commonest / days.length < 0.15,
      `${commonest} of ${days.length} days share one shape`,
    );
    ok(`${months}mo: at least seven of the nine lanes are used`, lanes.size >= 7, [...lanes].join(","));
  }
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
    const full = counts.filter((c) => c === QUESTIONS_PER_DAY).length;
    check(`${months}mo: every day asks something`, counts.filter((c) => c === 0).length, 0);
    ok(
      `${months}mo: a full ${QUESTIONS_PER_DAY} on 85% of days`,
      full / days.length >= 0.85,
      `only ${full} of ${days.length}`,
    );
    ok(
      `${months}mo: never more than ${QUESTIONS_PER_DAY}`,
      counts.every((c) => c <= QUESTIONS_PER_DAY),
    );

    // A short day has to be short for a reason. John 16 to 17 holds no proper
    // noun the corpus counts, so there is one honest question to ask about it
    // and the rest would be padding: the same "which of these did you read
    // today" a second and third time, each giving away the last.
    const thinForNothing = days
      .map((refs, i) => ({ refs, n: counts[i], day: i + 1 }))
      .filter(({ n, refs }) => n < 2 && refs.flatMap(namesIn).length > 0)
      .map(({ day }) => `day ${day}`);
    check(`${months}mo: a day is only left with one question when it has no names`, thinForNothing, []);
  }
}

console.log("\nedges");
{
  check("no chapters means no questions", quizForDay("p1", 1, []), []);
  // Psalm 119: one chapter, no names in it at all. The plainest template is
  // what stands between it and an empty card.
  const one = quizForDay("p1", 1, [{ book: "Psalms", chapter: 119 }]);
  ok("even a lone nameless chapter is asked about", one.length >= 1, `${one.length}`);
}

console.log(failures === 0 ? "\nall quiz checks passed\n" : `\n${failures} FAILED\n`);
if (failures > 0) process.exit(1);
