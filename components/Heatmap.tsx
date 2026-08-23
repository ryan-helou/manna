"use client";

import { formatLongDay, type DayKey } from "@/lib/dates";
import { dateOfDay, totalDays } from "@/lib/progress";
import type { ActivePlan } from "@/lib/types";

/**
 * A contribution graph over the length of the plan. Columns are weeks, rows are
 * weekdays, so the shape of a person's week shows up: the ones who read on the
 * commute, the ones who only manage Sundays.
 */
export function Heatmap({
  plan,
  userId,
  today,
}: {
  plan: ActivePlan;
  userId: string;
  today: DayKey;
}) {
  const days = totalDays(plan);
  const done = new Set(plan.completions.filter((c) => c.userId === userId).map((c) => c.day));

  // Pad the front so the first column starts on a Sunday.
  const first = new Date(plan.startDay);
  const lead = first.getDay();
  const cells: ({ day: number; date: DayKey } | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push({ day: d, date: dateOfDay(plan, d) });
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div>
      {/* The grid scrolls sideways on its own. The legend below must not go
          with it, and the scrollbar must not draw through it. */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-[3px]" style={{ minWidth: `${weeks.length * 13}px` }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((cell, di) => {
                if (!cell) return <span key={di} className="h-2.5 w-2.5" />;
                const isDone = done.has(cell.day);
                const isFuture = cell.date > today;
                const isToday = cell.date === today;
                return (
                  <span
                    key={di}
                    title={`${formatLongDay(cell.date)}: ${
                      isDone ? "read" : isFuture ? "still to come" : "not logged"
                    }`}
                    className={`h-2.5 w-2.5 rounded-[3px] ${
                      isDone ? "bg-accent" : isFuture ? "bg-page-2" : "bg-line"
                    } ${isToday ? "ring-1 ring-ink-2" : ""}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-accent" /> read
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-line" /> missed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-page-2" /> still to come
        </span>
      </div>
    </div>
  );
}
