import type {
  InterviewAnswerEvaluation,
  InterviewDifficulty,
  InterviewQuestion,
  InterviewVerdict,
} from "@shared/types";

export type BankQuestion = InterviewQuestion & {
  keyPoints: string[];
  // Lowercase phrases checked by the offline heuristic grader. The LLM grader
  // ignores these and grades from `keyPoints` instead.
  signals: string[];
};

export const TOPICS = [
  "Arrays & Hashing",
  "Strings",
  "Linked Lists",
  "Trees & Graphs",
  "Dynamic Programming",
  "Sorting & Searching",
  "Recursion & Backtracking",
  "Problem Solving",
] as const;

export const DIFFICULTIES: InterviewDifficulty[] = ["easy", "medium", "hard"];

export const questionBank: BankQuestion[] = [
  // Arrays & Hashing
  {
    id: "arr-e1",
    topic: "Arrays & Hashing",
    difficulty: "easy",
    prompt:
      "Given an array of integers, every element appears twice except for one. Find that single element.",
    keyPoints: [
      "Voice a hash set or XOR approach",
      "XOR cancels pairs in O(1) space",
      "O(n) time is expected",
      "Edge case: single element array",
    ],
    signals: ["hash set", "hashset", "xor", "cancel", "o(n)", "o(1)"],
  },
  {
    id: "arr-m1",
    topic: "Arrays & Hashing",
    difficulty: "medium",
    prompt:
      "Given an integer array, return the two numbers that add up to a target. You may assume exactly one solution exists.",
    keyPoints: [
      "Hash map storing value to index while scanning",
      "Complement = target - current",
      "O(n) time, O(n) space",
      "Not reusing the same element twice",
    ],
    signals: [
      "hash map",
      "hashmap",
      "complement",
      "target",
      "dictionary",
      "map",
    ],
  },
  {
    id: "arr-h1",
    topic: "Arrays & Hashing",
    difficulty: "hard",
    prompt:
      "Given an unsorted integer array, find the length of the longest consecutive element sequence in O(n) time.",
    keyPoints: [
      "Insert all values into a hash set",
      "Only start counting from values with no left neighbor",
      "O(n) time, O(n) space",
      "Consecutive streak means +1 lookups",
    ],
    signals: ["hash set", "hashset", "set", "consecutive", "streak", "o(n)"],
  },

  // Strings
  {
    id: "str-e1",
    topic: "Strings",
    difficulty: "easy",
    prompt:
      "Write a function to check whether a given string is a valid palindrome, considering only alphanumeric characters and ignoring case.",
    keyPoints: [
      "Two pointers moving inward",
      "Filter to alphanumeric, normalize case",
      "O(n) time, O(1) extra space",
      "Handle empty or single-character strings",
    ],
    signals: [
      "two pointers",
      "pointer",
      "alphanumeric",
      "lowercase",
      "tolower",
      "isalnum",
      "palindrom",
    ],
  },
  {
    id: "str-m1",
    topic: "Strings",
    difficulty: "medium",
    prompt: "Given two strings s and t, return true if t is an anagram of s.",
    keyPoints: [
      "Character frequency counts must match",
      "Use a 26-count array or hash map",
      "Lengths must be equal",
      "O(n) time, O(1) space with fixed alphabet",
    ],
    signals: ["frequency", "count", "26", "array", "map", "anagram", "equal"],
  },
  {
    id: "str-h1",
    topic: "Strings",
    difficulty: "hard",
    prompt:
      "Given two strings s and p, return all start indices of p's anagrams in s.",
    keyPoints: [
      "Sliding window over s with fixed size of p",
      "Maintain a rolling character frequency difference",
      "O(n) with one pass over s",
      "Return the list of window start indices",
    ],
    signals: ["sliding window", "window", "frequency", "count", "index"],
  },

  // Linked Lists
  {
    id: "ll-e1",
    topic: "Linked Lists",
    difficulty: "easy",
    prompt: "Reverse a singly linked list in place.",
    keyPoints: [
      "Iterate with prev/current/next pointers",
      "Reassign current.next to prev",
      "Return the new head, formerly the tail",
      "Handle empty and single-node lists",
    ],
    signals: [
      "prev",
      "current",
      "next",
      "pointer",
      "reverse",
      "in place",
      "in-place",
      "head",
    ],
  },
  {
    id: "ll-m1",
    topic: "Linked Lists",
    difficulty: "medium",
    prompt:
      "Detect whether a linked list has a cycle, and discuss how you would find the start of the cycle.",
    keyPoints: [
      "Floyd's tortoise and hare",
      "Two pointers, fast moves twice as fast",
      "Meeting point confirms a cycle",
      "Reset one pointer to head to find cycle start",
    ],
    signals: [
      "floyd",
      "tortoise",
      "hare",
      "fast",
      "slow",
      "two pointers",
      "cycle",
      "loop",
    ],
  },
  {
    id: "ll-h1",
    topic: "Linked Lists",
    difficulty: "hard",
    prompt:
      "Given two singly linked lists that intersect, find the node where they join.",
    keyPoints: [
      "Two-pointer intersection technique",
      "Advance both pointers, swap heads on reaching null",
      "Uses length difference implicitly",
      "O(n + m) time, O(1) space",
    ],
    signals: ["two pointers", "pointer", "length", "intersect", "swap", "head"],
  },

  // Trees & Graphs
  {
    id: "tree-e1",
    topic: "Trees & Graphs",
    difficulty: "easy",
    prompt: "Given a binary tree, find its maximum depth.",
    keyPoints: [
      "Recursive post-order: 1 + max(depth of children)",
      "Or iterative level-order counting levels",
      "Base case: null node has depth 0",
    ],
    signals: ["depth", "recursive", "1 + max", "max", "level", "null"],
  },
  {
    id: "tree-m1",
    topic: "Trees & Graphs",
    difficulty: "medium",
    prompt: "Validate whether a binary tree is a valid Binary Search Tree.",
    keyPoints: [
      "Pass down allowed min/max bounds",
      "Left subtree must stay below node value",
      "Right subtree must stay above node value",
      "Compare children against bounds, not just parent",
    ],
    signals: [
      "min",
      "max",
      "bound",
      "range",
      "left",
      "right",
      "inorder",
      "subtree",
    ],
  },
  {
    id: "tree-h1",
    topic: "Trees & Graphs",
    difficulty: "hard",
    prompt:
      "Given a 2D grid of '1's and '0's, count the number of islands of connected '1's.",
    keyPoints: [
      "DFS or BFS to flood-fill each island",
      "Mark visited cells in place to avoid recursion loops",
      "Count the number of times you start a new search",
      "O(rows * cols) time",
    ],
    signals: [
      "dfs",
      "bfs",
      "flood",
      "visited",
      "grid",
      "recursion",
      "adjacent",
    ],
  },

  // Dynamic Programming
  {
    id: "dp-e1",
    topic: "Dynamic Programming",
    difficulty: "easy",
    prompt:
      "You are climbing a staircase taking 1 or 2 steps at a time. How many distinct ways can you reach the top of n steps?",
    keyPoints: [
      "This is Fibonacci-like: ways(n) = ways(n-1) + ways(n-2)",
      "Base cases: 1 step => 1, 2 steps => 2",
      "Use memoization or rolling two variables",
      "O(n) time, O(1) space with rolling variables",
    ],
    signals: [
      "fib",
      "fibonacci",
      "memo",
      "ways",
      "n-1",
      "n-2",
      "dynamic programming",
      "dp",
    ],
  },
  {
    id: "dp-m1",
    topic: "Dynamic Programming",
    difficulty: "medium",
    prompt:
      "Given an array of coins and an amount, compute the fewest coins needed to make that amount, or say it is impossible.",
    keyPoints: [
      "dp[amount] = min over coins of 1 + dp[amount - coin]",
      "Initialize dp[0] = 0 and the rest to infinity",
      "Bottom-up or top-down memoization",
      "Handle unbounded coin usage and impossible cases",
    ],
    signals: [
      "dp",
      "minimum",
      "fewest",
      "coins",
      "amount",
      "memo",
      "bottom-up",
      "bottom up",
      "infinite",
      "infinity",
    ],
  },
  {
    id: "dp-h1",
    topic: "Dynamic Programming",
    difficulty: "hard",
    prompt:
      "Given two strings, find the length of their longest common subsequence.",
    keyPoints: [
      "2D DP table over prefixes of both strings",
      "If chars match add 1 to diagonal result",
      "Otherwise take the max of the two neighbors",
      "O(n * m) time and space, can compress to one row",
    ],
    signals: [
      "dp",
      "2d",
      "two-dimensional",
      "table",
      "subsequence",
      "diagonal",
      "row",
    ],
  },

  // Sorting & Searching
  {
    id: "sort-e1",
    topic: "Sorting & Searching",
    difficulty: "easy",
    prompt:
      "Given a sorted array and a target value, return its index, or -1 if it is not present.",
    keyPoints: [
      "Binary search halves the search space",
      "Compare middle element to target",
      "O(log n) time, O(1) space",
      "Take care with low/high boundary updates",
    ],
    signals: ["binary", "mid", "half", "o(log", "low", "high", "middle"],
  },
  {
    id: "sort-m1",
    topic: "Sorting & Searching",
    difficulty: "medium",
    prompt:
      "Merge two sorted arrays in place, with the result living inside the first array which has enough trailing space.",
    keyPoints: [
      "Fill from the end backwards to avoid overwriting",
      "Compare largest elements first",
      "When one array exhausts, copy the remainder",
      "O(n + m) time, in place",
    ],
    signals: [
      "from the end",
      "backwards",
      "backward",
      "end",
      "largest",
      "in place",
      "in-place",
    ],
  },
  {
    id: "sort-h1",
    topic: "Sorting & Searching",
    difficulty: "hard",
    prompt:
      "Given an array of intervals, return the intervals where no two intervals overlap by merging any that do.",
    keyPoints: [
      "Sort intervals by start time",
      "Merge overlapping adjacent intervals in one pass",
      "Track current start and end while scanning",
      "O(n log n) time due to sorting",
    ],
    signals: ["sort", "overlap", "merge", "start", "scan", "one pass"],
  },

  // Recursion & Backtracking
  {
    id: "rec-e1",
    topic: "Recursion & Backtracking",
    difficulty: "easy",
    prompt: "Generate the first n levels of Pascal's triangle.",
    keyPoints: [
      "Each row builds from the previous row",
      "Edges are always 1",
      "Recursive or iterative both acceptable",
      "O(n^2) total cells",
    ],
    signals: ["pascal", "previous row", "row", "edge", "triangle"],
  },
  {
    id: "rec-m1",
    topic: "Recursion & Backtracking",
    difficulty: "medium",
    prompt:
      "Given a string of digits from a phone keypad, return every possible letter combination that the number could represent.",
    keyPoints: [
      "Backtracking over digit-to-letters mappings",
      "Depth-first build candidate strings",
      "Grow the string then undo on return",
      "Empty input returns an empty list",
    ],
    signals: [
      "backtrack",
      "dfs",
      "depth-first",
      "letters",
      "digit",
      "map",
      "phone",
      "keypad",
    ],
  },
  {
    id: "rec-h1",
    topic: "Recursion & Backtracking",
    difficulty: "hard",
    prompt:
      "Solve the N-Queens problem: place n queens on an n x n board so none attack another, and return all distinct configurations.",
    keyPoints: [
      "Backtracking with one queen per row",
      "Track used columns and two diagonals",
      "Check conflicts in O(1) with sets",
      "Only place queens; backtrack when blocked",
    ],
    signals: [
      "backtrack",
      "row",
      "column",
      "diagonal",
      "queen",
      "attack",
      "conflict",
    ],
  },

  // Problem Solving
  {
    id: "prob-e1",
    topic: "Problem Solving",
    difficulty: "easy",
    prompt:
      "Given a non-empty array of integers, every element appears twice except for one. In your head, walk me through both an easy and an optimal solution.",
    keyPoints: [
      "Mention hash set as the simple O(n) space approach",
      "Mention XOR as the optimal O(1) space approach",
      "Explain why XOR works on pairs",
      "Confirm on a small example",
    ],
    signals: ["hash", "xor", "o(1)", "o(n)", "pairs", "bitwise"],
  },
  {
    id: "prob-m1",
    topic: "Problem Solving",
    difficulty: "medium",
    prompt:
      "You are given an array of stock prices by day. Find the maximum profit you can make by buying once and selling once.",
    keyPoints: [
      "Track the minimum price seen so far",
      "Profit = current price - running minimum",
      "Update best profit while scanning once",
      "O(n) time, O(1) space",
    ],
    signals: [
      "min",
      "minimum",
      "price",
      "profit",
      "buy",
      "sell",
      "lowest",
      "so far",
    ],
  },
  {
    id: "prob-h1",
    topic: "Problem Solving",
    difficulty: "hard",
    prompt:
      "Given a list of meeting time intervals, determine the minimum number of conference rooms required.",
    keyPoints: [
      "Sort by start time and use a min-heap of end times",
      "Reuse a room when the earliest end time passes",
      "Answer is the size of the heap",
      "O(n log n) time",
    ],
    signals: [
      "heap",
      "priority queue",
      "end time",
      "meeting",
      "sort",
      "rooms",
      "room",
    ],
  },
];

/**
 * Offline heuristic grader — used when the LLM is unavailable (no API key) so
 * the interview still works end to end. Matches spoken answers against each
 * question's `signals` list and gives honest partial credit.
 */
export function gradeRuleBased(
  question: Pick<BankQuestion, "signals">,
  answer: string
): InterviewAnswerEvaluation {
  const text = answer
    .toLowerCase()
    .replace(/[^a-z0-9+\-^%. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = text ? text.split(" ").length : 0;

  const signals = question.signals ?? [];
  const matched = signals.filter(signal => text.includes(signal));
  const fraction = signals.length ? matched.length / signals.length : 0;
  const score = Math.min(100, Math.round(fraction * 100));

  let status: InterviewVerdict;
  if (wordCount < 6) {
    status = "incorrect";
  } else if (fraction >= 0.66) {
    status = "correct";
  } else if (fraction >= 0.4) {
    status = "partial";
  } else {
    status = "incorrect";
  }

  const feedback: Record<InterviewVerdict, string> = {
    correct: `Strong signal. You hit ${Math.max(1, matched.length)} key point${
      matched.length === 1 ? "" : "s"
    } — the interviewer heard you clearly.`,
    partial: `Good start — you are onto the right area. Make the data structure explicit, then walk through the time and space complexity out loud.`,
    incorrect:
      wordCount < 6
        ? "You didn't say much there. Take a breath and talk me through your plan one step at a time."
        : "Let's pull it back into focus. Name the data structure you would reach for first, then the approach in two or three steps.",
  };

  const unmatched = signals.find(signal => !text.includes(signal)) ?? null;
  const hint =
    status === "correct" || !unmatched
      ? null
      : `Think about ${unmatched} — that is the angle to sharpen.`;

  return { status, score, feedback: feedback[status], hint };
}

export function pickQuestions(input: {
  topics: readonly string[];
  difficulty: InterviewDifficulty | "mixed";
  count: number;
}): InterviewQuestion[] {
  const { topics, difficulty, count } = input;

  const sameTopic = questionBank.filter(
    question => topics.length === 0 || topics.includes(question.topic)
  );

  let pool =
    difficulty === "mixed"
      ? sameTopic
      : sameTopic.filter(question => question.difficulty === difficulty);

  const picked = shuffle(pool).slice(0, count);

  if (picked.length < count) {
    const remainder = shuffle(
      sameTopic.filter(question => !picked.some(p => p.id === question.id))
    ).slice(0, count - picked.length);
    picked.push(...remainder);
  }

  // Alternate difficulties for a natural "mixed" ramp.
  if (difficulty === "mixed") {
    const order: InterviewDifficulty[] = ["easy", "medium", "hard"];
    picked.sort(
      (a, b) => order.indexOf(a.difficulty) - order.indexOf(b.difficulty)
    );
  }

  const questions: InterviewQuestion[] = picked.map(question => ({
    id: question.id,
    topic: question.topic,
    difficulty: question.difficulty,
    prompt: question.prompt,
  }));

  return questions.slice(0, count);
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
