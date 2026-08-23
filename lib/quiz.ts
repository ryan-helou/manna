import { allChapters, refKey, type Ref } from "./bible";
import { CHAPTER_NAMES } from "./chapter-names";

/**
 * A short daily check: two or three multiple choice questions on the reading
 * you just did.
 *
 * Every question is derived from the text and verified against it, so none of
 * them can be wrong about the Bible. That constraint shapes what they can ask.
 * They are built from names rather than quoted lines, because the app reads the
 * ESV while the corpus behind these is the public domain World English Bible,
 * and "finish the verse" in one translation's wording is simply wrong in the
 * other's. Names cross over; wording does not.
 *
 * So these test whether you read attentively, not what you concluded. That is
 * the honest limit of a question a machine can mark.
 */

export interface Question {
  id: string;
  prompt: string;
  options: string[];
  /** Index into `options`. */
  answer: number;
  /** Shown after answering, to say where it came from. */
  note?: string;
}

let NAMES: Map<string, string[]> | null = null;
let ORDER: string[] | null = null;

function names(): Map<string, string[]> {
  if (!NAMES) {
    NAMES = new Map(Object.entries(CHAPTER_NAMES));
    ORDER = allChapters().map(refKey);
  }
  return NAMES;
}

const namesIn = (ref: Ref): string[] => names().get(refKey(ref)) ?? [];

/** Deterministic per plan and day, so both readers get the same questions. */
function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
}

function shuffle<T>(list: T[], rnd: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Names that appear nowhere in today's chapters. Sound because the vocabulary
 * is never truncated per chapter: a name missing from a chapter's list really is
 * missing from the chapter.
 */
function distractors(today: Set<string>, todayRefs: Ref[], rnd: () => number, want: number): string[] {
  const order = ORDER!;
  const todayIdx = new Set(todayRefs.map((r) => order.indexOf(refKey(r))));
  const first = Math.min(...todayIdx);
  const picked: string[] = [];
  const tried = new Set<number>();
  // Pull from chapters a long way off, so the wrong answers are not merely
  // yesterday's reading, which nobody could fairly be expected to separate.
  for (let attempt = 0; attempt < 500 && picked.length < want; attempt++) {
    const i = Math.floor(rnd() * order.length);
    if (tried.has(i)) continue;
    tried.add(i);
    if (Math.abs(i - first) < 120) continue;
    const pool = names().get(order[i]) ?? [];
    if (!pool.length) continue;
    const cand = pool[Math.floor(rnd() * pool.length)];
    if (today.has(cand) || picked.includes(cand)) continue;
    picked.push(cand);
  }
  return picked;
}

/** Two or three questions on a day's chapters, or none if it has no names. */
export function quizForDay(planId: string, day: number, chapters: Ref[]): Question[] {
  if (chapters.length === 0) return [];
  names();

  const rnd = seeded(`${planId}:${day}:quiz`);
  // In order of first appearance across the day, deduped.
  const ordered: { name: string; ref: Ref }[] = [];
  const seen = new Set<string>();
  for (const ref of chapters) {
    for (const n of namesIn(ref)) {
      if (seen.has(n)) continue;
      seen.add(n);
      ordered.push({ name: n, ref });
    }
  }
  const out: Question[] = [];
  const pool = shuffle(ordered, rnd);

  // 1. One of these was in today's reading.
  if (pool.length > 0) {
    const right = pool[0];
    const wrong = distractors(seen, chapters, rnd, 3);
    if (wrong.length === 3) {
      const options = shuffle([right.name, ...wrong], rnd);
      out.push({
        id: `${day}-appears`,
        prompt: "Which of these appears in today's reading?",
        options,
        answer: options.indexOf(right.name),
        note: `${right.ref.book} ${right.ref.chapter}`,
      });
    }
  }

  // 2. Three were, one was not.
  if (ordered.length >= 3) {
    const right = pool.slice(1, 4).map((p) => p.name);
    const wrong = distractors(seen, chapters, rnd, 1);
    if (right.length === 3 && wrong.length === 1) {
      const options = shuffle([...right, wrong[0]], rnd);
      out.push({
        id: `${day}-absent`,
        prompt: "Which of these does not appear in today's reading?",
        options,
        answer: options.indexOf(wrong[0]),
      });
    }
  }

  // 3. Which came first. Only asked when the candidates sit in different
  //    chapters: order is tracked at chapter granularity, so two names from the
  //    same chapter have no defensible answer between them. An earlier version
  //    offered Euphrates against Assyria, which share a verse.
  if (chapters.length >= 3) {
    const byChapter = new Map<string, { name: string; ref: Ref }>();
    for (const item of ordered) {
      const k = refKey(item.ref);
      if (!byChapter.has(k)) byChapter.set(k, item); // first name of that chapter
    }
    const spread = [...byChapter.values()];
    if (spread.length >= 3) {
      const picks = shuffle(spread, rnd).slice(0, Math.min(4, spread.length));
      const earliest = picks.reduce((a, b) => (ordered.indexOf(a) <= ordered.indexOf(b) ? a : b));
      const options = picks.map((p) => p.name);
      out.push({
        id: `${day}-order`,
        prompt: "Which of these comes first in today's reading?",
        options,
        answer: options.indexOf(earliest.name),
        note: `${earliest.ref.book} ${earliest.ref.chapter}`,
      });
    }
  }

  // 4. Where in the day it turned up. Carries the days that are thin on names
  //    but span several chapters, and asks for something more than recognition.
  // Three chapters minimum: with two, the options are two and the question is a
  // coin toss rather than something you could know.
  if (out.length < 3 && chapters.length >= 3) {
    // A name that belongs to exactly one of today's chapters, so the answer is
    // not merely arguable.
    const homes = new Map<string, Ref[]>();
    for (const ref of chapters) {
      for (const n of namesIn(ref)) {
        if (!homes.has(n)) homes.set(n, []);
        homes.get(n)!.push(ref);
      }
    }
    const unique = shuffle(
      [...homes.entries()].filter(([, refs]) => refs.length === 1),
      rnd,
    );
    const used = new Set(out.flatMap((q) => q.options));
    const choice = unique.find(([n]) => !used.has(n));
    if (choice) {
      const [name, [home]] = choice;
      const options = shuffle(chapters.map((r) => `${r.book} ${r.chapter}`), rnd);
      out.push({
        id: `${day}-locate`,
        prompt: `Which of today's chapters mentions ${name}?`,
        options,
        answer: options.indexOf(`${home.book} ${home.chapter}`),
      });
    }
  }

  // 5. Last resort, and always available: which reference was today's. Carries
  //    the days with no names to speak of, a run of Psalms or a stretch of an
  //    epistle, where there is nothing else to ask about.
  const order = ORDER!;
  const todayKeys = new Set(chapters.map(refKey));
  const firstIdx = order.indexOf(refKey(chapters[0]));
  const asked = new Set<string>();
  for (let round = 0; out.length < 2 && round < 4; round++) {
    const mine = chapters[Math.floor(rnd() * chapters.length)];
    const right = refKey(mine);
    if (asked.has(right)) continue;
    asked.add(right);
    const wrong: string[] = [];
    for (let attempt = 0; attempt < 400 && wrong.length < 3; attempt++) {
      const i = Math.floor(rnd() * order.length);
      if (Math.abs(i - firstIdx) < 60) continue;
      const k = order[i];
      if (todayKeys.has(k) || wrong.includes(k)) continue;
      wrong.push(k);
    }
    if (wrong.length < 3) break;
    const options = shuffle([right, ...wrong], rnd);
    out.push({
      id: `${day}-which-${round}`,
      prompt: "Which of these did you read today?",
      options,
      answer: options.indexOf(right),
    });
  }

  return out.slice(0, 3);
}
