/**
 * Per-chapter study weights, in minutes.
 *
 * The unit is how long it takes to read a chapter and properly grasp it, which
 * is not the same as how long it takes to read it. Three chapters of Romans are
 * not three chapters of Chronicles, and length alone will never say so.
 *
 * The model is deliberately two-layered:
 *
 *   minutes = overhead + readMinutes x comprehension
 *
 * `readMinutes` is mechanical: how long the words take to pass through your
 * eyes. `comprehension` is the multiplier on top of that read, driven by genre
 * and by five signals measured directly from the text of every chapter. Nothing
 * here is hand-set per chapter; every one of the 1,189 numbers falls out of this
 * function applied to `data/chapter-signals.json`.
 *
 * The full derivation, sources and sanity checks are written up in
 * docs/weighting.md.
 */

export interface ChapterSignals {
  /** Book name. */
  b: string;
  /** Chapter number. */
  c: number;
  /** Verse count. */
  v: number;
  /** Word count. */
  w: number;
  /** Share of the chapter set as poetic lines rather than prose, 0..1. */
  po: number;
  /** Logical connectives per hundred words. */
  ar: number;
  /** Abstract theological vocabulary per hundred words. */
  ab: number;
  /** How much of the chapter reads as a register or genealogy, 0..1. */
  li: number;
  /** Share of the chapter that repeats an earlier 5-word window, 0..1. */
  rp: number;
}

/**
 * Attentive-read words per minute. Anchored to published per-book reading-time
 * tables, which imply 163 wpm across the whole Bible; we model 160.
 */
export const READ_WPM = 160;
/** The fixed cost of sitting down with a chapter at all. */
export const OVERHEAD_MINUTES = 1.5;
/** Whole-Bible study hours the table is calibrated to. */
export const TARGET_HOURS = 250;

/** Comprehension multiplier and expected poetry share, by genre. */
export const GENRES: Record<string, { base: number; poetry: number }> = {
  narrative: { base: 2.3, poetry: 0.05 },
  law: { base: 3.3, poetry: 0.05 },
  /** Blueprints, itineraries and diagnostic manuals: procedure, not argument. */
  spec: { base: 2.2, poetry: 0.02 },
  wisdom: { base: 4.1, poetry: 0.85 },
  psalm: { base: 3.55, poetry: 0.98 },
  prophecy: { base: 4.35, poetry: 0.7 },
  apocalyptic: { base: 5.3, poetry: 0.35 },
  gospel: { base: 3.45, poetry: 0.05 },
  epistlePauline: { base: 5.0, poetry: 0.02 },
  epistleGeneral: { base: 4.45, poetry: 0.02 },
};

const BOOK_GENRE: Record<string, string> = {
  "Genesis": "narrative", "Exodus": "narrative", "Leviticus": "law", "Numbers": "law",
  "Deuteronomy": "law", "Joshua": "narrative", "Judges": "narrative", "Ruth": "narrative",
  "1 Samuel": "narrative", "2 Samuel": "narrative", "1 Kings": "narrative",
  "2 Kings": "narrative", "1 Chronicles": "narrative", "2 Chronicles": "narrative",
  "Ezra": "narrative", "Nehemiah": "narrative", "Esther": "narrative", "Job": "wisdom",
  "Psalms": "psalm", "Proverbs": "wisdom", "Ecclesiastes": "wisdom",
  "Song of Solomon": "wisdom", "Isaiah": "prophecy", "Jeremiah": "prophecy",
  "Lamentations": "prophecy", "Ezekiel": "prophecy", "Daniel": "narrative",
  "Hosea": "prophecy", "Joel": "prophecy", "Amos": "prophecy", "Obadiah": "prophecy",
  "Jonah": "narrative", "Micah": "prophecy", "Nahum": "prophecy", "Habakkuk": "prophecy",
  "Zephaniah": "prophecy", "Haggai": "prophecy", "Zechariah": "prophecy",
  "Malachi": "prophecy", "Matthew": "gospel", "Mark": "gospel", "Luke": "gospel",
  "John": "gospel", "Acts": "narrative", "Romans": "epistlePauline",
  "1 Corinthians": "epistlePauline", "2 Corinthians": "epistlePauline",
  "Galatians": "epistlePauline", "Ephesians": "epistlePauline",
  "Philippians": "epistlePauline", "Colossians": "epistlePauline",
  "1 Thessalonians": "epistlePauline", "2 Thessalonians": "epistlePauline",
  "1 Timothy": "epistlePauline", "2 Timothy": "epistlePauline", "Titus": "epistlePauline",
  "Philemon": "epistlePauline", "Hebrews": "epistleGeneral", "James": "epistleGeneral",
  "1 Peter": "epistleGeneral", "2 Peter": "epistleGeneral", "1 John": "epistleGeneral",
  "2 John": "epistleGeneral", "3 John": "epistleGeneral", "Jude": "epistleGeneral",
  "Revelation": "apocalyptic",
};

/**
 * Genre boundaries inside a book, used only where the shift is one every
 * commentator marks. Each entry is [book, firstChapter, lastChapter, genre].
 */
const SPANS: [string, number, number, string][] = [
  ["Exodus", 20, 24, "law"],
  ["Exodus", 25, 31, "spec"],        // the tabernacle instructions
  ["Exodus", 35, 40, "spec"],        // and its construction, repeated near verbatim
  ["Leviticus", 8, 10, "narrative"], // Aaron's ordination
  ["Leviticus", 11, 15, "spec"],     // the clean and unclean diagnostic manual
  ["Numbers", 11, 25, "narrative"],  // the wilderness story between the two censuses
  ["Numbers", 33, 33, "spec"],       // the itinerary
  ["Deuteronomy", 1, 4, "narrative"],
  ["Deuteronomy", 31, 34, "narrative"],
  ["Job", 1, 2, "narrative"],
  ["Job", 42, 42, "narrative"],
  ["Isaiah", 36, 39, "narrative"],   // the Hezekiah interlude, paralleling 2 Kings
  ["Jeremiah", 39, 45, "narrative"],
  ["Jeremiah", 52, 52, "narrative"],
  ["Ezekiel", 40, 48, "spec"],       // the temple blueprint
  ["Daniel", 7, 12, "apocalyptic"],  // the visions, as against the court tales
  ["Zechariah", 1, 6, "apocalyptic"],
  ["Revelation", 1, 3, "epistleGeneral"], // the letters to the seven churches
];

export function genreOf(book: string, chapter: number): string {
  for (const [b, lo, hi, g] of SPANS) {
    if (b === book && chapter >= lo && chapter <= hi) return g;
  }
  return BOOK_GENRE[book];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface WeighedChapter {
  book: string;
  chapter: number;
  genre: string;
  comprehension: number;
  minutes: number;
}

/**
 * Turn the measured signals into a minute weight for every chapter. Pure: the
 * same input always produces the same 1,189 numbers, which is what lets
 * lib/weights.test.ts assert that the committed table is exactly this output.
 */
export function computeWeights(signals: ChapterSignals[]): WeighedChapter[] {
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const arMean = mean(signals.map((s) => s.ar));
  const abMean = mean(signals.map((s) => s.ab));

  const scored = signals.map((s) => {
    const genre = genreOf(s.b, s.c);
    const g = GENRES[genre];

    // A register is long to read and quick to grasp. Cut the comprehension
    // cost, never the reading cost: you still have to pass your eyes over it.
    const fList = 1 - 0.5 * s.li;
    // Poetry relative to what the genre already assumes, so Isaiah 53 outweighs
    // Isaiah 37 without the Psalms being charged for being poetry twice.
    const fPoetry = clamp(1 + 0.45 * (s.po - g.poetry), 0.8, 1.3);
    // Reasoned discourse: connective density against the whole-Bible mean.
    const fArgue = clamp(1 + 0.028 * (s.ar - arMean), 0.85, 1.3);
    // Abstraction: theological vocabulary density against the whole-Bible mean.
    const fAbstract = clamp(1 + 0.04 * (s.ab - abMean), 0.88, 1.35);
    // Verbatim repetition pays twice: the repeated stretch reads faster, and it
    // only has to be understood once. This is what separates Numbers 7 from
    // Romans 8, when both are a long sit.
    const fRepeat = 1 - 0.35 * s.rp;

    const comprehension = g.base * fList * fPoetry * fArgue * fAbstract * fRepeat;
    const readMinutes = s.w / (READ_WPM * (1 + 0.7 * s.rp));
    return {
      book: s.b, chapter: s.c, genre, comprehension,
      unscaled: OVERHEAD_MINUTES + readMinutes * comprehension,
    };
  });

  // Scale so the whole-Bible total lands on the calibration anchor, then round.
  // Rounding after scaling is why the final total is near, not exactly, target.
  const total = scored.reduce((a, s) => a + s.unscaled, 0);
  const scale = (TARGET_HOURS * 60) / total;
  return scored.map((s) => ({
    book: s.book,
    chapter: s.chapter,
    genre: s.genre,
    comprehension: s.comprehension,
    minutes: Math.max(3, Math.round(s.unscaled * scale)),
  }));
}
