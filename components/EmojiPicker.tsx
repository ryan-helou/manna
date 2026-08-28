"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QUICK_REACTIONS } from "@/lib/types";
import type { EmojiEntry } from "@/lib/emoji";

/**
 * Pick any emoji, by browsing or by name.
 *
 * This replaced a field that asked you to type one. On a phone that meant
 * hunting for the emoji key on a keyboard the field had no way of summoning,
 * which is a fine thing to ask of a developer and no use at all to a reader at
 * six in the morning. So: the whole list, grouped the way a keyboard groups it,
 * searchable by the standard names.
 *
 * The list is nearly two thousand entries, so it is imported dynamically. Until
 * it arrives the quick row still works, which means the common case never waits
 * for it.
 */
export function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<
    readonly { label: string; emoji: readonly EmojiEntry[] }[] | null
  >(null);
  const [group, setGroup] = useState(0);
  const [query, setQuery] = useState("");
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let live = true;
    void import("@/lib/emoji").then((m) => {
      if (live) setGroups(m.EMOJI_GROUPS);
    });
    return () => {
      live = false;
    };
  }, []);

  const q = query.trim().toLowerCase();

  /** Searching looks across everything; browsing stays in one group, because a
   *  grid of two thousand is a wall rather than a choice. */
  const shown = useMemo<readonly EmojiEntry[]>(() => {
    if (!groups) return [];
    if (!q) return groups[group]?.emoji ?? [];
    const hits: EmojiEntry[] = [];
    for (const g of groups) {
      const label = g.label.toLowerCase();
      for (const e of g.emoji) {
        if (e[1].includes(q) || label.startsWith(q)) hits.push(e);
        if (hits.length >= 180) return hits;
      }
    }
    return hits;
  }, [groups, group, q]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [group, q]);

  return (
    <div className="rise-in mt-2 rounded-2xl border border-line-2 bg-page-2 p-2">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          autoComplete="off"
          aria-label="Search emoji"
          placeholder="Search"
          className="min-w-0 flex-1 rounded-xl border border-line bg-page-2 px-3 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <button
          onClick={onClose}
          className="shrink-0 rounded-xl border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-2 transition hover:border-accent hover:text-accent"
        >
          Done
        </button>
      </div>

      {!q && (
        <div className="-mx-1 mt-2 flex gap-0.5 overflow-x-auto px-1">
          {QUICK_REACTIONS.slice(0, 8).map((e) => (
            <button
              key={e}
              onClick={() => onPick(e)}
              aria-label={`React with ${e}`}
              className="shrink-0 rounded-lg px-1.5 py-1 text-lg transition hover:bg-accent-soft"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {!groups && <p className="px-1 py-3 text-xs text-ink-3">Loading the rest...</p>}

      {groups && (
        <>
          {!q && (
            <div className="mt-1.5 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
              {groups.map((g, i) => (
                <button
                  key={g.label}
                  onClick={() => setGroup(i)}
                  aria-pressed={i === group}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold transition ${
                    i === group
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line text-ink-3 hover:border-line-2"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}

          <div ref={scroller} className="mt-1 max-h-52 overflow-y-auto">
            {shown.length === 0 ? (
              <p className="px-1 py-3 text-xs text-ink-3">Nothing called that.</p>
            ) : (
              <div className="grid grid-cols-8 gap-0.5">
                {shown.map(([emoji, name]) => (
                  <button
                    key={emoji}
                    onClick={() => onPick(emoji)}
                    title={name}
                    aria-label={name}
                    className="rounded-lg py-1 text-lg transition hover:bg-accent-soft"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
