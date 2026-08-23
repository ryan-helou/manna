"use client";

import { useState } from "react";
import { Glyph } from "./Glyph";
import { PersonSheet } from "./PersonSheet";
import { formatMinutes, type DayKey } from "@/lib/dates";
import { totalDays } from "@/lib/progress";
import { timeAgo } from "@/lib/dates";
import type { ActivePlan, FeedNote, User } from "@/lib/types";

/**
 * Everyone in the plan, ordered by how far through they are.
 *
 * Written for a group rather than a pair. Your rank is shown plainly, because
 * hiding it from a competition would be patronising, but the gap quoted beside
 * it is to the person immediately ahead rather than to the leader. Twelfth of
 * twelve is a fact; eleven days behind the front runner is a reason to stop,
 * and one morning behind the person in front of you is a reason to keep going.
 */
export function TogetherTab({
  plan,
  me,
  feed,
  today,
}: {
  plan: ActivePlan;
  me: User;
  feed: FeedNote[];
  today: DayKey;
}) {
  const board = plan.standings;
  const days = totalDays(plan);
  const myRank = board.findIndex((s) => s.userId === me.id) + 1;
  const mine = board[myRank - 1];
  const ahead = myRank > 1 ? board[myRank - 2] : null;

  const doneToday = board.filter((s) => s.readToday);
  const [looking, setLooking] = useState<string | null>(null);
  const lookingAt = board.find((s) => s.userId === looking) ?? null;
  const iAmDone = doneToday.some((s) => s.userId === me.id);

  return (
    <div className="space-y-5 pb-4">
      <section className="rise-in rounded-2xl border border-line bg-card p-5">
        <p className="eyebrow flex items-center gap-1.5 text-ink-2">
          <Glyph name="users" className="h-3.5 w-3.5" />
          Today
        </p>
        <p className="serif mt-2 text-lg leading-snug text-ink">
          {board.length === 1
            ? "Reading on your own for now. Anyone who signs in joins you."
            : iAmDone
              ? doneToday.length === board.length
                ? "Everyone has read today. Good morning to all of you."
                : `You have read today, along with ${doneToday.length - 1} of the other ${board.length - 1}.`
              : doneToday.length === 0
                ? "Nobody has read yet today. Be the first."
                : `${doneToday.length} of ${board.length} have read today. You are not one of them yet.`}
        </p>

        {/* A dozen faces at a glance: filled means today is done. */}
        {board.length > 1 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {board.map((s) => {
              const done = doneToday.some((d) => d.userId === s.userId);
              return (
                <li
                  key={s.userId}
                  title={`${s.displayName}: ${done ? "read today" : "not yet"}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-[0.6875rem] font-semibold ${
                    done
                      ? "border-accent bg-accent text-page"
                      : "border-line bg-page-2 text-ink-3"
                  } ${s.userId === me.id ? "ring-2 ring-ink-3 ring-offset-2 ring-offset-[var(--card)]" : ""}`}
                >
                  {initials(s.displayName)}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rise-in rounded-2xl border border-line bg-card p-5" style={{ animationDelay: "60ms" }}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="eyebrow flex items-center gap-1.5 text-ink-2">
            <Glyph name="chart" className="h-3.5 w-3.5" />
            How far along
          </p>
          {board.length > 1 && mine && (
            <p className="stat text-xs text-ink-3">
              you are {ordinal(myRank)} of {board.length}
            </p>
          )}
        </div>

        {ahead && mine && ahead.daysDone > mine.daysDone && (
          <p className="serif mt-2 text-[0.9375rem] leading-snug text-ink-2">
            {ahead.displayName} is{" "}
            <span className="font-semibold text-ink">
              {ahead.daysDone - mine.daysDone} day
              {ahead.daysDone - mine.daysDone === 1 ? "" : "s"}
            </span>{" "}
            up on you. That is one good morning away.
          </p>
        )}

        <ul className="mt-4 space-y-3">
          {board.map((s, i) => {
            const isMe = s.userId === me.id;
            const pct = days ? (s.daysDone / days) * 100 : 0;
            const theirDay = s.day;
            return (
              <li key={s.userId}>
                <button
                  onClick={() => setLooking(s.userId)}
                  aria-label={`See how ${s.displayName} is going`}
                  className="w-full text-left"
                >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="stat w-4 shrink-0 text-xs text-ink-3">{i + 1}</span>
                    <span
                      className={`truncate text-[0.9375rem] font-semibold ${isMe ? "text-accent" : "text-ink"}`}
                    >
                      {s.displayName}
                    </span>
                    {i === 0 && board.length > 1 && (
                      <span className="shrink-0 text-ink-3">
                        <Glyph name="trophy" className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </span>
                  <span className="stat shrink-0 text-xs text-ink-2">
                    {s.daysDone}
                    <span className="text-ink-3">/{days}</span>
                  </span>
                </div>

                <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-page-2">
                  <div
                    className={`h-full rounded-full ${isMe ? "bg-accent" : "bg-line-2"}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                  {/* Where their own plan says they should be tonight. */}
                  <span
                    aria-hidden
                    className="absolute top-0 h-full w-px bg-ink-3"
                    style={{ left: `${Math.min(100, (theirDay / days) * 100)}%` }}
                  />
                </div>

                <div className="mt-1 flex items-center gap-3 text-xs text-ink-3">
                  <span className="tnum">{s.chaptersRead} chapters</span>
                  <span className="tnum">{formatMinutes(s.minutes)}</span>
                  {s.streak > 0 && (
                    <span className="flex items-center gap-1">
                      <Glyph name="flame" className="h-3 w-3" />
                      <span className="tnum">{s.streak}</span>
                    </span>
                  )}
                  <span
                    className={
                      s.status === "behind"
                        ? "text-warn"
                        : s.status === "ahead"
                          ? "text-good"
                          : "text-ink-3"
                    }
                  >
                    {s.status === "on-pace"
                      ? "on pace"
                      : s.status === "ahead"
                        ? `${s.delta} ahead`
                        : `${-s.delta} behind`}
                  </span>
                </div>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-5 flex items-center gap-1.5 text-xs text-ink-3">
          <span aria-hidden className="inline-block h-3 w-px bg-ink-3" />
          the line marks where each person&apos;s own plan says they should be tonight
        </p>
        <p className="mt-1.5 text-xs text-ink-3">Tap anyone to see how they are going.</p>
      </section>

      {/* ---- what people have been writing ---- */}
      <section className="rise-in rounded-2xl border border-line bg-card p-5" style={{ animationDelay: "120ms" }}>
        <p className="eyebrow flex items-center gap-1.5 text-ink-2">
          <Glyph name="note" className="h-3.5 w-3.5" />
          Lately
        </p>
        {feed.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">
            Nothing written yet. Notes you leave on a day show up here for everyone.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {feed.map((n) => (
              <li key={n.id} className="rounded-xl border border-line bg-page-2 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-ink">{n.authorName}</span>
                  <span className="stat shrink-0 text-xs text-ink-3">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="serif mt-0.5 text-xs text-ink-3">
                  Day {n.day} &middot; {n.reference}
                </p>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-ink-2">
                  {n.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {lookingAt && (
        <PersonSheet
          plan={plan}
          standing={lookingAt}
          today={today}
          onClose={() => setLooking(null)}
        />
      )}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
