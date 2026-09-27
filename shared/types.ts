/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

/**
 * HackerRank-style voice interview types.
 */

export type InterviewDifficulty = "easy" | "medium" | "hard";

export type InterviewQuestion = {
  id: string;
  topic: string;
  difficulty: InterviewDifficulty;
  prompt: string;
};

export type InterviewVerdict = "correct" | "partial" | "incorrect";

export type InterviewAnswerEvaluation = {
  status: InterviewVerdict;
  score: number;
  feedback: string;
  hint: string | null;
};

export type InterviewSummaryVerdict =
  | "strong-hire"
  | "hire"
  | "lean-hire"
  | "no-hire";

export type InterviewSummary = {
  total: number;
  correct: number;
  partial: number;
  incorrect: number;
  points: number;
  maxPoints: number;
  verdict: InterviewSummaryVerdict;
  strengths: string[];
  improvements: string[];
  closing: string;
};
