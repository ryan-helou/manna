import { readFileSync } from "node:fs";
import { CHAPTER_WEIGHTS, TOTAL_WEIGHT_MINUTES, weightOf } from "./weights";
import { computeWeights, genreOf, TARGET_HOURS, type ChapterSignals } from "./weighting";
import { BOOKS, TOTAL_CHAPTERS, allChapters } from "./bible";

/**
 * The weight table is the heart of the app: it decides what lands on your plate
 * every morning. These checks hold it to two things. It has to be exactly what
 * the documented model produces from the measured signals, so nobody can quietly
 * hand-tune a number. And it has to agree with what anyone who reads the Bible
 * would tell you: genealogies are quick, Romans is not.
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

const signals = JSON.parse(
  readFileSync(new URL("../data/chapter-signals.json", import.meta.url), "utf8"),
) as ChapterSignals[];

console.log("\nthe committed table is exactly what the model produces");
{
  check("one signal row per chapter", signals.length, TOTAL_CHAPTERS);
  const model = computeWeights(signals);
  const mismatches = model.filter((m) => weightOf(m.book, m.chapter) !== m.minutes);
  ok(
    "every committed weight matches lib/weighting.ts",
    mismatches.length === 0,
    mismatches.slice(0, 5).map((m) => `${m.book} ${m.chapter}: table has ${weightOf(m.book, m.chapter)}, model says ${m.minutes}`).join("; ") +
      (mismatches.length > 5 ? ` (+${mismatches.length - 5} more)` : ""),
  );
  check("total matches", model.reduce((a, m) => a + m.minutes, 0), TOTAL_WEIGHT_MINUTES);
}

console.log("\nshape of the table");
{
  check("covers all 66 books", Object.keys(CHAPTER_WEIGHTS).length, 66);
  const wrong = BOOKS.filter((b) => (CHAPTER_WEIGHTS[b.name]?.length ?? 0) !== b.chapters);
  check("every book has its full chapter count", wrong.map((b) => b.name), []);

  const all = allChapters().map((c) => weightOf(c.book, c.chapter));
  check("1,189 weights", all.length, 1189);
  ok("every weight is a positive whole number", all.every((w) => Number.isInteger(w) && w > 0));
  ok("nothing under the 3 minute floor", Math.min(...all) >= 3, `min is ${Math.min(...all)}`);
  // A single chapter that ran to two hours would break any plan it landed in.
  ok("nothing over an hour", Math.max(...all) <= 60, `max is ${Math.max(...all)}`);

  const hours = TOTAL_WEIGHT_MINUTES / 60;
  ok(
    `whole Bible lands near the ${TARGET_HOURS} hour anchor`,
    Math.abs(hours - TARGET_HOURS) / TARGET_HOURS < 0.02,
    `${hours.toFixed(1)} hours`,
  );
}

console.log("\nsanity: narrative and genealogy are light");
{
  // The registers everyone skims. Each should sit well under the average.
  const avg = TOTAL_WEIGHT_MINUTES / TOTAL_CHAPTERS;
  const registers: [string, number][] = [
    ["Genesis", 5], ["Genesis", 10], ["Genesis", 36],
    ["Numbers", 1], ["Numbers", 7],
    ["1 Chronicles", 1], ["1 Chronicles", 2], ["1 Chronicles", 8],
    ["Ezra", 2], ["Nehemiah", 7],
  ];
  for (const [b, c] of registers) {
    const w = weightOf(b, c);
    // Numbers 7 is 1,900 words: it still takes real time to read, so judge these
    // against the per-word cost, not the raw minutes.
    const words = signals.find((s) => s.b === b && s.c === c)!.w;
    ok(
      `${b} ${c} is cheap per word (${w} min for ${words} words)`,
      w / words < 0.012,
      `${(w / words).toFixed(4)} min/word vs average ${(TOTAL_WEIGHT_MINUTES / signals.reduce((a, s) => a + s.w, 0)).toFixed(4)}`,
    );
  }
  ok(`Genesis 5 (${weightOf("Genesis", 5)} min) is under half the average`, weightOf("Genesis", 5) < avg / 2);
}

console.log("\nsanity: dense epistles, prophecy and Revelation are heavy");
{
  const perWord = (b: string, c: number) =>
    weightOf(b, c) / signals.find((s) => s.b === b && s.c === c)!.w;

  // Three chapters of Romans is not three chapters of Chronicles.
  const romans = [1, 2, 3, 4, 5, 6, 7, 8].map((c) => perWord("Romans", c));
  const chron = [1, 2, 3, 4, 5].map((c) => perWord("1 Chronicles", c));
  const romansAvg = romans.reduce((a, b) => a + b, 0) / romans.length;
  const chronAvg = chron.reduce((a, b) => a + b, 0) / chron.length;
  ok(
    `Romans costs 3x Chronicles per word (${(romansAvg / chronAvg).toFixed(1)}x)`,
    romansAvg / chronAvg > 3,
  );

  const heavyBooks = ["Romans", "Galatians", "Hebrews", "Ephesians"];
  const lightBooks = ["1 Chronicles", "Joshua", "Ezra", "Esther"];
  const bookPerWord = (name: string) => {
    const rows = signals.filter((s) => s.b === name);
    const mins = rows.reduce((a, s) => a + weightOf(s.b, s.c), 0);
    const words = rows.reduce((a, s) => a + s.w, 0);
    return mins / words;
  };
  for (const h of heavyBooks) {
    for (const l of lightBooks) {
      ok(`${h} outweighs ${l} per word`, bookPerWord(h) > bookPerWord(l) * 2);
    }
  }

  // Revelation and the prophets should clear the whole-Bible average per word.
  const globalPerWord = TOTAL_WEIGHT_MINUTES / signals.reduce((a, s) => a + s.w, 0);
  for (const b of ["Revelation", "Isaiah", "Jeremiah", "Hosea", "Amos", "Micah"]) {
    ok(`${b} is above average per word`, bookPerWord(b) > globalPerWord);
  }
  for (const b of ["Genesis", "Joshua", "Judges", "1 Kings", "Acts", "Esther"]) {
    ok(`${b} is below average per word`, bookPerWord(b) < globalPerWord);
  }

  // Ezekiel and Daniel deliberately do NOT clear it as whole books, because each
  // carries a large block that is not prophecy at all: Ezekiel's temple
  // blueprint and Daniel's court tales. Judging them book-wide would hide the
  // very thing the per-chapter weighting exists to capture, so judge the spans.
  const spanPerWord = (name: string, lo: number, hi: number) => {
    const rows = signals.filter((s) => s.b === name && s.c >= lo && s.c <= hi);
    const mins = rows.reduce((a, s) => a + weightOf(s.b, s.c), 0);
    const words = rows.reduce((a, s) => a + s.w, 0);
    return mins / words;
  };
  const spans: [string, string, number, number, boolean][] = [
    ["Ezekiel's oracles", "Ezekiel", 1, 39, true],
    ["Ezekiel's temple blueprint", "Ezekiel", 40, 48, false],
    ["Daniel's visions", "Daniel", 7, 12, true],
    ["Daniel's court tales", "Daniel", 1, 6, false],
    ["Isaiah's oracles", "Isaiah", 1, 35, true],
    ["Isaiah's Hezekiah narrative", "Isaiah", 36, 39, false],
  ];
  for (const [label, book, lo, hi, aboveAverage] of spans) {
    const pw = spanPerWord(book, lo, hi);
    ok(
      `${label} is ${aboveAverage ? "above" : "below"} average per word`,
      aboveAverage ? pw > globalPerWord : pw < globalPerWord,
      `${(pw / globalPerWord).toFixed(2)}x the whole-Bible average`,
    );
  }
  // And the contrast inside each book is the point: same author, same book,
  // different genre, different cost.
  ok(
    "Daniel's visions cost ~2x his court tales per word",
    spanPerWord("Daniel", 7, 12) / spanPerWord("Daniel", 1, 6) > 1.8,
  );
  ok(
    "Ezekiel's oracles cost ~1.5x his blueprint per word",
    spanPerWord("Ezekiel", 1, 39) / spanPerWord("Ezekiel", 40, 48) > 1.5,
  );
}

console.log("\ngenre assignment");
{
  check("every book resolves to a genre", BOOKS.filter((b) => !genreOf(b.name, 1)).map((b) => b.name), []);
  check("Daniel 6 is a court tale", genreOf("Daniel", 6), "narrative");
  check("Daniel 7 is apocalyptic", genreOf("Daniel", 7), "apocalyptic");
  check("Isaiah 37 is the narrative interlude", genreOf("Isaiah", 37), "narrative");
  check("Isaiah 53 is prophecy", genreOf("Isaiah", 53), "prophecy");
  check("Ezekiel 40 is the temple blueprint", genreOf("Ezekiel", 40), "spec");
  check("Revelation 2 is a letter", genreOf("Revelation", 2), "epistleGeneral");
  check("Revelation 13 is apocalyptic", genreOf("Revelation", 13), "apocalyptic");
  // The narrative interlude must actually come out lighter than the oracles.
  ok(
    "Isaiah 53 outweighs Isaiah 37 per word",
    weightOf("Isaiah", 53) / signals.find((s) => s.b === "Isaiah" && s.c === 53)!.w >
      weightOf("Isaiah", 37) / signals.find((s) => s.b === "Isaiah" && s.c === 37)!.w,
  );
}

console.log("\nchapters inside a book differ from each other");
{
  // The whole point of per-chapter weighting: a book must not be a flat rate.
  for (const b of ["Genesis", "Isaiah", "Psalms", "Numbers", "Luke"]) {
    const list = CHAPTER_WEIGHTS[b];
    check(`${b} is not one flat number`, new Set(list).size > 1, true);
  }
  const genesis = CHAPTER_WEIGHTS["Genesis"];
  ok(
    `Genesis 1 (${genesis[0]}) differs from Genesis 36 (${genesis[35]})`,
    genesis[0] !== genesis[35],
  );
}

console.log(failures === 0 ? "\nall weight checks passed\n" : `\n${failures} FAILED\n`);
if (failures > 0) process.exit(1);
