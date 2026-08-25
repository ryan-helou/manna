import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { cookies } from "next/headers";
import { getStore } from "./db";
import type { User } from "./types";

const COOKIE = "manna_session";
const MAX_AGE = 60 * 60 * 24 * 400; // a thirteen-month plan, and then some

function secret(): string {
  return process.env.SESSION_SECRET || "manna-dev-secret";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function seal(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

function unseal(raw: string | undefined): string | null {
  if (!raw) return null;
  const i = raw.lastIndexOf(".");
  if (i <= 0) return null;
  const id = raw.slice(0, i);
  const mac = Buffer.from(raw.slice(i + 1));
  const expected = Buffer.from(sign(id));
  if (mac.length !== expected.length) return null;
  return timingSafeEqual(mac, expected) ? id : null;
}

export function hashPassword(password: string): Promise<string> {
  return argonHash(password);
}

export async function checkPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argonVerify(hash, password);
  } catch {
    return false;
  }
}

async function startSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, seal(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function register(username: string, password: string): Promise<User> {
  const user = await getStore().createUser(username, await hashPassword(password));
  await startSession(user.id);
  return user;
}

export async function signIn(username: string, password: string): Promise<User | null> {
  const found = await getStore().findUserByUsername(username);
  // Hash anyway when the user does not exist, so a missing username and a wrong
  // password take the same time to answer.
  if (!found) {
    await checkPassword(
      "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$0000000000000000000000000000000000000000000",
      password,
    );
    return null;
  }
  if (!(await checkPassword(found.passwordHash, password))) return null;
  await startSession(found.id);
  return {
    id: found.id,
    username: found.username,
    displayName: found.displayName,
    reminderHour: found.reminderHour,
  };
}

/** Swap a password, but only for someone who can produce the old one. */
export async function changePassword(
  userId: string,
  current: string,
  next: string,
): Promise<boolean> {
  const store = getStore();
  const me = await store.getUser(userId);
  if (!me) return false;
  const full = await store.findUserByUsername(me.username);
  if (!full || !(await checkPassword(full.passwordHash, current))) return false;
  await store.setPasswordHash(userId, await hashPassword(next));
  return true;
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/**
 * The one account that can moderate any plan, not only the ones it started.
 *
 * Read from the username rather than from a row, so it cannot be granted by
 * anything the app itself does: there is no path in the product that makes
 * somebody an admin. Matched case-insensitively, because the sign-in field is.
 */
export function isAdmin(user: User | null): boolean {
  if (!user) return false;
  const admin = (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  if (!admin) return false;
  return user.username.trim().toLowerCase() === admin;
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const id = unseal(jar.get(COOKIE)?.value);
  if (!id) return null;
  return getStore().getUser(id);
}
