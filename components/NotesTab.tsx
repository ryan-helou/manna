"use client";

import { useState } from "react";
import { Glyph } from "./Glyph";
import { timeAgo } from "@/lib/dates";
import { MAX_NOTE_LENGTH, REACTIONS } from "@/lib/types";
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
                  <NoteBody note={n} me={me} busy={busy} onReact={onReact} onDelete={onDelete} />

                  {n.replies.length > 0 && (
                    <ul className="mt-3 space-y-3 border-l-2 border-line pl-4">
                      {n.replies.map((r) => (
                        <li key={r.id}>
                          <NoteBody
                            note={r}
                            me={me}
                            busy={busy}
                            onReact={onReact}
                            onDelete={onDelete}
                          />
                        </li>
                      ))}
                    </ul>
                  )}

                  <ReplyBox parentId={n.id} busy={busy} onReply={onReply} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function NoteBody({
  note,
  me,
  busy,
  onReact,
  onDelete,
}: {
  note: FeedNote;
  me: User;
  busy: boolean;
  onReact: (noteId: string, emoji: string) => void;
  onDelete: (id: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const mine = note.userId === me.id;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-semibold text-ink">{note.authorName}</span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-ink-3">
          <span className="tnum">{timeAgo(note.createdAt)}</span>
          {mine && (
            <button
              onClick={() => onDelete(note.id)}
              aria-label="Delete this note"
              className="text-ink-3 transition hover:text-warn"
            >
              <Glyph name="trash" className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
      </div>

      <p className="mt-1 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-ink-2">
        {note.body}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {note.reactions.map((r) => {
          const isMine = r.userIds.includes(me.id);
          return (
            <button
              key={r.emoji}
              onClick={() => onReact(note.id, r.emoji)}
              disabled={busy}
              aria-pressed={isMine}
              aria-label={`${r.emoji}, ${r.userIds.length}`}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                isMine
                  ? "border-accent bg-accent-soft text-ink"
                  : "border-line bg-page-2 text-ink-2 hover:border-accent"
              }`}
            >
              <span>{r.emoji}</span>
              <span className="tnum">{r.userIds.length}</span>
            </button>
          );
        })}

        <button
          onClick={() => setPicking((v) => !v)}
          aria-label="React to this note"
          aria-expanded={picking}
          className="rounded-full border border-line bg-page-2 px-2 py-1 text-ink-3 transition hover:border-accent hover:text-accent"
        >
          <Glyph name="plus" className="h-3.5 w-3.5" />
        </button>

        {picking && (
          <span className="flex items-center gap-1 rounded-full border border-line-2 bg-page px-2 py-1">
            {REACTIONS.map((e) => (
              <button
                key={e}
                onClick={() => {
                  onReact(note.id, e);
                  setPicking(false);
                }}
                aria-label={`React with ${e}`}
                className="rounded-full px-1 text-base transition hover:scale-125"
              >
                {e}
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

function ReplyBox({
  parentId,
  busy,
  onReply,
}: {
  parentId: string;
  busy: boolean;
  onReply: (parentId: string, body: string) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ink-3 transition hover:text-accent"
      >
        <Glyph name="chat" className="h-3.5 w-3.5" />
        Reply
      </button>
    );
  }

  return (
    <form
      className="mt-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const err = await onReply(parentId, draft);
        setError(err);
        if (!err) {
          setDraft("");
          setOpen(false);
        }
      }}
    >
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, MAX_NOTE_LENGTH))}
        rows={2}
        autoFocus
        placeholder="Say something back"
        className="w-full resize-none rounded-xl border border-line-2 bg-page px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
      />
      {error && (
        <p role="alert" className="mt-1.5 text-sm font-medium text-warn">
          {error}
        </p>
      )}
      <div className="mt-1.5 flex gap-2">
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-page transition disabled:opacity-50"
        >
          Post
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setDraft("");
            setError(null);
          }}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-3"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
