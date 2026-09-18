import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

const knowledgeBase = `You are Intervue, a calm, demanding, practical interview coach. You know behavioral interviews, STAR stories, product sense, analytics, system design, coding interviews, leadership, communication, and negotiation. Your job is to ask one sharp follow-up question at a time and help the candidate think, not give them a rehearsed answer. Prefer specific, concise prompts. Notice missing context, unclear ownership, weak metrics, and hidden trade-offs. Never claim to be a real recruiter or make hiring decisions. Keep responses under 90 words unless a framework is directly requested.`;

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
    ask: publicProcedure
      .input(z.object({
        question: z.string().min(1).max(5000),
        mode: z.string().min(1).max(80).default("General interview"),
        level: z.string().min(1).max(40).default("mid-level"),
        transcript: z.array(z.object({ role: z.enum(["assistant", "user"]), content: z.string() })).max(12).default([]),
      }))
      .mutation(async ({ input }) => {
        const transcript = input.transcript.map(message => `${message.role === "assistant" ? "Interviewer" : "Candidate"}: ${message.content}`).join("\n");
        const response = await invokeLLM({
          messages: [
            { role: "system", content: knowledgeBase },
            { role: "user", content: `Interview mode: ${input.mode}\nCandidate level: ${input.level}\nRecent conversation:\n${transcript || "No previous turns."}\n\nCandidate's latest response or request:\n${input.question}\n\nRespond as the interviewer. Acknowledge one strong signal if present, then ask the most useful next question. If the candidate asks for a framework, give a short framework and one example.` },
          ],
        });
        const content = response.choices?.[0]?.message?.content;
        const answer = typeof content === "string" ? content : Array.isArray(content) ? content.map((part: any) => part.text ?? "").join("") : "Good start. What trade-off did you make, and how did you know it was the right one?";
        return { answer };
      }),
  }),
});

export type AppRouter = typeof appRouter;
