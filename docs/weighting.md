# How a chapter's weight is worked out

Manna paces a plan by minutes, not by chapters. This document explains where
those minutes come from, so any number in the table can be argued with.

The short version: **249.9 hours for the whole Bible**, spread across 1,189
chapters, averaging **12.6 minutes a chapter** and ranging from 3 minutes
(Psalm 117) to 56 (Psalm 119).

## The problem

Splitting the Bible evenly by chapter count gives you days that look identical
and feel nothing alike. Genesis 5 is a list of names and ages. Romans 8 is
thirty-nine verses that people spend their lives on. Both are one chapter.

Weighting by length alone does not fix it either. Numbers 7 is one of the
longest chapters in the Bible and one of the easiest: it is the same tribal
offering described twelve times over, changing only the name at the top. It
takes a while to read and almost no time to understand.

So the unit is minutes to **read a chapter and properly grasp it**, and that
number has to come apart into two different things.

## The model

```
minutes = overhead + readMinutes x comprehension
```

**`readMinutes`** is mechanical: how long the words take to go past your eyes.
Word counts come from the World English Bible, a public domain modern
translation, counted directly from the text rather than estimated.

**`comprehension`** is the multiplier on top of that read. It is the number of
times over you effectively have to work through the chapter for it to land.

**`overhead`** is a flat 1.5 minutes: opening the text, finding your place,
settling. It is why Psalm 117, at 24 words, is not scored at twenty seconds.

### Calibrating the reading layer

Published per-book reading-time tables put a full read-through at about 76
hours. Our measured word count, divided by those same published times, implies
**163 words a minute**. We model **160 wpm**, chosen independently as an
attentive rather than skimming pace, and it lands within 2% of the published
figure.

Checked book by book against that table, the correlation is **r = 0.9931**
across all 66 books. The largest single divergence is Leviticus at 22%, which is
within the rounding noise of a table published in quarter-hour steps. The
reading layer is sound.

### Calibrating the comprehension layer

A straight read of the whole Bible is roughly 78 hours at 160 wpm. Manna's table
comes out at **3.19x** that, which is the claim being made: studying the text
costs a bit over three times what reading it costs.

That figure is anchored rather than invented. Published guidance on inductive
chapter study puts a narrative chapter at 20 to 30 minutes when you are writing
a formal chapter summary, and says explicitly that the Psalms, the prophets and
the doctrinal letters cost more. A full inductive treatment of one chapter runs
to an hour or more. Manna is not asking for a formal inductive study every
morning, so it sits below that: read attentively, go back over the dense parts,
think about it, follow a cross reference. Three times a plain read is what that
costs.

The consequence is worth stating plainly, because it is the number that decides
whether the app is usable. At 250 hours, a twelve-month plan asks about **41
minutes a day**. Had we calibrated to full inductive study at ~25 minutes a
chapter, the same plan would demand 75 minutes a day for a year, which nobody
sustains and which would make the app's own longest setting a joke.

## What drives comprehension

`comprehension` starts from a genre baseline and is then moved by five signals
measured from the text of each individual chapter. No number is set by hand.

### Genre baseline

Genre is assigned per book, with chapter spans where a genre boundary inside a
book is one every commentator marks: Daniel's court tales against his visions,
Isaiah's Hezekiah narrative against his oracles, Ezekiel's temple blueprint
against his prophecy, Revelation's seven letters against its apocalypse.

| Genre | Base | Expected poetry |
| --- | --- | --- |
| `spec` (blueprints, itineraries, diagnostic manuals) | 2.20 | 0.02 |
| `narrative` | 2.30 | 0.05 |
| `law` | 3.30 | 0.05 |
| `psalm` | 3.55 | 0.98 |
| `gospel` | 3.45 | 0.05 |
| `wisdom` | 4.10 | 0.85 |
| `prophecy` | 4.35 | 0.70 |
| `epistleGeneral` | 4.45 | 0.02 |
| `epistlePauline` | 5.00 | 0.02 |
| `apocalyptic` | 5.30 | 0.35 |

### The five measured signals

Each is computed from the chapter text in `data/chapter-signals.json`.

**Poetry share** comes free: the source text tags poetic lines separately from
prose paragraphs. It is applied as a deviation from what the genre already
assumes, so Isaiah 53 outweighs Isaiah 37 without the Psalms being charged twice
for being poetry.

**Argument density** counts logical connectives (therefore, because, since,
unless, lest) per hundred words, against the whole-Bible mean. It peaks exactly
where you would want it to: Romans 7, Romans 8, 1 Corinthians 8, 2 Corinthians 5.

**Abstraction** counts theological vocabulary (righteousness, propitiation,
covenant, justification) per hundred words. Its top of the table is Romans 5, 6,
7, 2, 8, then Galatians 3 and 5.

**Register share** detects genealogy, census and inventory material by blending
three independent tells: verses carrying genealogical formulae, the density of
proper nouns, and the density of counts. Its highest scores are 1 Chronicles 2,
Ezra 2, 1 Chronicles 8 and 1, Nehemiah 7, Genesis 10, Genesis 36, Numbers 26 -
which is, precisely, the list of the Bible's registers. It cuts comprehension
cost only, never reading cost: you still have to pass your eyes over the names.

**Internal repetition** measures the share of the chapter that repeats an
earlier five-word window. Its top entries are Numbers 7 (the twelve identical
offerings), Numbers 29 (the festival calendar), Numbers 1 (the census formula),
Leviticus 3 and 4, and Psalm 136, whose refrain runs twenty-six times. Romans 8
and Hebrews 11 score essentially zero. Repetition pays twice: it speeds the
read *and* cuts the comprehension, because you only have to understand it once.

Each factor is clamped so no single signal can run away with a chapter, and the
whole table is scaled at the end so the total lands on the 250 hour anchor.

## Does it come out right

By genre, in minutes per thousand words:

| Genre | Chapters | Min/chapter | Min per 1,000 words |
| --- | --- | --- | --- |
| Pauline epistles | 87 | 18.8 | 37.7 |
| General epistles | 37 | 16.3 | 32.3 |
| Wisdom | 90 | 12.1 | 28.2 |
| Apocalyptic | 31 | 14.4 | 26.5 |
| Psalms | 150 | 7.0 | 25.6 |
| Prophecy | 207 | 15.0 | 24.7 |
| Gospels | 89 | 18.7 | 20.8 |
| Law | 70 | 14.2 | 17.6 |
| Narrative | 400 | 10.2 | 13.4 |
| Specification | 28 | 11.2 | 12.4 |

The densest books per word are Romans, Titus, Galatians, 1 Thessalonians,
1 Timothy and 2 Corinthians. The lightest are Ezra, 2 Kings, Judges, 1 Kings,
Joshua and 1 Chronicles. **Romans costs 4.2 times what 1 Chronicles costs, word
for word.** That is the whole thesis of the app, and it falls out of the model
rather than being asserted.

The hardest individual chapters per word are Romans 8, 7, 5, 6 and 3, then
1 Corinthians 2 and Galatians 3. The easiest are 1 Chronicles 2, Ezra 2,
1 Chronicles 8, Genesis 36 and Genesis 10.

Within a single book the numbers genuinely move, which is the point of weighting
per chapter rather than per book:

| Span | vs whole-Bible average |
| --- | --- |
| Daniel 7 to 12 (visions) | 1.31x |
| Daniel 1 to 6 (court tales) | 0.67x |
| Isaiah 1 to 35 (oracles) | 1.23x |
| Isaiah 36 to 39 (Hezekiah) | 0.75x |
| Ezekiel 1 to 39 (oracles) | 1.05x |
| Ezekiel 40 to 48 (temple) | 0.63x |

Note that Ezekiel and Daniel do **not** clear the average as whole books, and
should not: each carries a large block that is not prophecy at all.

## Edge cases

**Psalm 119** is the heaviest chapter at 56 minutes. It is 2,334 words, a fifth
longer than the next longest chapter, and dense devotional poetry throughout.
Nothing special was done to it; the model simply produces a large number,
because it is a large chapter. On a plan of ten months or longer it exceeds a
whole day's target, and the scheduler responds by giving it a day of its own. On
a six-month plan, where the daily target is 82 minutes, it is read alongside its
neighbours. That difference is the leveller doing its job rather than a rule
about long chapters.

**The genealogies** are handled entirely by the register and repetition signals.
Genesis 5 lands at 5 minutes for 530 words, 1 Chronicles 1 at 6 minutes for 606,
Ezra 2 at 8 minutes for 903. They are cheap per word, but not free, because the
reading time is real even when the comprehension cost is not.

**Numbers 7** is the case that forced the repetition signal into existence. The
first version of the model scored it at 30 minutes on length alone. It now sits
at 18, having been cut both for register content and for being 57% verbatim
repetition, the highest in the Bible.

**Leviticus 11 to 15** is classified as specification rather than law. It is a
priestly diagnostic manual, procedural in the same way the tabernacle blueprint
is procedural, and scoring it as legal-theological argument put Leviticus 13 at
28 minutes when 20 is closer to honest.

**Very short chapters** are floored at 3 minutes. Psalm 117 is two verses; you
still have to open it, read it and think about it.

## Reproducing this

The measured signals for all 1,189 chapters are committed at
`data/chapter-signals.json`. The model is `lib/weighting.ts`. The output is
`lib/weights.ts`, regenerated with:

```bash
npx tsx scripts/gen-weights.ts
```

`lib/weights.test.ts` asserts that the committed table is exactly what the model
produces from the committed signals, so a number cannot be quietly hand-tuned,
along with the sanity checks quoted throughout this document.

The signals were derived from the World English Bible, which is public domain.
That text is used only as a measuring instrument for word counts, poetry share
and vocabulary density; the app itself links out to the ESV or the NKJV.

## Things worth arguing with

- **The 250 hour anchor is a judgement call.** It is defensible and it is
  documented, but a different reader could reasonably want 180 or 350. It is a
  single constant, `TARGET_HOURS` in `lib/weighting.ts`, and moving it rescales
  everything proportionally without touching the relative weights.
- **The genre baselines are informed estimates,** not measurements. The relative
  ordering is well supported; the exact gaps between adjacent genres are not.
- **Familiarity is not modelled.** John 3 is dense by every signal here, and a
  reader who has known it since childhood will move through it faster than the
  table says. The weights describe the text, not the reader.
