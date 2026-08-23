"use client";

import { useEffect, useState } from "react";
import { Sheet } from "./Sheet";
import { Glyph } from "./Glyph";
import { Heatmap } from "./Heatmap";
import { formatMinutes, type DayKey } from "@/lib/dates";
import { longestStreakFor, milestonesFor, statsFor, streakFor } from "@/lib/progress";
import type { ActivePlan, ChapterRead, Standing, User } from "@/lib/types";

/**
 * Somebody else's journey.
 *
 * The board says where a person is; this says how they have been going. Their
 * ticks are fetched on open rather than carried in the state, because a dozen
 * people's reads in every payload is the thing we just stopped doing.
 */
export function PersonSheet({
  plan,
  standing,
  today,
  onClose,
}: {
  plan: ActivePlan;
  standing: Standing;
  today: DayKey;
  onClose: () => void;
}) {
  const [reads, setReads] = useState<ChapterRead[] | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/plans/${plan.id}/members/${standing.userId}`)
      .then((r) => (r.ok ? r.json() : { reads: [] }))
      .then((d: { reads?: ChapterRead[] }) => {
        if (live) setReads(d.reads ?? []);
      })
      .catch(() => {
        if (live) setReads([]);
      });
    return () => {
      live = false;
    };
  }, [plan.id, standing.userId]);

  // A view of the plan holding their reads, so the same functions answer.
  const view: ActivePlan = { ...plan, reads: reads ?? [] };
  const them = { id: standing.userId } as User;
  const stats = reads ? statsFor(view, them.id, today) : null;
  const earned = reads ? milestonesFor(view, them.id).filter((m) => m.earned) : [];

  return (
    <Sheet title={standing.displayName} onClose={onClose}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Stat label="Days read" value={`${standing.daysDone}`} sub={`of ${plan.cuts.length - 1}`} />
          <Stat label="Chapters" value={`${standing.chaptersRead}`} sub="of 1189" />
          <Stat label="Time in" value={formatMinutes(standing.minutes)} />
          <Stat
            label="Streak"
            value={`${reads ? streakFor(view, them.id, today) : standing.streak}`}
            sub={
              reads
                ? `longest ${longestStreakFor(view, them.id)}`
                : undefined
            }
          />
        </div>

        <div>
          <p className="eyebrow flex items-center gap-1.5 text-ink-2">
            <Glyph name="calendar" className="h-3.5 w-3.5" />
            Their days
          </p>
          <div className="mt-3">
            {reads ? (
              <Heatmap plan={view} userId={them.id} today={today} />
            ) : (
              <p className="text-sm text-ink-3">Loading.</p>
            )}
          </div>
        </div>

        <div>
          <p className="eyebrow flex items-center gap-1.5 text-ink-2">
            <Glyph name="seal" className="h-3.5 w-3.5" />
            Finished
          </p>
          {!reads ? (
            <p className="mt-2 text-sm text-ink-3">Loading.</p>
          ) : earned.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">
              No sections finished yet. {stats && stats.chaptersRead > 0 ? "Still early." : ""}
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {earned.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-xs font-semibold text-ink"
                >
                  <Glyph name="seal" className="h-3.5 w-3.5 text-accent" />
                  {m.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Sheet>
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
