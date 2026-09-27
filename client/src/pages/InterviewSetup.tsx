import { useState, type ReactNode } from "react";
import { Brain, Gauge, ListFilter, Loader2, Mic } from "lucide-react";

export type InterviewSettings = {
  topics: string[];
  difficulty: "easy" | "medium" | "hard" | "mixed";
  count: number;
};

export const INTERVIEW_TOPICS = [
  "Arrays & Hashing",
  "Strings",
  "Linked Lists",
  "Trees & Graphs",
  "Dynamic Programming",
  "Sorting & Searching",
  "Recursion & Backtracking",
  "Problem Solving",
];

const DIFFICULTY_OPTIONS: {
  value: InterviewSettings["difficulty"];
  label: string;
}[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "mixed", label: "Mixed" },
];

const COUNT_OPTIONS = [3, 5, 7];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-xs font-medium transition-all ${
        active
          ? "border-transparent bg-[#d8f97a] text-[#101724] shadow-[0_0_0_1px_rgba(216,249,122,0.4)]"
          : "border-white/[0.1] bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white/80"
      }`}
    >
      {children}
    </button>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 text-left sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-white/[0.06] text-[#d8f97a]">
          {icon}
        </div>
        <div>
          <div className="font-display text-sm font-semibold text-white">
            {title}
          </div>
          <div className="text-[11px] text-white/40">{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function InterviewSetup({
  defaultSettings,
  loading,
  onStart,
}: {
  defaultSettings: InterviewSettings;
  loading: boolean;
  onStart: (settings: InterviewSettings) => void;
}) {
  const [topics, setTopics] = useState<string[]>(defaultSettings.topics);
  const [difficulty, setDifficulty] = useState<InterviewSettings["difficulty"]>(
    defaultSettings.difficulty
  );
  const [count, setCount] = useState<number>(defaultSettings.count);

  const toggleTopic = (topic: string) => {
    setTopics(current =>
      current.includes(topic)
        ? current.filter(t => t !== topic)
        : current.length >= 5
          ? current
          : [...current, topic]
    );
  };

  const canStart = count >= 1 && count <= 10;

  return (
    <section className="relative z-10 mx-auto flex min-h-[calc(100vh-92px)] w-full max-w-[560px] flex-col items-center px-5 pb-8 pt-10 sm:pt-14">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-[#d8f97a]">
        <Brain className="h-3.5 w-3.5" /> HackerRank-style practice screen
      </div>
      <h1 className="mt-4 text-center font-display text-3xl font-medium leading-tight tracking-[-0.05em] text-white sm:text-4xl">
        Talk through a live
        <br className="hidden sm:block" /> technical interview.
      </h1>
      <p className="mt-4 max-w-[430px] text-center text-[13px] leading-6 text-white/40">
        A voice interviewer reads you algorithm and data-structure questions,
        grades your reasoning out loud, and keeps the interview moving. No code
        editor — just think and speak.
      </p>

      <div className="mt-9 flex w-full flex-col gap-4 sm:gap-5">
        <Section
          icon={<ListFilter className="h-4 w-4" />}
          title="Topics"
          subtitle="Pick up to five. Leave empty for a general screen."
        >
          <div className="flex flex-wrap gap-2">
            {INTERVIEW_TOPICS.map(topic => (
              <Chip
                key={topic}
                active={topics.includes(topic)}
                onClick={() => toggleTopic(topic)}
              >
                {topic}
              </Chip>
            ))}
          </div>
        </Section>

        <Section
          icon={<Gauge className="h-4 w-4" />}
          title="Difficulty"
          subtitle="Mixed ramps easy → medium → hard like a real screen."
        >
          <div className="flex flex-wrap gap-2">
            {DIFFICULTY_OPTIONS.map(option => (
              <Chip
                key={option.value}
                active={difficulty === option.value}
                onClick={() => setDifficulty(option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section
          icon={<Mic className="h-4 w-4" />}
          title="Questions"
          subtitle="Three is a warm-up. Seven is closer to a full loop."
        >
          <div className="flex gap-2">
            {COUNT_OPTIONS.map(value => (
              <Chip
                key={value}
                active={count === value}
                onClick={() => setCount(value)}
              >
                {value} questions
              </Chip>
            ))}
          </div>
        </Section>
      </div>

      <button
        type="button"
        disabled={!canStart || loading}
        onClick={() => onStart({ topics, difficulty, count })}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-[#d8f97a] px-8 py-3.5 text-sm font-semibold text-[#101724] shadow-[0_0_40px_rgba(216,249,122,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        {loading ? "Booking the interviewer…" : "Start voice interview"}
      </button>
      <p className="mt-3 text-[11px] text-white/30">
        Mic input works best in Chrome or Edge. Wear headphones if you can.
      </p>
    </section>
  );
}
