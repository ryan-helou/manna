import "server-only";
import { getStore } from "./db";
import type { Ref } from "./bible";

/**
 * The text of the verse of the day.
 *
 * ESV and NKJV are both under copyright, so the words cannot be shipped in the
 * repo. Crossway publishes a free API for the ESV, which we use when a key is
 * configured and cache permanently: the same reference always returns the same
 * text, and the free tier is not worth spending twice.
 *
 * With no key, or on NKJV, the app shows the reference and links out to it.
 * Nothing breaks; you just tap through to read it.
 */

const ENDPOINT = "https://api.esv.org/v3/passage/text/";

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
  const cacheKey = `verse:ESV:${passage}`;
  const store = getStore();

  const cached = await store.getMeta(cacheKey).catch(() => null);
  if (cached !== null) return cached || null;

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
    // Cached under the reference, so it survives restarts and redeploys.
    await store.setMeta(cacheKey, text).catch(() => {});
    return text;
  } catch {
    return null;
  }
}
