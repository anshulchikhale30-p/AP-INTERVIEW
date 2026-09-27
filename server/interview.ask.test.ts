import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeLLM } = vi.hoisted(() => ({ invokeLLM: vi.fn() }));

vi.mock("./_core/llm", () => ({ invokeLLM }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { questionBank } from "./questionBank";

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("interview.start", () => {
  it("returns a filtered, correctly-sized question set", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.interview.start({
      topics: ["Arrays & Hashing"],
      difficulty: "medium",
      count: 3,
    });

    expect(result.count).toBe(3);
    expect(result.questions.length).toBe(result.count);
    expect(result.intro).toContain("technical screen");
    expect(result.questions.some(q => q.difficulty === "medium")).toBe(true);
    for (const question of result.questions) {
      expect(question.topic).toBe("Arrays & Hashing");
      expect(question.prompt.length).toBeGreaterThan(10);
    }
  });
});

describe("interview.answer", () => {
  beforeEach(() => {
    invokeLLM.mockReset();
    invokeLLM.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              status: "correct",
              score: 90,
              feedback: "Solid answer. Nice and precise.",
              hint: null,
            }),
          },
        },
      ],
    });
  });

  it("grades the candidate and returns the evaluation", async () => {
    const caller = appRouter.createCaller(createContext());
    const question = questionBank[0];

    const result = await caller.interview.answer({
      questionId: question.id,
      questionIndex: 0,
      count: 3,
      difficulty: "mixed",
      answer: "I would use a hash map to track numbers I have seen.",
      transcript: [],
      history: [],
    });

    expect(result.summary).toBeNull();
    expect(result.evaluation.status).toBe("correct");
    expect(result.evaluation.score).toBe(90);
    expect(result.evaluation.feedback).toContain("Solid");
    expect(invokeLLM).toHaveBeenCalledOnce();
    const userMessage = invokeLLM.mock.calls[0][0].messages[1].content;
    expect(userMessage).toContain(question.prompt);
    expect(userMessage).toContain("hash map");
  });

  it("returns a summary on the final question", async () => {
    const caller = appRouter.createCaller(createContext());
    const question = questionBank[0];

    const result = await caller.interview.answer({
      questionId: question.id,
      questionIndex: 2,
      count: 3,
      difficulty: "mixed",
      answer: "Use XOR to cancel out the duplicate pairs.",
      transcript: [],
      history: [
        { questionId: "arr-m1", status: "correct", score: 90 },
        { questionId: "str-e1", status: "partial", score: 60 },
      ],
    });

    expect(result.summary).not.toBeNull();
    expect(result.summary?.total).toBe(3);
    expect(result.evaluation.status).toBe("correct");
  });

  it("falls back to the offline grader when the LLM is unavailable", async () => {
    invokeLLM.mockRejectedValue(new Error("OPENAI_API_KEY is not configured"));
    const caller = appRouter.createCaller(createContext());

    const result = await caller.interview.answer({
      questionId: "arr-m1",
      questionIndex: 0,
      count: 3,
      difficulty: "mixed",
      answer:
        "I would use a hash map and look for the complement of the target.",
      transcript: [],
      history: [],
    });

    expect(result.summary).toBeNull();
    expect(["correct", "partial", "incorrect"]).toContain(
      result.evaluation.status
    );
    expect(result.evaluation.score).toBeGreaterThanOrEqual(0);
    expect(result.evaluation.score).toBeLessThanOrEqual(100);
  });

  it("handles skipped questions without calling the LLM", async () => {
    const caller = appRouter.createCaller(createContext());

    const result = await caller.interview.answer({
      questionId: "arr-e1",
      questionIndex: 0,
      count: 3,
      difficulty: "mixed",
      answer: "",
      skipped: true,
      transcript: [],
      history: [],
    });

    expect(invokeLLM).not.toHaveBeenCalled();
    expect(result.evaluation.status).toBe("incorrect");
    expect(result.evaluation.score).toBe(0);
  });
});
