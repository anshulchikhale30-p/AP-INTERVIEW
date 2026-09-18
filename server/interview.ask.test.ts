import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeLLM } = vi.hoisted(() => ({ invokeLLM: vi.fn() }));

vi.mock("./_core/llm", () => ({ invokeLLM }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("interview.ask", () => {
  beforeEach(() => {
    invokeLLM.mockReset();
    invokeLLM.mockResolvedValue({
      choices: [{ message: { content: "Strong start. What trade-off did you make?" } }],
    });
  });

  it("sends the interview context to the coach and returns a concise answer", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.interview.ask({
      question: "I reduced onboarding time by 30%.",
      mode: "Product sense warm-up",
      level: "mid-level",
      transcript: [{ role: "assistant", content: "Tell me about a project you are proud of." }],
    });

    expect(result.answer).toContain("trade-off");
    expect(invokeLLM).toHaveBeenCalledOnce();
    expect(invokeLLM.mock.calls[0][0].messages[1].content).toContain("Product sense warm-up");
    expect(invokeLLM.mock.calls[0][0].messages[1].content).toContain("reduced onboarding time by 30%");
  });
});
