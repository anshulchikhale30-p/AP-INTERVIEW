import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import type {
  InterviewAnswerEvaluation,
  InterviewSummary,
  InterviewSummaryVerdict,
  InterviewVerdict,
} from "@shared/types";
import type { JsonSchema } from "./_core/llm";
import { getSessionCookieOptions } from "./_core/cookies";
import {
  createStreamingToken,
  getStreamingConfig,
} from "./_core/assemblyai";
import { hasAssemblyAi } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { questionBank, gradeRuleBased, pickQuestions } from "./questionBank";

const interviewerPersona = `
You are a rigorous HackerRank-style technical interviewer conducting a live, spoken coding interview. You ask algorithm and data-structure questions, grade the candidate's verbal answer against a hidden checklist, give fair partial credit, and keep every reply conversational and under 90 words. Do not reveal or quote the checklist. Never claim to be a real recruiter or promise a job. Stay calm, precise, and encouraging — this is practice.
`;

const verdictSchema = z.enum(["correct", "partial", "incorrect"]);

const historyItemSchema = z.object({
  questionId: z.string(),
  status: verdictSchema,
  score: z.number().int().min(0).max(100),
});

const answerInputSchema = z.object({
  questionId: z.string().min(1),
  questionIndex: z.number().int().min(0),
  count: z.number().int().min(1).max(10),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
  answer: z.string().max(5000).default(""),
  skipped: z.boolean().default(false),
  transcript: z
    .array(
      z.object({ role: z.enum(["assistant", "user"]), content: z.string() })
    )
    .max(12)
    .default([]),
  history: z.array(historyItemSchema).max(10).default([]),
});

const evaluationSchema: JsonSchema = {
  name: "answer_evaluation",
  strict: true,
  schema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["correct", "partial", "incorrect"] },
      score: { type: "number" },
      feedback: { type: "string" },
      hint: { type: ["string", "null"] },
    },
    required: ["status", "score", "feedback", "hint"],
    additionalProperties: false,
  },
};

const summarySchema: JsonSchema = {
  name: "interview_summary",
  strict: true,
  schema: {
    type: "object",
    properties: {
      verdict: {
        type: "string",
        enum: ["strong-hire", "hire", "lean-hire", "no-hire"],
      },
      strengths: { type: "array", items: { type: "string" } },
      improvements: { type: "array", items: { type: "string" } },
      closing: { type: "string" },
    },
    required: ["verdict", "strengths", "improvements", "closing"],
    additionalProperties: false,
  },
};

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

function parseJson<T>(content: string): T | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(content.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

function normalizeFeedback(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function normalizeVerdict(
  value: unknown,
  fallback: InterviewVerdict
): InterviewVerdict {
  if (value === "correct" || value === "partial" || value === "incorrect") {
    return value;
  }
  return fallback;
}

function normalizeScore(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function renderTranscript(
  messages: { role: string; content: string }[]
): string {
  return messages
    .map(
      message =>
        `${message.role === "assistant" ? "Interviewer" : "Candidate"}: ${message.content}`
    )
    .join("\n");
}

function makeFeedbackPrompt(input: z.infer<typeof answerInputSchema>): string {
  const question = questionBank.find(q => q.id === input.questionId);
  const details = question
    ? `${question.prompt}\n\nGrading checklist (use internally, never quote verbatim):\n- ${question.keyPoints.join("\n- ")}`
    : "Question not found in the bank; grade generously on clarity and correctness.";

  return [
    `Question ${input.questionIndex + 1} of ${input.count} [${question?.topic ?? "General"}, ${input.difficulty}]`,
    details,
    `Recent conversation:\n${renderTranscript(input.transcript) || "No previous turns."}`,
    `Candidate's answer${input.skipped ? " (candidate skipped this question)" : ""}:\n${input.answer}`,
    "Grade this verbal answer against the checklist. Score 0-100. Give one short, specific piece of feedback and, if the answer was incomplete, one concrete hint. Never reveal the checklist.",
  ].join("\n\n");
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  interview: router({
    streamToken: publicProcedure
      .input(
        z
          .object({
            maxSessionDurationSeconds: z.number().int().min(60).max(10_800).optional(),
          })
          .default({})
      )
      .mutation(async ({ input }) => {
        if (!hasAssemblyAi()) {
          return {
            enabled: false as const,
            reason:
              "ASSEMBLYAI_API_KEY is not configured on the server. Set it to enable real-time voice.",
          };
        }
        try {
          const { token, expiresInSeconds } = await createStreamingToken({
            maxSessionDurationSeconds: input.maxSessionDurationSeconds,
          });
          return {
            token,
            expiresInSeconds,
            ...getStreamingConfig(),
            enabled: true as const,
          };
        } catch (error) {
          return {
            enabled: false as const,
            reason:
              error instanceof Error
                ? error.message
                : "Could not reach AssemblyAI.",
          };
        }
      }),
    start: publicProcedure
      .input(
        z.object({
          topics: z.array(z.string()).max(5).default([]),
          difficulty: z
            .enum(["easy", "medium", "hard", "mixed"])
            .default("mixed"),
          count: z.number().int().min(1).max(10).default(5),
        })
      )
      .mutation(({ input }) => {
        const questions = pickQuestions(input);
        const topicSummary =
          input.topics.length > 0
            ? input.topics.join(", ")
            : "general algorithms";
        const difficultySummary =
          input.difficulty === "mixed" ? "mixed" : `${input.difficulty}`;
        const intro =
          `You're in a live technical screen. We'll cover ${input.count} ${difficultySummary}-difficulty questions on ` +
          `${topicSummary}. I'll read each one aloud — walk me through your thinking out loud, explain your ` +
          `approach, the data structures, and the time or space complexity. When you're ready for the first ` +
          `question, just say "Go" or answer it directly.`;
        return {
          intro,
          questions,
          count: questions.length,
        };
      }),
    answer: publicProcedure.input(answerInputSchema).mutation(
      async ({
        input,
      }): Promise<{
        evaluation: InterviewAnswerEvaluation;
        summary: InterviewSummary | null;
      }> => {
        const question = questionBank.find(q => q.id === input.questionId);

        const evaluation: InterviewAnswerEvaluation = await (async () => {
          if (input.skipped) {
            return {
              status: "incorrect",
              score: 0,
              feedback: "No problem — let's move to the next one. Keep going.",
              hint: null,
            };
          }

          if (!question) {
            return gradeRuleBased(
              {
                signals: [
                  "data structure",
                  "approach",
                  "complexity",
                  "o(n)",
                  "o(log",
                  "solution",
                ],
              },
              input.answer
            );
          }

          try {
            const response = await invokeLLM({
              response_format: {
                type: "json_schema",
                json_schema: evaluationSchema,
              },
              messages: [
                { role: "system", content: interviewerPersona },
                { role: "user", content: makeFeedbackPrompt(input) },
              ],
            });

            const raw = parseJson<Partial<InterviewAnswerEvaluation> & object>(
              extractText(response.choices?.[0]?.message?.content)
            );

            const verdict = normalizeVerdict(raw?.status, "partial");
            const fallbackText =
              "Good attempt. Let's sharpen your reasoning — explain the trade-offs in your approach more explicitly.";
            return {
              status: verdict,
              score: normalizeScore(raw?.score),
              feedback:
                normalizeFeedback(raw?.feedback) ??
                (verdict === "correct"
                  ? "Solid answer. Nice and precise."
                  : fallbackText),
              hint: normalizeFeedback(raw?.hint),
            };
          } catch (error) {
            // No API key or upstream failure: fall back to the offline grader
            // so the interview keeps working without network credentials.
            console.warn(
              "[Interview] LLM unavailable, using heuristic grader:",
              error
            );
            return gradeRuleBased(question, input.answer);
          }
        })();

        const isLast = input.questionIndex + 1 >= input.count;

        if (!isLast) {
          return { evaluation, summary: null };
        }

        const history = [
          ...input.history,
          {
            questionId: input.questionId,
            status: evaluation.status,
            score: evaluation.score,
          },
        ];
        const points = history.reduce((sum, item) => sum + item.score, 0);
        const maxPoints = history.length * 100;
        const correct = history.filter(h => h.status === "correct").length;
        const partial = history.filter(h => h.status === "partial").length;
        const incorrect = history.filter(h => h.status === "incorrect").length;

        const summary = await (async (): Promise<InterviewSummary> => {
          const fallbackVerdict: InterviewSummaryVerdict =
            points / Math.max(1, maxPoints) >= 0.8
              ? "strong-hire"
              : points / Math.max(1, maxPoints) >= 0.6
                ? "hire"
                : points / Math.max(1, maxPoints) >= 0.4
                  ? "lean-hire"
                  : "no-hire";
          try {
            const response = await invokeLLM({
              response_format: {
                type: "json_schema",
                json_schema: summarySchema,
              },
              messages: [
                { role: "system", content: interviewerPersona },
                {
                  role: "user",
                  content:
                    `The interview is finished. Here is the per-question breakdown (JSON):\n` +
                    `${JSON.stringify(history, null, 2)}\n\n` +
                    `Total score: ${points}/${maxPoints}. Produce a fair practice summary: a verdict, ` +
                    `2-4 strengths, 2-4 improvement areas, and a short spoken closing under 80 words. ` +
                    `Never quote the hidden checklists.`,
                },
              ],
            });
            const raw = parseJson<
              Partial<InterviewSummary> & {
                strengths?: unknown;
                improvements?: unknown;
              }
            >(extractText(response.choices?.[0]?.message?.content));
            if (raw) {
              const toStrings = (value: unknown): string[] =>
                Array.isArray(value)
                  ? value
                      .map(item => normalizeFeedback(item))
                      .filter((s): s is string => s !== null)
                  : [];
              const overrideVerdict =
                raw.verdict &&
                (raw.verdict === "strong-hire" ||
                  raw.verdict === "hire" ||
                  raw.verdict === "lean-hire" ||
                  raw.verdict === "no-hire")
                  ? raw.verdict
                  : fallbackVerdict;
              return {
                total: history.length,
                correct,
                partial,
                incorrect,
                points,
                maxPoints,
                verdict: overrideVerdict,
                strengths: toStrings(raw.strengths),
                improvements: toStrings(raw.improvements),
                closing:
                  normalizeFeedback(raw.closing) ??
                  "That wraps the session. Solid effort — review the feedback and try again when you're ready.",
              };
            }
          } catch {
            // Fall through to the deterministic summary below.
          }
          return {
            total: history.length,
            correct,
            partial,
            incorrect,
            points,
            maxPoints,
            verdict: fallbackVerdict,
            strengths: [],
            improvements: [],
            closing:
              "That wraps the session. Solid effort — review the feedback and try again when you're ready.",
          };
        })();

        return { evaluation, summary };
      }
    ),
  }),
});

export type AppRouter = typeof appRouter;
