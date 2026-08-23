/**
 * Pull the distinctive proper nouns out of every chapter, for the daily
 * questions. Run with `node scripts/extract-names.mjs`.
 *
 * Questions are built from names rather than from quoted text on purpose. The
 * app reads the ESV; the corpus measured here is the World English Bible, and a
 * "finish the verse" question in one translation's wording is wrong in the
 * other's. Names survive the crossing. So do the answers: every question is
 * checked against the text rather than written by hand, so none of them can be
 * wrong about the Bible.
 *
 * Writes data/chapter-names.json. Downloads the corpus on first run.
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";

const CACHE = path.join(process.cwd(), "node_modules", ".cache", "manna-web");
const BASE = "https://raw.githubusercontent.com/TehShrike/world-english-bible/master/json";
const BOOKS = JSON.parse(await readFile(new URL("./books.json", import.meta.url), "utf8"));

// Divine names and titles: present nearly everywhere, so they tell you nothing
// about whether someone read today.
const SKIP = new Set([
  "God","Yahweh","Lord","LORD","Christ","Jesus","Spirit","Holy","Almighty","Father",
  "Son","Most","High","Messiah","Behold","But","And","For","Then","So","Now","When",
  "The","This","That","These","Those","There","Therefore","O","Woe","Blessed","Yes",
  "Amen","Selah","Praise","Hallelujah","Yah","Sabbath","Passover","Israelite",
  "Israelites","Gentile","Gentiles","Jew","Jews","Levite","Levites","Pharisee",
  "Pharisees","Sadducee","Sadducees","Egyptian","Egyptians","Philistine","Philistines",
  // Capitalised common nouns that never appear lowercase in this translation, so
  // the lowercase test cannot catch them.
  "Scripture","Scriptures","Meeting","Tent","Feast","Preparation","Law","Temple",
  // Leading halves of place names the translation writes with a space:
  // Beth Shemesh, Bene Berak, Kibroth Hattaavah, Hazar Addar, En Gedi.
  "Beth","Bene","Kibroth","Hazar","Kiriath","Baal-","En","Abel-",
]);

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

/**
 * Pass zero: every word that ever appears lowercase in the Bible. A real proper
 * noun almost never does. Without this, anything that happened to sit after a
 * quotation mark or at the head of a poetic line came through as a name, and
 * questions offered "Has" and "Scripture" alongside Abel and Cain.
 */
const lowercased = new Set();
const rawBooks = new Map();
for (const [book, file] of BOOKS) {
  const entries = await bookJson(file);
  rawBooks.set(book, entries);
  for (const e of entries) {
    if (e.type !== "paragraph text" && e.type !== "line text") continue;
    for (const w of String(e.value ?? "").split(/\s+/)) {
      const clean = w.replace(/[^A-Za-z’'-]/g, "").replace(/[’']s$/, "");
      if (clean && /^[a-z]/.test(clean)) lowercased.add(clean.toLowerCase());
    }
  }
}

// Pass one: collect the names in every chapter, in order of first appearance.
const chapters = [];
for (const [book] of BOOKS) {
  const entries = rawBooks.get(book);
  const byChapter = new Map();
  let cur = 0;
  for (const e of entries) {
    if (e.type !== "paragraph text" && e.type !== "line text") continue;
    const n = e.chapterNumber ?? cur;
    if (!n) continue;
    cur = n;
    if (!byChapter.has(n)) byChapter.set(n, []);
    byChapter.get(n).push(String(e.value ?? ""));
  }
  for (const n of [...byChapter.keys()].sort((a, b) => a - b)) {
    const text = byChapter.get(n).join(" ");
    const seen = [];
    for (const sentence of text.split(/(?<=[.!?:;”])\s+/)) {
      const ws = sentence.trim().split(/\s+/).filter(Boolean);
      ws.forEach((w, i) => {
        // Strip the possessive, then any bare apostrophe left behind: the text
        // writes "Yahweh's" and plural possessives like "Israelites'", and both
        // were coming through with the mark still attached.
        const clean = w
          .replace(/[^A-Za-z’'-]/g, "")
          .replace(/[’']s$/, "")
          .replace(/[’']$/, "");
        if (!clean || clean.length < 3) return;
        if (i === 0) return;                      // sentence-initial: could be any word
        if (!/^[A-Z][a-z]/.test(clean)) return;   // Proper-noun shaped only
        if (SKIP.has(clean)) return;
        // If the same word turns up lowercase anywhere, it is an ordinary word
        // that happened to be capitalised here, not a name.
        if (lowercased.has(clean.toLowerCase())) return;
        if (!seen.includes(clean)) seen.push(clean);
      });
    }
    chapters.push({ b: book, c: n, all: seen });
  }
}

// Pass two: how many chapters each name turns up in. A name that appears
// everywhere makes a poor question; one that appears in a handful is a real tell.
const freq = new Map();
for (const ch of chapters) for (const n of ch.all) freq.set(n, (freq.get(n) ?? 0) + 1);

/**
 * Keep a name only if it recurs (so it is a figure rather than a one-off, and
 * far less likely to be spelled differently in another translation) and is not
 * so common that it says nothing. Crucially the list is NOT truncated: within
 * this vocabulary, a name missing from a chapter really is absent from it, which
 * is what lets a question ask which name does *not* appear and be right.
 */
const usable = (n) => {
  const f = freq.get(n) ?? 0;
  return f >= 2 && f <= 60;
};
const out = chapters.map((ch) => ({
  b: ch.b,
  c: ch.c,
  n: ch.all.filter(usable), // in order of first appearance
}));

await writeFile(path.join(process.cwd(), "data", "chapter-names.json"), JSON.stringify(out));
const withNames = out.filter((o) => o.n.length > 0).length;
const vocab = [...freq.keys()].filter(usable);
const entries = out.reduce((a, o) => a + o.n.length, 0);
console.log(`wrote data/chapter-names.json`);
console.log(`  ${out.length} chapters, ${withNames} with usable names (${(withNames / out.length * 100).toFixed(1)}%)`);
console.log(`  ${vocab.length} names in the vocabulary, ${entries} chapter entries`);
console.log(`  median names per chapter: ${out.map((o) => o.n.length).sort((a, b) => a - b)[Math.floor(out.length / 2)]}`);
