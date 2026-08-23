"use client";

import { useState } from "react";
import { Sheet } from "./Sheet";
import { Glyph } from "./Glyph";
import { BOOKS, chapterUrl } from "@/lib/bible";
import { readChapters, scheduleFromCuts } from "@/lib/progress";
import type { ActivePlan, User } from "@/lib/types";

/**
 * All sixty-six books, and where you are in each.
 *
 * The plan only ever moves forward; this is how you go back. Tapping a chapter
 * opens the day that chapter belongs to, so you land somewhere you can tick it
 * off or read what people wrote, rather than on a dead reference.
 */
export function BookIndexSheet({
  plan,
  me,
  onClose,
  onGoToDay,
}: {
  plan: ActivePlan;
  me: User;
  onClose: () => void;
  onGoToDay: (day: number) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const read = readChapters(plan, me.id);

  // Which plan day each chapter falls on, so a tap can land there.
  const dayOf = new Map<string, number>();
  scheduleFromCuts(plan.cuts).forEach((refs, i) => {
    for (const r of refs) dayOf.set(`${r.book} ${r.chapter}`, i + 1);
  });

  return (
    <Sheet title="The books" onClose={onClose}>
      <ul className="space-y-1.5">
        {BOOKS.map((b) => {
          let done = 0;
          for (let c = 1; c <= b.chapters; c++) if (read.has(`${b.name} ${c}`)) done++;
          const complete = done === b.chapters;
          const isOpen = open === b.name;
          return (
            <li key={b.name} className="rounded-xl border border-line bg-page-2">
              <button
                onClick={() => setOpen(isOpen ? null : b.name)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span
                      className={`serif truncate text-[0.9375rem] ${
                        complete ? "font-semibold text-ink" : "text-ink-2"
                      }`}
                    >
                      {b.name}
                    </span>
                    <span className="stat shrink-0 text-xs text-ink-3">
                      {done}/{b.chapters}
                    </span>
                  </span>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-line">
                    <span
                      className={`block h-full rounded-full ${complete ? "bg-accent" : "bg-line-2"}`}
                      style={{ width: `${(done / b.chapters) * 100}%` }}
                    />
                  </span>
                </span>
                <span className={`shrink-0 text-ink-3 transition ${isOpen ? "rotate-180" : ""}`}>
                  <Glyph name="chevron" className="h-4 w-4" />
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-line px-3 pb-3 pt-2">
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: b.chapters }, (_, i) => i + 1).map((c) => {
                      const isRead = read.has(`${b.name} ${c}`);
                      const day = dayOf.get(`${b.name} ${c}`);
                      return (
                        <button
                          key={c}
                          onClick={() => {
                            if (day) {
                              onGoToDay(day);
                              onClose();
                            }
                          }}
                          title={day ? `${b.name} ${c} is on day ${day}` : `${b.name} ${c}`}
                          className={`stat h-7 min-w-7 rounded-md border px-1 text-xs transition ${
                            isRead
                              ? "border-accent bg-accent-soft text-ink"
                              : "border-line-2 bg-page text-ink-3 hover:border-accent"
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                  <a
                    href={chapterUrl({ book: b.name, chapter: 1 }, plan.translation)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent underline underline-offset-4"
                  >
                    Open {b.name} in {plan.translation}
                    <Glyph name="link" className="h-3 w-3" />
                  </a>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
