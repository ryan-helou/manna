"use client";

import { useState } from "react";
import { Glyph } from "./Glyph";
import { MAX_MONTHS, MIN_MONTHS } from "@/lib/types";

/**
 * Shown only when there is no plan yet. Whoever gets here first sets the pace
 * for everyone; after that, signing in is all it takes to be in it.
 */
export function Onboarding({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (name: string, months: number) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [months, setMonths] = useState(12);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="rise-in">
        <span className="text-accent">
          <Glyph name="book" className="h-8 w-8" />
        </span>
        <h1 className="serif mt-4 text-3xl font-semibold text-ink">Start the plan</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
          The whole Bible, levelled so every day asks about the same of you. Once it
          exists, anyone who signs in joins it.
        </p>
      </div>

      <form
        className="mt-7"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(await onCreate(name, months));
        }}
      >
        <label htmlFor="plan-name" className="eyebrow block text-ink-2">
          Plan name
        </label>
        <input
          id="plan-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Through the Bible"
          enterKeyHint="done"
          className="mt-2 w-full rounded-xl border border-line-2 bg-page px-4 py-3.5 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />

        <label htmlFor="months" className="eyebrow mt-6 block text-ink-2">
          Finish in
        </label>
        <div className="mt-2 flex items-center gap-4">
          <input
            id="months"
            type="range"
            min={MIN_MONTHS}
            max={MAX_MONTHS}
            step={1}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-line accent-[var(--accent)]"
          />
          <span className="stat w-[5.5rem] shrink-0 text-right text-lg font-medium text-ink">
            {months} {months === 1 ? "month" : "months"}
          </span>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm font-medium text-warn">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-base font-semibold text-page transition active:scale-[0.99] disabled:opacity-60"
        >
          Start reading
          <Glyph name="arrow-right" className="h-4 w-4" />
        </button>
      </form>
    </main>
  );
}
