import type { DayKey } from "./dates";
import type { TranslationId } from "./bible";

export interface User {
  id: string;
  username: string;
  /** What everyone else sees. Defaults to the username. */
  displayName: string;
}

/** A plan as it appears in the switcher: just enough to name and pick it. */
export interface PlanSummary {
  id: string;
  name: string;
  joinCode: string;
}

export interface Member extends User {
  canEdit: boolean;
  isCreator: boolean;
  joinedAt: string;
  /**
   * The calendar day this reader's day 1 falls on. The creator starts with the
   * plan; anyone joining later starts the day they join, so nobody opens the
   * app for the first time already a month behind.
   */
  startDay: DayKey;
}

/**
 * One chapter, read. Progress is stored per chapter rather than per day on
 * purpose: a day is a slice of the schedule, and the schedule moves when the
 * plan length changes. Chapters do not. Storing days meant that switching a
 * twelve month plan to three would silently credit you with hundreds of
 * chapters you had never opened.
 */
export interface ChapterRead {
  userId: string;
  book: string;
  chapter: number;
  /** The calendar day it was ticked, which is not always the day it was due. */
  readOn: DayKey;
}

export interface Note {
  id: string;
  day: number;
  userId: string;
  body: string;
  createdAt: string;
}

/** Everything about the plan currently on screen. */
export interface ActivePlan {
  id: string;
  name: string;
  joinCode: string;
  months: number;
  startDay: DayKey;
  translation: TranslationId;
  creatorId: string;
  /** Whether the signed-in user may change settings. */
  canEdit: boolean;
  members: Member[];
  /**
   * Schedule day boundaries: day d covers canonical chapters
   * `[cuts[d - 1], cuts[d])`. Sent instead of 1,189 chapter objects because the
   * client already has the canon and the weights.
   */
  cuts: number[];
  reads: ChapterRead[];
  notes: Note[];
}

/** Today's shared verse. `text` is null unless an ESV API key is configured. */
export interface VerseOfDay {
  book: string;
  chapter: number;
  verse: number;
  text: string | null;
}

export interface AppState {
  me: User | null;
  plans: PlanSummary[];
  active: ActivePlan | null;
  verse: VerseOfDay | null;
  push: { configured: boolean };
}

export const MIN_MONTHS = 1;
export const MAX_MONTHS = 13;

export function isMonths(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= MIN_MONTHS && (v as number) <= MAX_MONTHS;
}

/**
 * Join codes are four characters, uppercase, with the shapes that get misread
 * out loud or in a screenshot removed: no O or 0, no 1, I or L.
 */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 4;

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isJoinCode(raw: string): boolean {
  const code = normalizeCode(raw);
  return (
    code.length === CODE_LENGTH &&
    [...code].every((ch) => CODE_ALPHABET.includes(ch))
  );
}

export function randomCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export const MAX_NOTE_LENGTH = 2000;
export const MAX_NAME_LENGTH = 60;
export const MIN_PASSWORD_LENGTH = 8;

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function isUsername(raw: string): boolean {
  const name = normalizeUsername(raw);
  return name.length >= 2 && name.length <= 30 && /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(name);
}
