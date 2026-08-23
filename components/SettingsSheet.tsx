"use client";

import { useState } from "react";
import { Sheet } from "./Sheet";
import { Glyph } from "./Glyph";
import { NotificationSetup } from "./NotificationSetup";
import { TRANSLATIONS, type TranslationId } from "@/lib/bible";
import { TOTAL_WEIGHT_MINUTES } from "@/lib/weights";
import { formatMinutes, planLengthDays } from "@/lib/dates";
import { MAX_MONTHS, MIN_MONTHS } from "@/lib/types";
import type { ActivePlan, User } from "@/lib/types";

export function SettingsSheet({
  plan,
  me,
  pushConfigured,
  theme,
  onTheme,
  busy,
  onClose,
  onSavePlan,
  onToggleEdit,
  onSignOut,
}: {
  plan: ActivePlan;
  me: User;
  pushConfigured: boolean;
  theme: "system" | "light" | "dark";
  onTheme: (t: "system" | "light" | "dark") => void;
  busy: boolean;
  onClose: () => void;
  onSavePlan: (patch: { name?: string; months?: number; translation?: TranslationId }) => Promise<string | null>;
  onToggleEdit: (userId: string, canEdit: boolean) => void;
  onSignOut: () => void;
}) {
  const [name, setName] = useState(plan.name);
  const [months, setMonths] = useState(plan.months);
  const [translation, setTranslation] = useState<TranslationId>(plan.translation);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const isCreator = plan.creatorId === me.id;
  const days = planLengthDays(plan.startDay, months);
  const perDay = TOTAL_WEIGHT_MINUTES / days;
  const dirty = name !== plan.name || months !== plan.months || translation !== plan.translation;

  const field =
    "mt-2 w-full rounded-xl border border-line-2 bg-page px-4 py-3 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none disabled:opacity-60";

  return (
    <Sheet title="Plan settings" onClose={onClose}>
      <div className="space-y-6">
        {/* ---- join code ---- */}
        <div>
          <p className="eyebrow text-ink-2">Join code</p>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(plan.joinCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              } catch {
                setCopied(false);
              }
            }}
            className="mt-2 flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-page-2 px-4 py-3 transition hover:border-accent"
          >
            <span className="stat text-2xl font-semibold tracking-[0.3em] text-accent">
              {plan.joinCode}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-ink-2">
              {copied ? "Copied" : "Copy"}
              <Glyph name="copy" className="h-4 w-4" />
            </span>
          </button>
        </div>

        {/* ---- editable settings ---- */}
        <div>
          <p className="eyebrow text-ink-2">Plan name</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!plan.canEdit}
            className={field}
          />

          <p className="eyebrow mt-5 text-ink-2">Finish in</p>
          <div className="mt-2 flex items-center gap-4">
            <input
              type="range"
              min={MIN_MONTHS}
              max={MAX_MONTHS}
              step={1}
              value={months}
              disabled={!plan.canEdit}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-line accent-[var(--accent)] disabled:opacity-60"
            />
            <span className="stat w-[5.5rem] shrink-0 text-right text-base font-medium text-ink">
              {months} {months === 1 ? "month" : "months"}
            </span>
          </div>
          <p className="mt-2 text-sm text-ink-2">
            About <span className="font-semibold text-ink">{formatMinutes(perDay)}</span> a day
            across <span className="tnum">{days}</span> days.
          </p>
          {months !== plan.months && (
            <p className="mt-2 rounded-lg border border-line bg-page-2 px-3 py-2 text-sm text-ink-2">
              Changing the length rebuilds the schedule. What you have already read stays read.
            </p>
          )}

          <p className="eyebrow mt-5 text-ink-2">Translation</p>
          <div className="mt-2 flex gap-2">
            {TRANSLATIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={!plan.canEdit}
                onClick={() => setTranslation(t.id)}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                  translation === t.id
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-line-2 bg-page text-ink-2"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {!plan.canEdit && (
            <p className="mt-3 text-sm text-ink-3">
              Only the person who started this plan can change these, unless they hand you
              edit rights.
            </p>
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-warn">
              {error}
            </p>
          )}

          {plan.canEdit && dirty && (
            <button
              disabled={busy}
              onClick={async () => {
                const err = await onSavePlan({ name, months, translation });
                setError(err);
                if (!err) {
                  setSaved(true);
                  setTimeout(() => setSaved(false), 1800);
                }
              }}
              className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-page transition active:scale-[0.99] disabled:opacity-60"
            >
              Save changes
            </button>
          )}
          {saved && <p className="mt-2 text-sm font-medium text-good">Saved.</p>}
        </div>

        {/* ---- participants ---- */}
        <div>
          <p className="eyebrow flex items-center gap-1.5 text-ink-2">
            <Glyph name="users" className="h-3.5 w-3.5" />
            Who is reading
          </p>
          <ul className="mt-3 space-y-2">
            {plan.members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-page-2 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[0.9375rem] font-semibold text-ink">
                    {m.displayName}
                    {m.id === me.id && (
                      <span className="ml-1.5 text-xs font-normal text-ink-3">you</span>
                    )}
                  </span>
                  <span className="text-xs text-ink-3">
                    {m.isCreator ? "Started the plan" : m.canEdit ? "Can edit" : "Reader"}
                  </span>
                </span>
                {isCreator && !m.isCreator && (
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-ink-2">
                    can edit
                    <input
                      type="checkbox"
                      checked={m.canEdit}
                      onChange={(e) => onToggleEdit(m.id, e.target.checked)}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                  </label>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* ---- notifications ---- */}
        <NotificationSetup configured={pushConfigured} />

        {/* ---- appearance ---- */}
        <div>
          <p className="eyebrow text-ink-2">Appearance</p>
          <div className="mt-2 flex gap-1 rounded-xl border border-line bg-page-2 p-1">
            {(
              [
                ["system", "System", null],
                ["light", "Light", "sun"],
                ["dark", "Dark", "moon"],
              ] as const
            ).map(([id, label, glyph]) => (
              <button
                key={id}
                onClick={() => onTheme(id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  theme === id ? "bg-card text-ink shadow-sm" : "text-ink-2"
                }`}
              >
                {glyph && <Glyph name={glyph} className="h-3.5 w-3.5" />}
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-line-2 px-4 py-3 text-sm font-semibold text-ink-2 transition hover:text-warn"
        >
          <Glyph name="logout" className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </Sheet>
  );
}
