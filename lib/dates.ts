/**
 * Every date in this app is a local calendar day string (`YYYY-MM-DD`), never a
 * timestamp. A reading plan is lived one calendar day at a time, and date-only
 * strings keep the day buckets exact instead of off-by-one near midnight.
 */

export type DayKey = string; // YYYY-MM-DD

/**
 * The day rolls over at 3 AM, not midnight: reading at 1 AM still counts as the
 * day you have been awake for, which is how people actually experience it.
 *
 * This is 3 AM wherever the server thinks it is, so the server has to be told.
 * A container defaults to UTC, and against a reader in Toronto that put the
 * rollover at 11 PM: an evening's reading was filed under tomorrow and the
 * streak it belonged to broke. `TZ` is set on the deployment for that reason.
 */
export const RESET_HOUR = 3;

export function toDayKey(d: Date): DayKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today, with the 3 AM rollover applied. */
export function today(now: Date = new Date()): DayKey {
  return toDayKey(new Date(now.getTime() - RESET_HOUR * 3_600_000));
}

export function isDayKey(v: unknown): v is DayKey {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const probe = new Date(y, m - 1, d);
  return probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === d;
}

export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: DayKey, n: number): DayKey {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + n);
  return toDayKey(d);
}

/** Inclusive day count from `from` to `to`. Same day is 1. */
export function daysBetween(from: DayKey, to: DayKey): number {
  const ms = parseDayKey(to).getTime() - parseDayKey(from).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * How many days a plan of `months` whole months starting on `start` covers.
 * Taken off the calendar rather than assuming 30-day months, so a plan started
 * in February is not quietly longer than one started in July.
 */
export function planLengthDays(start: DayKey, months: number): number {
  const d = parseDayKey(start);
  const end = new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
  return Math.max(1, Math.round((end.getTime() - d.getTime()) / 86_400_000));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDay(key: DayKey): string {
  const d = parseDayKey(key);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatLongDay(key: DayKey): string {
  const d = parseDayKey(key);
  return `${MONTHS_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "21 Aug 2027" — compact enough to sit in a stat cell without wrapping. */
export function formatShortDate(key: DayKey): string {
  const d = parseDayKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDayRelative(key: DayKey, ref: DayKey): string {
  if (key === ref) return "Today";
  if (key === addDays(ref, -1)) return "Yesterday";
  if (key === addDays(ref, 1)) return "Tomorrow";
  return formatDay(key);
}

/** Compact "just now / 5m / 3h / 2d / 1w" from an ISO timestamp. */
export function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

/** "1 h 20 min" / "45 min" — minutes rendered the way a person would say them. */
export function formatMinutes(mins: number): string {
  const m = Math.round(mins);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}
