import type {
  InterviewAnswerEvaluation,
  InterviewQuestion,
  InterviewSummary,
} from "@shared/types";
import type {
  DeliveryMetrics,
  RubricCoverage,
} from "@shared/rubric";
import { RUBRIC_DIMENSIONS } from "@shared/rubric";
import {
  ArrowLeft,
  Check,
  CircleSlash,
  Gauge,
  Minus,
  RotateCcw,
  Sparkles,
  Trophy,
} from "lucide-react";

export type QuestionResult = {
  question: InterviewQuestion;
  evaluation: InterviewAnswerEvaluation;
  /** How much of the verbal rubric this answer actually covered. */
  coverage: RubricCoverage | null;
  delivery: DeliveryMetrics | null;
  transcript: string;
};

const VERDICT_COLORS: Record<
  InterviewSummary["verdict"],
  { label: string; className: string }
> = {
  "strong-hire": {
    label: "Strong hire signal",
    className: "bg-[#d8f97a] text-[#101724]",
  },
  hire: { label: "Hire signal", className: "bg-[#82a9ff] text-[#0d1526]" },
  "lean-hire": {
    label: "Lean hire signal",
    className: "bg-[#ffd47a] text-[#241a08]",
  },
  "no-hire": { label: "Not ready yet", className: "bg-white/10 text-white/70" },
};

function StatusIcon({
  status,
}: {
  status: InterviewAnswerEvaluation["status"];
}) {
  if (status === "correct")
    return <Check className="h-3.5 w-3.5 text-[#57d6a7]" />;
  if (status === "partial")
    return <Minus className="h-3.5 w-3.5 text-[#ffd47a]" />;
  return <CircleSlash className="h-3.5 w-3.5 text-[#ff8f70]" />;
}

const DIFFICULTY_LABEL: Record<InterviewQuestion["difficulty"], string> = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
};

/**
 * The report card a correctness score cannot produce. Correctness tells you
 * whether the answer was right; this tells you whether the person would have
 * communicated it convincingly in a real screen, and which habit is costing
 * them the most across the whole interview.
 */
function DeliveryReport({ results }: { results: QuestionResult[] }) {
  const spoken = results.filter(result => result.delivery !== null);
  if (spoken.length === 0) return null;

  const totalWords = spoken.reduce(
    (sum, result) => sum + (result.delivery?.wordCount ?? 0),
    0
  );
  const totalFillers = spoken.reduce(
    (sum, result) => sum + (result.delivery?.fillerCount ?? 0),
    0
  );
  const avgWpm = Math.round(
    spoken.reduce((sum, result) => sum + (result.delivery?.wordsPerMinute ?? 0), 0) /
      spoken.length
  );
  const fillerRate = totalWords
    ? Number(((totalFillers / totalWords) * 100).toFixed(1))
    : 0;
  const longestPause = Math.max(
    ...spoken.map(result => result.delivery?.longestPauseMs ?? 0)
  );

  // Which rubric steps did this candidate habitually skip? This is the single
  // most actionable line in the whole report.
  const missedCounts = new Map<string, { label: string; count: number }>();
  for (const result of results) {
    for (const id of result.coverage?.missing ?? []) {
      const entry = missedCounts.get(id) ?? {
        label:
          RUBRIC_DIMENSIONS.find(dimension => dimension.id === id)?.label ?? id,
        count: 0,
      };
      entry.count += 1;
      missedCounts.set(id, entry);
    }
  }
  const habit = Array.from(missedCounts.values()).sort(
    (a, b) => b.count - a.count
  )[0];

  const stats = [
    { label: "spoken", value: `${totalWords}w` },
    { label: "pace", value: `${avgWpm} wpm` },
    { label: "fillers", value: `${totalFillers} (${fillerRate}/100w)` },
    { label: "longest pause", value: `${(longestPause / 1000).toFixed(1)}s` },
  ];

  return (
    <div className="mt-4 w-full rounded-2xl border border-[#82a9ff]/20 bg-[#82a9ff]/[0.04] p-5 text-left sm:p-6">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#82a9ff]">
        <Gauge className="h-3.5 w-3.5" /> Delivery
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(stat => (
          <div key={stat.label}>
            <dt className="text-[10px] uppercase tracking-[0.12em] text-white/35">
              {stat.label}
            </dt>
            <dd className="mt-0.5 font-mono text-[13px] text-white/85">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {habit && habit.count > 0 && (
        <p className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-[12px] leading-5 text-white/70">
          <span className="font-semibold text-white/90">
            Your biggest habit: {habit.label}.
          </span>{" "}
          You left it out of {habit.count} of {results.length} answers. Interviewers
          score it every time, even when the algorithm is right.
        </p>
      )}

      <ul className="mt-3 flex flex-col gap-1.5">
        {spoken
          .flatMap(result => result.delivery?.notes ?? [])
          .slice(0, 3)
          .map((note, index) => (
            <li
              key={index}
              className="flex gap-2 text-[12px] leading-5 text-white/55"
            >
              <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#82a9ff]" />{" "}
              {note}
            </li>
          ))}
      </ul>
    </div>
  );
}

export default function InterviewSummary({
  results,
  summary,
  onRestart,
  onSettings,
}: {
  results: QuestionResult[];
  summary: InterviewSummary;
  onRestart: () => void;
  onSettings: () => void;
}) {
  const percent = Math.round(
    (summary.points / Math.max(1, summary.maxPoints)) * 100
  );
  const verdict = VERDICT_COLORS[summary.verdict];

  return (
    <section className="relative z-10 mx-auto flex min-h-[calc(100vh-92px)] w-full max-w-[620px] flex-col items-center px-5 pb-10 pt-10 sm:pt-14">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[#d8f97a]">
        <Trophy className="h-3.5 w-3.5" /> Screen complete
      </div>

      <div className="mt-6 flex items-center gap-5">
        <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border border-[#d8f97a]/30 bg-[#d8f97a]/[0.06]">
          <span className="font-display text-3xl font-semibold text-white">
            {percent}
          </span>
          <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
            score
          </span>
        </div>
        <div className="text-left">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${verdict.className}`}
          >
            <Sparkles className="h-3 w-3" /> {verdict.label}
          </span>
          <div className="mt-3 flex gap-4 text-left">
            <div>
              <div className="font-display text-lg font-semibold text-[#57d6a7]">
                {summary.correct}
              </div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                correct
              </div>
            </div>
            <div>
              <div className="font-display text-lg font-semibold text-[#ffd47a]">
                {summary.partial}
              </div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                partial
              </div>
            </div>
            <div>
              <div className="font-display text-lg font-semibold text-[#ff8f70]">
                {summary.incorrect}
              </div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/35">
                missed
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 w-full rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 text-left sm:p-6">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
          Question by question
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {results.map(({ question, evaluation }, index) => (
            <li key={question.id} className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.05] text-[11px] text-white/45">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-white/75">
                {question.topic}
              </span>
              <span className="hidden rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-white/40 sm:block">
                {DIFFICULTY_LABEL[question.difficulty]}
              </span>
              <StatusIcon status={evaluation.status} />
              <span className="w-10 text-right font-mono text-[12px] text-white/55">
                {evaluation.score}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 grid w-full gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#57d6a7]/20 bg-[#57d6a7]/[0.04] p-5 text-left">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#57d6a7]">
            Strengths
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {summary.strengths.length > 0 ? (
              summary.strengths.map((item, index) => (
                <li
                  key={index}
                  className="flex gap-2 text-[13px] leading-5 text-white/75"
                >
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#57d6a7]" />{" "}
                  {item}
                </li>
              ))
            ) : (
              <li className="text-[13px] text-white/40">
                Coach notes pending — repeat with easier topics.
              </li>
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-[#ff8f70]/20 bg-[#ff8f70]/[0.04] p-5 text-left">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#ffad9a]">
            Sharpen next
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {summary.improvements.length > 0 ? (
              summary.improvements.map((item, index) => (
                <li
                  key={index}
                  className="flex gap-2 text-[13px] leading-5 text-white/75"
                >
                  <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff8f70]" />{" "}
                  {item}
                </li>
              ))
            ) : (
              <li className="text-[13px] text-white/40">
                You're in good shape. Try hard mode.
              </li>
            )}
          </ul>
        </div>
      </div>

      <DeliveryReport results={results} />

      <p className="mt-6 max-w-[500px] text-center text-[13px] italic leading-6 text-white/55">
        “{summary.closing}”
      </p>

      <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onRestart}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#d8f97a] px-6 py-3 text-sm font-semibold text-[#101724] transition hover:brightness-105"
        >
          <RotateCcw className="h-4 w-4" /> Practice again
        </button>
        <button
          type="button"
          onClick={onSettings}
          className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/[0.06]"
        >
          <ArrowLeft className="h-4 w-4" /> Change practice plan
        </button>
      </div>
    </section>
  );
}
