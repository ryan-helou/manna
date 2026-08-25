"use client";

import { useState } from "react";
import { Sheet } from "./Sheet";
import { Glyph } from "./Glyph";
import { NotificationSetup } from "./NotificationSetup";
import { InviteCard } from "./InviteCard";
import { MAX_MONTHS, MIN_MONTHS } from "@/lib/types";
import type { ActivePlan, User } from "@/lib/types";

export function SettingsSheet({
  plan,
  me,
  pushConfigured,
  isAdmin,
  theme,
  onTheme,
  busy,
  onClose,
  onSavePlan,
  onSaveProfile,
  onToggleEdit,
  onRemove,
  onSignOut,
}: {
  plan: ActivePlan;
  me: User;
  pushConfigured: boolean;
  isAdmin: boolean;
  theme: "system" | "light" | "dark";
  onTheme: (t: "system" | "light" | "dark") => void;
  busy: boolean;
  onClose: () => void;
  onSavePlan: (patch: { name?: string; months?: number }) => Promise<string | null>;
  onSaveProfile: (patch: {
    displayName?: string;
    username?: string;
    currentPassword?: string;
    newPassword?: string;
    reminderHour?: number;
  }) => Promise<string | null>;
  onToggleEdit: (userId: string, canEdit: boolean) => void;
  onRemove: (userId: string) => void;
  onSignOut: () => void;
}) {
  const [name, setName] = useState(plan.name);
  const [months, setMonths] = useState(plan.months);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [displayName, setDisplayName] = useState(me.displayName);
  const [username, setUsername] = useState(me.username);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const profileDirty = displayName !== me.displayName || username !== me.username;

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  // The plan's owner, or the admin, who can moderate any plan.
  const isCreator = plan.creatorId === me.id || isAdmin;
  const dirty = name !== plan.name || months !== plan.months;

  const field =
    "mt-2 w-full rounded-xl border border-line-2 bg-page px-4 py-3 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none disabled:opacity-60";

  return (
    <Sheet title="Settings" onClose={onClose}>
      <div className="space-y-6">
        <InviteCard planName={plan.name} code={plan.joinCode} />

        {/* ---- you ---- */}
        <div>
          <p className="eyebrow flex items-center gap-1.5 text-ink-2">
            <Glyph name="users" className="h-3.5 w-3.5" />
            You
          </p>

          <label htmlFor="display-name" className="mt-3 block text-sm text-ink-2">
            Display name
          </label>
          <input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={field}
          />
          <p className="mt-1.5 text-xs text-ink-3">What everyone else sees.</p>

          <label htmlFor="username" className="mt-4 block text-sm text-ink-2">
            Username
          </label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={field}
          />
          <p className="mt-1.5 text-xs text-ink-3">What you sign in with.</p>

          {profileError && (
            <p role="alert" className="mt-3 text-sm font-medium text-warn">
              {profileError}
            </p>
          )}
          {profileDirty && (
            <button
              disabled={busy}
              onClick={async () => {
                const err = await onSaveProfile({ displayName, username });
                setProfileError(err);
                if (!err) {
                  setProfileSaved(true);
                  setTimeout(() => setProfileSaved(false), 1800);
                }
              }}
              className="mt-3 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-page transition active:scale-[0.99] disabled:opacity-60"
            >
              Save
            </button>
          )}
          {profileSaved && <p className="mt-2 text-sm font-medium text-good">Saved.</p>}

          <button
            onClick={() => setPwOpen((v) => !v)}
            aria-expanded={pwOpen}
            className="mt-4 flex w-full items-center justify-between gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink-2 transition hover:border-accent"
          >
            Change password
            <span className={`transition ${pwOpen ? "rotate-180" : ""}`}>
              <Glyph name="chevron" className="h-4 w-4" />
            </span>
          </button>

          {pwOpen && (
            <div className="mt-3">
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Current password"
                autoComplete="current-password"
                className={field}
              />
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="New password"
                autoComplete="new-password"
                className={field}
              />
              {pwError && (
                <p role="alert" className="mt-3 text-sm font-medium text-warn">
                  {pwError}
                </p>
              )}
              {pwSaved && <p className="mt-3 text-sm font-medium text-good">Password changed.</p>}
              <button
                disabled={busy || !currentPw || !newPw}
                onClick={async () => {
                  const err = await onSaveProfile({
                    currentPassword: currentPw,
                    newPassword: newPw,
                  });
                  setPwError(err);
                  if (!err) {
                    setCurrentPw("");
                    setNewPw("");
                    setPwOpen(false);
                    setPwSaved(true);
                    setTimeout(() => setPwSaved(false), 2200);
                  }
                }}
                className="mt-3 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-page transition active:scale-[0.99] disabled:opacity-50"
              >
                Update password
              </button>
            </div>
          )}
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
          {months !== plan.months && (
            <p className="mt-2 rounded-lg border border-line bg-page-2 px-3 py-2 text-sm text-ink-2">
              Changing the length rebuilds the schedule. What you have already read stays read.
            </p>
          )}

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
                const err = await onSavePlan({ name, months });
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
          {isCreator && plan.members.length > 1 && (
            <p className="mt-1.5 text-xs text-ink-3">
              Tap the bin twice to remove someone. Their reading and notes go with them.
            </p>
          )}
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
                  <span className="flex shrink-0 items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-2">
                      can edit
                      <input
                        type="checkbox"
                        checked={m.canEdit}
                        onChange={(e) => onToggleEdit(m.id, e.target.checked)}
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                    </label>
                    <button
                      onClick={() => {
                        // Their reading and their notes go too, so make sure.
                        if (confirmRemove === m.id) onRemove(m.id);
                        else {
                          setConfirmRemove(m.id);
                          setTimeout(() => setConfirmRemove(null), 4000);
                        }
                      }}
                      aria-label={`Remove ${m.displayName} from the plan`}
                      className={`rounded-lg p-1.5 transition ${
                        confirmRemove === m.id
                          ? "bg-warn/15 text-warn"
                          : "text-ink-3 hover:text-warn"
                      }`}
                    >
                      <Glyph name="trash" className="h-4 w-4" />
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* ---- notifications ---- */}
        <NotificationSetup
          configured={pushConfigured}
          reminderHour={me.reminderHour}
          onHour={(hour) => void onSaveProfile({ reminderHour: hour })}
        />

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
