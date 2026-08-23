import type { Pool as PgPool } from "pg";
import { DEFAULT_TRANSLATION, isTranslation, type TranslationId } from "./bible";
import { CHAPTER_WEIGHTS } from "./weights";
import { randomCode, type Completion, type Member, type Note, type PlanSummary, type User } from "./types";
import type { DayKey } from "./dates";

/**
 * Storage. Railway Postgres when DATABASE_URL is set, otherwise an in-memory
 * store so `npm run dev` works on a laptop with nothing installed. Local dev is
 * never pointed at production.
 */

export interface NewPlan {
  name: string;
  months: number;
  startDay: DayKey;
  translation: TranslationId;
  creatorId: string;
}

export interface PlanRow {
  id: string;
  name: string;
  joinCode: string;
  months: number;
  startDay: DayKey;
  translation: TranslationId;
  creatorId: string;
  createdAt: string;
}

export interface PlanPatch {
  name?: string;
  months?: number;
  translation?: TranslationId;
}

/** A browser Web Push subscription (from PushSubscription.toJSON()). */
export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
}

export interface StoredSub {
  userId: string;
  sub: PushSub;
}

export interface Store {
  init(): Promise<void>;

  // Users
  createUser(username: string, passwordHash: string): Promise<User>;
  getUser(id: string): Promise<User | null>;
  findUserByUsername(username: string): Promise<(User & { passwordHash: string }) | null>;
  setDisplayName(userId: string, displayName: string): Promise<void>;

  // Plans
  createPlan(input: NewPlan): Promise<PlanRow>;
  getPlan(id: string): Promise<PlanRow | null>;
  getPlanByCode(code: string): Promise<PlanRow | null>;
  updatePlan(id: string, patch: PlanPatch): Promise<PlanRow | null>;
  listPlansFor(userId: string): Promise<PlanSummary[]>;
  /** Every plan, for the scheduled nudge. */
  listAllPlans(): Promise<PlanRow[]>;

  // Membership
  addMember(planId: string, userId: string, canEdit: boolean): Promise<void>;
  listMembers(planId: string): Promise<Member[]>;
  isMember(planId: string, userId: string): Promise<boolean>;
  setCanEdit(planId: string, userId: string, canEdit: boolean): Promise<void>;

  // Reading
  listCompletions(planId: string): Promise<Completion[]>;
  setCompletion(planId: string, userId: string, day: number, on: DayKey): Promise<void>;
  clearCompletion(planId: string, userId: string, day: number): Promise<void>;

  // Notes
  listNotes(planId: string): Promise<Note[]>;
  addNote(planId: string, userId: string, day: number, body: string): Promise<Note>;
  deleteNote(planId: string, noteId: string, userId: string): Promise<boolean>;

  // Chapter weights, seeded from lib/weights.ts
  countChapterWeights(): Promise<number>;
  getChapterWeight(book: string, chapter: number): Promise<number | null>;

  // Push
  savePushSub(userId: string, sub: PushSub): Promise<void>;
  deletePushSub(endpoint: string): Promise<void>;
  listPushSubsFor(userId: string): Promise<PushSub[]>;

  // Small key/value store, used to dedupe scheduled notifications.
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
}

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** The 1,189 weight rows, flattened for seeding. */
export function weightRows(): { book: string; chapter: number; minutes: number }[] {
  const out: { book: string; chapter: number; minutes: number }[] = [];
  for (const [book, mins] of Object.entries(CHAPTER_WEIGHTS)) {
    mins.forEach((minutes, i) => out.push({ book, chapter: i + 1, minutes }));
  }
  return out;
}

const asTranslation = (v: unknown): TranslationId =>
  isTranslation(v) ? v : DEFAULT_TRANSLATION;

// ---------------------------------------------------------------------------
// Postgres
// ---------------------------------------------------------------------------

type PlanDbRow = {
  id: string;
  name: string;
  join_code: string;
  months: number;
  start_day: string;
  translation: string;
  creator_id: string;
  created_at: string;
};

const toPlan = (r: PlanDbRow): PlanRow => ({
  id: r.id,
  name: r.name,
  joinCode: r.join_code,
  months: Number(r.months),
  startDay: r.start_day,
  translation: asTranslation(r.translation),
  creatorId: r.creator_id,
  createdAt: r.created_at,
});

const PLAN_COLS = `id, name, join_code, months, to_char(start_day, 'YYYY-MM-DD') AS start_day,
  translation, creator_id,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`;

class PgStore implements Store {
  private pool: PgPool;
  private ready: Promise<void> | null = null;

  constructor(pool: PgPool) {
    this.pool = pool;
  }

  init(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            username_lower TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`);
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS plans (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            join_code TEXT UNIQUE NOT NULL,
            months INT NOT NULL,
            start_day DATE NOT NULL,
            translation TEXT NOT NULL DEFAULT 'ESV',
            creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`);
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS plan_members (
            plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            can_edit BOOLEAN NOT NULL DEFAULT false,
            joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (plan_id, user_id)
          )`);
        await this.pool.query(
          `CREATE INDEX IF NOT EXISTS plan_members_user_idx ON plan_members (user_id)`,
        );
        // The whole point of the app: what a chapter costs to study, in minutes.
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS chapter_weights (
            book TEXT NOT NULL,
            chapter INT NOT NULL,
            minutes INT NOT NULL,
            PRIMARY KEY (book, chapter)
          )`);
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS completions (
            plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            day INT NOT NULL,
            completed_on DATE NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (plan_id, user_id, day)
          )`);
        await this.pool.query(
          `CREATE INDEX IF NOT EXISTS completions_plan_idx ON completions (plan_id)`,
        );
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            day INT NOT NULL,
            body TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`);
        await this.pool.query(
          `CREATE INDEX IF NOT EXISTS notes_plan_day_idx ON notes (plan_id, day)`,
        );
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS push_subs (
            endpoint TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            sub JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`);
        await this.pool.query(
          `CREATE INDEX IF NOT EXISTS push_subs_user_idx ON push_subs (user_id)`,
        );
        await this.pool.query(`
          CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`);
        await this.seedWeights();
      })();
    }
    return this.ready;
  }

  /**
   * Load all 1,189 chapter weights. Runs on every boot and is idempotent, so a
   * fresh database is seeded without anyone having to remember a manual step,
   * and a changed weight is picked up on the next deploy.
   */
  private async seedWeights(): Promise<void> {
    const rows = weightRows();
    const books: string[] = [];
    const chapters: number[] = [];
    const minutes: number[] = [];
    for (const r of rows) {
      books.push(r.book);
      chapters.push(r.chapter);
      minutes.push(r.minutes);
    }
    await this.pool.query(
      `INSERT INTO chapter_weights (book, chapter, minutes)
       SELECT * FROM UNNEST($1::text[], $2::int[], $3::int[])
       ON CONFLICT (book, chapter) DO UPDATE SET minutes = EXCLUDED.minutes`,
      [books, chapters, minutes],
    );
  }

  async createUser(username: string, passwordHash: string): Promise<User> {
    await this.init();
    const r = await this.pool.query(
      `INSERT INTO users (id, username, username_lower, display_name, password_hash)
       VALUES ($1, $2, $3, $2, $4)
       RETURNING id, username, display_name`,
      [newId(), username, username.toLowerCase(), passwordHash],
    );
    return { id: r.rows[0].id, username: r.rows[0].username, displayName: r.rows[0].display_name };
  }

  async getUser(id: string): Promise<User | null> {
    await this.init();
    const r = await this.pool.query(
      `SELECT id, username, display_name FROM users WHERE id = $1`, [id],
    );
    return r.rows[0]
      ? { id: r.rows[0].id, username: r.rows[0].username, displayName: r.rows[0].display_name }
      : null;
  }

  async findUserByUsername(username: string) {
    await this.init();
    const r = await this.pool.query(
      `SELECT id, username, display_name, password_hash FROM users WHERE username_lower = $1`,
      [username.toLowerCase()],
    );
    if (!r.rows[0]) return null;
    return {
      id: r.rows[0].id,
      username: r.rows[0].username,
      displayName: r.rows[0].display_name,
      passwordHash: r.rows[0].password_hash,
    };
  }

  async setDisplayName(userId: string, displayName: string): Promise<void> {
    await this.init();
    await this.pool.query(`UPDATE users SET display_name = $2 WHERE id = $1`, [userId, displayName]);
  }

  async createPlan(input: NewPlan): Promise<PlanRow> {
    await this.init();
    // Four characters from a 31-letter alphabet is ~924k combinations; for a
    // handful of plans a couple of retries on collision is plenty.
    for (let attempt = 0; attempt < 12; attempt++) {
      const code = randomCode();
      try {
        const r = await this.pool.query(
          `INSERT INTO plans (id, name, join_code, months, start_day, translation, creator_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${PLAN_COLS}`,
          [newId(), input.name, code, input.months, input.startDay, input.translation, input.creatorId],
        );
        return toPlan(r.rows[0]);
      } catch (err) {
        if ((err as { code?: string }).code !== "23505") throw err;
      }
    }
    throw new Error("Could not allocate a join code");
  }

  async getPlan(id: string): Promise<PlanRow | null> {
    await this.init();
    const r = await this.pool.query(`SELECT ${PLAN_COLS} FROM plans WHERE id = $1`, [id]);
    return r.rows[0] ? toPlan(r.rows[0]) : null;
  }

  async getPlanByCode(code: string): Promise<PlanRow | null> {
    await this.init();
    const r = await this.pool.query(
      `SELECT ${PLAN_COLS} FROM plans WHERE join_code = $1`, [code.toUpperCase()],
    );
    return r.rows[0] ? toPlan(r.rows[0]) : null;
  }

  async updatePlan(id: string, patch: PlanPatch): Promise<PlanRow | null> {
    await this.init();
    const sets: string[] = [];
    const vals: unknown[] = [id];
    if (patch.name !== undefined) { vals.push(patch.name); sets.push(`name = $${vals.length}`); }
    if (patch.months !== undefined) { vals.push(patch.months); sets.push(`months = $${vals.length}`); }
    if (patch.translation !== undefined) {
      vals.push(patch.translation); sets.push(`translation = $${vals.length}`);
    }
    if (!sets.length) return this.getPlan(id);
    const r = await this.pool.query(
      `UPDATE plans SET ${sets.join(", ")} WHERE id = $1 RETURNING ${PLAN_COLS}`, vals,
    );
    return r.rows[0] ? toPlan(r.rows[0]) : null;
  }

  async listPlansFor(userId: string): Promise<PlanSummary[]> {
    await this.init();
    const r = await this.pool.query(
      `SELECT p.id, p.name, p.join_code FROM plans p
       JOIN plan_members m ON m.plan_id = p.id
       WHERE m.user_id = $1 ORDER BY m.joined_at`,
      [userId],
    );
    return r.rows.map((x) => ({ id: x.id, name: x.name, joinCode: x.join_code }));
  }

  async listAllPlans(): Promise<PlanRow[]> {
    await this.init();
    const r = await this.pool.query(`SELECT ${PLAN_COLS} FROM plans ORDER BY created_at`);
    return r.rows.map(toPlan);
  }

  async addMember(planId: string, userId: string, canEdit: boolean): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO plan_members (plan_id, user_id, can_edit) VALUES ($1, $2, $3)
       ON CONFLICT (plan_id, user_id) DO NOTHING`,
      [planId, userId, canEdit],
    );
  }

  async listMembers(planId: string): Promise<Member[]> {
    await this.init();
    const r = await this.pool.query(
      `SELECT u.id, u.username, u.display_name, m.can_edit, p.creator_id,
              to_char(m.joined_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS joined_at
       FROM plan_members m
       JOIN users u ON u.id = m.user_id
       JOIN plans p ON p.id = m.plan_id
       WHERE m.plan_id = $1 ORDER BY m.joined_at`,
      [planId],
    );
    return r.rows.map((x) => ({
      id: x.id, username: x.username, displayName: x.display_name,
      canEdit: x.can_edit || x.id === x.creator_id,
      isCreator: x.id === x.creator_id,
      joinedAt: x.joined_at,
    }));
  }

  async isMember(planId: string, userId: string): Promise<boolean> {
    await this.init();
    const r = await this.pool.query(
      `SELECT 1 FROM plan_members WHERE plan_id = $1 AND user_id = $2`, [planId, userId],
    );
    return r.rowCount! > 0;
  }

  async setCanEdit(planId: string, userId: string, canEdit: boolean): Promise<void> {
    await this.init();
    await this.pool.query(
      `UPDATE plan_members SET can_edit = $3 WHERE plan_id = $1 AND user_id = $2`,
      [planId, userId, canEdit],
    );
  }

  async listCompletions(planId: string): Promise<Completion[]> {
    await this.init();
    const r = await this.pool.query(
      `SELECT user_id, day, to_char(completed_on, 'YYYY-MM-DD') AS completed_on
       FROM completions WHERE plan_id = $1 ORDER BY day`,
      [planId],
    );
    return r.rows.map((x) => ({ userId: x.user_id, day: Number(x.day), completedOn: x.completed_on }));
  }

  async setCompletion(planId: string, userId: string, day: number, on: DayKey): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO completions (plan_id, user_id, day, completed_on) VALUES ($1, $2, $3, $4)
       ON CONFLICT (plan_id, user_id, day) DO NOTHING`,
      [planId, userId, day, on],
    );
  }

  async clearCompletion(planId: string, userId: string, day: number): Promise<void> {
    await this.init();
    await this.pool.query(
      `DELETE FROM completions WHERE plan_id = $1 AND user_id = $2 AND day = $3`,
      [planId, userId, day],
    );
  }

  async listNotes(planId: string): Promise<Note[]> {
    await this.init();
    const r = await this.pool.query(
      `SELECT id, day, user_id, body,
              to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
       FROM notes WHERE plan_id = $1 ORDER BY created_at`,
      [planId],
    );
    return r.rows.map((x) => ({
      id: x.id, day: Number(x.day), userId: x.user_id, body: x.body, createdAt: x.created_at,
    }));
  }

  async addNote(planId: string, userId: string, day: number, body: string): Promise<Note> {
    await this.init();
    const r = await this.pool.query(
      `INSERT INTO notes (id, plan_id, user_id, day, body) VALUES ($1, $2, $3, $4, $5)
       RETURNING id, day, user_id, body,
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`,
      [newId(), planId, userId, day, body],
    );
    const x = r.rows[0];
    return { id: x.id, day: Number(x.day), userId: x.user_id, body: x.body, createdAt: x.created_at };
  }

  async deleteNote(planId: string, noteId: string, userId: string): Promise<boolean> {
    await this.init();
    const r = await this.pool.query(
      `DELETE FROM notes WHERE id = $1 AND plan_id = $2 AND user_id = $3`,
      [noteId, planId, userId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async countChapterWeights(): Promise<number> {
    await this.init();
    const r = await this.pool.query(`SELECT count(*)::int AS n FROM chapter_weights`);
    return r.rows[0].n as number;
  }

  async getChapterWeight(book: string, chapter: number): Promise<number | null> {
    await this.init();
    const r = await this.pool.query(
      `SELECT minutes FROM chapter_weights WHERE book = $1 AND chapter = $2`, [book, chapter],
    );
    return r.rows[0] ? Number(r.rows[0].minutes) : null;
  }

  async savePushSub(userId: string, sub: PushSub): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO push_subs (endpoint, user_id, sub) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, sub = EXCLUDED.sub`,
      [sub.endpoint, userId, JSON.stringify(sub)],
    );
  }

  async deletePushSub(endpoint: string): Promise<void> {
    await this.init();
    await this.pool.query(`DELETE FROM push_subs WHERE endpoint = $1`, [endpoint]);
  }

  async listPushSubsFor(userId: string): Promise<PushSub[]> {
    await this.init();
    const r = await this.pool.query(`SELECT sub FROM push_subs WHERE user_id = $1`, [userId]);
    return r.rows.map((x) => x.sub as PushSub);
  }

  async getMeta(key: string): Promise<string | null> {
    await this.init();
    const r = await this.pool.query(`SELECT value FROM meta WHERE key = $1`, [key]);
    return r.rows[0]?.value ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO meta (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, value],
    );
  }
}

// ---------------------------------------------------------------------------
// In-memory
// ---------------------------------------------------------------------------

class MemoryStore implements Store {
  private users = new Map<string, User & { passwordHash: string; usernameLower: string }>();
  private plans = new Map<string, PlanRow>();
  private members = new Map<string, Map<string, { canEdit: boolean; joinedAt: string }>>();
  private completions = new Map<string, Completion[]>();
  private notes = new Map<string, Note[]>();
  private weights = new Map<string, number>();
  private subs = new Map<string, StoredSub>();
  private meta = new Map<string, string>();

  async init(): Promise<void> {
    if (this.weights.size === 0) {
      for (const r of weightRows()) this.weights.set(`${r.book} ${r.chapter}`, r.minutes);
    }
  }

  async createUser(username: string, passwordHash: string): Promise<User> {
    await this.init();
    const lower = username.toLowerCase();
    if ([...this.users.values()].some((u) => u.usernameLower === lower)) {
      const err = new Error("duplicate") as Error & { code?: string };
      err.code = "23505";
      throw err;
    }
    const user = { id: newId(), username, displayName: username, passwordHash, usernameLower: lower };
    this.users.set(user.id, user);
    return { id: user.id, username: user.username, displayName: user.displayName };
  }

  async getUser(id: string): Promise<User | null> {
    const u = this.users.get(id);
    return u ? { id: u.id, username: u.username, displayName: u.displayName } : null;
  }

  async findUserByUsername(username: string) {
    const lower = username.toLowerCase();
    const u = [...this.users.values()].find((x) => x.usernameLower === lower);
    return u
      ? { id: u.id, username: u.username, displayName: u.displayName, passwordHash: u.passwordHash }
      : null;
  }

  async setDisplayName(userId: string, displayName: string): Promise<void> {
    const u = this.users.get(userId);
    if (u) u.displayName = displayName;
  }

  async createPlan(input: NewPlan): Promise<PlanRow> {
    await this.init();
    let code = randomCode();
    while ([...this.plans.values()].some((p) => p.joinCode === code)) code = randomCode();
    const plan: PlanRow = {
      id: newId(), name: input.name, joinCode: code, months: input.months,
      startDay: input.startDay, translation: input.translation,
      creatorId: input.creatorId, createdAt: new Date().toISOString(),
    };
    this.plans.set(plan.id, plan);
    return plan;
  }

  async getPlan(id: string) { return this.plans.get(id) ?? null; }

  async getPlanByCode(code: string) {
    const up = code.toUpperCase();
    return [...this.plans.values()].find((p) => p.joinCode === up) ?? null;
  }

  async updatePlan(id: string, patch: PlanPatch) {
    const p = this.plans.get(id);
    if (!p) return null;
    if (patch.name !== undefined) p.name = patch.name;
    if (patch.months !== undefined) p.months = patch.months;
    if (patch.translation !== undefined) p.translation = patch.translation;
    return p;
  }

  async listPlansFor(userId: string): Promise<PlanSummary[]> {
    const out: (PlanSummary & { joinedAt: string })[] = [];
    for (const [planId, members] of this.members) {
      const m = members.get(userId);
      const p = this.plans.get(planId);
      if (m && p) out.push({ id: p.id, name: p.name, joinCode: p.joinCode, joinedAt: m.joinedAt });
    }
    out.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
    return out.map(({ id, name, joinCode }) => ({ id, name, joinCode }));
  }

  async listAllPlans(): Promise<PlanRow[]> {
    await this.init();
    return [...this.plans.values()];
  }

  async addMember(planId: string, userId: string, canEdit: boolean): Promise<void> {
    if (!this.members.has(planId)) this.members.set(planId, new Map());
    const m = this.members.get(planId)!;
    if (!m.has(userId)) m.set(userId, { canEdit, joinedAt: new Date().toISOString() });
  }

  async listMembers(planId: string): Promise<Member[]> {
    const plan = this.plans.get(planId);
    const m = this.members.get(planId);
    if (!plan || !m) return [];
    return [...m.entries()]
      .sort((a, b) => a[1].joinedAt.localeCompare(b[1].joinedAt))
      .map(([userId, info]) => {
        const u = this.users.get(userId)!;
        return {
          id: u.id, username: u.username, displayName: u.displayName,
          canEdit: info.canEdit || userId === plan.creatorId,
          isCreator: userId === plan.creatorId,
          joinedAt: info.joinedAt,
        };
      });
  }

  async isMember(planId: string, userId: string) {
    return this.members.get(planId)?.has(userId) ?? false;
  }

  async setCanEdit(planId: string, userId: string, canEdit: boolean): Promise<void> {
    const m = this.members.get(planId)?.get(userId);
    if (m) m.canEdit = canEdit;
  }

  async listCompletions(planId: string) {
    return [...(this.completions.get(planId) ?? [])].sort((a, b) => a.day - b.day);
  }

  async setCompletion(planId: string, userId: string, day: number, on: DayKey): Promise<void> {
    if (!this.completions.has(planId)) this.completions.set(planId, []);
    const list = this.completions.get(planId)!;
    if (!list.some((c) => c.userId === userId && c.day === day)) {
      list.push({ userId, day, completedOn: on });
    }
  }

  async clearCompletion(planId: string, userId: string, day: number): Promise<void> {
    const list = this.completions.get(planId);
    if (!list) return;
    this.completions.set(planId, list.filter((c) => !(c.userId === userId && c.day === day)));
  }

  async listNotes(planId: string) {
    return [...(this.notes.get(planId) ?? [])];
  }

  async addNote(planId: string, userId: string, day: number, body: string): Promise<Note> {
    if (!this.notes.has(planId)) this.notes.set(planId, []);
    const note: Note = { id: newId(), day, userId, body, createdAt: new Date().toISOString() };
    this.notes.get(planId)!.push(note);
    return note;
  }

  async deleteNote(planId: string, noteId: string, userId: string): Promise<boolean> {
    const list = this.notes.get(planId);
    if (!list) return false;
    const next = list.filter((n) => !(n.id === noteId && n.userId === userId));
    this.notes.set(planId, next);
    return next.length !== list.length;
  }

  async countChapterWeights() { await this.init(); return this.weights.size; }

  async getChapterWeight(book: string, chapter: number) {
    await this.init();
    return this.weights.get(`${book} ${chapter}`) ?? null;
  }

  async savePushSub(userId: string, sub: PushSub) { this.subs.set(sub.endpoint, { userId, sub }); }
  async deletePushSub(endpoint: string) { this.subs.delete(endpoint); }
  async listPushSubsFor(userId: string) {
    return [...this.subs.values()].filter((s) => s.userId === userId).map((s) => s.sub);
  }
  async getMeta(key: string) { return this.meta.get(key) ?? null; }
  async setMeta(key: string, value: string) { this.meta.set(key, value); }
}

// ---------------------------------------------------------------------------

declare global {
  // Survives hot reloads in dev so the in-memory store doesn't reset on save.
  var __mannaStore: Store | undefined;
}

function build(): Store {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[manna] DATABASE_URL not set — using in-memory store");
    return new MemoryStore();
  }
  // Required lazily: importing `pg` at module scope pulls it into every bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as typeof import("pg");
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
    max: 5,
  });
  return new PgStore(pool);
}

export function getStore(): Store {
  if (!globalThis.__mannaStore) globalThis.__mannaStore = build();
  return globalThis.__mannaStore;
}
