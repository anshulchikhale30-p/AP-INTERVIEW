import { describe, expect, it } from "vitest";
import {
  analyzeDelivery,
  normalizeSpeech,
  scoreRubric,
  type TimedWord,
} from "./rubric";

/** Build a word timeline of `seconds` spoken, one word per `wpm` pace. */
function wordsOver(seconds: number, wordsPerMinute: number): TimedWord[] {
  const count = Math.round((seconds / 60) * wordsPerMinute);
  const step = (seconds * 1000) / count;
  return Array.from({ length: count }, (_, index) => ({
    text: "word",
    start: Math.round(index * step),
    end: Math.round(index * step + step * 0.6),
  }));
}

describe("normalizeSpeech", () => {
  it("strips punctuation so complexity phrasings normalize identically", () => {
    expect(normalizeSpeech("O(n) time")).toBe("o n time");
    expect(normalizeSpeech("c + + and  c#")).toBe("c and c");
  });
});

describe("scoreRubric", () => {
  const weak = scoreRubric("yeah i dunno, maybe just loop over stuff");

  it("starts empty", () => {
    expect(scoreRubric("")).toMatchObject({ coveredCount: 0, percent: 0 });
    expect(weak.missing).toHaveLength(5);
  });

  it("credits each rubric step independently", () => {
    const result = scoreRubric(
      "So the problem is finding duplicates. My approach is a hash set. To clarify, values can repeat. That is O(n) time and O(n) space. Edge case: empty input."
    );
    const covered = result.scores.filter(score => score.covered).map(s => s.id);
    expect(covered).toContain("clarify");
    expect(covered).toContain("approach");
    expect(covered).toContain("data-structure");
    expect(covered).toContain("complexity");
    expect(covered).toContain("edge-cases");
    expect(result.percent).toBe(100);
  });

  it("detects complexity phrased as words rather than notation", () => {
    const result = scoreRubric("that is constant time and constant space");
    const complexity = result.scores.find(s => s.id === "complexity");
    expect(complexity?.covered).toBe(true);
  });

  it("reports which dimension a phrase satisfied", () => {
    const result = scoreRubric("I'd use a linked list with two pointers");
    const structures = result.scores.find(s => s.id === "data-structure");
    expect(structures?.covered).toBe(true);
    expect(structures?.matchedSignal).toBeTruthy();
  });

  it("does not credit a step the candidate never reached", () => {
    const result = scoreRubric("I would use a hash map to store the values");
    expect(result.scores.find(s => s.id === "complexity")?.covered).toBe(false);
    expect(result.scores.find(s => s.id === "data-structure")?.covered).toBe(true);
  });

  it("merges per-question signal overrides into the global signals", () => {
    const withoutOverride = scoreRubric("I would use a lookup table");
    expect(
      withoutOverride.scores.find(s => s.id === "data-structure")?.covered
    ).toBe(false);

    const withOverride = scoreRubric("I would use a lookup table", {
      "data-structure": ["lookup table"],
    });
    expect(
      withOverride.scores.find(s => s.id === "data-structure")?.matchedSignal
    ).toBe("lookup table");
  });

  it("stays consistent no matter how the transcript is punctuated or cased", () => {
    const messy = scoreRubric("MY APPROACH?? A HashMap, Big-O, edge cases!");
    const tidy = scoreRubric("my approach a hashmap big o edge cases");
    expect(messy.percent).toBe(tidy.percent);
  });
});

describe("analyzeDelivery", () => {
  it("returns zeroes for an empty answer", () => {
    expect(analyzeDelivery([])).toMatchObject({
      wordCount: 0,
      wordsPerMinute: 0,
      fillerCount: 0,
      longestPauseMs: 0,
    });
  });

  it("computes words per minute from word timestamps", () => {
    const words = wordsOver(30, 150);
    const metrics = analyzeDelivery(words);
    expect(metrics.wordCount).toBe(75);
    expect(metrics.wordsPerMinute).toBeGreaterThanOrEqual(140);
    expect(metrics.wordsPerMinute).toBeLessThanOrEqual(160);
  });

  it("counts multi-word fillers as a single hit", () => {
    const words: TimedWord[] = "um so uh the like answer you know".split(" ").map(
      (text, index) => ({ text, start: index * 100, end: index * 100 + 60 })
    );
    const metrics = analyzeDelivery(words);
    // um, uh, like and "you know" — the two-word filler must not score twice.
    expect(metrics.fillerCount).toBe(4);
    expect(metrics.topFillers).toHaveLength(3);
  });

  it("surfaces a repeated filler in the top list", () => {
    const words: TimedWord[] = "um um so you know and um".split(" ").map(
      (text, index) => ({ text, start: index * 100, end: index * 100 + 60 })
    );
    const metrics = analyzeDelivery(words);
    expect(metrics.fillerCount).toBe(4);
    expect(metrics.topFillers[0]).toEqual({ word: "um", count: 3 });
  });

  it("does not count a filler substring inside a longer word", () => {
    const words: TimedWord[] = "summary album likeness".split(" ").map(
      (text, index) => ({ text, start: index * 100, end: index * 100 + 60 })
    );
    expect(analyzeDelivery(words).fillerCount).toBe(0);
  });

  it("finds the longest pause between words", () => {
    const words: TimedWord[] = [
      { text: "hello", start: 0, end: 400 },
      { text: "there", start: 6_000, end: 6_500 },
      { text: "friend", start: 6_800, end: 7_200 },
    ];
    expect(analyzeDelivery(words).longestPauseMs).toBe(5_600);
  });

  it("flags rambling pace and heavy filler use", () => {
    const fast: TimedWord[] = Array.from({ length: 100 }, (_, index) => ({
      text: index % 3 === 0 ? "um" : "word",
      start: index * 150,
      end: index * 150 + 100,
    }));
    const metrics = analyzeDelivery(fast);
    expect(metrics.wordsPerMinute).toBeGreaterThan(300);
    expect(metrics.notes.join(" ")).toMatch(/wpm/);
  });

  it("stays quiet on very short answers", () => {
    const metrics = analyzeDelivery(
      "hash map".split(" ").map((text, index) => ({
        text,
        start: index * 200,
        end: index * 200 + 150,
      }))
    );
    expect(metrics.notes).toHaveLength(0);
  });
});
