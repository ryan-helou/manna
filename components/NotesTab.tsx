"use client";

import { Glyph } from "./Glyph";
import { NoteThread } from "./NoteThread";
import type { FeedNote, User } from "@/lib/types";

/**
 * Everything the group has written, gathered under the passage it was written
 * about.
 *
 * Notes used to live only on the day they belonged to, which meant a thought
 * about Genesis 3 was invisible to anyone not standing on that day. Here they
 * are grouped by passage, newest conversation first, with replies and reactions.
 *
 * Threads are one level deep. Replying to a reply attaches to the note that
 * reply was answering, so a conversation stays a conversation rather than
 * becoming a tree nobody can follow.
 */
export function NotesTab({
  feed,
  me,
  busy,
  onReply,
  onReact,
  onDelete,
}: {
  feed: FeedNote[];
  me: User;
  busy: boolean;
  onReply: (parentId: string, body: string) => Promise<string | null>;
  onReact: (noteId: string, emoji: string) => void;
  onDelete: (id: string) => void;
}) {
  // Grouped by the passage, not by the day. A note about Genesis 3 belongs under
  // Genesis 3, not swallowed into the morning's whole reading alongside it.
  const groups: { key: string; day: number; reference: string; notes: FeedNote[] }[] = [];
  for (const n of feed) {
    const key = `${n.day}|${n.reference}`;
    const existing = groups.find((g) => g.key === key);
    if (existing) existing.notes.push(n);
    else groups.push({ key, day: n.day, reference: n.reference, notes: [n] });
  }

  return (
    <div className="space-y-5 pb-4">
      {feed.length === 0 ? (
        <section className="rise-in rounded-2xl border border-line bg-card p-5">
          <p className="eyebrow flex items-center gap-1.5 text-ink-2">
            <Glyph name="note" className="h-3.5 w-3.5" />
            Nothing written yet
          </p>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
            Anything anyone writes on a day&apos;s reading turns up here, under the
            passage it was about. Start one from today&apos;s card.
          </p>
        </section>
      ) : (
        groups.map((g, i) => (
          <section
            key={g.key}
            className="rise-in rounded-2xl border border-line bg-card p-5"
            style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="serif text-[1.0625rem] font-semibold text-ink">{g.reference}</h2>
              <span className="stat shrink-0 text-xs text-ink-3">Day {g.day}</span>
            </div>

            <ul className="mt-4 space-y-4">
              {g.notes.map((n) => (
                <li key={n.id}>
                  <NoteThread
                    note={n}
                    me={me}
                    busy={busy}
                    onReply={onReply}
                    onReact={onReact}
                    onDelete={onDelete}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

