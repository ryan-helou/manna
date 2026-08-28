"use client";

import { useState } from "react";
import { Glyph } from "./Glyph";
import { timeAgo } from "@/lib/dates";
import { MAX_NOTE_LENGTH, REACTIONS } from "@/lib/types";
import type { FeedNote, User } from "@/lib/types";

/**
 * One note, its reactions, its replies and a box to answer it.
 *
 * Shared by the Notes tab and by a chapter's own sheet, so a conversation looks
 * and behaves the same wherever you come across it.
 */
export function NoteThread({
  note,
  me,
  busy,
  onReply,
  onReact,
  onDelete,
}: {
  note: FeedNote;
  me: User;
  busy: boolean;
  onReply: (parentId: string, body: string) => Promise<string | null>;
  onReact: (noteId: string, emoji: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <NoteBody note={note} me={me} busy={busy} onReact={onReact} onDelete={onDelete} />
      {note.replies.length > 0 && (
        <ul className="mt-3 space-y-3 border-l-2 border-line pl-4">
          {note.replies.map((r) => (
            <li key={r.id}>
              <NoteBody note={r} me={me} busy={busy} onReact={onReact} onDelete={onDelete} />
            </li>
          ))}
        </ul>
      )}
      <ReplyBox parentId={note.id} busy={busy} onReply={onReply} />
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
          <span className="flex items-center gap-1 rounded-full border border-line-2 bg-page-2 px-2 py-1">
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
        className="w-full resize-none rounded-xl border border-line-2 bg-page-2 px-3 py-2 text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
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
          className="rounded-lg bg-accent accent-fill px-3 py-1.5 text-xs font-semibold text-on-accent transition disabled:opacity-50"
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
