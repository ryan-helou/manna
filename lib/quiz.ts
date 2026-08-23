import { allChapters, BOOKS, refKey, type Ref } from "./bible";
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

/** How many questions a day asks. */
export const QUESTIONS_PER_DAY = 5;

/** Five questions on a day's chapters, drawn from as many angles as it allows. */
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

  const order = ORDER!;
  const todayKeys = new Set(chapters.map(refKey));
  const firstIdx = order.indexOf(refKey(chapters[0]));
  const pool = shuffle(ordered, rnd);

  // Each template contributes what it can; they are interleaved afterwards so a
  // day never asks the same shape five times over.
  const appears: Question[] = [];
  const absent: Question[] = [];
  const first: Question[] = [];
  const locate: Question[] = [];
  const which: Question[] = [];

  // Which name was in today's reading.
  for (const item of pool.slice(0, 4)) {
    const wrong = distractors(seen, chapters, rnd, 3);
    if (wrong.length < 3) break;
    const options = shuffle([item.name, ...wrong], rnd);
    appears.push({
      id: `${day}-appears-${appears.length}`,
      prompt: "Which of these appears in today's reading?",
      options,
      answer: options.indexOf(item.name),
      note: `${item.ref.book} ${item.ref.chapter}`,
    });
  }

  // Which name was not. Needs three genuine ones to sit beside the impostor.
  for (let i = 0; i + 3 <= pool.length && absent.length < 3; i += 3) {
    const right = pool.slice(i, i + 3).map((p) => p.name);
    const wrong = distractors(seen, chapters, rnd, 1);
    if (wrong.length < 1) break;
    const options = shuffle([...right, wrong[0]], rnd);
    absent.push({
      id: `${day}-absent-${absent.length}`,
      prompt: "Which of these does not appear in today's reading?",
      options,
      answer: options.indexOf(wrong[0]),
    });
  }

  // Which came first. Candidates must sit in different chapters: order is known
  // at chapter granularity, so two names from one chapter have no answer
  // between them. An earlier version offered Euphrates against Assyria, which
  // share a verse.
  if (chapters.length >= 3) {
    const byChapter = new Map<string, { name: string; ref: Ref }>();
    for (const item of ordered) {
      const k = refKey(item.ref);
      if (!byChapter.has(k)) byChapter.set(k, item);
    }
    const spread = [...byChapter.values()];
    if (spread.length >= 3) {
      const picks = shuffle(spread, rnd).slice(0, Math.min(4, spread.length));
      const earliest = picks.reduce((a, b) => (ordered.indexOf(a) <= ordered.indexOf(b) ? a : b));
      const options = picks.map((p) => p.name);
      first.push({
        id: `${day}-order`,
        prompt: "Which of these comes first in today's reading?",
        options,
        answer: options.indexOf(earliest.name),
        note: `${earliest.ref.book} ${earliest.ref.chapter}`,
      });
    }
  }

  // Where in the day it turned up. Three chapters minimum: with two, the
  // options are two and it is a coin toss rather than something you could know.
  if (chapters.length >= 3) {
    const homes = new Map<string, Ref[]>();
    for (const ref of chapters) {
      for (const n of namesIn(ref)) {
        if (!homes.has(n)) homes.set(n, []);
        homes.get(n)!.push(ref);
      }
    }
    const unique = shuffle([...homes.entries()].filter(([, refs]) => refs.length === 1), rnd);
    for (const [name, [home]] of unique.slice(0, 3)) {
      const options = shuffle(chapters.map((r) => `${r.book} ${r.chapter}`), rnd);
      locate.push({
        id: `${day}-locate-${locate.length}`,
        prompt: `Which of today's chapters mentions ${name}?`,
        options,
        answer: options.indexOf(`${home.book} ${home.chapter}`),
      });
    }
  }

  // Always available, and what carries a run of Psalms or a stretch of an
  // epistle where there is no name to ask about.
  for (const mine of shuffle(chapters, rnd).slice(0, 4)) {
    const right = refKey(mine);
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
    which.push({
      id: `${day}-which-${which.length}`,
      prompt: "Which of these did you read today?",
      options,
      answer: options.indexOf(right),
    });
  }

  // The inverse of the above, and harder: you have to recognise three of the
  // four as yours rather than one.
  const notRead: Question[] = [];
  if (chapters.length >= 3) {
    for (let round = 0; round < 2; round++) {
      const mine = shuffle(chapters, rnd).slice(0, 3).map(refKey);
      let stray = "";
      for (let attempt = 0; attempt < 400 && !stray; attempt++) {
        const i = Math.floor(rnd() * order.length);
        if (Math.abs(i - firstIdx) < 60) continue;
        if (todayKeys.has(order[i])) continue;
        stray = order[i];
      }
      if (!stray) break;
      const options = shuffle([...mine, stray], rnd);
      notRead.push({
        id: `${day}-notread-${notRead.length}`,
        prompt: "Which of these did you not read today?",
        options,
        answer: options.indexOf(stray),
      });
    }
  }

  // The plainest question there is, and the one that always works: a day of
  // Leviticus procedure or a run of Psalms offers nothing else to ask about.
  const whichBook: Question[] = [];
  {
    const mine = chapters[0].book;
    const others: string[] = [];
    const myIdx = BOOKS.findIndex((b) => b.name === mine);
    for (let attempt = 0; attempt < 200 && others.length < 3; attempt++) {
      const b = BOOKS[Math.floor(rnd() * BOOKS.length)];
      if (Math.abs(BOOKS.indexOf(b) - myIdx) < 6) continue;
      if (chapters.some((c) => c.book === b.name) || others.includes(b.name)) continue;
      others.push(b.name);
    }
    if (others.length === 3) {
      const options = shuffle([mine, ...others], rnd);
      whichBook.push({
        id: `${day}-book`,
        prompt: "Which book did today's reading come from?",
        options,
        answer: options.indexOf(mine),
      });
    }
  }

  // Take one of each shape before taking a second of any, so five questions
  // feel like five different questions. The two plainest go last: they are
  // there to carry the days that offer nothing better.
  const lanes = [appears, absent, first, locate, notRead, which, whichBook];
  const out: Question[] = [];
  for (let round = 0; out.length < QUESTIONS_PER_DAY && round < 5; round++) {
    for (const lane of lanes) {
      if (out.length >= QUESTIONS_PER_DAY) break;
      if (lane[round]) out.push(lane[round]);
    }
  }
  return out;
}
