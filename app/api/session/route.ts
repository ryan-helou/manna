import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { changePassword, currentUser, register, signIn, signOut } from "@/lib/session";
import { readState } from "@/lib/state";
import { isUsername, normalizeUsername, MAX_NAME_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readState());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    username?: unknown;
    password?: unknown;
    mode?: unknown;
    invite?: unknown;
  };
  const username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
  const password = typeof body.password === "string" ? body.password : "";
  const mode = body.mode === "register" ? "register" : "signin";
  const invite = typeof body.invite === "string" ? body.invite.trim() : "";

  if (!isUsername(username)) {
    return NextResponse.json(
      { error: "Usernames are 2 to 30 characters: letters, numbers, dots, dashes, underscores." },
      { status: 400 },
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }
  if (password.length > 200) {
    return NextResponse.json({ error: "That password is too long." }, { status: 400 });
  }

  if (mode === "register") {
    // Signing in is all it takes to be in the plan, which means registration is
    // the only door. Without this, anyone who found the URL would land in the
    // group, read its notes and appear on its board. One shared word, typed
    // once, keeps that from being true. Unset in local dev, where there is
    // nothing to protect.
    const expected = process.env.SIGNUP_SECRET;
    if (expected && invite !== expected) {
      return NextResponse.json(
        { error: "That is not the right invite word." },
        { status: 403 },
      );
    }
    const taken = await getStore().findUserByUsername(username);
    if (taken) {
      return NextResponse.json({ error: "That username is taken." }, { status: 409 });
    }
    try {
      await register(username, password);
    } catch (err) {
      // Someone claimed it between the check and the insert.
      if ((err as { code?: string }).code === "23505") {
        return NextResponse.json({ error: "That username is taken." }, { status: 409 });
      }
      throw err;
    }
    return NextResponse.json(await readState());
  }

  const user = await signIn(username, password);
  if (!user) {
    return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });
  }
  return NextResponse.json(await readState());
}

export async function PATCH(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    displayName?: unknown;
    username?: unknown;
    currentPassword?: unknown;
    newPassword?: unknown;
  };
  const store = getStore();

  if (body.displayName !== undefined) {
    const name = typeof body.displayName === "string" ? body.displayName.trim() : "";
    if (!name || name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Pick a name between 1 and ${MAX_NAME_LENGTH} characters.` },
        { status: 400 },
      );
    }
    await store.setDisplayName(me.id, name);
  }

  if (body.username !== undefined) {
    const username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
    if (!isUsername(username)) {
      return NextResponse.json(
        { error: "Usernames are 2 to 30 characters: letters, numbers, dots, dashes, underscores." },
        { status: 400 },
      );
    }
    if (username.toLowerCase() !== me.username.toLowerCase()) {
      const taken = await store.findUserByUsername(username);
      if (taken) return NextResponse.json({ error: "That username is taken." }, { status: 409 });
      try {
        await store.setUsername(me.id, username);
      } catch (err) {
        if ((err as { code?: string }).code === "23505") {
          return NextResponse.json({ error: "That username is taken." }, { status: 409 });
        }
        throw err;
      }
    }
  }

  if (body.newPassword !== undefined) {
    const next = typeof body.newPassword === "string" ? body.newPassword : "";
    const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
    if (next.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 },
      );
    }
    if (next.length > 200) {
      return NextResponse.json({ error: "That password is too long." }, { status: 400 });
    }
    // The current password is required even though they are already signed in:
    // a borrowed unlocked phone should not be able to lock the owner out.
    if (!(await changePassword(me.id, current, next))) {
      return NextResponse.json({ error: "That is not your current password." }, { status: 403 });
    }
  }

  return NextResponse.json(await readState());
}

export async function DELETE() {
  await signOut();
  return NextResponse.json(await readState());
}
