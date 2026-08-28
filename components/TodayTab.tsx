"use client";

import { useEffect, useState } from "react";
import { Glyph } from "./Glyph";
import { DailyQuiz } from "./DailyQuiz";
import { ChapterPage } from "./ChapterPage";
import { NoteThread } from "./NoteThread";
import { chapterUrl, formatRefs, type Ref } from "@/lib/bible";
import { formatDay, formatDayRelative, formatLongDay, type DayKey } from "@/lib/dates";
import {
  chaptersForDay, currentDay, dateOfDay, dayProgress, isChapterRead, paceFor,
  missedDays, planEnded, startDayFor, streakFor, totalDays, verseOfTheDay,
} from "@/lib/progress";
import { MAX_NOTE_LENGTH } from "@/lib/types";
import type { ActivePlan, FeedNote, QuizQuestion, User, VerseOfDay } from "@/lib/types";
import { formatMinutes } from "@/lib/dates";

export function TodayTab({
  plan,
  me,
  verse,
  quiz,
  today,
  busy,
  dayOffset,
  onDayOffset,
  onToggleDay,
  onToggleChapter,
  onAddNote,
  onReply,
  onReact,
  onDeleteNote,
}: {
  plan: ActivePlan;
  me: User;
  verse: VerseOfDay | null;
  quiz: QuizQuestion[];
  today: DayKey;
  busy: boolean;
  dayOffset: number;
  onDayOffset: (offset: number) => void;
  onToggleDay: (day: number, done: boolean) => void;
  onToggleChapter: (ref: Ref, done: boolean) => void;
  onAddNote: (day: number, body: string, ref: Ref | null) => Promise<string | null>;
  onReply: (parentId: string, body: string) => Promise<string | null>;
  onReact: (noteId: string, emoji: string) => void;
  onDeleteNote: (id: string) => void;
}) {
  const days = totalDays(plan);
  const base = currentDay(plan, today, me.id);

  // The offset lives in the shell, because the heatmap and the book index both
  // send you to a day. Offset zero is always today, so the 3 AM rollover carries
  // the view with it rather than stranding you on a stale date.
  const day = Math.max(1, Math.min(days, base + dayOffset));
  const go = (delta: number) => {
    const next = Math.max(1, Math.min(days, day + delta));
    onDayOffset(next - base);
  };

  const chapters = chaptersForDay(plan, day);
  const isToday = day === base;
  const isPast = day < base;
  const pace = paceFor(plan, me.id, today);
  const streak = streakFor(plan, me.id, today);
  const progress = dayProgress(plan, me.id, day);
  const done = progress.total > 0 && progress.done === progress.total;
  const started = progress.done > 0 && !done;
  const ended = planEnded(plan, today, me.id);
  const missed = missedDays(plan, me.id, today);

  const [noteDraft, setNoteDraft] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  // Which chapter the note is about. Null means the day's reading as a whole.
  const [noteRef, setNoteRef] = useState<Ref | null>(null);
  // Which chapter's conversation is open, if any.
  const [openChapter, setOpenChapter] = useState<Ref | null>(null);

  // The payload carries today's notes only, because a year of a dozen people
  // writing is too much to send on every tap. Any other day fetches its own,
  // rather than showing an empty field over the top of something somebody
  // already wrote there.
  // Stamped with the day it belongs to, so a slow reply for a day you have
  // already navigated away from cannot be shown against the wrong one.
  const [awayNotes, setAwayNotes] = useState<{ day: number; notes: FeedNote[] } | null>(null);
  useEffect(() => {
    if (isToday) return;
    let live = true;
    fetch(`/api/notes?planId=${encodeURIComponent(plan.id)}&day=${day}`)
      .then((r) => (r.ok ? r.json() : { notes: [] }))
      .then((d: { notes?: FeedNote[] }) => {
        if (live) setAwayNotes({ day, notes: d.notes ?? [] });
      })
      .catch(() => {
        if (live) setAwayNotes({ day, notes: [] });
      });
    return () => {
      live = false;
    };
    // `plan.notes` is a dependency so posting on another day refetches it.
  }, [isToday, plan.id, day, plan.notes]);

  const loaded = awayNotes?.day === day;
  const notesLoading = !isToday && !loaded;
  const dayNotes = isToday
    ? plan.notes.filter((n) => n.day === day)
    : loaded
      ? awayNotes!.notes
      : [];

  // The verse is picked from the day's own chapters, so it works for any day we
  // are looking at. Only today's arrives with its text already fetched.
  const pick = verseOfTheDay(plan, day);
  const verseText = isToday && verse ? verse.text : null;

  if (openChapter) {
    return (
      <ChapterPage
        plan={plan}
        me={me}
        refr={openChapter}
        read={isChapterRead(plan, me.id, openChapter)}
        notes={dayNotes.filter(
          (n) => n.book === openChapter.book && n.chapter === openChapter.chapter,
        )}
        busy={busy}
        onBack={() => setOpenChapter(null)}
        onToggleRead={(next) => onToggleChapter(openChapter, next)}
        onAdd={(body, ref) => onAddNote(day, body, ref)}
        onReply={onReply}
        onReact={onReact}
        onDelete={onDeleteNote}
      />
    );
  }

  return (
    <div className="space-y-5 pb-4">
      {/* ---- the reading ---- */}
      <section className="rise-in rounded-2xl border border-line bg-card glass p-5">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => go(-1)}
            disabled={day === 1}
            aria-label="Previous day"
            className="-ml-2 rounded-full p-2 text-ink-2 transition hover:bg-page-2 hover:text-ink disabled:pointer-events-none disabled:opacity-25"
          >
            <Glyph name="chevron-left" className="h-5 w-5" />
          </button>

          <div className="min-w-0 text-center">
            <p className="eyebrow truncate text-ink-2">
              {ended && isToday
                ? "The plan is finished"
                : formatDayRelative(dateOfDay(plan, day, me.id), today)}
            </p>
            <p className="stat mt-0.5 text-xs text-ink-3">
              Day {day} of {days}
            </p>
          </div>

          <button
            onClick={() => go(1)}
            disabled={day === days}
            aria-label="Next day"
            className="-mr-2 rounded-full p-2 text-ink-2 transition hover:bg-page-2 hover:text-ink disabled:pointer-events-none disabled:opacity-25"
          >
            <Glyph name="chevron-right" className="h-5 w-5" />
          </button>
        </div>

        {!isToday && (
          <button
            onClick={() => onDayOffset(0)}
            className="mx-auto mt-2 flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-2 transition hover:border-accent hover:text-accent"
          >
            <Glyph name="arrow-right" className="h-3 w-3" />
            Back to today
          </button>
        )}

        <h1 className="serif mt-3 text-center text-[1.75rem] leading-tight font-semibold text-ink">
          {formatRefs(chapters)}
        </h1>
        <p className="mt-1.5 text-center text-sm text-ink-3">
          {formatLongDay(dateOfDay(plan, day, me.id))}
          <span>
            &nbsp;&middot;&nbsp;
            {started
              ? `${progress.done} of ${progress.total} read`
              : `${chapters.length} ${chapters.length === 1 ? "chapter" : "chapters"}`}
          </span>
        </p>

        <ul className="mt-4 space-y-1.5">
          {chapters.map((ref) => (
            <ChapterRow
              key={`${ref.book}-${ref.chapter}`}
              refr={ref}
              plan={plan}
              read={isChapterRead(plan, me.id, ref)}
              comments={dayNotes.filter(
                (n) => n.book === ref.book && n.chapter === ref.chapter,
              ).length}
              onToggle={(next) => onToggleChapter(ref, next)}
              onOpenNotes={() => setOpenChapter(ref)}
            />
          ))}
        </ul>

        {/* Not disabled while a request is in flight. The tick is applied
            locally the moment you tap, so blocking the next tap only loses it:
            three chapters ticked quickly used to register as one. */}
        <button
          onClick={() => onToggleDay(day, !done)}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold transition active:scale-[0.99] ${
            done ? "border border-good bg-transparent text-good" : "bg-accent text-page"
          }`}
        >
          <span className={done ? "tick-in" : ""}>
            <Glyph name="check" className="h-5 w-5" />
          </span>
          {done
            ? "Read"
            : started
              ? `Finish the last ${progress.total - progress.done}`
              : isPast
                ? "Catch this one up"
                : isToday
                  ? "Mark all as read"
                  : "Read ahead"}
        </button>
      </section>

      {/* ---- what you actually owe ---- */}
      {missed.length > 0 && (
        <section className="rise-in rounded-2xl border border-warn/30 bg-card glass p-5" style={{ animationDelay: "30ms" }}>
          <p className="eyebrow flex items-center gap-1.5 text-warn">
            <Glyph name="arrow-down" className="h-3.5 w-3.5" />
            {missed.length} day{missed.length === 1 ? "" : "s"} to catch up
          </p>
          <p className="mt-1.5 text-sm text-ink-2">
            {formatMinutes(pace.minutesBehind)} of reading. Pick one.
          </p>
          <ul className="mt-3 space-y-1.5">
            {missed.slice(0, 5).map((d) => {
              const prog = dayProgress(plan, me.id, d);
              return (
                <li key={d}>
                  <button
                    onClick={() => onDayOffset(d - base)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-page-2 px-4 py-2.5 text-left transition hover:border-accent"
                  >
                    <span className="min-w-0">
                      <span className="serif block truncate text-[0.9375rem] font-medium text-ink">
                        {formatRefs(chaptersForDay(plan, d))}
                      </span>
                      <span className="text-xs text-ink-3">
                        {formatDay(dateOfDay(plan, d, me.id))}
                        {prog.done > 0 && ` · ${prog.done} of ${prog.total} already read`}
                      </span>
                    </span>
                    <Glyph name="arrow-right" className="h-4 w-4 shrink-0 text-ink-3" />
                  </button>
                </li>
              );
            })}
          </ul>
          {missed.length > 5 && (
            <p className="mt-2 text-xs text-ink-3">
              and {missed.length - 5} more further back
            </p>
          )}
        </section>
      )}

      {/* ---- pace and progress: always about now, whatever day is on screen ---- */}
      <section className="rise-in rounded-2xl border border-line bg-card glass p-5" style={{ animationDelay: "60ms" }}>
        <div className="flex items-center justify-between gap-3">
          <PaceBadge pace={pace} />
          {streak > 0 && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-accent">
              <Glyph name="flame" className="h-4 w-4" />
              <span className="tnum">{streak}</span>
              <span className="font-normal text-ink-2">day{streak === 1 ? "" : "s"}</span>
            </span>
          )}
        </div>

        <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-page-2">
          <div
            className="fill-in h-full rounded-full bg-accent"
            style={{ width: `${Math.min(100, (base / days) * 100)}%` }}
          />
          {/* Where in the plan you are currently looking. */}
          {!isToday && (
            <span
              aria-hidden
              className="absolute top-0 h-full w-0.5 bg-ink-2"
              style={{ left: `${Math.min(100, (day / days) * 100)}%` }}
            />
          )}
        </div>
        <div className="mt-2 flex justify-between text-xs text-ink-3">
          <span className="tnum">{formatLongDay(startDayFor(plan, me.id))}</span>
          <span className="tnum">{formatLongDay(dateOfDay(plan, days, me.id))}</span>
        </div>
      </section>

      {/* ---- verse of the day ---- */}
      {pick && (
        <section className="rise-in rounded-2xl border border-line bg-card glass p-5" style={{ animationDelay: "120ms" }}>
          <p className="eyebrow flex items-center gap-1.5 text-ink-2">
            <Glyph name="quote" className="h-3.5 w-3.5" />
            {isToday ? "Verse of the day" : "Verse for this day"}
          </p>
          {verseText ? (
            <>
              <blockquote className="serif mt-3 text-lg leading-relaxed text-ink">
                {verseText}
              </blockquote>
              {/* Crossway's terms require the notice and the link on any page
                  that shows their text. */}
              <p className="mt-2 text-xs text-ink-3">
                Scripture quotation from the ESV Bible, copyright 2001 by
                Crossway.{" "}
                <a
                  href="https://www.esv.org"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  esv.org
                </a>
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-ink-2">
              Tap through to read it in {plan.translation}.
            </p>
          )}
          <a
            href={chapterUrl(pick.ref, plan.translation)}
            target="_blank"
            rel="noreferrer"
            className="serif mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent underline underline-offset-4"
          >
            {pick.ref.book} {pick.ref.chapter}:{pick.verse}
            <Glyph name="link" className="h-3.5 w-3.5" />
          </a>
        </section>
      )}

      {/* ---- the daily check, today only ---- */}
      {isToday && <DailyQuiz questions={quiz} planId={plan.id} day={day} />}

      {/* ---- shared notes ---- */}
      <section className="rise-in rounded-2xl border border-line bg-card glass p-5" style={{ animationDelay: "180ms" }}>
        <p className="eyebrow flex items-center gap-1.5 text-ink-2">
          <Glyph name="note" className="h-3.5 w-3.5" />
          {isToday ? "Notes on today" : `Notes on day ${day}`}
        </p>

        {notesLoading && (
          <p className="mt-3 text-sm text-ink-3">Loading what was written here.</p>
        )}

        {dayNotes.length > 0 && (
          <ul className="mt-3 space-y-5">
            {dayNotes.map((n) => (
              <li key={n.id}>
                <NoteThread
                  note={n}
                  me={me}
                  busy={busy}
                  onReply={onReply}
                  onReact={onReact}
                  onDelete={onDeleteNote}
                />
              </li>
            ))}
          </ul>
        )}

        <form
          className="mt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const err = await onAddNote(day, noteDraft, noteRef);
            setNoteError(err);
            if (!err) {
              setNoteDraft("");
              setNoteRef(null);
            }
          }}
        >
          {/* What the note is about. A thought on one chapter should not be
              filed under the whole morning's reading. */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setNoteRef(null)}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                noteRef === null
                  ? "border-accent bg-accent-soft text-ink"
                  : "border-line bg-page-2 text-ink-3"
              }`}
            >
              Whole day
            </button>
            {chapters.map((r) => {
              const on = noteRef?.book === r.book && noteRef?.chapter === r.chapter;
              return (
                <button
                  key={`note-${r.book}-${r.chapter}`}
                  type="button"
                  onClick={() => setNoteRef(on ? null : r)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                    on
                      ? "border-accent bg-accent-soft text-ink"
                      : "border-line bg-page-2 text-ink-3"
                  }`}
                >
                  {r.book} {r.chapter}
                </button>
              );
            })}
          </div>

          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value.slice(0, MAX_NOTE_LENGTH))}
            rows={3}
            placeholder={
              noteRef
                ? `On ${noteRef.book} ${noteRef.chapter}`
                : dayNotes.length
                  ? "Add to the conversation"
                  : "What stood out to you?"
            }
            className="w-full resize-none rounded-xl border border-line-2 bg-page-2 px-4 py-3 text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
          {noteError && (
            <p role="alert" className="mt-2 text-sm font-medium text-warn">
              {noteError}
            </p>
          )}
          {noteDraft.trim() && (
            <button
              type="submit"
              disabled={busy}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-accent accent-fill px-4 py-2 text-sm font-semibold text-page transition active:scale-[0.99] disabled:opacity-60"
            >
              <Glyph name="plus" className="h-4 w-4" />
              Post
            </button>
          )}
        </form>
      </section>
    </div>
  );
}

/**
 * A chapter on the day's card. Three targets, deliberately separate: the box
 * ticks it read, the name opens what everyone has written about it, and the link
 * opens the text itself. It used to be one link across the whole row, which left
 * nowhere to put a conversation.
 */
function ChapterRow({
  refr,
  plan,
  read,
  comments,
  onToggle,
  onOpenNotes,
}: {
  refr: Ref;
  plan: ActivePlan;
  read: boolean;
  comments: number;
  onToggle: (next: boolean) => void;
  onOpenNotes: () => void;
}) {
  return (
    <li
      className={`flex items-center gap-1 rounded-xl border bg-page-2 pr-1 transition ${
        read ? "border-good/40" : "border-line"
      }`}
    >
      <button
        onClick={() => onToggle(!read)}
        aria-pressed={read}
        aria-label={`${read ? "Unmark" : "Mark"} ${refr.book} ${refr.chapter} as read`}
        className="py-3 pl-4 pr-2"
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
            read ? "border-good bg-good text-page" : "border-line-2 text-transparent"
          }`}
        >
          <span className={read ? "tick-in" : ""}>
            <Glyph name="check" className="h-3.5 w-3.5" />
          </span>
        </span>
      </button>

      <button
        onClick={onOpenNotes}
        aria-label={`Notes on ${refr.book} ${refr.chapter}`}
        className="flex flex-1 items-center gap-2 py-3 text-left"
      >
        <span
          className={`serif text-[1.0625rem] font-medium transition ${
            read ? "text-ink-3 line-through decoration-ink-3/50" : "text-ink"
          }`}
        >
          {refr.book} {refr.chapter}
        </span>
        {comments > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[0.6875rem] font-semibold text-accent">
            <Glyph name="chat" className="h-3 w-3" />
            <span className="tnum">{comments}</span>
          </span>
        )}
      </button>

      <a
        href={chapterUrl(refr, plan.translation)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${refr.book} ${refr.chapter} in ${plan.translation}`}
        className="rounded-lg p-2.5 text-ink-3 transition hover:bg-page hover:text-accent"
      >
        <Glyph name="link" className="h-4 w-4" />
      </a>
    </li>
  );
}

function PaceBadge({ pace }: { pace: ReturnType<typeof paceFor> }) {
  if (pace.status === "on-pace") {
    return (
      <span className="flex items-center gap-2 text-sm font-semibold text-good">
        <Glyph name="check" className="h-4 w-4" />
        Right on pace
      </span>
    );
  }
  if (pace.status === "ahead") {
    const n = pace.delta;
    return (
      <span className="flex items-center gap-2 text-sm font-semibold text-good">
        <Glyph name="arrow-up" className="h-4 w-4" />
        {n} day{n === 1 ? "" : "s"} ahead
      </span>
    );
  }
  const n = -pace.delta;
  return (
    <span className="flex items-center gap-2 text-sm font-semibold text-warn">
      <Glyph name="arrow-down" className="h-4 w-4" />
      {n} day{n === 1 ? "" : "s"} behind
      <span className="font-normal text-ink-2">({formatMinutes(pace.minutesBehind)} to catch up)</span>
    </span>
  );
}
