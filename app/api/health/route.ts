import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { TOTAL_CHAPTERS } from "@/lib/bible";
import { cachedVerseCount, VERSE_CACHE_LIMIT } from "@/lib/verse-text";

export const dynamic = "force-dynamic";

/**
 * Railway's health check. It also reports the seeded weight count, so a
 * half-seeded database shows up here rather than as a strange schedule.
 */
export async function GET() {
  try {
    const weights = await getStore().countChapterWeights();
    return NextResponse.json({
      ok: weights === TOTAL_CHAPTERS,
      chapterWeights: weights,
      expected: TOTAL_CHAPTERS,
      // Crossway caps ESV caching at 500 verses; surfaced so it is checkable.
      versesCached: cachedVerseCount(),
      verseCacheLimit: VERSE_CACHE_LIMIT,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "storage unavailable" }, { status: 503 });
  }
}
