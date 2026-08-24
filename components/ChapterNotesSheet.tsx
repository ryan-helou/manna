"use client";

import { useState } from "react";
import { Sheet } from "./Sheet";
import { Glyph } from "./Glyph";
import { NoteThread } from "./NoteThread";
import { chapterUrl, type Ref } from "@/lib/bible";
import { MAX_NOTE_LENGTH } from "@/lib/types";
import type { ActivePlan, FeedNote, User } from "@/lib/types";

/**
 * What everyone has written about one chapter, and somewhere to add to it.
 *
 * Opened by tapping the chapter's name on the day card. The link out to the
 * text sits separately on the row, so reading the chapter and talking about it
 * are two different taps rather than one ambiguous one.
 */
export function ChapterNotesSheet({
  plan,
  me,
  refr,
  notes,
  busy,
  onClose,
  onAdd,
  onReply,
  onReact,
  onDelete,
}: {
  plan: ActivePlan;
  me: User;
  refr: Ref;
  notes: FeedNote[];
  busy: boolean;
  onClose: () => void;
  onAdd: (body: string, ref: Ref) => Promise<string | null>;
  onReply: (parentId: string, body: string) => Promise<string | null>;
  onReact: (noteId: string, emoji: string) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet title={`${refr.book} ${refr.chapter}`} onClose={onClose}>
      <a
        href={chapterUrl(refr, plan.translation)}
        target="_blank"
        rel="noreferrer"
        className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-page-2 px-4 py-3 transition hover:border-accent"
      >
        <span className="text-sm text-ink-2">
          Read it in <span className="font-semibold text-ink">{plan.translation}</span>
        </span>
        <Glyph name="link" className="h-4 w-4 shrink-0 text-accent" />
      </a>

      {notes.length === 0 ? (
        <p className="text-[0.9375rem] leading-relaxed text-ink-2">
          Nothing written on this chapter yet. Whatever you say here shows up for
          everyone, under {refr.book} {refr.chapter}.
        </p>
      ) : (
        <ul className="space-y-5">
          {notes.map((n) => (
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
      )}

      <form
        className="mt-5 border-t border-line pt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const err = await onAdd(draft, refr);
          setError(err);
          if (!err) setDraft("");
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_NOTE_LENGTH))}
          rows={3}
          placeholder={`What do you make of ${refr.book} ${refr.chapter}?`}
          className="w-full resize-none rounded-xl border border-line-2 bg-page px-4 py-3 text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm font-medium text-warn">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="mt-2 flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page transition active:scale-[0.99] disabled:opacity-50"
        >
          <Glyph name="plus" className="h-4 w-4" />
          Post
        </button>
      </form>
    </Sheet>
  );
}
