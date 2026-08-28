"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthScreen } from "./AuthScreen";
import { Onboarding } from "./Onboarding";
import { TodayTab } from "./TodayTab";
import { TogetherTab } from "./TogetherTab";
import { NotesTab } from "./NotesTab";
import { JourneyTab } from "./JourneyTab";
import { SettingsTab } from "./SettingsTab";
import { MilestoneCard } from "./MilestoneCard";
import { AddPlanSheet } from "./AddPlanSheet";
import { PullToRefresh } from "./PullToRefresh";
import { Glyph, type GlyphName } from "./Glyph";
import { useManna } from "./useManna";
import { today as deviceToday, type DayKey } from "@/lib/dates";
import { currentDay, milestonesFor, type Milestone } from "@/lib/progress";
import { DEFAULT_PALETTE, isPalette, type PaletteId } from "@/lib/types";
import type { AppState } from "@/lib/types";
import { allChapters, type Ref } from "@/lib/bible";
import { today as todayKey } from "@/lib/dates";

type Tab = "today" | "notes" | "together" | "journey" | "settings";

/**
 * Add or remove chapter ticks in the local state, so the box fills under the
 * thumb rather than after the network. Replaced wholesale by the server's reply.
 */
function applyReads(state: AppState, refs: Ref[], done: boolean): AppState {
  const plan = state.active;
  const me = state.me;
  if (!plan || !me) return state;
  const touched = new Set(refs.map((r) => `${r.book} ${r.chapter}`));
  const reads = done
    ? [
        ...plan.reads,
        ...refs
          .filter((r) => !plan.reads.some((x) => x.book === r.book && x.chapter === r.chapter))
          .map((r) => ({ userId: me.id, book: r.book, chapter: r.chapter, readOn: todayKey() })),
      ]
    : plan.reads.filter((r) => !touched.has(`${r.book} ${r.chapter}`));
  return { ...state, active: { ...plan, reads } };
}
type Theme = "system" | "light" | "dark";

const TABS: { id: Tab; label: string; glyph: GlyphName }[] = [
  { id: "today", label: "Today", glyph: "book" },
  { id: "notes", label: "Notes", glyph: "chat" },
  { id: "together", label: "Together", glyph: "users" },
  { id: "journey", label: "Journey", glyph: "chart" },
  { id: "settings", label: "Settings", glyph: "settings" },
];

export function AppShell({
  initial,
  serverToday,
}: {
  initial: AppState;
  serverToday: DayKey;
}) {
  const { state, busy, send, sendOptimistic } = useManna(initial);
  const [tab, setTab] = useState<Tab>("today");
  const [theme, setTheme] = useState<Theme>("system");
  const [palette, setPalette] = useState<PaletteId>(DEFAULT_PALETTE);
  const [celebrating, setCelebrating] = useState<Milestone | null>(null);
  // Which day the reading card is showing, as an offset from today. Held here
  // rather than in the card because the heatmap and the book index both need to
  // send you to a day, and offsets survive the 3 AM rollover without resyncing.
  const [dayOffset, setDayOffset] = useState(0);
  const [addingPlan, setAddingPlan] = useState(false);

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

  // The saved theme and palette can only be read once the client is running, so
  // this is the one place state is set straight from an effect. One directive
  // for the pair rather than one each, which goes stale the moment either moves.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const savedPalette = localStorage.getItem("manna-palette");
      if (isPalette(savedPalette)) setPalette(savedPalette);
      const saved = localStorage.getItem("manna-theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {}
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  /**
   * Olive is the stylesheet's base, so choosing it removes the attribute rather
   * than setting one. Same shape as the theme above, and the same reason:
   * ThemeScript replays it before the next first paint.
   */
  const applyPalette = useCallback((next: PaletteId) => {
    setPalette(next);
    try {
      if (next === DEFAULT_PALETTE) {
        localStorage.removeItem("manna-palette");
        document.documentElement.removeAttribute("data-palette");
      } else {
        localStorage.setItem("manna-palette", next);
        document.documentElement.setAttribute("data-palette", next);
      }
    } catch {}
  }, []);

  // Pulling down re-reads the calendar day as well as the plan: a home-screen
  // app is usually resumed rather than loaded, and it can be resumed on a
  // different day than it was left on. Declared up here with the other hooks,
  // above the early returns for the signed-out and no-plan screens.
  const refresh = useCallback(async () => {
    setRefDay(deviceToday());
    await send("/api/session");
  }, [send]);

  const post = useCallback(
    (url: string, body: unknown) =>
      send(url, { method: "POST", body: JSON.stringify(body) }),
    [send],
  );

  if (!state.me) {
    return (
      <AuthScreen
        busy={busy}
        inviteRequired={state.inviteRequired}
        onSubmit={(mode, username, password, invite) =>
          post("/api/session", { mode, username, password, invite })
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
      <PullToRefresh onRefresh={refresh} />

      {/* ---- top bar ---- */}
      <header className="flex items-center justify-between gap-3 py-4">
        <PlanSwitcher
          plans={state.plans}
          activeId={plan.id}
          onSelect={(planId) => void post("/api/plans/select", { planId })}
          onAdd={() => setAddingPlan(true)}
        />
      </header>

      {/* The tab bar is fixed, so the scroll region carries the clearance for it.
          One place, so a new tab cannot forget it. */}
      <main className="flex-1 pb-[calc(7rem+env(safe-area-inset-bottom))]">
        {tab === "today" && (
          <TodayTab
            plan={plan}
            me={state.me}
            verse={state.verse}
            quiz={state.quiz}
            today={refDay}
            busy={busy}
            dayOffset={dayOffset}
            onDayOffset={setDayOffset}
            onToggleDay={(day, done) =>
              void sendOptimistic(
                (s) => applyReads(s, allChapters().slice(plan.cuts[day - 1], plan.cuts[day]), done),
                "/api/readings",
                { method: "POST", body: JSON.stringify({ planId: plan.id, day, done }) },
              )
            }
            onToggleChapter={(ref: Ref, done) =>
              void sendOptimistic((s) => applyReads(s, [ref], done), "/api/readings", {
                method: "POST",
                body: JSON.stringify({
                  planId: plan.id,
                  book: ref.book,
                  chapter: ref.chapter,
                  done,
                }),
              })
            }
            onAddNote={(day, body, ref) =>
              post("/api/notes", {
                planId: plan.id,
                day,
                body,
                ...(ref ? { book: ref.book, chapter: ref.chapter } : {}),
              })
            }
            onReply={(parentId, body) => post("/api/notes", { planId: plan.id, parentId, body })}
            onReact={(noteId, emoji) =>
              void post("/api/notes/react", { planId: plan.id, noteId, emoji })
            }
            onDeleteNote={(id) =>
              void send(`/api/notes?planId=${encodeURIComponent(plan.id)}&id=${encodeURIComponent(id)}`, {
                method: "DELETE",
              })
            }
          />
        )}
        {tab === "notes" && (
          <NotesTab
            feed={state.feed}
            me={state.me}
            busy={busy}
            onReply={(parentId, body) =>
              post("/api/notes", { planId: plan.id, parentId, body })
            }
            onReact={(noteId, emoji) =>
              void post("/api/notes/react", { planId: plan.id, noteId, emoji })
            }
            onDelete={(id) =>
              void send(
                `/api/notes?planId=${encodeURIComponent(plan.id)}&id=${encodeURIComponent(id)}`,
                { method: "DELETE" },
              )
            }
          />
        )}
        {tab === "together" && <TogetherTab plan={plan} me={state.me} today={refDay} />}
        {tab === "journey" && (
          <JourneyTab
            plan={plan}
            me={state.me}
            today={refDay}
            onGoToDay={(day) => {
              setDayOffset(day - currentDay(plan, refDay, state.me!.id));
              setTab("today");
            }}
          />
        )}

        {tab === "settings" && (
          <SettingsTab
            plan={plan}
            me={state.me}
            pushConfigured={state.push.configured}
            isAdmin={state.isAdmin}
            theme={theme}
            onTheme={applyTheme}
            palette={palette}
            onPalette={applyPalette}
            busy={busy}
            onSavePlan={(patch: { name?: string; months?: number }) =>
              send(`/api/plans/${plan.id}`, { method: "PATCH", body: JSON.stringify(patch) })
            }
            onSaveProfile={(patch) =>
              send("/api/session", { method: "PATCH", body: JSON.stringify(patch) })
            }
            onToggleEdit={(userId, canEdit) =>
              void send(`/api/plans/${plan.id}/members`, {
                method: "PATCH",
                body: JSON.stringify({ userId, canEdit }),
              })
            }
            onRemove={(userId) =>
              void send(`/api/plans/${plan.id}/members?userId=${encodeURIComponent(userId)}`, {
                method: "DELETE",
              })
            }
            onSignOut={() => void send("/api/session", { method: "DELETE" })}
          />
        )}
      </main>

      {/* ---- tab bar ----
          Fixed, not sticky: sticky pins to the containing block rather than the
          viewport, and a bottom bar that loses the viewport strands itself
          across the middle of the screen with the page running on underneath.

          Solid, not `bg-page/95 backdrop-blur`: iOS repaints a blurred bar at a
          stale position during momentum scrolling, so it detaches and floats
          mid-scroll before snapping back. AmaComp's tab bar did exactly this
          over its leaderboard. translateZ(0) gives the bar its own compositing
          layer so it stays put. */}
      {/* The wrapper is what is fixed, and it is empty: no background, no filter,
          nothing to repaint. The island inside it is an ordinary element that
          happens to sit there, which is the safest way to put a blurred surface
          at the bottom of an iOS screen. */}
      <nav className="pointer-events-none fixed inset-x-0 bottom-0 mx-auto w-full max-w-md px-3 pb-[max(0.45rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex gap-1 rounded-[1.75rem] border border-line p-1.5 glass-island">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 rounded-[1.35rem] py-2.5 text-[0.6875rem] font-semibold transition ${
                tab === t.id
                  ? "border border-accent/30 bg-accent-soft text-accent"
                  : "border border-transparent text-ink-3"
              }`}
            >
              <Glyph name={t.glyph} className="h-5 w-5" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {addingPlan && (
        <AddPlanSheet
          busy={busy}
          onClose={() => setAddingPlan(false)}
          onCreate={async (name: string, months: number) => {
            const err = await post("/api/plans", { name, months });
            if (!err) setAddingPlan(false);
            return err;
          }}
          onJoin={async (code: string) => {
            const err = await post("/api/plans/join", { code });
            if (!err) setAddingPlan(false);
            return err;
          }}
        />
      )}

      {celebrating && (
        <MilestoneCard milestone={celebrating} onClose={() => setCelebrating(null)} />
      )}

    </div>
  );
}

/**
 * The plan switcher. With one plan it is just the plan's name, which is what it
 * will be for almost everyone: a quiet label, not a control. It only becomes a
 * menu once there is a second plan to switch to.
 */
/**
 * The plan you are in, and the way to be in another.
 *
 * With one plan it is a label rather than a control, which is what it is for
 * almost everyone. It is still tappable, because starting a second plan or
 * joining somebody else's has to live somewhere and this is where you would
 * look for it.
 */
function PlanSwitcher({
  plans,
  activeId,
  onSelect,
  onAdd,
}: {
  plans: { id: string; name: string }[];
  activeId: string;
  onSelect: (planId: string) => void;
  onAdd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const active = plans.find((p) => p.id === activeId);

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
          <ul className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-line py-1 glass-raised">
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
            <li className="mt-1 border-t border-line pt-1">
              <button
                onClick={() => {
                  setOpen(false);
                  onAdd();
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-accent transition hover:bg-page-2"
              >
                <Glyph name="plus" className="h-4 w-4 shrink-0" />
                Start or join another
              </button>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}
