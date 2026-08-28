"use client";

import { useState } from "react";
import { Glyph } from "./Glyph";
import { MAX_MONTHS, MIN_MONTHS, normalizeCode } from "@/lib/types";

/**
 * The two ways in, side by side, with neither buried.
 *
 * Shown when you are in no plans at all. Somebody who was handed a code needs
 * the code box in front of them, and somebody starting a group needs the name
 * field; guessing which and hiding the other is what makes this screen annoying.
 */
export function Onboarding({
  busy,
  onCreate,
  onJoin,
}: {
  busy: boolean;
  onCreate: (name: string, months: number) => Promise<string | null>;
  onJoin: (code: string) => Promise<string | null>;
}) {
  const [tab, setTab] = useState<"join" | "create">("join");
  const [name, setName] = useState("");
  const [months, setMonths] = useState(12);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const field =
    "mt-2 w-full rounded-xl border border-line-2 bg-page-2 px-4 py-3.5 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="rise-in">
        <span className="text-accent">
          <Glyph name="book" className="h-8 w-8" />
        </span>
        <h1 className="serif mt-4 text-3xl font-semibold text-ink">Get started</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
          Join a plan someone has already started, or start your own and invite
          people to it.
        </p>
      </div>

      <div className="mt-7 flex gap-1 rounded-xl border border-line bg-page-2 p-1">
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
            className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
              tab === id ? "bg-card text-ink shadow-sm" : "text-ink-2"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "join" ? (
        <form
          className="mt-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(await onJoin(code));
          }}
        >
          <label htmlFor="code" className="eyebrow block text-ink-2">
            The four character code
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, 4))}
            placeholder="K7RM"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            className="stat mt-2 w-full rounded-xl border-2 border-line-2 bg-page-2 px-4 py-5 text-center text-4xl font-medium uppercase tracking-[0.35em] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
          <p className="mt-2 text-sm text-ink-2">
            Whoever started the plan can find it in their settings. Upper or lower
            case, it does not matter.
          </p>
          {error && (
            <p role="alert" className="mt-4 text-sm font-medium text-warn">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || code.length < 4}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-accent accent-fill px-4 py-3.5 text-base font-semibold text-page transition active:scale-[0.99] disabled:opacity-50"
          >
            Join the plan
            <Glyph name="arrow-right" className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <form
          className="mt-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(await onCreate(name, months));
          }}
        >
          <label htmlFor="plan-name" className="eyebrow block text-ink-2">
            Call it something
          </label>
          <input
            id="plan-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bible in a year"
            enterKeyHint="done"
            className={field}
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
          <p className="mt-3 text-sm text-ink-2">
            You will get a code to share the moment it exists.
          </p>

          {error && (
            <p role="alert" className="mt-4 text-sm font-medium text-warn">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-accent accent-fill px-4 py-3.5 text-base font-semibold text-page transition active:scale-[0.99] disabled:opacity-50"
          >
            Start reading
            <Glyph name="arrow-right" className="h-4 w-4" />
          </button>
        </form>
      )}
    </main>
  );
}
