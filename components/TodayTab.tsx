"use client";

import { useState } from "react";
import { Glyph } from "./Glyph";
import { DailyQuiz } from "./DailyQuiz";
import { chapterUrl, formatRefs, type Ref } from "@/lib/bible";
import { formatDayRelative, formatLongDay, timeAgo, type DayKey } from "@/lib/dates";
import {
  chaptersForDay, currentDay, dateOfDay, dayProgress, isChapterRead, paceFor,
  planEnded, startDayFor, streakFor, totalDays, verseOfTheDay,
} from "@/lib/progress";
import { MAX_NOTE_LENGTH } from "@/lib/types";
import type { ActivePlan, QuizQuestion, User, VerseOfDay } from "@/lib/types";
import { formatMinutes } from "@/lib/dates";

export function TodayTab({
  plan,
  me,
  verse,
  quiz,
  today,
  busy,
  onToggleDay,
  onToggleChapter,
  onAddNote,
  onDeleteNote,
}: {
  plan: ActivePlan;
  me: User;
  verse: VerseOfDay | null;
  quiz: QuizQuestion[];
  today: DayKey;
  busy: boolean;
  onToggleDay: (day: number, done: boolean) => void;
  onToggleChapter: (ref: Ref, done: boolean) => void;
  onAddNote: (day: number, body: string) => Promise<string | null>;
  onDeleteNote: (id: string) => void;
}) {
  const days = totalDays(plan);
  const base = currentDay(plan, today, me.id);

  // Which day is on screen, held as an offset from today rather than as an
  // absolute day. When the clock rolls past 3 AM and `today` moves on, the view
  // moves with it, and offset zero is always today without any resyncing.
  const [offset, setOffset] = useState(0);
  const day = Math.max(1, Math.min(days, base + offset));
  // Stepped from the previous offset rather than from the rendered day: four
  // quick taps on Next are batched into one render, and reading `day` out of a
  // stale closure would move exactly one day for all four of them.
  const go = (delta: number) => {
    setOffset((prev) => {
      const from = Math.max(1, Math.min(days, base + prev));
      const next = Math.max(1, Math.min(days, from + delta));
      return next - base;
    });
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

  const [noteDraft, setNoteDraft] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const dayNotes = plan.notes.filter((n) => n.day === day);
  const nameOf = (id: string) =>
    plan.members.find((m) => m.id === id)?.displayName ?? "Someone";

  // The verse is picked from the day's own chapters, so it works for any day we
  // are looking at. Only today's arrives with its text already fetched.
  const pick = verseOfTheDay(plan, day);
  const verseText = isToday && verse ? verse.text : null;

  return (
    <div className="space-y-5 pb-4">
      {/* ---- the reading ---- */}
      <section className="rise-in rounded-2xl border border-line bg-card p-5">
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
            onClick={() => setOffset(0)}
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
              busy={busy}
              onToggle={(next) => onToggleChapter(ref, next)}
            />
          ))}
        </ul>

        <button
          onClick={() => onToggleDay(day, !done)}
          disabled={busy}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold transition active:scale-[0.99] disabled:opacity-60 ${
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

      {/* ---- pace and progress: always about now, whatever day is on screen ---- */}
      <section className="rise-in rounded-2xl border border-line bg-card p-5" style={{ animationDelay: "60ms" }}>
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
        <section className="rise-in rounded-2xl border border-line bg-card p-5" style={{ animationDelay: "120ms" }}>
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
      <section className="rise-in rounded-2xl border border-line bg-card p-5" style={{ animationDelay: "180ms" }}>
        <p className="eyebrow flex items-center gap-1.5 text-ink-2">
          <Glyph name="note" className="h-3.5 w-3.5" />
          {isToday ? "Notes on today" : `Notes on day ${day}`}
        </p>

        {dayNotes.length > 0 && (
          <ul className="mt-3 space-y-3">
            {dayNotes.map((n) => (
              <li key={n.id} className="rounded-xl border border-line bg-page-2 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-ink">{nameOf(n.userId)}</span>
                  <span className="flex items-center gap-2 text-xs text-ink-3">
                    <span className="tnum">{timeAgo(n.createdAt)}</span>
                    {n.userId === me.id && (
                      <button
                        onClick={() => onDeleteNote(n.id)}
                        aria-label="Delete note"
                        className="text-ink-3 transition hover:text-warn"
                      >
                        <Glyph name="trash" className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                </div>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-ink-2">
                  {n.body}
                </p>
              </li>
            ))}
          </ul>
        )}

        <form
          className="mt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const err = await onAddNote(day, noteDraft);
            setNoteError(err);
            if (!err) setNoteDraft("");
          }}
        >
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value.slice(0, MAX_NOTE_LENGTH))}
            rows={3}
            placeholder={dayNotes.length ? "Add to the conversation" : "What stood out to you?"}
            className="w-full resize-none rounded-xl border border-line-2 bg-page px-4 py-3 text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
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
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-page transition active:scale-[0.99] disabled:opacity-60"
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

function ChapterRow({
  refr,
  plan,
  read,
  busy,
  onToggle,
}: {
  refr: Ref;
  plan: ActivePlan;
  read: boolean;
  busy: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <li
      className={`flex items-center gap-1 rounded-xl border bg-page-2 pr-2 transition ${
        read ? "border-good/40" : "border-line"
      }`}
    >
      <button
        onClick={() => onToggle(!read)}
        disabled={busy}
        aria-pressed={read}
        aria-label={`${read ? "Unmark" : "Mark"} ${refr.book} ${refr.chapter} as read`}
        className="py-3 pl-4 pr-2 disabled:opacity-60"
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
      <a
        href={chapterUrl(refr, plan.translation)}
        target="_blank"
        rel="noreferrer"
        className="group flex flex-1 items-center justify-between gap-3 py-3"
      >
        <span
          className={`serif text-[1.0625rem] font-medium transition ${
            read ? "text-ink-3 line-through decoration-ink-3/50" : "text-ink"
          }`}
        >
          {refr.book} {refr.chapter}
        </span>
        <Glyph name="arrow-right" className="h-4 w-4 text-ink-3 transition group-hover:text-accent" />
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
