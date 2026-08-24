import "server-only";
import { allChapters, formatRefs } from "./bible";
import type { FeedNote, Member, Note, Reaction } from "./types";

/**
 * Turn raw notes into readable threads: author names attached, the passage they
 * were written about resolved, reactions gathered, replies nested under the note
 * they answer.
 *
 * Shared by the feed and by a single day's card so the two can never disagree
 * about what a conversation looks like.
 */
export function buildThreads(
  notes: Note[],
  reactions: Map<string, Reaction[]>,
  members: Member[],
  cuts: number[],
  { limit }: { limit?: number } = {},
): FeedNote[] {
  const nameOf = new Map(members.map((m) => [m.id, m.displayName]));
  const chapters = allChapters();

  const dress = (n: Note): FeedNote => ({
    ...n,
    authorName: nameOf.get(n.userId) ?? "Someone",
    // A note that names a chapter is filed under that chapter, not under the
    // whole morning's reading it happened to sit inside.
    reference: n.book
      ? `${n.book} ${n.chapter}`
      : formatRefs(chapters.slice(cuts[n.day - 1], cuts[n.day])),
    reactions: reactions.get(n.id) ?? [],
    replies: [],
  });

  const repliesTo = new Map<string, FeedNote[]>();
  for (const n of notes) {
    if (!n.parentId) continue;
    if (!repliesTo.has(n.parentId)) repliesTo.set(n.parentId, []);
    repliesTo.get(n.parentId)!.push(dress(n));
  }

  // The limit counts openers rather than notes, so a busy conversation is never
  // cut off halfway down.
  const openers = notes
    .filter((n) => !n.parentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (limit ? openers.slice(0, limit) : openers).map((n) => ({
    ...dress(n),
    replies: (repliesTo.get(n.id) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  }));
}
