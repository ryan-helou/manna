"use client";

import { useState } from "react";
import { Glyph } from "./Glyph";

/**
 * The code, big enough to read out over the phone, with the two ways people
 * actually pass one along: copy it, or hand it to the share sheet.
 *
 * Sits at the top of settings rather than buried in it, because inviting
 * somebody is the main thing a plan's owner comes here to do.
 */
export function InviteCard({ planName, code }: { planName: string; code: string }) {
  const [said, setSaid] = useState<string | null>(null);

  const flash = (msg: string) => {
    setSaid(msg);
    setTimeout(() => setSaid(null), 1800);
  };

  const invite = `Join me reading through the Bible. Go to ${
    typeof window === "undefined" ? "" : window.location.origin
  }, make an account, and enter the code ${code}.`;

  return (
    <div className="rounded-2xl border border-accent/40 bg-accent-soft/40 glass p-5">
      <p className="eyebrow flex items-center gap-1.5 text-ink-2">
        <Glyph name="users" className="h-3.5 w-3.5" />
        Invite someone
      </p>
      <p className="mt-1.5 text-sm text-ink-2">
        Anyone who enters this code joins {planName}.
      </p>

      <p className="stat mt-3 text-center text-[2.75rem] leading-none font-semibold tracking-[0.3em] text-accent">
        {code}
      </p>

      <div className="mt-4 flex gap-2">
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              flash("Code copied");
            } catch {
              flash("Could not copy");
            }
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line-2 bg-card px-4 py-3 text-sm font-semibold text-ink transition active:scale-[0.99]"
        >
          <Glyph name="copy" className="h-4 w-4" />
          Copy code
        </button>
        <button
          onClick={async () => {
            // The share sheet is how a code actually reaches somebody. Where
            // there isn't one, copying the whole invitation is the next best.
            try {
              if (navigator.share) await navigator.share({ text: invite });
              else {
                await navigator.clipboard.writeText(invite);
                flash("Invitation copied");
              }
            } catch {
              // A cancelled share sheet is not a failure.
            }
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent accent-fill px-4 py-3 text-sm font-semibold text-page transition active:scale-[0.99]"
        >
          <Glyph name="link" className="h-4 w-4" />
          Send invite
        </button>
      </div>

      {said && <p className="mt-2 text-center text-sm font-medium text-good">{said}</p>}
    </div>
  );
}
