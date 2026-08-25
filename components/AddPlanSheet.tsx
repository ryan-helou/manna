"use client";

import { useState } from "react";
import { Sheet } from "./Sheet";
import { Glyph } from "./Glyph";
import { MAX_MONTHS, MIN_MONTHS, normalizeCode } from "@/lib/types";

/** Starting a second plan, or joining someone else's, once you are already in one. */
export function AddPlanSheet({
  busy,
  onClose,
  onCreate,
  onJoin,
}: {
  busy: boolean;
  onClose: () => void;
  onCreate: (name: string, months: number) => Promise<string | null>;
  onJoin: (code: string) => Promise<string | null>;
}) {
  const [tab, setTab] = useState<"join" | "create">("join");
  const [name, setName] = useState("");
  const [months, setMonths] = useState(12);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet title="Another plan" onClose={onClose}>
      <div className="flex gap-1 rounded-xl border border-line bg-page-2 p-1">
        {(
          [
            ["join", "I have a code"],
            ["create", "Start a plan"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              setTab(id);
              setError(null);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === id ? "bg-card text-ink shadow-sm" : "text-ink-2"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "join" ? (
        <form
          className="mt-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(await onJoin(code));
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, 4))}
            placeholder="K7RM"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-label="Join code"
            className="stat w-full rounded-xl border-2 border-line-2 bg-page px-4 py-4 text-center text-3xl font-medium uppercase tracking-[0.35em] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-warn">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || code.length < 4}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-base font-semibold text-page transition active:scale-[0.99] disabled:opacity-50"
          >
            Join
            <Glyph name="arrow-right" className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <form
          className="mt-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(await onCreate(name, months));
          }}
        >
          <label htmlFor="new-plan-name" className="eyebrow block text-ink-2">
            Call it something
          </label>
          <input
            id="new-plan-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bible in a year"
            className="mt-2 w-full rounded-xl border border-line-2 bg-page px-4 py-3.5 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />

          <label htmlFor="new-plan-months" className="eyebrow mt-5 block text-ink-2">
            Finish in
          </label>
          <div className="mt-2 flex items-center gap-4">
            <input
              id="new-plan-months"
              type="range"
              min={MIN_MONTHS}
              max={MAX_MONTHS}
              step={1}
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-line accent-[var(--accent)]"
            />
            <span className="stat w-[5.5rem] shrink-0 text-right text-base font-medium text-ink">
              {months} {months === 1 ? "month" : "months"}
            </span>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-warn">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-base font-semibold text-page transition active:scale-[0.99] disabled:opacity-50"
          >
            Start it
            <Glyph name="arrow-right" className="h-4 w-4" />
          </button>
        </form>
      )}
    </Sheet>
  );
}
