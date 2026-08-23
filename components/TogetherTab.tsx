"use client";

import { Glyph } from "./Glyph";
import type { DayKey } from "@/lib/dates";
import { currentDay, standings, totalDays } from "@/lib/progress";
import type { ActivePlan, User } from "@/lib/types";

/**
 * You against whoever else is in the plan. The framing matters: the person
 * behind should read this and want to catch up, not close the app. So the gap
 * is always expressed as something reachable, and nobody is ever called last.
 */
export function TogetherTab({
  plan,
  me,
  today,
}: {
  plan: ActivePlan;
  me: User;
  today: DayKey;
}) {
  const board = standings(plan, today);
  const days = totalDays(plan);
  const day = currentDay(plan, today, me.id);
  const mine = board.find((s) => s.userId === me.id);
  const leader = board[0];
  const gap = mine && leader ? leader.daysDone - mine.daysDone : 0;

  return (
    <div className="space-y-5 pb-4">
      <section className="rise-in rounded-2xl border border-line bg-card p-5">
        <p className="eyebrow flex items-center gap-1.5 text-ink-2">
          <Glyph name="users" className="h-3.5 w-3.5" />
          Where everyone is
        </p>

        {board.length === 1 ? (
          <div className="mt-3">
            <p className="serif text-lg text-ink">Reading on your own for now.</p>
            <p className="mt-1.5 text-sm text-ink-2">
              Share the code{" "}
              <span className="stat font-semibold tracking-widest text-accent">
                {plan.joinCode}
              </span>{" "}
              and this turns into a race.
            </p>
          </div>
        ) : (
          <p className="serif mt-2 text-lg leading-snug text-ink">
            {gap === 0
              ? "Dead level. Nobody is giving an inch."
              : gap > 0
                ? `You are ${gap} day${gap === 1 ? "" : "s"} back. That is one good morning away.`
                : `You are ${-gap} day${gap === -1 ? "" : "s"} up. Keep the pressure on.`}
          </p>
        )}

        <ul className="mt-5 space-y-3">
          {board.map((s, i) => {
            const isMe = s.userId === me.id;
            const pct = days ? (s.daysDone / days) * 100 : 0;
            const onPacePct = days ? (day / days) * 100 : 0;
            return (
              <li key={s.userId}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-baseline gap-2">
                    <span
                      className={`text-[0.9375rem] font-semibold ${isMe ? "text-accent" : "text-ink"}`}
                    >
                      {s.displayName}
                      {isMe && <span className="ml-1.5 text-xs font-normal text-ink-3">you</span>}
                    </span>
                    {i === 0 && board.length > 1 && (
                      <span className="text-ink-3">
                        <Glyph name="trophy" className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </span>
                  <span className="stat text-xs text-ink-2">
                    {s.daysDone}
                    <span className="text-ink-3">/{days} days</span>
                  </span>
                </div>

                <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-page-2">
                  <div
                    className={`h-full rounded-full ${isMe ? "bg-accent" : "bg-line-2"}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                  {/* Where the plan says you should be by tonight. */}
                  <span
                    aria-hidden
                    className="absolute top-0 h-full w-px bg-ink-3"
                    style={{ left: `${Math.min(100, onPacePct)}%` }}
                  />
                </div>

                <div className="mt-1.5 flex items-center gap-3 text-xs text-ink-3">
                  <span className="tnum">{s.chaptersRead} chapters</span>
                  {s.streak > 0 && (
                    <span className="flex items-center gap-1">
                      <Glyph name="flame" className="h-3 w-3" />
                      <span className="tnum">{s.streak}</span>
                    </span>
                  )}
                  <span
                    className={
                      s.pace.status === "behind"
                        ? "text-warn"
                        : s.pace.status === "ahead"
                          ? "text-good"
                          : "text-ink-3"
                    }
                  >
                    {s.pace.status === "on-pace"
                      ? "on pace"
                      : s.pace.status === "ahead"
                        ? `${s.pace.delta} ahead`
                        : `${-s.pace.delta} behind`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-5 flex items-center gap-1.5 text-xs text-ink-3">
          <span aria-hidden className="inline-block h-3 w-px bg-ink-3" />
          the line marks where the plan says you should be tonight
        </p>
      </section>
    </div>
  );
}
