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

/**
 * One person's position, worked out on the server.
 *
 * Everybody's individual chapter ticks used to travel to every phone so the
 * client could compute this itself. That was fine for two readers and absurd
 * for twelve: a finished plan came to 14,268 rows and close to a megabyte, sent
 * again on every tap, because each mutation returns the state. The reads that
 * travel now are your own; everyone else arrives as these numbers.
 */
export interface Standing {
  userId: string;
  displayName: string;
  daysDone: number;
  chaptersRead: number;
  minutes: number;
  streak: number;
  /** Positive is ahead, negative is behind, zero is on pace. */
  delta: number;
  status: "ahead" | "on-pace" | "behind";
  /** Which day of the plan they are on, by their own start. */
  day: number;
  /** Whether they have finished today's reading. */
  readToday: boolean;
}

/** Everything about the plan currently on screen. */
export interface ActivePlan {
  id: string;
  name: string;
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
  /** Your own ticks only. Everyone else is summarised in `standings`. */
  reads: ChapterRead[];
  /** Everyone in the plan, most finished first. */
  standings: Standing[];
  /** Notes on the day currently being viewed. Others are fetched on demand. */
  notes: Note[];
}

/** Today's shared verse. `text` is null unless an ESV API key is configured. */
export interface VerseOfDay {
  book: string;
  chapter: number;
  verse: number;
  text: string | null;
}

/** One of the day's two or three questions. */
export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  note?: string;
}

/** A note with enough context to read it out of its day. */
export interface FeedNote extends Note {
  authorName: string;
  /** "Genesis 1 to 4", so the note makes sense away from the day card. */
  reference: string;
}

export interface AppState {
  me: User | null;
  plans: PlanSummary[];
  active: ActivePlan | null;
  verse: VerseOfDay | null;
  /**
   * Today's questions. Generated server side: the name index they are built
   * from is 146 KB, which has no business in a phone's bundle, so the quiz
   * covers today only rather than any day you can navigate to.
   */
  quiz: QuizQuestion[];
  /** The most recent notes across the whole plan, newest first. */
  feed: FeedNote[];
  push: { configured: boolean };
  /** Whether registering needs the shared invite word. */
  inviteRequired: boolean;
}

export const MIN_MONTHS = 1;
export const MAX_MONTHS = 13;

export function isMonths(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= MIN_MONTHS && (v as number) <= MAX_MONTHS;
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
