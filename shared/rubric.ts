/**
 * The verbal-screening rubric.
 *
 * Most candidates fail a spoken technical screen not because they do not know
 * the algorithm, but because they cannot articulate it out loud under pressure.
 * Correctness alone is therefore a poor signal, so we score the *structure* of
 * the answer while the candidate is still speaking.
 *
 * These five dimensions mirror how technical screeners are actually coached:
 * clarify, approach, data structure, complexity, edge cases. The client scores
 * them live from AssemblyAI's immutable transcript, which means the interviewer
 * can see what the candidate has missed and probe for it mid-conversation.
 */

export type RubricDimensionId =
  | "clarify"
  | "approach"
  | "data-structure"
  | "complexity"
  | "edge-cases";

export type RubricDimension = {
  id: RubricDimensionId;
  label: string;
  /** What a strong answer does at this step. */
  description: string;
  /** What the interviewer says if the candidate never reaches this step. */
  probe: string;
  signals: string[];
};

/**
 * Normalize speech for substring matching. Strips punctuation so that "O(n)"
 * and "O of N" both reduce to comparable token sequences, and so that
 * transcription artefacts ("c + +") do not break a match.
 */
export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const RUBRIC_DIMENSIONS: RubricDimension[] = [
  {
    id: "clarify",
    label: "Clarify",
    description:
      "Confirms the problem before solving, or asks a sharp question",
    probe: "Before you go further — restate the problem in your own words.",
    signals: [
      "to clarify",
      "just to confirm",
      "let me make sure i",
      "am i understanding",
      "so the problem is",
      "so we're given",
      "so we are given",
      "restating the",
      "can i ask",
      "what happens if",
      "so the input is",
      "so the task is",
      "if i understand",
      "my understanding is",
      "so essentially the",
    ],
  },
  {
    id: "approach",
    label: "Approach",
    description: "States a high-level plan before reaching for code",
    probe: "What's your high-level approach before you write anything?",
    signals: [
      "my approach",
      "the approach",
      "i would start",
      "i'd start",
      "i would first",
      "i'd first",
      "the plan",
      "i'll walk",
      "i will walk",
      "high level",
      "my plan",
      "one way to",
      "so first",
      "the idea is",
      "i'd go with",
      "i would go with",
    ],
  },
  {
    id: "data-structure",
    label: "Data structure",
    description: "Names a concrete structure and says why it fits",
    probe: "Which data structure are you reaching for, and why that one?",
    signals: [
      "hash map",
      "hashmap",
      "hash set",
      "hashset",
      "dictionary",
      "array",
      "linked list",
      "stack",
      "queue",
      "heap",
      "binary tree",
      "graph",
      "matrix",
      "trie",
      "counter",
      "pointer",
      "recursion",
      "recursively",
      "dynamic programming",
      "sliding window",
      "two pointers",
      "binary search",
      "sort",
      "sorting",
      "map",
      "set",
      "list",
    ],
  },
  {
    id: "complexity",
    label: "Complexity",
    description: "States the time and space cost out loud",
    probe: "Give me the time and space complexity.",
    signals: [
      "o of n",
      "o n",
      "o n log n",
      "o one",
      "o 1",
      "big o",
      "time complexity",
      "space complexity",
      "constant time",
      "linear time",
      "logarithmic",
      "quadratic",
      "runtime is",
      "runs in",
      "n log n",
    ],
  },
  {
    id: "edge-cases",
    label: "Edge cases",
    description: "Acknowledges edge cases, assumptions or trade-offs",
    probe: "What breaks in that solution, and how would you handle it?",
    signals: [
      "edge case",
      "corner case",
      "empty",
      "null",
      "negative",
      "duplicate",
      "overflow",
      "what if",
      "assume",
      "assumption",
      "trade-off",
      "tradeoff",
      "downside",
      "correctness",
      "invariant",
      "in place",
      "without extra space",
      "not allowed",
      "handles",
      "handle the case",
    ],
  },
];

/** Per-question overrides, keyed by dimension. Extend the global signals. */
export type RubricOverrides = Partial<Record<RubricDimensionId, string[]>>;

export type RubricScore = {
  id: RubricDimensionId;
  label: string;
  description: string;
  probe: string;
  covered: boolean;
  matchedSignal: string | null;
};

export type RubricCoverage = {
  scores: RubricScore[];
  coveredCount: number;
  total: number;
  percent: number;
  missing: RubricDimensionId[];
};

function matchSignals(
  haystack: string,
  signals: string[]
): string | null {
  for (const signal of signals) {
    if (haystack.includes(normalizeSpeech(signal))) return signal;
  }
  return null;
}

/**
 * Score the rubric against everything the candidate has said so far. Cheap
 * enough to call on every streaming transcript update.
 */
export function scoreRubric(
  transcript: string,
  overrides?: RubricOverrides
): RubricCoverage {
  const haystack = normalizeSpeech(transcript);

  const scores: RubricScore[] = RUBRIC_DIMENSIONS.map(dimension => {
    const signals = [
      ...dimension.signals,
      ...(overrides?.[dimension.id] ?? []),
    ];
    const matched = matchSignals(haystack, signals);
    return {
      id: dimension.id,
      label: dimension.label,
      description: dimension.description,
      probe: dimension.probe,
      covered: matched !== null,
      matchedSignal: matched,
    };
  });

  const coveredCount = scores.filter(score => score.covered).length;

  return {
    scores,
    coveredCount,
    total: scores.length,
    percent: Math.round((coveredCount / scores.length) * 100),
    missing: scores
      .filter(score => !score.covered)
      .map(score => score.id),
  };
}

/* ------------------------------------------------------------------ */
/* Delivery telemetry                                                  */
/* ------------------------------------------------------------------ */

export const FILLER_WORDS = [
  "um",
  "uh",
  "erm",
  "ah",
  "hmm",
  "like",
  "you know",
  "i mean",
  "sort of",
  "kind of",
  "basically",
  "actually",
  "literally",
];

/** Below this a candidate is likely panicking; above it, rambling. */
export const HEALTHY_WPM_RANGE = { min: 120, max: 175 };

export type TimedWord = {
  text: string;
  start: number;
  end: number;
};

export type DeliveryMetrics = {
  wordCount: number;
  durationSeconds: number;
  wordsPerMinute: number;
  fillerCount: number;
  /** Fillers per 100 words. */
  fillerRate: number;
  longestPauseMs: number;
  topFillers: { word: string; count: number }[];
  /** Human-readable notes surfaced in the report card. */
  notes: string[];
};

/**
 * Measure *how* the answer was delivered, using AssemblyAI's word-level
 * timestamps. This is the part a correctness score can never tell you, and it
 * is where most real interview rejections actually come from.
 */
export function analyzeDelivery(words: TimedWord[]): DeliveryMetrics {
  if (words.length === 0) {
    return {
      wordCount: 0,
      durationSeconds: 0,
      wordsPerMinute: 0,
      fillerCount: 0,
      fillerRate: 0,
      longestPauseMs: 0,
      topFillers: [],
      notes: [],
    };
  }

  const start = words[0]!.start;
  const end = words[words.length - 1]!.end;
  const durationMs = Math.max(1, end - start);
  const durationSeconds = durationMs / 1000;
  const wordCount = words.length;

  const wordsPerMinute = Math.round(
    (wordCount / durationMs) * 60_000
  );

  const spoken = normalizeSpeech(words.map(word => word.text).join(" "));

  // Match fillers as token n-grams rather than substrings: adjacent repeats
  // ("um, um, so…") must each count, and multi-word fillers ("you know") must
  // only count once per occurrence.
  const tokens = spoken.split(" ").filter(Boolean);

  const counts = new Map<string, number>();
  for (const filler of FILLER_WORDS) {
    const needle = normalizeSpeech(filler).split(" ").filter(Boolean);
    if (needle.length === 0) continue;

    let count = 0;
    for (let start = 0; start + needle.length <= tokens.length; start += 1) {
      let matched = true;
      for (let offset = 0; offset < needle.length; offset += 1) {
        if (tokens[start + offset] !== needle[offset]) {
          matched = false;
          break;
        }
      }
      if (matched) count += 1;
    }
    if (count > 0) counts.set(filler, count);
  }

  const fillerCount = Array.from(counts.values()).reduce(
    (a, b) => a + b,
    0
  );
  const fillerRate = Number(((fillerCount / wordCount) * 100).toFixed(1));

  let longestPauseMs = 0;
  for (let index = 1; index < words.length; index += 1) {
    const gap = words[index]!.start - words[index - 1]!.end;
    if (gap > longestPauseMs) longestPauseMs = Math.round(gap);
  }

  const topFillers = Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const notes: string[] = [];

  if (wordCount >= 20) {
    if (wordsPerMinute > HEALTHY_WPM_RANGE.max) {
      notes.push(
        `You spoke at ${wordsPerMinute} wpm — fast enough to sound panicked. Slow down on the first sentence.`
      );
    } else if (wordsPerMinute < HEALTHY_WPM_RANGE.min) {
      notes.push(
        `You spoke at ${wordsPerMinute} wpm, which reads as uncertain. Commit to an answer faster.`
      );
    }

    if (fillerRate > 4) {
      notes.push(
        `${fillerCount} filler${fillerCount === 1 ? "" : "s"} per 100 words. Replace them with a short pause — it reads as thinking, not stalling.`
      );
    } else if (fillerRate <= 1 && wordCount >= 30) {
      notes.push(
        "Your delivery was clean — almost no filler words. That reads as confidence."
      );
    }

    if (longestPauseMs > 4000) {
      notes.push(
        `Your longest pause was ${(longestPauseMs / 1000).toFixed(1)}s. Think out loud during silence instead of going quiet.`
      );
    }
  }

  return {
    wordCount,
    durationSeconds: Number(durationSeconds.toFixed(1)),
    wordsPerMinute,
    fillerCount,
    fillerRate,
    longestPauseMs,
    topFillers,
    notes,
  };
}
