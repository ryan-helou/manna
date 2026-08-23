import "server-only";
import type { Ref } from "./bible";

/**
 * The text of the verse of the day.
 *
 * ESV and NKJV are both under copyright, so the words cannot be shipped in the
 * repo. Crossway publishes a free API for the ESV, which we use when a key is
 * configured. With no key, or on NKJV, the app shows the reference and links
 * out to it. Nothing breaks; you just tap through to read it.
 *
 * Crossway's terms say plainly: "You can cache up to 500 verses." So the cache
 * is a bounded in-process map rather than a table. An unbounded one would creep
 * past that limit somewhere in the second year of a plan, quietly, long after
 * anyone thought to check. This cannot: it is capped well under the line and
 * evicts the oldest entry when full.
 *
 * The cost of holding it in memory is one refetch per verse after a restart,
 * which against a 5,000 request daily allowance and one verse a day is nothing.
 */

const ENDPOINT = "https://api.esv.org/v3/passage/text/";
/** Comfortably under Crossway's 500 verse ceiling. */
const MAX_CACHED_VERSES = 200;

declare global {
  // Survives hot reloads in dev so editing a file does not re-spend the quota.
  var __mannaVerseCache: Map<string, string> | undefined;
}

function cache(): Map<string, string> {
  if (!globalThis.__mannaVerseCache) globalThis.__mannaVerseCache = new Map();
  return globalThis.__mannaVerseCache;
}

export function verseTextAvailable(translation: string): boolean {
  return translation === "ESV" && !!process.env.ESV_API_KEY;
}

export async function fetchVerseText(
  ref: Ref,
  verse: number,
  translation: string,
): Promise<string | null> {
  if (!verseTextAvailable(translation)) return null;
  const passage = `${ref.book} ${ref.chapter}:${verse}`;
  const store = cache();

  const hit = store.get(passage);
  if (hit !== undefined) return hit || null;

  try {
    const url = new URL(ENDPOINT);
    url.searchParams.set("q", passage);
    url.searchParams.set("include-headings", "false");
    url.searchParams.set("include-footnotes", "false");
    url.searchParams.set("include-verse-numbers", "false");
    url.searchParams.set("include-passage-references", "false");
    url.searchParams.set("include-short-copyright", "false");
    const res = await fetch(url, {
      headers: { Authorization: `Token ${process.env.ESV_API_KEY}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { passages?: string[] };
    const text = (data.passages?.[0] ?? "").trim().replace(/\s+/g, " ");
    if (!text) return null;

    // Oldest out first. Map iterates in insertion order, so the first key is it.
    if (store.size >= MAX_CACHED_VERSES) {
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
    store.set(passage, text);
    return text;
  } catch {
    return null;
  }
}

/** How many verses are held right now. Reported by /api/health. */
export const cachedVerseCount = (): number => cache().size;
export const VERSE_CACHE_LIMIT = MAX_CACHED_VERSES;
