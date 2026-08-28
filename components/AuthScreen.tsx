"use client";

import { useState } from "react";
import { Glyph } from "./Glyph";

/**
 * Username and password, nothing else. No email to verify, no reset flow: two
 * people who know each other, and a password manager between them.
 */
export function AuthScreen({
  busy,
  inviteRequired,
  onSubmit,
}: {
  busy: boolean;
  inviteRequired: boolean;
  onSubmit: (
    mode: "signin" | "register",
    username: string,
    password: string,
    invite: string,
  ) => Promise<string | null>;
}) {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(await onSubmit(mode, username, password, invite));
  }

  const field =
    "mt-2 w-full rounded-xl border border-line-2 bg-page-2 px-4 py-3.5 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="rise-in">
        <span className="text-accent">
          <Glyph name="book" className="h-9 w-9" />
        </span>
        <h1 className="serif mt-5 text-5xl font-semibold tracking-tight text-ink">Manna</h1>
        <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-ink-2">
          The whole Bible, paced by how long each chapter actually takes to sit with.
          Not by chapter count, because three chapters of Romans is not three of Chronicles.
        </p>
      </div>

      <form onSubmit={submit} className="rise-in mt-9" style={{ animationDelay: "80ms" }}>
        <label htmlFor="username" className="eyebrow block text-ink-2">
          Username
        </label>
        <input
          id="username"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          className={field}
        />

        <label htmlFor="password" className="eyebrow mt-5 block text-ink-2">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          enterKeyHint="go"
          placeholder={mode === "register" ? "at least 8 characters" : ""}
          className={field}
        />

        {mode === "register" && inviteRequired && (
          <>
            <label htmlFor="invite" className="eyebrow mt-5 block text-ink-2">
              Invite word
            </label>
            <input
              id="invite"
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="from whoever asked you to join"
              className={field}
            />
          </>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm font-medium text-warn">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-accent accent-fill px-4 py-3.5 text-base font-semibold text-on-accent transition active:scale-[0.99] disabled:opacity-60"
        >
          {mode === "register" ? "Create account" : "Sign in"}
          <Glyph name="arrow-right" className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "register" : "signin");
            setError(null);
          }}
          className="mt-4 w-full text-center text-sm text-ink-2 underline underline-offset-4 transition hover:text-ink"
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}
