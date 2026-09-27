import type {
  InterviewAnswerEvaluation,
  InterviewQuestion,
  InterviewSummary,
} from "@shared/types";
import {
  ArrowLeft,
  Check,
  CircleSlash,
  Minus,
  RotateCcw,
  Sparkles,
  Trophy,
} from "lucide-react";

export type QuestionResult = {
  question: InterviewQuestion;
  evaluation: InterviewAnswerEvaluation;
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
