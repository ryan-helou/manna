import type { DayKey } from "./dates";
import type { TranslationId } from "./bible";

export interface User {
  id: string;
  username: string;
  /** What everyone else sees. Defaults to the username. */
  displayName: string;
  /** Hour of the evening nudge, in the group's timezone. Null means the default. */
  reminderHour: number | null;
}

/** When the nudge goes out if nobody picks. */
export const DEFAULT_REMINDER_HOUR = 19;

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
  /** The note this one answers, or null when it opens a thread. */
  parentId: string | null;
  /** The chapter it is about. Null means the day's reading as a whole. */
  book: string | null;
  chapter: number | null;
}

/**
 * The reactions offered up front. Any emoji is allowed, so this is a shortcut
 * rather than the whole menu: the six that actually got used, plus enough of a
 * spread that most notes can be answered without opening a keyboard.
 */
export const QUICK_REACTIONS = [
  "\u{1F64F}", "\u2764\uFE0F", "\u{1F44D}", "\u{1F525}", "\u{1F4A1}", "\u2753",
  "\u{1F62D}", "\u{1F622}", "\u{1F914}", "\u{1F440}", "\u{1F4AF}", "\u{1F929}",
  "\u{1F609}", "\u{1F602}", "\u{1F60A}", "\u{1F4D6}", "\u{1F54A}\uFE0F", "\u2728",
  "\u{1F331}", "\u26F0\uFE0F", "\u{1F5FF}", "\u{1F451}", "\u2694\uFE0F", "\u{1F344}",
] as const;

/** A reaction is any single emoji. Longest legitimate one measured is a family
 *  sequence at 11 UTF-16 units; 32 leaves room without leaving room for prose. */
const MAX_REACTION_LENGTH = 32;

/**
 * One emoji, and nothing else.
 *
 * Anyone can now send whatever their keyboard produces, so this is the only
 * thing standing between the reaction row and a paragraph of text. Three
 * conditions, all of them necessary:
 *
 *  - exactly ONE grapheme, so a string of emoji cannot be posted as a single
 *    reaction and stretch the row off the screen;
 *  - it has to actually contain a pictograph, a flag or a keycap, which is what
 *    rules out letters, digits and punctuation;
 *  - no letters or whitespace anywhere, which rules out the sequences that
 *    smuggle text through a variation selector.
 */
export function isReaction(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!s || s.length > MAX_REACTION_LENGTH) return false;
  if (/[\s\p{L}]/u.test(s)) return false;
  if (!/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(s)) return false;
  try {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let count = 0;
    for (const _ of segmenter.segment(s)) {
      void _;
      if (++count > 1) return false;
    }
    return count === 1;
  } catch {
    // No Intl.Segmenter: fall back to the length bound, which still holds.
    return true;
  }
}

/**
 * The colour schemes. Olive is the default and is the base of the stylesheet,
 * so a reader who never opens Settings gets it with no attribute set and no
 * flash of the wrong palette. `ground` and `accent` are the dark theme values,
 * quoted here only so the picker can show what it is offering.
 */
export const PALETTES = [
  { id: "olive", name: "Olive", note: "Monastic and still", ground: "#0f120d", accent: "#a9c48a" },
  { id: "vigil", name: "Vigil", note: "A cool room, one warm light", ground: "#0b0e18", accent: "#e2c88a" },
  { id: "brass", name: "Brass", note: "Lamplight and warm brass", ground: "#110d0b", accent: "#e8b26a" },
  { id: "ember", name: "Ember", note: "Neutral room, one hot colour", ground: "#101010", accent: "#e8825a" },
  { id: "slate", name: "Slate", note: "Quiet, cool, editorial", ground: "#0e1013", accent: "#8fb4d9" },
  { id: "claret", name: "Claret", note: "Liturgical and warm", ground: "#130b0e", accent: "#c98d88" },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];
export const DEFAULT_PALETTE: PaletteId = "olive";

export function isPalette(v: unknown): v is PaletteId {
  return typeof v === "string" && PALETTES.some((p) => p.id === v);
}

/** One emoji and everyone who left it, so the UI can show a count and whether
 *  you are among them. */
export interface Reaction {
  emoji: string;
  userIds: string[];
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
  /** Your own ticks only. Everyone else is summarised in `standings`. */
  reads: ChapterRead[];
  /** Everyone in the plan, most finished first. */
  standings: Standing[];
  /** Threads on the day being viewed, replies and reactions included. Other
   *  days are fetched on demand. */
  notes: FeedNote[];
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

/** A note with enough context to read it away from its day. */
export interface FeedNote extends Note {
  authorName: string;
  /** "Genesis 1 to 4", so the note makes sense away from the day card. */
  reference: string;
  reactions: Reaction[];
  /** Answers to this note, oldest first. One level deep, never a tree. */
  replies: FeedNote[];
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
  /** Whether this account can moderate any plan, not only its own. */
  isAdmin: boolean;
}

export const MIN_MONTHS = 1;
export const MAX_MONTHS = 13;

export function isMonths(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= MIN_MONTHS && (v as number) <= MAX_MONTHS;
}

/**
 * Join codes are four characters, uppercase, with the shapes that get misread
 * out loud or in a screenshot left out: no O or 0, no 1, I or L.
 */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 4;

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isJoinCode(raw: string): boolean {
  const code = normalizeCode(raw);
  return code.length === CODE_LENGTH && [...code].every((ch) => CODE_ALPHABET.includes(ch));
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
