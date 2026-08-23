"use client";

import { formatLongDay, type DayKey } from "@/lib/dates";
import { dateOfDay, dayProgressWith, readChapters, totalDays } from "@/lib/progress";
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
  onSelect,
}: {
  plan: ActivePlan;
  userId: string;
  today: DayKey;
  /** Given when the squares should be tappable. Omitted for someone else's. */
  onSelect?: (day: number) => void;
}) {
  const days = totalDays(plan);
  // Built once for the whole grid rather than inside every cell.
  const read = readChapters(plan, userId);

  // Pad the front so the first column starts on a Sunday.
  const first = new Date(plan.startDay);
  const lead = first.getDay();
  const cells: ({ day: number; date: DayKey } | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push({ day: d, date: dateOfDay(plan, d, userId) });
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
                const { done, total } = dayProgressWith(read, plan, cell.day);
                const isDone = total > 0 && done === total;
                const isPartial = done > 0 && !isDone;
                const isFuture = cell.date > today;
                const isToday = cell.date === today;
                const label = `${formatLongDay(cell.date)}: ${
                  isDone
                    ? "read"
                    : isPartial
                      ? `${done} of ${total} read`
                      : isFuture
                        ? "still to come"
                        : "not logged"
                }`;
                const tone = `h-2.5 w-2.5 rounded-[3px] ${
                  isDone
                    ? "bg-accent"
                    : isPartial
                      ? "bg-accent/40"
                      : isFuture
                        ? "bg-page-2"
                        : "bg-line"
                } ${isToday ? "ring-1 ring-ink-2" : ""}`;
                // Every square is a day you can open. Painting the missed ones
                // grey and then making them untouchable was the whole problem.
                if (!onSelect) return <span key={di} title={label} className={tone} />;
                const cellDay = cell.day;
                return (
                  <button
                    key={di}
                    title={label}
                    aria-label={label}
                    onClick={() => onSelect(cellDay)}
                    className={`${tone} transition hover:ring-2 hover:ring-accent`}
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
          <span className="h-2.5 w-2.5 rounded-[3px] bg-accent/40" /> part read
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
