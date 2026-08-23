"use client";

import { useEffect, useState } from "react";
import { Glyph } from "./Glyph";
import type { QuizQuestion } from "@/lib/types";

/**
 * A short check on the reading you just did. Two or three questions, answered
 * in place, marked immediately.
 *
 * Answers live in localStorage rather than the database: this is a nudge to
 * read attentively, not an exam, and nothing is gained by making a wrong guess
 * permanent or by showing anyone else your score.
 */
export function DailyQuiz({
  questions,
  planId,
  day,
}: {
  questions: QuizQuestion[];
  planId: string;
  day: number;
}) {
  const storeKey = `manna-quiz-${planId}-${day}`;
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPicked(JSON.parse(localStorage.getItem(storeKey) ?? "{}") as Record<string, number>);
    } catch {
      setPicked({});
    }
  }, [storeKey]);

  if (questions.length === 0) return null;

  function choose(q: QuizQuestion, i: number) {
    if (picked[q.id] !== undefined) return; // one go per question
    const next = { ...picked, [q.id]: i };
    setPicked(next);
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch {}
  }

  const answered = questions.filter((q) => picked[q.id] !== undefined).length;
  const right = questions.filter((q) => picked[q.id] === q.answer).length;
  const finished = answered === questions.length;

  return (
    <section className="rise-in rounded-2xl border border-line bg-card p-5" style={{ animationDelay: "150ms" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="eyebrow flex items-center gap-1.5 text-ink-2">
          <Glyph name="scroll" className="h-3.5 w-3.5" />
          Check yourself
        </span>
        <span className="flex items-center gap-2">
          {finished && (
            <span className={`stat text-xs font-semibold ${right === questions.length ? "text-good" : "text-ink-2"}`}>
              {right}/{questions.length}
            </span>
          )}
          <span className={`text-ink-3 transition ${open ? "rotate-180" : ""}`}>
            <Glyph name="chevron" className="h-4 w-4" />
          </span>
        </span>
      </button>

      {!open && (
        <p className="mt-2 text-sm text-ink-2">
          {finished
            ? right === questions.length
              ? "All correct. You were paying attention."
              : `${right} of ${questions.length}. Open to see which.`
            : `${questions.length} quick question${questions.length === 1 ? "" : "s"} on today's reading.`}
        </p>
      )}

      {open && (
        <ol className="mt-4 space-y-5">
          {questions.map((q) => {
            const choice = picked[q.id];
            const done = choice !== undefined;
            return (
              <li key={q.id}>
                <p className="text-[0.9375rem] font-medium text-ink">{q.prompt}</p>
                <div className="mt-2 space-y-1.5">
                  {q.options.map((opt, i) => {
                    const isAnswer = i === q.answer;
                    const isChoice = i === choice;
                    let tone = "border-line bg-page-2 text-ink-2";
                    if (done && isAnswer) tone = "border-good bg-good/10 text-ink";
                    else if (done && isChoice) tone = "border-warn bg-warn/10 text-ink-2 line-through";
                    else if (done) tone = "border-line bg-page-2 text-ink-3";
                    return (
                      <button
                        key={opt}
                        onClick={() => choose(q, i)}
                        disabled={done}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-left text-[0.9375rem] transition ${tone} ${
                          done ? "" : "hover:border-accent"
                        }`}
                      >
                        <span>{opt}</span>
                        {done && isAnswer && (
                          <span className="tick-in shrink-0 text-good">
                            <Glyph name="check" className="h-4 w-4" />
                          </span>
                        )}
                        {done && isChoice && !isAnswer && (
                          <span className="shrink-0 text-warn">
                            <Glyph name="close" className="h-4 w-4" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {done && q.note && (
                  <p className="mt-1.5 text-xs text-ink-3">{q.note}</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
