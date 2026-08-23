"use client";

import { useState } from "react";
import { Glyph } from "./Glyph";
import { chapterUrl, formatRefs, type Ref } from "@/lib/bible";
import { weightOf } from "@/lib/weights";
import { formatMinutes, formatDayRelative, formatLongDay, timeAgo, type DayKey } from "@/lib/dates";
import {
  chaptersForDay, currentDay, dateOfDay, minutesForDay, paceFor, planEnded,
  streakFor, totalDays,
} from "@/lib/progress";
import { MAX_NOTE_LENGTH } from "@/lib/types";
import type { ActivePlan, User, VerseOfDay } from "@/lib/types";

export function TodayTab({
  plan,
  me,
  verse,
  today,
  busy,
  onToggle,
  onAddNote,
  onDeleteNote,
}: {
  plan: ActivePlan;
  me: User;
  verse: VerseOfDay | null;
  today: DayKey;
  busy: boolean;
  onToggle: (day: number, done: boolean) => void;
  onAddNote: (day: number, body: string) => Promise<string | null>;
  onDeleteNote: (id: string) => void;
}) {
  const day = currentDay(plan, today);
  const chapters = chaptersForDay(plan, day);
  const minutes = minutesForDay(plan, day);
  const days = totalDays(plan);
  const pace = paceFor(plan, me.id, today);
  const streak = streakFor(plan, me.id, today);
  const doneToday = plan.completions.some((c) => c.userId === me.id && c.day === day);
  const ended = planEnded(plan, today);

  const [noteDraft, setNoteDraft] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const dayNotes = plan.notes.filter((n) => n.day === day);
  const nameOf = (id: string) =>
    plan.members.find((m) => m.id === id)?.displayName ?? "Someone";

  return (
    <div className="space-y-5 pb-4">
      {/* ---- the reading ---- */}
      <section className="rise-in rounded-2xl border border-line bg-card p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="eyebrow text-ink-2">
            {ended ? "The plan is finished" : formatDayRelative(dateOfDay(plan, day), today)}
          </p>
          <p className="stat text-xs text-ink-3">
            Day {day} of {days}
          </p>
        </div>

        <h1 className="serif mt-2 text-[1.75rem] leading-tight font-semibold text-ink">
          {formatRefs(chapters)}
        </h1>

        <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-2">
          <Glyph name="clock" className="h-4 w-4" />
          About {formatMinutes(minutes)}
          <span className="text-ink-3">
            &nbsp;&middot;&nbsp;{chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}
          </span>
        </p>

        <ul className="mt-4 space-y-1.5">
          {chapters.map((ref) => (
            <ChapterRow key={`${ref.book}-${ref.chapter}`} refr={ref} plan={plan} />
          ))}
        </ul>

        <button
          onClick={() => onToggle(day, !doneToday)}
          disabled={busy}
          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold transition active:scale-[0.99] disabled:opacity-60 ${
            doneToday
              ? "border border-good bg-transparent text-good"
              : "bg-accent text-page"
          }`}
        >
          <span className={doneToday ? "tick-in" : ""}>
            <Glyph name="check" className="h-5 w-5" />
          </span>
          {doneToday ? "Read" : "Mark as read"}
        </button>
      </section>

      {/* ---- pace and progress ---- */}
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

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-page-2">
          <div
            className="fill-in h-full rounded-full bg-accent"
            style={{ width: `${Math.min(100, (day / days) * 100)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-ink-3">
          <span className="tnum">{formatLongDay(plan.startDay)}</span>
          <span className="tnum">{formatLongDay(dateOfDay(plan, days))}</span>
        </div>
      </section>

      {/* ---- verse of the day ---- */}
      {verse && (
        <section className="rise-in rounded-2xl border border-line bg-card p-5" style={{ animationDelay: "120ms" }}>
          <p className="eyebrow flex items-center gap-1.5 text-ink-2">
            <Glyph name="quote" className="h-3.5 w-3.5" />
            Verse of the day
          </p>
          {verse.text ? (
            <blockquote className="serif mt-3 text-lg leading-relaxed text-ink">
              {verse.text}
            </blockquote>
          ) : (
            <p className="mt-3 text-sm text-ink-2">
              Tap through to read it in {plan.translation}.
            </p>
          )}
          <a
            href={chapterUrl({ book: verse.book, chapter: verse.chapter }, plan.translation)}
            target="_blank"
            rel="noreferrer"
            className="serif mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent underline underline-offset-4"
          >
            {verse.book} {verse.chapter}:{verse.verse}
            <Glyph name="link" className="h-3.5 w-3.5" />
          </a>
        </section>
      )}

      {/* ---- shared notes ---- */}
      <section className="rise-in rounded-2xl border border-line bg-card p-5" style={{ animationDelay: "180ms" }}>
        <p className="eyebrow flex items-center gap-1.5 text-ink-2">
          <Glyph name="note" className="h-3.5 w-3.5" />
          Notes on today
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
            placeholder={
              dayNotes.length ? "Add to the conversation" : "What stood out to you?"
            }
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

function ChapterRow({ refr, plan }: { refr: Ref; plan: ActivePlan }) {
  return (
    <li>
      <a
        href={chapterUrl(refr, plan.translation)}
        target="_blank"
        rel="noreferrer"
        className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-page-2 px-4 py-3 transition hover:border-accent"
      >
        <span className="serif text-[1.0625rem] font-medium text-ink">
          {refr.book} {refr.chapter}
        </span>
        <span className="flex items-center gap-2.5 text-xs text-ink-3">
          <span className="tnum">{weightOf(refr.book, refr.chapter)} min</span>
          <Glyph name="arrow-right" className="h-4 w-4 transition group-hover:text-accent" />
        </span>
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
