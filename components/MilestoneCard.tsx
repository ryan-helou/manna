"use client";

import { useEffect } from "react";
import { Glyph } from "./Glyph";
import type { Milestone } from "@/lib/progress";

/**
 * The moment you finish a section of the canon. Ten of these across a plan, so
 * it has to feel earned rather than routine: it takes the screen, says the one
 * thing worth saying, and gets out of the way.
 */
export function MilestoneCard({
  milestone,
  onClose,
}: {
  milestone: Milestone;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const line =
    milestone.id === "whole-bible"
      ? "All 66 books. Every one of the 1,189 chapters. You read the whole thing."
      : milestone.id === "old-testament"
        ? "Genesis through Malachi. The long half, behind you."
        : `${milestone.total} chapters, finished.`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-page/90 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${milestone.label} complete`}
        className="rise-in relative w-full max-w-sm rounded-3xl border border-line bg-card p-8 text-center shadow-2xl"
      >
        <span className="tick-in mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent bg-accent-soft text-accent">
          <Glyph name="seal" className="h-8 w-8" />
        </span>

        <p className="eyebrow mt-6 text-ink-3">Finished</p>
        <h2 className="serif mt-1 text-3xl leading-tight font-semibold text-ink">
          {milestone.label}
        </h2>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-2">{line}</p>

        <button
          onClick={onClose}
          className="mt-7 w-full rounded-xl bg-accent px-4 py-3.5 text-base font-semibold text-page transition active:scale-[0.99]"
        >
          Keep going
        </button>
      </div>
    </div>
  );
}
