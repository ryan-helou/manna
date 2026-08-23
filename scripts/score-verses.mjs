/**
 * Score every verse in the Bible for whether it stands on its own, and record
 * the best one in each chapter. Run with `node scripts/score-verses.mjs`.
 *
 * The verse of the day used to be a hash pick out of the day's chapters, which
 * meant a month of reading could hand you tabernacle sockets, sacrificial fat
 * and a genealogy. Nothing here judges theology. It judges whether a verse is a
 * whole thought that survives being lifted out of its paragraph.
 *
 * Measured against the World English Bible, which is public domain. Verse
 * numbering agrees with the ESV nearly everywhere, and the app only uses the
 * number, never the WEB wording.
 *
 * Writes data/chapter-verses.json. Downloads the corpus on first run.
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";

const CACHE = path.join(process.cwd(), "node_modules", ".cache", "manna-web");
const BASE = "https://raw.githubusercontent.com/TehShrike/world-english-bible/master/json";

const BOOKS = [
  ["Genesis","genesis"],["Exodus","exodus"],["Leviticus","leviticus"],["Numbers","numbers"],
  ["Deuteronomy","deuteronomy"],["Joshua","joshua"],["Judges","judges"],["Ruth","ruth"],
  ["1 Samuel","1samuel"],["2 Samuel","2samuel"],["1 Kings","1kings"],["2 Kings","2kings"],
  ["1 Chronicles","1chronicles"],["2 Chronicles","2chronicles"],["Ezra","ezra"],["Nehemiah","nehemiah"],
  ["Esther","esther"],["Job","job"],["Psalms","psalms"],["Proverbs","proverbs"],
  ["Ecclesiastes","ecclesiastes"],["Song of Solomon","songofsolomon"],["Isaiah","isaiah"],
  ["Jeremiah","jeremiah"],["Lamentations","lamentations"],["Ezekiel","ezekiel"],["Daniel","daniel"],
  ["Hosea","hosea"],["Joel","joel"],["Amos","amos"],["Obadiah","obadiah"],["Jonah","jonah"],
  ["Micah","micah"],["Nahum","nahum"],["Habakkuk","habakkuk"],["Zephaniah","zephaniah"],
  ["Haggai","haggai"],["Zechariah","zechariah"],["Malachi","malachi"],
  ["Matthew","matthew"],["Mark","mark"],["Luke","luke"],["John","john"],["Acts","acts"],
  ["Romans","romans"],["1 Corinthians","1corinthians"],["2 Corinthians","2corinthians"],
  ["Galatians","galatians"],["Ephesians","ephesians"],["Philippians","philippians"],
  ["Colossians","colossians"],["1 Thessalonians","1thessalonians"],["2 Thessalonians","2thessalonians"],
  ["1 Timothy","1timothy"],["2 Timothy","2timothy"],["Titus","titus"],["Philemon","philemon"],
  ["Hebrews","hebrews"],["James","james"],["1 Peter","1peter"],["2 Peter","2peter"],
  ["1 John","1john"],["2 John","2john"],["3 John","3john"],["Jude","jude"],["Revelation","revelation"],
];

// Measurement, construction and cultic procedure: an instruction manual when
// pulled out on its own.
const PROCEDURAL = /\b(cubit|cubits|socket|sockets|loop|loops|clasp|clasps|curtain|curtains|pole|poles|grating|boards?|pillars?|hooks?|ephod|breastplate|tenons?|frames?|overlaid?|hin|ephah|omer|shekels?|handbreadth|span|goats' hair|fine linen)\b/gi;
// Registers, genealogies and census material.
const LISTY = /\b(son of|sons of|daughter of|the father of|were numbered|according to their families|by their generations|the children of)\b/gi;
// The vocabulary of the verses people actually carry with them.
const WEIGHTY = /\b(love|loves|loved|faith|faithful|grace|mercy|merciful|righteous|righteousness|salvation|saves?|saved|redeem(?:ed|er)?|forgive|forgiven|forgiveness|hope|trust|peace|joy|glory|holy|blessed|bless|covenant|everlasting|eternal|life|light|truth|wisdom|heart|soul|spirit|strength|refuge|shepherd|comfort|delight|praise|thanks|rejoice|humble|gracious|compassion|steadfast|kindness|goodness|patience|gentle)\b/gi;
const COURAGE = /\b(do not be afraid|don't be afraid|fear not|be strong|take courage|do not fear|don't fear)\b/gi;

const words = (s) => s.trim().split(/\s+/).filter(Boolean);
const count = (s, re) => (s.match(re) ?? []).length;

function properNouns(text) {
  const ws = words(text);
  let n = 0;
  ws.forEach((w, i) => {
    const c = w.replace(/[^A-Za-z']/g, "");
    if (i > 0 && /^[A-Z]/.test(c) && !/^(God|Yahweh|Lord|LORD|Christ|Jesus|Spirit|Holy|I|Israel)$/.test(c)) n++;
  });
  return ws.length ? n / ws.length : 0;
}

export function scoreVerse(text) {
  const ws = words(text);
  const n = ws.length;
  if (n < 6) return -100;   // too short to be a thought
  if (n > 55) return -40;   // too long to hold

  let s = 0;
  // A whole sentence, not a clause lifted from the middle of one.
  const first = ws[0].replace(/[^A-Za-z’']/g, "");
  if (/^(and|but|then|so|for|of|also|now|when|because|therefore|thus|these|those|he|she|they|it|him|her|them|saying)$/i.test(first)) s -= 14;
  if (/[.!?”']\s*$/.test(text.trim())) s += 8; else s -= 10;

  if (n >= 12 && n <= 38) s += 12;
  else if (n >= 9) s += 4;

  const per100 = (c) => (c / n) * 100;
  s -= per100(count(text, PROCEDURAL)) * 9;
  s -= per100(count(text, LISTY)) * 7;
  s -= properNouns(text) * 90;
  s -= per100((text.match(/\b\d+\b/g) ?? []).length) * 6;

  s += per100(count(text, WEIGHTY)) * 6;
  if (COURAGE.test(text)) s += 14;
  if (/\bI am\b/.test(text)) s += 6;
  if (/^“/.test(text.trim())) s += 3;

  return s;
}

async function bookJson(file) {
  const local = path.join(CACHE, `${file}.json`);
  try {
    await access(local);
  } catch {
    const res = await fetch(`${BASE}/${file}.json`);
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    await mkdir(CACHE, { recursive: true });
    await writeFile(local, await res.text());
  }
  return JSON.parse(await readFile(local, "utf8"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = [];
  for (const [book, file] of BOOKS) {
    const entries = await bookJson(file);
    const chapters = new Map(); // n -> Map(verse -> text)
    let cur = 0;
    for (const e of entries) {
      if (e.type !== "paragraph text" && e.type !== "line text") continue;
      const n = e.chapterNumber ?? cur;
      if (!n) continue;
      cur = n;
      if (!chapters.has(n)) chapters.set(n, new Map());
      const v = e.verseNumber ?? 0;
      if (!v) continue;
      const m = chapters.get(n);
      m.set(v, `${m.get(v) ?? ""} ${String(e.value ?? "").trim()}`.trim());
    }
    for (const n of [...chapters.keys()].sort((a, b) => a - b)) {
      let best = { v: 1, s: -Infinity };
      for (const [v, text] of chapters.get(n)) {
        const s = scoreVerse(text);
        if (s > best.s) best = { v, s };
      }
      out.push({ b: book, c: n, v: best.v, s: Math.round(best.s) });
    }
  }
  await writeFile(
    path.join(process.cwd(), "data", "chapter-verses.json"),
    JSON.stringify(out),
  );
  console.log(`wrote data/chapter-verses.json — ${out.length} chapters`);
}
