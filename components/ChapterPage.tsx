"use client";

import { useState } from "react";
import { Glyph } from "./Glyph";
import { NoteThread } from "./NoteThread";
import { chapterUrl, type Ref } from "@/lib/bible";
import { weightOf } from "@/lib/weights";
import { formatMinutes } from "@/lib/dates";
import { MAX_NOTE_LENGTH } from "@/lib/types";
import type { ActivePlan, FeedNote, User } from "@/lib/types";

/**
 * One chapter, and everything the group has said about it.
 *
 * A page rather than a sheet. A conversation is somewhere you settle into and
 * scroll, and a modal sliding over the day's card made it feel like an interruption
 * to be dismissed rather than a place to be. It takes the whole view, keeps the
 * tab bar, and leaves by the same back control you arrived through.
 */
export function ChapterPage({
  plan,
  me,
  refr,
  read,
  notes,
  busy,
  onBack,
  onToggleRead,
  onAdd,
  onReply,
  onReact,
  onDelete,
}: {
  plan: ActivePlan;
  me: User;
  refr: Ref;
  read: boolean;
  notes: FeedNote[];
  busy: boolean;
  onBack: () => void;
  onToggleRead: (next: boolean) => void;
  onAdd: (body: string, ref: Ref) => Promise<string | null>;
  onReply: (parentId: string, body: string) => Promise<string | null>;
  onReact: (noteId: string, emoji: string) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="pb-4">
      <button
        onClick={onBack}
        className="-ml-2 flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-ink-2 transition hover:text-accent"
      >
        <Glyph name="chevron-left" className="h-4 w-4" />
        Back to the day
      </button>

      <header className="mt-3">
        <h1 className="serif text-[2rem] leading-tight font-semibold text-ink">
          {refr.book} {refr.chapter}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-3">
          <Glyph name="clock" className="h-3.5 w-3.5" />
          About {formatMinutes(weightOf(refr.book, refr.chapter))} to sit with
        </p>
      </header>

      <div className="mt-4 flex gap-2">
        <a
          href={chapterUrl(refr, plan.translation)}
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent accent-fill px-4 py-3 text-sm font-semibold text-page transition active:scale-[0.99]"
        >
          Read it in {plan.translation}
          <Glyph name="link" className="h-4 w-4" />
        </a>
        <button
          onClick={() => onToggleRead(!read)}
          aria-pressed={read}
          className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition active:scale-[0.99] ${
            read ? "border-good text-good" : "border-line-2 text-ink-2"
          }`}
        >
          <span className={read ? "tick-in" : ""}>
            <Glyph name="check" className="h-4 w-4" />
          </span>
          {read ? "Read" : "Mark read"}
        </button>
      </div>

      <div className="rule mt-6" />

      <section className="mt-5">
        <p className="eyebrow flex items-center gap-1.5 text-ink-2">
          <Glyph name="chat" className="h-3.5 w-3.5" />
          {notes.length === 0
            ? "Nothing said yet"
            : `${notes.length} ${notes.length === 1 ? "thread" : "threads"}`}
        </p>

        {notes.length === 0 ? (
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-2">
            Whatever you write here shows up for everyone, filed under {refr.book}{" "}
            {refr.chapter} rather than lost in the day around it.
          </p>
        ) : (
          <ul className="mt-4 space-y-6">
            {notes.map((n) => (
              <li key={n.id} className="rounded-2xl border border-line bg-card glass p-4">
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
      </section>

      <form
        className="mt-6"
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
          rows={4}
          placeholder={`What do you make of ${refr.book} ${refr.chapter}?`}
          className="w-full resize-none rounded-2xl border border-line-2 bg-card px-4 py-3.5 text-[0.9375rem] leading-relaxed text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm font-medium text-warn">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-accent accent-fill px-4 py-3.5 text-base font-semibold text-page transition active:scale-[0.99] disabled:opacity-50"
        >
          <Glyph name="plus" className="h-4 w-4" />
          Post
        </button>
      </form>
    </div>
  );
}
