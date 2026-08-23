"use client";

import { Glyph } from "./Glyph";
import { Heatmap } from "./Heatmap";
import { formatMinutes, formatShortDate, type DayKey } from "@/lib/dates";
import { milestonesFor, longestStreakFor, statsFor } from "@/lib/progress";
import { TOTAL_CHAPTERS } from "@/lib/bible";
import type { ActivePlan, User } from "@/lib/types";

/** Everything you have put in so far, visible the whole way through. */
export function JourneyTab({
  plan,
  me,
  today,
}: {
  plan: ActivePlan;
  me: User;
  today: DayKey;
}) {
  const s = statsFor(plan, me.id, today);
  const milestones = milestonesFor(plan, me.id);
  const best = longestStreakFor(plan, me.id);

  return (
    <div className="space-y-5 pb-4">
      <section className="rise-in rounded-2xl border border-line bg-card p-5">
        <p className="eyebrow flex items-center gap-1.5 text-ink-2">
          <Glyph name="chart" className="h-3.5 w-3.5" />
          So far
        </p>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
          <Stat label="Time invested" value={formatMinutes(s.minutesInvested)} />
          <Stat label="Chapters read" value={`${s.chaptersRead}`} sub={`of ${TOTAL_CHAPTERS}`} />
          <Stat label="Books finished" value={`${s.booksFinished}`} sub="of 66" />
          <Stat label="Longest streak" value={`${best}`} sub={best === 1 ? "day" : "days"} />
          <Stat
            label="Average pace"
            value={s.averagePace.toFixed(2)}
            sub="days of reading per day"
          />
          <Stat
            label="Projected finish"
            value={s.projectedFinish ? formatShortDate(s.projectedFinish) : "not yet"}
            sub={s.projectedFinish ? undefined : "read a day to find out"}
          />
        </div>

        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-ink-2">Through the Bible</span>
            <span className="stat text-sm font-semibold text-ink">
              {(s.fraction * 100).toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-page-2">
            <div
              className="fill-in h-full rounded-full bg-accent"
              style={{ width: `${Math.min(100, s.fraction * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-ink-3">
            Measured in study minutes, not chapter count, so a week in Chronicles does
            not count for more than a week in Romans.
          </p>
        </div>
      </section>

      <section className="rise-in rounded-2xl border border-line bg-card p-5" style={{ animationDelay: "60ms" }}>
        <p className="eyebrow flex items-center gap-1.5 text-ink-2">
          <Glyph name="calendar" className="h-3.5 w-3.5" />
          Every day of the plan
        </p>
        <div className="mt-4">
          <Heatmap plan={plan} userId={me.id} today={today} />
        </div>
      </section>

      <section className="rise-in rounded-2xl border border-line bg-card p-5" style={{ animationDelay: "120ms" }}>
        <p className="eyebrow flex items-center gap-1.5 text-ink-2">
          <Glyph name="seal" className="h-3.5 w-3.5" />
          Milestones
        </p>
        <ul className="mt-4 space-y-3">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                  m.earned
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-page-2 text-ink-3"
                }`}
              >
                <Glyph name={m.earned ? "seal" : "scroll"} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span
                    className={`serif text-[0.9375rem] ${m.earned ? "font-semibold text-ink" : "text-ink-2"}`}
                  >
                    {m.label}
                  </span>
                  <span className="stat text-xs text-ink-3">
                    {m.done}/{m.total}
                  </span>
                </span>
                <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-page-2">
                  <span
                    className={`block h-full rounded-full ${m.earned ? "bg-accent" : "bg-line-2"}`}
                    style={{ width: `${(m.done / m.total) * 100}%` }}
                  />
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="stat mt-1 text-xl font-medium text-ink">{value}</p>
      {sub && <p className="text-xs text-ink-3">{sub}</p>}
    </div>
  );
}
