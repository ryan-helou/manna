/**
 * The canonical Protestant Bible: 66 books, 1,189 chapters, in the order they
 * are printed. Every plan covers all of it; the only variable is pace, so this
 * list is fixed data rather than configuration.
 */

export interface Book {
  name: string;
  /** Short form used in tight UI (heatmap tooltips, badges). */
  abbrev: string;
  chapters: number;
  testament: "old" | "new";
  /** USFM code, used to build YouVersion deep links. */
  usfm: string;
}

export const BOOKS: Book[] = [
  { name: "Genesis", abbrev: "Gen", chapters: 50, testament: "old", usfm: "GEN" },
  { name: "Exodus", abbrev: "Ex", chapters: 40, testament: "old", usfm: "EXO" },
  { name: "Leviticus", abbrev: "Lev", chapters: 27, testament: "old", usfm: "LEV" },
  { name: "Numbers", abbrev: "Num", chapters: 36, testament: "old", usfm: "NUM" },
  { name: "Deuteronomy", abbrev: "Deut", chapters: 34, testament: "old", usfm: "DEU" },
  { name: "Joshua", abbrev: "Josh", chapters: 24, testament: "old", usfm: "JOS" },
  { name: "Judges", abbrev: "Judg", chapters: 21, testament: "old", usfm: "JDG" },
  { name: "Ruth", abbrev: "Ruth", chapters: 4, testament: "old", usfm: "RUT" },
  { name: "1 Samuel", abbrev: "1 Sam", chapters: 31, testament: "old", usfm: "1SA" },
  { name: "2 Samuel", abbrev: "2 Sam", chapters: 24, testament: "old", usfm: "2SA" },
  { name: "1 Kings", abbrev: "1 Kgs", chapters: 22, testament: "old", usfm: "1KI" },
  { name: "2 Kings", abbrev: "2 Kgs", chapters: 25, testament: "old", usfm: "2KI" },
  { name: "1 Chronicles", abbrev: "1 Chr", chapters: 29, testament: "old", usfm: "1CH" },
  { name: "2 Chronicles", abbrev: "2 Chr", chapters: 36, testament: "old", usfm: "2CH" },
  { name: "Ezra", abbrev: "Ezra", chapters: 10, testament: "old", usfm: "EZR" },
  { name: "Nehemiah", abbrev: "Neh", chapters: 13, testament: "old", usfm: "NEH" },
  { name: "Esther", abbrev: "Est", chapters: 10, testament: "old", usfm: "EST" },
  { name: "Job", abbrev: "Job", chapters: 42, testament: "old", usfm: "JOB" },
  { name: "Psalms", abbrev: "Ps", chapters: 150, testament: "old", usfm: "PSA" },
  { name: "Proverbs", abbrev: "Prov", chapters: 31, testament: "old", usfm: "PRO" },
  { name: "Ecclesiastes", abbrev: "Eccl", chapters: 12, testament: "old", usfm: "ECC" },
  { name: "Song of Solomon", abbrev: "Song", chapters: 8, testament: "old", usfm: "SNG" },
  { name: "Isaiah", abbrev: "Isa", chapters: 66, testament: "old", usfm: "ISA" },
  { name: "Jeremiah", abbrev: "Jer", chapters: 52, testament: "old", usfm: "JER" },
  { name: "Lamentations", abbrev: "Lam", chapters: 5, testament: "old", usfm: "LAM" },
  { name: "Ezekiel", abbrev: "Ezek", chapters: 48, testament: "old", usfm: "EZK" },
  { name: "Daniel", abbrev: "Dan", chapters: 12, testament: "old", usfm: "DAN" },
  { name: "Hosea", abbrev: "Hos", chapters: 14, testament: "old", usfm: "HOS" },
  { name: "Joel", abbrev: "Joel", chapters: 3, testament: "old", usfm: "JOL" },
  { name: "Amos", abbrev: "Amos", chapters: 9, testament: "old", usfm: "AMO" },
  { name: "Obadiah", abbrev: "Obad", chapters: 1, testament: "old", usfm: "OBA" },
  { name: "Jonah", abbrev: "Jonah", chapters: 4, testament: "old", usfm: "JON" },
  { name: "Micah", abbrev: "Mic", chapters: 7, testament: "old", usfm: "MIC" },
  { name: "Nahum", abbrev: "Nah", chapters: 3, testament: "old", usfm: "NAM" },
  { name: "Habakkuk", abbrev: "Hab", chapters: 3, testament: "old", usfm: "HAB" },
  { name: "Zephaniah", abbrev: "Zeph", chapters: 3, testament: "old", usfm: "ZEP" },
  { name: "Haggai", abbrev: "Hag", chapters: 2, testament: "old", usfm: "HAG" },
  { name: "Zechariah", abbrev: "Zech", chapters: 14, testament: "old", usfm: "ZEC" },
  { name: "Malachi", abbrev: "Mal", chapters: 4, testament: "old", usfm: "MAL" },
  { name: "Matthew", abbrev: "Matt", chapters: 28, testament: "new", usfm: "MAT" },
  { name: "Mark", abbrev: "Mark", chapters: 16, testament: "new", usfm: "MRK" },
  { name: "Luke", abbrev: "Luke", chapters: 24, testament: "new", usfm: "LUK" },
  { name: "John", abbrev: "John", chapters: 21, testament: "new", usfm: "JHN" },
  { name: "Acts", abbrev: "Acts", chapters: 28, testament: "new", usfm: "ACT" },
  { name: "Romans", abbrev: "Rom", chapters: 16, testament: "new", usfm: "ROM" },
  { name: "1 Corinthians", abbrev: "1 Cor", chapters: 16, testament: "new", usfm: "1CO" },
  { name: "2 Corinthians", abbrev: "2 Cor", chapters: 13, testament: "new", usfm: "2CO" },
  { name: "Galatians", abbrev: "Gal", chapters: 6, testament: "new", usfm: "GAL" },
  { name: "Ephesians", abbrev: "Eph", chapters: 6, testament: "new", usfm: "EPH" },
  { name: "Philippians", abbrev: "Phil", chapters: 4, testament: "new", usfm: "PHP" },
  { name: "Colossians", abbrev: "Col", chapters: 4, testament: "new", usfm: "COL" },
  { name: "1 Thessalonians", abbrev: "1 Thess", chapters: 5, testament: "new", usfm: "1TH" },
  { name: "2 Thessalonians", abbrev: "2 Thess", chapters: 3, testament: "new", usfm: "2TH" },
  { name: "1 Timothy", abbrev: "1 Tim", chapters: 6, testament: "new", usfm: "1TI" },
  { name: "2 Timothy", abbrev: "2 Tim", chapters: 4, testament: "new", usfm: "2TI" },
  { name: "Titus", abbrev: "Titus", chapters: 3, testament: "new", usfm: "TIT" },
  { name: "Philemon", abbrev: "Phlm", chapters: 1, testament: "new", usfm: "PHM" },
  { name: "Hebrews", abbrev: "Heb", chapters: 13, testament: "new", usfm: "HEB" },
  { name: "James", abbrev: "Jas", chapters: 5, testament: "new", usfm: "JAS" },
  { name: "1 Peter", abbrev: "1 Pet", chapters: 5, testament: "new", usfm: "1PE" },
  { name: "2 Peter", abbrev: "2 Pet", chapters: 3, testament: "new", usfm: "2PE" },
  { name: "1 John", abbrev: "1 John", chapters: 5, testament: "new", usfm: "1JN" },
  { name: "2 John", abbrev: "2 John", chapters: 1, testament: "new", usfm: "2JN" },
  { name: "3 John", abbrev: "3 John", chapters: 1, testament: "new", usfm: "3JN" },
  { name: "Jude", abbrev: "Jude", chapters: 1, testament: "new", usfm: "JUD" },
  { name: "Revelation", abbrev: "Rev", chapters: 22, testament: "new", usfm: "REV" },
];

export const TOTAL_CHAPTERS = BOOKS.reduce((n, b) => n + b.chapters, 0); // 1189

const BY_NAME = new Map(BOOKS.map((b) => [b.name, b]));
export const bookByName = (name: string): Book | undefined => BY_NAME.get(name);

/** A single chapter, identified the way a reader would say it out loud. */
export interface Ref {
  book: string;
  chapter: number;
}

export const refKey = (r: Ref): string => `${r.book} ${r.chapter}`;
export const formatRef = (r: Ref): string => `${r.book} ${r.chapter}`;

/** Every chapter in canonical order. The spine the whole app is built on. */
export function allChapters(): Ref[] {
  const out: Ref[] = [];
  for (const b of BOOKS) {
    for (let c = 1; c <= b.chapters; c++) out.push({ book: b.name, chapter: c });
  }
  return out;
}

/**
 * Collapse a run of consecutive chapters into how a person would say it:
 * "Genesis 1 to 3", "Psalms 4 to 6 and Proverbs 1".
 */
export function formatRefs(refs: Ref[]): string {
  if (refs.length === 0) return "";
  const runs: { book: string; from: number; to: number }[] = [];
  for (const r of refs) {
    const last = runs[runs.length - 1];
    if (last && last.book === r.book && r.chapter === last.to + 1) last.to = r.chapter;
    else runs.push({ book: r.book, from: r.chapter, to: r.chapter });
  }
  const parts = runs.map((r) =>
    r.from === r.to ? `${r.book} ${r.from}` : `${r.book} ${r.from} to ${r.to}`,
  );
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Canonical sections — the milestone badges are earned by finishing these.
// ---------------------------------------------------------------------------

export interface Section {
  id: string;
  label: string;
  books: string[];
}

export const SECTIONS: Section[] = [
  {
    id: "pentateuch",
    label: "Pentateuch",
    books: ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"],
  },
  {
    id: "history",
    label: "Historical books",
    books: [
      "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
      "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther",
    ],
  },
  {
    id: "wisdom",
    label: "Wisdom literature",
    books: ["Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon"],
  },
  {
    id: "major-prophets",
    label: "Major prophets",
    books: ["Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel"],
  },
  {
    id: "minor-prophets",
    label: "Minor prophets",
    books: [
      "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum",
      "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
    ],
  },
  { id: "gospels", label: "Gospels", books: ["Matthew", "Mark", "Luke", "John"] },
  {
    id: "acts-epistles",
    label: "Acts and the epistles",
    books: [
      "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
      "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy",
      "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter",
      "1 John", "2 John", "3 John", "Jude",
    ],
  },
  { id: "revelation", label: "Revelation", books: ["Revelation"] },
  {
    id: "old-testament",
    label: "The Old Testament",
    books: BOOKS.filter((b) => b.testament === "old").map((b) => b.name),
  },
  {
    id: "whole-bible",
    label: "The whole Bible",
    books: BOOKS.map((b) => b.name),
  },
];

// ---------------------------------------------------------------------------
// Deep links out to the text.
// ---------------------------------------------------------------------------

export const TRANSLATIONS = [
  { id: "ESV", label: "ESV", youVersion: 59 },
  { id: "NKJV", label: "NKJV", youVersion: 114 },
] as const;

export type TranslationId = (typeof TRANSLATIONS)[number]["id"];
export const DEFAULT_TRANSLATION: TranslationId = "ESV";

export function isTranslation(v: unknown): v is TranslationId {
  return TRANSLATIONS.some((t) => t.id === v);
}

/**
 * Open this exact chapter in the reader's Bible. bible.com deep-links straight
 * into the YouVersion app when it is installed and falls back to the web reader
 * when it is not, which is the behaviour we want from a tap on a phone.
 */
export function chapterUrl(ref: Ref, translation: TranslationId): string {
  const book = bookByName(ref.book);
  const version = TRANSLATIONS.find((t) => t.id === translation) ?? TRANSLATIONS[0];
  if (!book) return "https://www.bible.com/";
  return `https://www.bible.com/bible/${version.youVersion}/${book.usfm}.${ref.chapter}.${version.id}`;
}
