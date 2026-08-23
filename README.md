# Manna

A weighted Bible reading plan for a small group of friends. The whole Bible,
66 books and 1,189 chapters in canonical order, paced by how long each chapter
actually takes to read and grasp rather than by chapter count.

Built to be added to the home screen from Safari: it installs and behaves like
an app, no App Store involved.

## The idea

Three chapters of Romans is not three chapters of Chronicles. Most plans pretend
otherwise and hand you a fixed number of chapters a day, which is why the weeks
in the genealogies feel like nothing and the weeks in the epistles bury you.

Manna gives every chapter a study weight in minutes, then levels the plan so
that **minutes per day** stay flat. Some mornings are one chapter, some are five.
The methodology behind those weights, and the arguments against it, are written
up in [docs/weighting.md](docs/weighting.md).

Total for the whole Bible: **249.9 hours**, averaging 12.6 minutes a chapter,
from 3 minutes (Psalm 117) to 56 (Psalm 119).

## What it does

- **Today.** The exact chapters, with a tap through to each one in the ESV. Tick
  them off one at a time or the whole day at once, and step backward and forward
  through the plan to catch up or read ahead.
- **Pace.** Ahead, behind or level, with the gap measured in the reading you
  actually missed rather than in days.
- **Streaks.** Consecutive days logged. The day rolls over at 3 AM, not midnight.
- **Together.** The whole group, ordered by how far through they are, with who
  has read today at a glance, and a feed of what people have written lately. The
  gap quoted beside your rank is to the person immediately ahead rather than to
  the leader.
- **Journey.** A contribution heatmap over the whole plan, milestone badges for
  each canonical section (with a moment when you finish one), and running stats:
  minutes invested, chapters and books finished, average pace, projected finish.
- **Notes.** A shared field on each day's reading. Anyone in the plan can write,
  everyone can read. Flat, no threads.
- **Verse of the day.** The strongest verse of today's chapters, scored on
  whether it stands on its own, and the same for everyone reading that day.
- **A daily check.** Five multiple choice questions on what you just read,
  marked on the spot.
- **Evening reminder.** A web push if today is still unticked.

## The plan

One plan, covering the entire Bible; the only variable is pace. Whoever signs in
first creates it and picks a duration of 1 to 13 whole months, and the schedule
is rebuilt whenever that changes. After that there is nothing to join and no
code to pass around: signing in puts you in it.

Because signing in is the only door, registration is the only lock. Set
`SIGNUP_SECRET` and new accounts need that one shared word; existing people
never see it again. Leave it unset locally, where there is nothing to protect.

The creator can remove someone, which takes their reading and their notes with
them and stops them signing back in.

Only the creator can change plan settings, and can hand edit rights to specific
people individually. Everyone can see who else is reading.

Anyone can change their own display name, username and password from settings.
Changing a password needs the old one, even while signed in.

Each reader carries their own day one. Someone handed the code a month in starts
at Genesis on pace rather than opening the app thirty days behind, reading the
same schedule shifted to their own start.

Progress is stored per chapter, not per day. Days are slices of a schedule that
moves when the plan length changes; chapters are not. It is also what lets a
half-finished morning be four chapters of six rather than a lie or nothing.

## Scale

The whole app used to travel as one payload, which was right for two readers and
wrong for twelve: everyone's individual chapter ticks came to 14,268 rows and
close to a megabyte on a finished plan, re-sent on every tap because mutations
return the state. Your own ticks travel now; everyone else arrives as a computed
standing. Twelve people a third of the way through a year is 44 KB.

## Stack

Next.js 16 (App Router) - React 19 - TypeScript - Tailwind v4 - Postgres on
Railway via `pg` - `web-push` - installable PWA. No database needed to run
locally: with no `DATABASE_URL` it falls back to an in-memory store.

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no `DATABASE_URL` set, data lives in memory and
resets when the server restarts. Never point local dev at the production
database.

## Test

```bash
npm test
```

Three suites, plain `.test.ts` files run with `tsx`, no framework:

- `lib/schedule.test.ts` - every chapter appears exactly once, canonical order
  holds, no empty days, daily load stays level within tolerance at 1, 6 and 13
  months, and the divide-and-conquer partitioner is checked against a
  brute-force DP to prove it finds the true optimum.
- `lib/weights.test.ts` - the committed weight table is exactly what the model
  produces, plus the sanity checks: genealogies cheap, epistles dear, Romans
  above Chronicles per word.
- `lib/quiz.test.ts` - checks all 1,800 of a year's questions against the same
  text they were built from, so none of them can be wrong about the Bible.
- `lib/progress.test.ts` - pace, streaks, stats, milestones, partial days, late
  joiners and the verse of the day. Includes a regression test for the bug that
  day-keyed progress caused: switching a twelve month plan to three used to
  credit 496 chapters that were never opened.

## Regenerating the weights

```bash
node scripts/score-verses.mjs      # rescore verses  -> data/chapter-verses.json
node scripts/extract-names.mjs     # names for the quiz -> data/chapter-names.json
npx tsx scripts/gen-weights.ts     # rebuild the generated tables
```

Reads `data/chapter-signals.json` through the model in `lib/weighting.ts` and
rewrites `lib/weights.ts`, `lib/verses.ts`, `lib/verse-picks.ts` and
`lib/chapter-names.ts`. `lib/weights.test.ts` will fail if
the committed table ever drifts from the model.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Unset means the in-memory store |
| `SESSION_SECRET` | Signs the session cookie |
| `VAPID_PUBLIC_KEY` | Web push. Unset means pushes quietly no-op |
| `VAPID_PRIVATE_KEY` | Web push |
| `VAPID_SUBJECT` | Web push contact, `mailto:` |
| `CRON_SECRET` | Guards `/api/cron/tick` |
| `SIGNUP_SECRET` | The shared word needed to register. Unset means anyone can |
| `ESV_API_KEY` | Optional. Shows the verse of the day's text inline |

The 1,189 chapter weights seed themselves into `chapter_weights` on boot, so a
fresh database needs no manual step. `/api/health` reports the row count.

## Deploy

Pushed to Railway (`manna` service plus Postgres). `railway deployment up`
builds with Nixpacks and runs `npm run start`.
