import { allChapters, BOOKS, refKey, type Ref } from "./bible";
import { CHAPTER_NAMES } from "./chapter-names";

/**
 * A short daily check: three multiple choice questions on the reading you just
 * did.
 *
 * Every question is derived from the text and verified against it, so none of
 * them can be wrong about the Bible. That constraint shapes what they can ask.
 * They are built from names rather than quoted lines, because the app reads the
 * ESV while the corpus behind these is the public domain World English Bible,
 * and "finish the verse" in one translation's wording is simply wrong in the
 * other's. Names cross over; wording does not.
 *
 * So these test whether you read attentively, not what you concluded. That is
 * the honest limit of a question a machine can mark. Within that limit there is
 * still a difference between a question you can only answer by having read and
 * one you can answer by pattern-matching, and three rules keep it on the right
 * side of that line:
 *
 *   1. Nothing repeats inside a day. A name that is the answer to one question
 *      is never an option in another, or the first question gives away the
 *      second.
 *   2. A wrong option has to be plausible. Distractors come from the same
 *      testament as the reading, because "Aristarchus" beside three names out
 *      of Genesis is answerable by anyone who has never opened the book.
 *   3. The day's questions come from different angles. The lane order is
 *      shuffled per day, so a year is not the same three prompts over and over.
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

/** How many questions a day asks. */
export const QUESTIONS_PER_DAY = 3;

/**
 * Four options, always. The count used to follow whatever the day happened to
 * offer, which produced a twelve-option question on a day of twelve psalms.
 */
const OPTIONS = 4;

/** How far off a name distractor must live, in chapters. */
const NAME_GAP = 120;
/** The same, for a chapter reference. Shorter: a reference is easier to place. */
const REF_GAP = 60;

// ---------------------------------------------------------------------------
// The corpus, indexed once.
// ---------------------------------------------------------------------------

let CHAPTERS: Ref[] = [];
let ORDER: string[] = [];
let AT = new Map<string, number>();
let NAMES = new Map<string, string[]>();
let NT_START = 0;
let ready = false;

function load() {
  if (ready) return;
  CHAPTERS = allChapters();
  ORDER = CHAPTERS.map(refKey);
  // A map rather than repeated indexOf: this is walked inside every draw.
  AT = new Map(ORDER.map((k, i) => [k, i]));
  NAMES = new Map(Object.entries(CHAPTER_NAMES));
  const nt = new Set(BOOKS.filter((b) => b.testament === "new").map((b) => b.name));
  NT_START = CHAPTERS.findIndex((c) => nt.has(c.book));
  ready = true;
}

const namesIn = (ref: Ref): string[] => NAMES.get(refKey(ref)) ?? [];

/**
 * Words the extractor keeps but that are not really names: peoples and
 * languages, gentilic adjectives, and a few capitalised abstractions the corpus
 * never writes in lower case. "Which of these appears in today's reading:
 * Levitical, Sabbaths, Hittites, Sheol" reads as a trick rather than a question
 * about the reading.
 *
 * This only decides what we are willing to ASK about. The stored list per
 * chapter stays complete, which is what keeps "which of these does not appear"
 * sound: a name filtered out here is still counted as present when checking
 * that a distractor really is absent.
 */
const NOT_A_NAME = new Set([
  "Aha", "Alas", "Hosanna", "Levitical", "Sabbaths", "Pentecost", "Creator",
  "Hebrew", "Hebrews", "Greek", "Greeks", "Roman", "Romans", "Jewish",
  "Christian", "Cretans", "Chaldees", "Nazarene",
  "Sheol", "Urim", "Thummim", "Baals",
  "Anakim", "Nephilim", "Rephaim",
]);
/** Gentilic endings: Hittite, Hittites, Assyrians, Chaldeans. */
const PEOPLES = /(?:ites?|ians|eans)$/;

const askable = (n: string) => !NOT_A_NAME.has(n) && !PEOPLES.test(n);

/** Deterministic per plan and day, so everyone gets the same questions. */
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

// ---------------------------------------------------------------------------
// Drawing wrong answers.
// ---------------------------------------------------------------------------

/** How far chapter `i` sits outside today's contiguous run. */
function gapFrom(span: { first: number; last: number }, i: number): number {
  if (i < span.first) return span.first - i;
  if (i > span.last) return i - span.last;
  return 0;
}

/** The half of the canon today's reading sits in. */
function testamentBand(first: number): [number, number] {
  return first >= NT_START ? [NT_START, ORDER.length] : [0, NT_START];
}

interface Foreign {
  name: string;
  /** Where it actually lives, so the card can say so afterwards. */
  ref: Ref;
}

/**
 * Names from outside today's reading.
 *
 * Sound because a chapter's stored vocabulary is never truncated: a name
 * missing from a chapter's list really is missing from the chapter.
 *
 * Two competing fairness rules, applied in order. A distractor must not come
 * from a chapter near today, because nobody can reasonably separate today's
 * names from the ones a day either side; and it should come from the same
 * testament, because otherwise the era gives the answer away without reading.
 * Measured before this rule existed: a third of distractors were from the wrong
 * testament, and one "appears" question in twelve could be answered on that
 * alone. Distance is the rule worth relaxing first, since a merely nearby name
 * is unfair rather than free.
 */
function foreignNames(
  span: { first: number; last: number },
  todayAll: Set<string>,
  used: Set<string>,
  rnd: () => number,
  want: number,
): Foreign[] {
  const [lo, hi] = testamentBand(span.first);
  const out: Foreign[] = [];
  const rules = [
    { lo, hi, gap: NAME_GAP },
    { lo, hi, gap: 40 },
    { lo: 0, hi: ORDER.length, gap: NAME_GAP },
  ];
  for (const rule of rules) {
    for (let tries = 0; tries < 600 && out.length < want; tries++) {
      const i = rule.lo + Math.floor(rnd() * (rule.hi - rule.lo));
      if (gapFrom(span, i) < rule.gap) continue;
      const pool = (NAMES.get(ORDER[i]) ?? []).filter(askable);
      if (!pool.length) continue;
      const cand = pool[Math.floor(rnd() * pool.length)];
      if (todayAll.has(cand) || used.has(cand)) continue;
      if (out.some((o) => o.name === cand)) continue;
      out.push({ name: cand, ref: CHAPTERS[i] });
    }
    if (out.length >= want) break;
  }
  return out;
}

/** Chapter references from outside today, same testament where possible. */
function foreignRefs(
  span: { first: number; last: number },
  todayKeys: Set<string>,
  used: Set<string>,
  rnd: () => number,
  want: number,
): string[] {
  const [lo, hi] = testamentBand(span.first);
  // A chapter of the book you are already in is a far better wrong answer than
  // one from another book. "Which of these did you read today: Leviticus 2,
  // Hosea 4, Psalms 147" is answerable by anyone who knows they are in
  // Leviticus. Only the long books can offer one at a fair distance, so this is
  // a preference rather than a rule.
  const book = CHAPTERS[span.first].book;
  const mine = BOOKS.findIndex((b) => b.name === book);
  const bookLo = ORDER.findIndex((k) => CHAPTERS[AT.get(k)!].book === book);
  const bookHi = bookLo + (BOOKS[mine]?.chapters ?? 0);
  const out: string[] = [];
  const rules = [
    { lo: bookLo, hi: bookHi, gap: REF_GAP },
    { lo, hi, gap: REF_GAP },
    { lo: 0, hi: ORDER.length, gap: REF_GAP },
  ];
  for (const rule of rules) {
    for (let tries = 0; tries < 600 && out.length < want; tries++) {
      const i = rule.lo + Math.floor(rnd() * (rule.hi - rule.lo));
      if (gapFrom(span, i) < rule.gap) continue;
      const k = ORDER[i];
      if (todayKeys.has(k) || used.has(k) || out.includes(k)) continue;
      out.push(k);
      if (out.length >= 2 && rule.hi === bookHi) break; // leave room for variety
    }
    if (out.length >= want) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// The day.
// ---------------------------------------------------------------------------

interface Seat {
  name: string;
  /** Every chapter of today's reading the name turns up in. */
  homes: Ref[];
}

/** Three questions on a day's chapters, drawn from as many angles as it allows. */
export function quizForDay(planId: string, day: number, chapters: Ref[]): Question[] {
  if (chapters.length === 0) return [];
  load();

  const todayKeys = new Set(chapters.map(refKey));
  const first = AT.get(refKey(chapters[0])) ?? 0;
  const span = { first, last: AT.get(refKey(chapters[chapters.length - 1])) ?? first };

  // Every name in today's reading, filtered or not. This is what a distractor
  // is checked against, so filtering must not reach it.
  const todayAll = new Set(chapters.flatMap(namesIn));

  // The names we are willing to ask about, with where they sit today.
  const homes = new Map<string, Ref[]>();
  for (const ref of chapters) {
    for (const n of namesIn(ref)) {
      if (!askable(n)) continue;
      if (!homes.has(n)) homes.set(n, []);
      homes.get(n)!.push(ref);
    }
  }
  // The same again without the quality filter. A day of Leviticus procedure may
  // hold nothing but gentilics; asking about "Amorites" is plainer than asking
  // about Aaron, but it is still a question about the reading, which beats
  // padding the card with a third variation of "which of these did you read".
  const allHomes = new Map<string, Ref[]>();
  for (const ref of chapters) {
    for (const n of namesIn(ref)) {
      if (!allHomes.has(n)) allHomes.set(n, []);
      allHomes.get(n)!.push(ref);
    }
  }
  const seatsIn = (pick: (n: string) => boolean, from: Map<string, Ref[]>): Seat[] => {
    const out: Seat[] = [];
    for (const ref of chapters) {
      for (const n of namesIn(ref)) {
        if (!pick(n) || out.some((s) => s.name === n)) continue;
        out.push({ name: n, homes: from.get(n)! });
      }
    }
      return out;
  };
  const preferred = seatsIn(askable, homes);
  const everything = seatsIn(() => true, allHomes);

  const attemptDay = (rnd: () => number, seats: Seat[]): Question[] => {
    /**
     * Everything already spoken for today. A name leaves this set for no reason:
     * before this existed, the answer to the first question was an option in the
     * second on 97% of days, because both lanes drew from the top of the same
     * shuffled pool.
     */
    const used = new Set<string>();
    const bag = shuffle(seats, rnd);
    const take = (want: number, fits: (s: Seat) => boolean = () => true): Seat[] => {
      const got: Seat[] = [];
      for (const seat of bag) {
        if (got.length >= want) break;
        if (used.has(seat.name) || !fits(seat)) continue;
        got.push(seat);
      }
      return got;
  };
  const spend = (...tokens: string[]) => tokens.forEach((t) => used.add(t));
  /**
   * A chapter reference spends its book along with itself. "Which of these did
   * you read today: Exodus 20" answers "which book did today's reading come
   * from" outright, even though the two questions share no option text.
   */
  const spendRef = (...keys: string[]) =>
    keys.forEach((k) => {
      used.add(k);
      const i = AT.get(k);
      if (i !== undefined) used.add(CHAPTERS[i].book);
    });
  const place = (right: string, wrong: string[]) => {
    const options = shuffle([right, ...wrong], rnd);
    return { options, answer: options.indexOf(right) };
  };

  const only = (s: Seat) => s.homes.length === 1;

  // Each lane builds one question or returns null, consuming from the shared
  // pools as it goes.
  type Lane = { key: string; build: () => Question | null };

  const appears: Lane = {
    key: "appears",
    build: () => {
      const [seat] = take(1);
      if (!seat) return null;
      const wrong = foreignNames(span, todayAll, used, rnd, OPTIONS - 1);
      if (wrong.length < OPTIONS - 1) return null;
      spend(seat.name, ...wrong.map((w) => w.name));
      const { options, answer } = place(seat.name, wrong.map((w) => w.name));
      return {
        id: `${day}-appears`,
        prompt: "Which of these appears in today's reading?",
        options,
        answer,
        note: `${seat.name} is in ${refKey(seat.homes[0])}.`,
      };
    },
  };

  const absent: Lane = {
    key: "absent",
    build: () => {
      const seats = take(OPTIONS - 1);
      if (seats.length < 2) return null;
      const [stray] = foreignNames(span, todayAll, used, rnd, 1);
      if (!stray) return null;
      spend(stray.name, ...seats.map((s) => s.name));
      const { options, answer } = place(stray.name, seats.map((s) => s.name));
      return {
        id: `${day}-absent`,
        prompt: "Which of these does not appear in today's reading?",
        options,
        answer,
        note: `${stray.name} is in ${refKey(stray.ref)}, not in today's reading.`,
      };
    },
  };

  // Order is known at chapter granularity, so the candidates have to sit in
  // different chapters: two names from one chapter have no answer between them.
  // An earlier version offered Euphrates against Assyria, which share a verse.
  const order: Lane = {
    key: "order",
    build: () => {
      if (chapters.length < 3) return null;
      const seen = new Set<string>();
      const seats = take(OPTIONS, (s) => {
        const k = refKey(s.homes[0]);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (seats.length < 3) return null;
      const rank = (s: Seat) => AT.get(refKey(s.homes[0])) ?? 0;
      const earliest = seats.reduce((a, b) => (rank(a) <= rank(b) ? a : b));
      spend(...seats.map((s) => s.name));
      const options = shuffle(seats.map((s) => s.name), rnd);
      return {
        id: `${day}-order`,
        prompt: "Which of these comes first in today's reading?",
        options,
        answer: options.indexOf(earliest.name),
        note: `${earliest.name} is in ${refKey(earliest.homes[0])}.`,
      };
    },
  };

  // Which chapter it was in. Capped at four: on a day of twelve psalms this
  // used to list all twelve.
  const locate: Lane = {
    key: "locate",
    build: () => {
      if (chapters.length < 3) return null;
      const [seat] = take(1, only);
      if (!seat) return null;
      const home = refKey(seat.homes[0]);
      const others = shuffle(
        chapters.map(refKey).filter((c) => c !== home),
        rnd,
      ).slice(0, OPTIONS - 1);
      if (others.length < 2) return null;
      spend(seat.name);
      spendRef(home, ...others);
      const { options, answer } = place(home, others);
      return {
        id: `${day}-locate`,
        prompt: `Which of today's chapters mentions ${seat.name}?`,
        options,
        answer,
      };
    },
  };

  /**
   * Who turned up beside whom. The distractors are today's own names, so the
   * era tells you nothing and the only way through is to have read the chapter.
   */
  const together: Lane = {
    key: "cooccur",
    build: () => {
      if (chapters.length < 2) return null;
      const [subject] = take(1, (s) => only(s) && namesIn(s.homes[0]).filter(askable).length >= 2);
      if (!subject) return null;
      const home = subject.homes[0];
      const homeNames = new Set(namesIn(home));
      const [mate] = take(1, (s) => s.name !== subject.name && homeNames.has(s.name));
      if (!mate) return null;
      const wrong = take(OPTIONS - 1, (s) => !homeNames.has(s.name) && s.name !== mate.name);
      if (wrong.length < 2) return null;
      spend(subject.name, mate.name, ...wrong.map((s) => s.name));
      const { options, answer } = place(mate.name, wrong.map((s) => s.name));
      return {
        id: `${day}-cooccur`,
        prompt: `Which of these appears in the same chapter as ${subject.name}?`,
        options,
        answer,
        note: `Both are in ${refKey(home)}.`,
      };
    },
  };

  /** Reading the whole day rather than one chapter of it. */
  const across: Lane = {
    key: "multi",
    build: () => {
      if (chapters.length < 2) return null;
      const [seat] = take(1, (s) => s.homes.length >= 2);
      if (!seat) return null;
      const wrong = take(OPTIONS - 1, only);
      if (wrong.length < 2) return null;
      spend(seat.name, ...wrong.map((s) => s.name));
      const { options, answer } = place(seat.name, wrong.map((s) => s.name));
      return {
        id: `${day}-multi`,
        prompt: "Which of these appears in more than one of today's chapters?",
        options,
        answer,
        note: `${seat.name} is in ${seat.homes.map(refKey).join(" and ")}.`,
      };
    },
  };

  // The plainest questions there are, and what carries a run of Psalms or a
  // stretch of an epistle where there is no name to ask about. They go last on
  // purpose: they are a floor, not a lane in the rotation.
  const which: Lane = {
    key: "which",
    build: () => {
      const mine = shuffle(chapters, rnd).find((r) => !used.has(refKey(r)));
      if (!mine) return null;
      const wrong = foreignRefs(span, todayKeys, used, rnd, OPTIONS - 1);
      if (wrong.length < OPTIONS - 1) return null;
      spendRef(refKey(mine), ...wrong);
      const { options, answer } = place(refKey(mine), wrong);
      return { id: `${day}-which`, prompt: "Which of these did you read today?", options, answer };
    },
  };

  const notRead: Lane = {
    key: "notread",
    build: () => {
      if (chapters.length < 2) return null;
      const mine = shuffle(chapters, rnd)
        .filter((r) => !used.has(refKey(r)))
        .slice(0, OPTIONS - 1)
        .map(refKey);
      if (mine.length < 2) return null;
      const [stray] = foreignRefs(span, todayKeys, used, rnd, 1);
      if (!stray) return null;
      spendRef(stray, ...mine);
      const { options, answer } = place(stray, mine);
      return { id: `${day}-notread`, prompt: "Which of these did you not read today?", options, answer };
    },
  };

  const whichBook: Lane = {
    key: "book",
    build: () => {
      const mine = chapters[0].book;
      if (used.has(mine)) return null;
      const myIdx = BOOKS.findIndex((b) => b.name === mine);
      const others: string[] = [];
      for (let tries = 0; tries < 300 && others.length < OPTIONS - 1; tries++) {
        const b = BOOKS[Math.floor(rnd() * BOOKS.length)];
        if (Math.abs(BOOKS.indexOf(b) - myIdx) < 6) continue;
        if (chapters.some((c) => c.book === b.name) || others.includes(b.name)) continue;
        if (used.has(b.name)) continue;
        others.push(b.name);
      }
      if (others.length < OPTIONS - 1) return null;
      spend(mine, ...others);
      const { options, answer } = place(mine, others);
      return { id: `${day}-book`, prompt: "Which book did today's reading come from?", options, answer };
    },
  };

  // Shuffled per day, so a year of readings is not the same three prompts over
  // and over. Measured before this: 41% of days ran the identical trio, and two
  // prompts accounted for 59% of every question asked.
  const rotation = shuffle([appears, absent, order, locate, together, across], rnd);

  // The lanes that ask something, then the plain ones as a floor under a day
  // that offers nothing better. One question per lane: two turns of the same
  // lane read as the same question asked twice, as "which of today's chapters
  // mentions Canaan" followed by "which of today's chapters mentions Hebrew"
  // over an identical list of options.
  const out: Question[] = [];
  for (const lane of [...rotation, which, notRead, whichBook]) {
    if (out.length >= QUESTIONS_PER_DAY) break;
    const q = lane.build();
    if (q) out.push(q);
  }
  return out;
  };

  /**
   * Lane order decides what a thin day can ask, because the lanes compete for
   * the same names and chapters. Proverbs 24 to 26 holds exactly one name
   * between them: if "which of today's chapters mentions Hezekiah" is drawn
   * first it spends the name and all three chapters, and the day is left with
   * one question, where another order gets three.
   *
   * So the order is not one roll of the dice. Try a few, keep the first that
   * fills the card, and fall back to the best of them. Still deterministic:
   * the attempt number is part of the seed.
   */
  let best: Question[] = [];
  for (let attempt = 0; attempt < 8 && best.length < QUESTIONS_PER_DAY; attempt++) {
    // Good names first. A day that cannot fill the card on those is asked again
    // over everything its chapters hold, gentilics included: "which of these
    // appears in today's reading: Amorites" is plainer than one built on Aaron,
    // but it is still a question about the reading, which beats padding the
    // card with a third variation of "which of these did you read today".
    for (const seats of [preferred, everything]) {
      const got = attemptDay(seeded(`${planId}:${day}:quiz:${attempt}`), seats);
      if (got.length > best.length) best = got;
      if (best.length >= QUESTIONS_PER_DAY) break;
    }
  }
  return best;
}
