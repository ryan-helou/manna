"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthScreen } from "./AuthScreen";
import { Onboarding } from "./Onboarding";
import { TodayTab } from "./TodayTab";
import { TogetherTab } from "./TogetherTab";
import { JourneyTab } from "./JourneyTab";
import { SettingsSheet } from "./SettingsSheet";
import { MilestoneCard } from "./MilestoneCard";
import { Glyph, type GlyphName } from "./Glyph";
import { useManna } from "./useManna";
import { today as deviceToday, type DayKey } from "@/lib/dates";
import { milestonesFor, type Milestone } from "@/lib/progress";
import type { AppState } from "@/lib/types";
import type { Ref } from "@/lib/bible";

type Tab = "today" | "together" | "journey";
type Theme = "system" | "light" | "dark";

const TABS: { id: Tab; label: string; glyph: GlyphName }[] = [
  { id: "today", label: "Today", glyph: "book" },
  { id: "together", label: "Together", glyph: "users" },
  { id: "journey", label: "Journey", glyph: "chart" },
];

export function AppShell({
  initial,
  serverToday,
}: {
  initial: AppState;
  serverToday: DayKey;
}) {
  const { state, busy, send } = useManna(initial);
  const [tab, setTab] = useState<Tab>("today");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const [celebrating, setCelebrating] = useState<Milestone | null>(null);

  // Start from the server's day so the first client render matches the markup,
  // then hand over to the device's own calendar. A home-screen app is usually
  // resumed rather than loaded, so waking up re-reads both the date and the plan.
  const [refDay, setRefDay] = useState<DayKey>(serverToday);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRefDay(deviceToday());
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      setRefDay(deviceToday());
      void send("/api/session");
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [send]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("manna-theme");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {}
  }, []);

  // Watch for a canonical section being finished and mark the moment once.
  // localStorage keyed per reader per plan, so it needs no schema and cannot
  // replay after a reload part-way through the animation.
  const active = state.active;
  const meId = state.me?.id;
  useEffect(() => {
    if (!active || !meId) return;
    const earned = milestonesFor(active, meId).filter((m) => m.earned);
    if (earned.length === 0) return;
    const storeKey = `manna-milestones-${meId}-${active.id}`;
    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(storeKey) ?? "[]") as string[];
    } catch {
      seen = [];
    }
    const fresh = earned.filter((m) => !seen.includes(m.id));
    if (fresh.length === 0) return;
    // Marked as seen up front: a reload mid-animation should not replay it.
    try {
      localStorage.setItem(storeKey, JSON.stringify([...seen, ...fresh.map((m) => m.id)]));
    } catch {}
    // Show the largest one earned, so finishing the Old Testament does not get
    // upstaged by the minor prophets landing in the same tick.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCelebrating(fresh[fresh.length - 1]);
  }, [active, meId]);

  const applyTheme = useCallback((next: Theme) => {
    setTheme(next);
    try {
      if (next === "system") {
        localStorage.removeItem("manna-theme");
        document.documentElement.removeAttribute("data-theme");
      } else {
        localStorage.setItem("manna-theme", next);
        document.documentElement.setAttribute("data-theme", next);
      }
    } catch {}
  }, []);

  const post = useCallback(
    (url: string, body: unknown) =>
      send(url, { method: "POST", body: JSON.stringify(body) }),
    [send],
  );

  if (!state.me) {
    return (
      <AuthScreen
        busy={busy}
        onSubmit={(mode, username, password) =>
          post("/api/session", { mode, username, password })
        }
      />
    );
  }

  if (!state.active) {
    return (
      <Onboarding
        busy={busy}
        onCreate={(name, months) => post("/api/plans", { name, months })}
        onJoin={(code) => post("/api/plans/join", { code })}
      />
    );
  }

  const plan = state.active;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
      {/* ---- top bar ---- */}
      <header className="flex items-center justify-between gap-3 py-4">
        <PlanSwitcher
          plans={state.plans}
          activeId={plan.id}
          onSelect={(planId) => post("/api/plans/select", { planId })}
        />
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Plan settings"
          className="rounded-full p-2 text-ink-2 transition hover:bg-page-2 hover:text-ink"
        >
          <Glyph name="settings" className="h-5 w-5" />
        </button>
      </header>

      <main className="flex-1">
        {tab === "today" && (
          <TodayTab
            plan={plan}
            me={state.me}
            verse={state.verse}
            today={refDay}
            busy={busy}
            onToggleDay={(day, done) =>
              void post("/api/readings", { planId: plan.id, day, done })
            }
            onToggleChapter={(ref: Ref, done) =>
              void post("/api/readings", {
                planId: plan.id,
                book: ref.book,
                chapter: ref.chapter,
                done,
              })
            }
            onAddNote={(day, body) => post("/api/notes", { planId: plan.id, day, body })}
            onDeleteNote={(id) =>
              void send(`/api/notes?planId=${encodeURIComponent(plan.id)}&id=${encodeURIComponent(id)}`, {
                method: "DELETE",
              })
            }
          />
        )}
        {tab === "together" && <TogetherTab plan={plan} me={state.me} today={refDay} />}
        {tab === "journey" && <JourneyTab plan={plan} me={state.me} today={refDay} />}
      </main>

      {/* ---- tab bar ---- */}
      <nav className="sticky bottom-0 -mx-4 mt-4 border-t border-line bg-page/95 px-4 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-[0.6875rem] font-semibold transition ${
                tab === t.id ? "text-accent" : "text-ink-3"
              }`}
            >
              <Glyph name={t.glyph} className="h-5 w-5" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {celebrating && (
        <MilestoneCard milestone={celebrating} onClose={() => setCelebrating(null)} />
      )}

      {settingsOpen && (
        <SettingsSheet
          plan={plan}
          me={state.me}
          pushConfigured={state.push.configured}
          theme={theme}
          onTheme={applyTheme}
          busy={busy}
          onClose={() => setSettingsOpen(false)}
          onSavePlan={(patch: { name?: string; months?: number }) =>
            send(`/api/plans/${plan.id}`, { method: "PATCH", body: JSON.stringify(patch) })
          }
          onToggleEdit={(userId, canEdit) =>
            void send(`/api/plans/${plan.id}/members`, {
              method: "PATCH",
              body: JSON.stringify({ userId, canEdit }),
            })
          }
          onSignOut={() => void send("/api/session", { method: "DELETE" })}
        />
      )}
    </div>
  );
}

/**
 * The plan switcher. With one plan it is just the plan's name, which is what it
 * will be for almost everyone: a quiet label, not a control. It only becomes a
 * menu once there is a second plan to switch to.
 */
function PlanSwitcher({
  plans,
  activeId,
  onSelect,
}: {
  plans: { id: string; name: string; joinCode: string }[];
  activeId: string;
  onSelect: (planId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = plans.find((p) => p.id === activeId);

  if (plans.length <= 1) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-accent">
          <Glyph name="book" className="h-4 w-4" />
        </span>
        <span className="serif truncate text-[0.9375rem] font-semibold text-ink">
          {active?.name}
        </span>
      </span>
    );
  }

  return (
    <div className="relative min-w-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-page-2"
      >
        <span className="shrink-0 text-accent">
          <Glyph name="book" className="h-4 w-4" />
        </span>
        <span className="serif truncate text-[0.9375rem] font-semibold text-ink">
          {active?.name}
        </span>
        <Glyph name="chevron" className="h-4 w-4 shrink-0 text-ink-3" />
      </button>
      {open && (
        <>
          <button
            aria-label="Close"
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <ul className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-xl">
            {plans.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => {
                    setOpen(false);
                    if (p.id !== activeId) onSelect(p.id);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition hover:bg-page-2 ${
                    p.id === activeId ? "font-semibold text-ink" : "text-ink-2"
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  {p.id === activeId && (
                    <Glyph name="check" className="h-4 w-4 shrink-0 text-accent" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
