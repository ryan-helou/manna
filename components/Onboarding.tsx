"use client";

import { useState } from "react";
import { Glyph } from "./Glyph";
import { TRANSLATIONS, type TranslationId } from "@/lib/bible";
import { TOTAL_WEIGHT_MINUTES } from "@/lib/weights";
import { MAX_MONTHS, MIN_MONTHS, normalizeCode } from "@/lib/types";
import { formatMinutes, planLengthDays, today } from "@/lib/dates";

/** First run: either start a plan or join the one a friend already started. */
export function Onboarding({
  busy,
  onCreate,
  onJoin,
}: {
  busy: boolean;
  onCreate: (name: string, months: number, translation: TranslationId) => Promise<string | null>;
  onJoin: (code: string) => Promise<string | null>;
}) {
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [months, setMonths] = useState(12);
  const [translation, setTranslation] = useState<TranslationId>("ESV");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const days = planLengthDays(today(), months);
  const perDay = TOTAL_WEIGHT_MINUTES / days;

  const field =
    "mt-2 w-full rounded-xl border border-line-2 bg-page px-4 py-3.5 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="rise-in">
        <span className="text-accent">
          <Glyph name="book" className="h-8 w-8" />
        </span>
        <h1 className="serif mt-4 text-3xl font-semibold text-ink">One plan, two readers</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-2">
          Start a plan and share the code, or enter the code you were given.
        </p>
      </div>

      <div className="mt-7 flex gap-1 rounded-xl border border-line bg-page-2 p-1">
        {(["create", "join"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setError(null);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === t ? "bg-card text-ink shadow-sm" : "text-ink-2"
            }`}
          >
            {t === "create" ? "Start a plan" : "Join a plan"}
          </button>
        ))}
      </div>

      {tab === "create" ? (
        <form
          className="mt-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(await onCreate(name, months, translation));
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
          <p className="mt-3 rounded-xl border border-line bg-page-2 px-4 py-3 text-sm text-ink-2">
            About <span className="font-semibold text-ink">{formatMinutes(perDay)}</span> a day
            across <span className="tnum">{days}</span> days.
            {perDay > 150 && " That is a serious pace."}
          </p>

          <label className="eyebrow mt-6 block text-ink-2">Translation</label>
          <div className="mt-2 flex gap-2">
            {TRANSLATIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTranslation(t.id)}
                className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  translation === t.id
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-line-2 bg-page text-ink-2"
                }`}
              >
                {t.label}
              </button>
            ))}
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
      ) : (
        <form
          className="mt-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(await onJoin(code));
          }}
        >
          <label htmlFor="code" className="eyebrow block text-ink-2">
            Join code
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, 4))}
            placeholder="K7RM"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            className="stat mt-2 w-full rounded-xl border border-line-2 bg-page px-4 py-4 text-center text-3xl font-medium uppercase tracking-[0.4em] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
          <p className="mt-3 text-sm text-ink-2">
            Four characters. Case does not matter.
          </p>
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
            Join
            <Glyph name="arrow-right" className="h-4 w-4" />
          </button>
        </form>
      )}
    </main>
  );
}
