import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  InterviewDifficulty,
  InterviewQuestion,
  InterviewSummary,
} from "@shared/types";
import {
  RUBRIC_DIMENSIONS,
  type RubricDimensionId,
} from "@shared/rubric";
import { trpc } from "@/lib/trpc";
import {
  Check,
  Gauge,
  Keyboard,
  Loader2,
  Mic,
  MicOff,
  Radio,
  Send,
  Sparkles,
  Volume2,
  Waves,
  X,
} from "lucide-react";
import { toast } from "sonner";
import InterviewSetup, { type InterviewSettings } from "@/pages/InterviewSetup";
import SummaryPanel, {
  type QuestionResult,
} from "@/pages/InterviewSummary";
import { useVoiceStream, type MergedTurn } from "@/hooks/useVoiceStream";

type ChatMessage = { role: "assistant" | "user"; content: string };
type Phase = "setup" | "interview" | "summary";

const DEFAULT_SETTINGS: InterviewSettings = {
  topics: [],
  difficulty: "mixed",
  count: 5,
};

/** Below this we assume the mic simply did not pick anything up. */
const MIN_ANSWER_WORDS = 6;
/** How long a candidate may talk before we probe for a missing rubric step. */
const RAMBLE_LIMIT_MS = 55_000;
/** Most valuable thing to prompt for when someone talks but never analyses. */
const PROBE_PRIORITY: RubricDimensionId[] = [
  "complexity",
  "data-structure",
  "edge-cases",
  "approach",
];

function VoiceOrb({
  listening,
  speaking,
  thinking,
}: {
  listening: boolean;
  speaking: boolean;
  thinking: boolean;
}) {
  return (
    <div
      className={`relative flex h-52 w-52 items-center justify-center rounded-full transition-all duration-700 sm:h-60 sm:w-60 ${listening ? "scale-105" : "scale-100"}`}
    >
      <div
        className={`absolute inset-0 rounded-full border transition-all duration-700 ${listening ? "animate-[pulse_2.2s_ease-in-out_infinite] border-[#d8f97a]/35 bg-[#d8f97a]/[0.035]" : "border-white/[0.07] bg-white/[0.015]"}`}
      />
      <div
        className={`absolute inset-8 rounded-full border transition-all duration-700 ${listening ? "border-[#d8f97a]/25" : "border-white/[0.07]"}`}
      />
      <div
        className={`absolute inset-16 rounded-full transition-all duration-500 ${speaking ? "scale-110 bg-[#ff8f70]/15" : thinking ? "bg-[#82a9ff]/15" : listening ? "bg-[#d8f97a]/10" : "bg-white/[0.04]"}`}
      />
      <div
        className={`relative flex h-24 w-24 items-center justify-center rounded-full shadow-[0_0_70px_rgba(216,249,122,0.12)] transition-all duration-500 sm:h-28 sm:w-28 ${speaking ? "bg-[#ff8f70] text-[#241417]" : thinking ? "bg-[#82a9ff] text-[#0d1526]" : "bg-[#d8f97a] text-[#101724]"}`}
      >
        {speaking ? (
          <Volume2 className="h-9 w-9" />
        ) : thinking ? (
          <Loader2 className="h-9 w-9 animate-spin" />
        ) : listening ? (
          <Waves className="h-9 w-9" />
        ) : (
          <Sparkles className="h-9 w-9" />
        )}
      </div>
    </div>
  );
}

/**
 * Live amplitude bars driven by the real RMS of the incoming audio frames, so
 * the orb reacts to the actual voice rather than a looping animation.
 */
function LiveWaveform({ levels }: { levels: number[] }) {
  return (
    <div className="flex h-11 items-center justify-center gap-1">
      {levels.map((level, index) => (
        <span
          key={index}
          className="w-1 rounded-full bg-[#d8f97a] transition-[height] duration-100"
          style={{
            height: `${Math.max(4, Math.min(42, level * 260))}px`,
            opacity: 0.35 + level * 0.65,
          }}
        />
      ))}
    </div>
  );
}

const DIFFICULTY_STYLE: Record<InterviewDifficulty, string> = {
  easy: "border-[#57d6a7]/30 bg-[#57d6a7]/10 text-[#57d6a7]",
  medium: "border-[#ffd47a]/30 bg-[#ffd47a]/10 text-[#ffd47a]",
  hard: "border-[#ff8f70]/30 bg-[#ff8f70]/10 text-[#ff8f70]",
};

function QuestionCard({
  question,
  index,
  total,
}: {
  question: InterviewQuestion;
  index: number;
  total: number;
}) {
  const progress = Math.round(((index + 1) / total) * 100);
  return (
    <div className="w-full max-w-[680px] rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 text-left sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#d8f97a]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d8f97a]">
            {question.topic}
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${DIFFICULTY_STYLE[question.difficulty]}`}
          >
            {question.difficulty}
          </span>
        </div>
        <span className="font-mono text-[11px] text-white/40">
          {index + 1} / {total}
        </span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-[#d8f97a] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-4 font-display text-[17px] font-medium leading-7 text-white/90 sm:text-lg">
        {question.prompt}
      </p>
    </div>
  );
}

/**
 * The live rubric. This is the core of the product: each box fills in real time
 * as the candidate demonstrates that step, so both they and the interviewer can
 * see what has not been said yet.
 */
function RubricMeter({
  coverage,
  active,
}: {
  coverage: ReturnType<typeof useVoiceStream>["coverage"];
  active: boolean;
}) {
  return (
    <div className="w-full max-w-[680px] rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-left sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">
          Answer structure
        </span>
        <span
          className={`font-mono text-[11px] ${coverage.percent === 100 ? "text-[#57d6a7]" : "text-white/45"}`}
        >
          {coverage.coveredCount}/{coverage.total}
        </span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-[#d8f97a] transition-all duration-500"
          style={{ width: `${coverage.percent}%` }}
        />
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {coverage.scores.map(score => (
          <li
            key={score.id}
            title={score.description}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition-all duration-300 ${
              score.covered
                ? "border-[#57d6a7]/25 bg-[#57d6a7]/[0.07] text-[#57d6a7]"
                : active
                  ? "border-white/[0.08] bg-white/[0.02] text-white/30"
                  : "border-white/[0.05] bg-transparent text-white/20"
            }`}
          >
            <span
              className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] ${
                score.covered ? "bg-[#57d6a7]/20" : "bg-white/[0.07]"
              }`}
            >
              {score.covered ? <Check className="h-2.5 w-2.5" /> : ""}
            </span>
            <span className="truncate">{score.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DeliveryTicker({
  turn,
  active,
}: {
  turn: MergedTurn;
  active: boolean;
}) {
  const { metrics } = turn;
  if (!active || metrics.wordCount < 3) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[10px] text-white/35">
      <span className="flex items-center gap-1 rounded-full border border-white/[0.08] px-2 py-0.5">
        <Gauge className="h-3 w-3" /> {metrics.wordsPerMinute} wpm
      </span>
      <span className="rounded-full border border-white/[0.08] px-2 py-0.5">
        {metrics.fillerCount} filler
        {metrics.fillerCount === 1 ? "" : "s"}
      </span>
      <span className="rounded-full border border-white/[0.08] px-2 py-0.5">
        {Math.round(turn.elapsedMs / 1000)}s
      </span>
    </div>
  );
}

export default function Home() {
  const startMutation = trpc.interview.start.useMutation();
  const answerMutation = trpc.interview.answer.useMutation();
  const streamTokenMutation = trpc.interview.streamToken.useMutation();

  const speakingRef = useRef(false);
  const respondingRef = useRef(false);
  const startedRef = useRef(false);
  const finalizingRef = useRef(false);
  const probedRef = useRef<Set<RubricDimensionId>>(new Set());
  const levelsRef = useRef<number[]>([]);

  const settingsRef = useRef<InterviewSettings>(DEFAULT_SETTINGS);
  const questionsRef = useRef<InterviewQuestion[]>([]);
  const questionIndexRef = useRef(0);
  const resultsRef = useRef<QuestionResult[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);

  const [phase, setPhase] = useState<Phase>("setup");
  const [settings, setSettings] = useState<InterviewSettings>(DEFAULT_SETTINGS);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [summary, setSummary] = useState<InterviewSummary | null>(null);

  const [started, setStarted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [responding, setResponding] = useState(false);
  const [muted, setMuted] = useState(false);
  const [typeMode, setTypeMode] = useState(false);
  const [typed, setTyped] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: 11 }, () => 0)
  );
  const [coaching, setCoaching] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean | null>(null);
  const [micDenied, setMicDenied] = useState<string | null>(null);

  const [turn, setTurn] = useState<MergedTurn | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);
  useEffect(() => {
    questionIndexRef.current = questionIndex;
  }, [questionIndex]);
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const getToken = useCallback(async () => {
    const result = await streamTokenMutation.mutateAsync({});
    if (!result.enabled) {
      throw new Error(result.reason ?? "Real-time voice is not configured.");
    }
    return { token: result.token };
  }, [streamTokenMutation]);

  const voice = useVoiceStream({
    getToken,
    onPartial: snapshot => {
      setTurn(snapshot);
      setMicDenied(null);
    },
    onTurnEnd: snapshot => {
      setTurn(snapshot);
      void handleTurnEnd(snapshot);
    },
    onLevel: rms => {
      levelsRef.current = [...levelsRef.current.slice(1), rms];
      setLevels(levelsRef.current);
    },
    onError: message => {
      if (/permission|denied|NotAllowed/i.test(message)) {
        setMicDenied(
          "Microphone access was blocked. Allow it in your browser, or use the Type button."
        );
      } else if (!/not configured/i.test(message)) {
        toast.error(message);
      }
    },
  });

  const listening = voice.isListening;
  const coverage = useMemo(
    () => turn?.coverage ?? voice.coverage,
    [turn, voice.coverage]
  );

  const lastAssistantText = useCallback(() => {
    const found = [...messagesRef.current]
      .reverse()
      .find(message => message.role === "assistant");
    return found?.content ?? "";
  }, []);

  /**
   * Speak a line and then hand control to the caller. This is the single
   * place the interview hands off between the interviewer and the candidate,
   * which is what keeps the mic from hearing the interviewer.
   */
  const speak = useCallback(
    (text: string, after?: () => void) => {
      window.speechSynthesis?.cancel();
      speakingRef.current = false;
      setSpeaking(false);

      if (!("speechSynthesis" in window) || muted || !text) {
        after?.();
        return;
      }

      speakingRef.current = true;
      setSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.98;
      utterance.pitch = 1.02;
      utterance.onend = () => {
        speakingRef.current = false;
        setSpeaking(false);
        if (startedRef.current) after?.();
      };
      window.speechSynthesis.speak(utterance);
    },
    [muted]
  );

  const openMic = useCallback(() => {
    if (!startedRef.current || respondingRef.current) return;
    finalizingRef.current = false;
    setCoaching(null);
    void voice.begin(lastAssistantText());
  }, [lastAssistantText, voice]);

  const completeInterview = useCallback(
    (closing: string, summaryResult: InterviewSummary) => {
      startedRef.current = false;
      voice.abort();
      setStarted(false);
      setMessages(current => [
        ...current,
        { role: "assistant", content: closing },
      ]);
      setSummary(summaryResult);
      setPhase("summary");
      speak(closing);
    },
    [speak, voice]
  );

  const grade = useCallback(
    async (answerText: string, answerTurn: MergedTurn | null, skipped: boolean) => {
      const question = questionsRef.current[questionIndexRef.current];
      if (!question || respondingRef.current) return;
      if (!skipped && answerText.trim().split(/\s+/).length < 2) return;

      respondingRef.current = true;
      setResponding(true);

      if (!skipped) {
        setMessages(current => [
          ...current,
          { role: "user", content: answerText },
        ]);
      }

      try {
        const result = await answerMutation.mutateAsync({
          questionId: question.id,
          questionIndex: questionIndexRef.current,
          count: questionsRef.current.length,
          difficulty: settingsRef.current.difficulty,
          answer: skipped ? "I'll pass on this one." : answerText,
          skipped,
          transcript: messagesRef.current.slice(-8),
          // Feed the rubric gaps back to the grader so the follow-up targets
          // whatever the candidate structurally left out.
          missingRubric: skipped ? [] : (answerTurn?.coverage.missing ?? []),
          delivery: skipped
            ? null
            : {
                wordsPerMinute: answerTurn?.metrics.wordsPerMinute ?? 0,
                fillerRate: answerTurn?.metrics.fillerRate ?? 0,
                longestPauseMs: answerTurn?.metrics.longestPauseMs ?? 0,
              },
          history: resultsRef.current.map(r => ({
            questionId: r.question.id,
            status: r.evaluation.status,
            score: r.evaluation.score,
          })),
        });

        const evaluation = result.evaluation;
        const nextResults: QuestionResult[] = [
          ...resultsRef.current,
          {
            question,
            evaluation,
            coverage: answerTurn?.coverage ?? null,
            delivery: answerTurn?.metrics ?? null,
            transcript: answerText,
          },
        ];
        resultsRef.current = nextResults;
        setResults(nextResults);

        if (result.summary) {
          completeInterview(evaluation.feedback, result.summary);
          return;
        }

        const nextIndex = questionIndexRef.current + 1;
        const nextQuestion = questionsRef.current[nextIndex];
        questionIndexRef.current = nextIndex;
        setQuestionIndex(nextIndex);
        setTurn(null);
        voice.reset();

        setMessages(current => [
          ...current,
          { role: "assistant", content: evaluation.feedback },
          ...(nextQuestion
            ? [{ role: "assistant" as const, content: nextQuestion.prompt }]
            : []),
        ]);

        if (nextQuestion) {
          speak(`${evaluation.feedback} ${nextQuestion.prompt}`, openMic);
        } else {
          speak(evaluation.feedback, openMic);
        }
      } catch {
        const fallback =
          "That answer is worth exploring more. Describe your data structure, then weigh the time and space trade-offs.";
        setMessages(current => [
          ...current,
          { role: "assistant", content: fallback },
        ]);
        speak(fallback, openMic);
        toast.error("I couldn't reach the grader. Carry on with a guided question.");
      } finally {
        respondingRef.current = false;
        setResponding(false);
      }
    },
    [answerMutation, completeInterview, openMic, speak, voice]
  );

  /**
   * The coach decision. AssemblyAI tells us when the candidate stopped talking,
   * and by then we know whether they actually said enough and how well it was
   * structured. Too thin or too unstructured and we probe instead of grading.
   */
  const handleTurnEnd = useCallback(
    async (snapshot: MergedTurn) => {
      if (respondingRef.current || finalizingRef.current) return;
      finalizingRef.current = true;
      voice.abort();

      const words = snapshot.metrics.wordCount;
      const spokenFor = snapshot.elapsedMs;

      if (words < MIN_ANSWER_WORDS || spokenFor < 2500) {
        probedRef.current.clear();
        const nudge =
          words === 0
            ? "I didn't catch anything. Take a breath and walk me through your first instinct."
            : "Go on — I want the full picture before I score that.";
        setCoaching("Waiting for a fuller answer");
        speak(nudge, openMic);
        return;
      }

      const missing = snapshot.coverage.missing;
      if (missing.length > 0 && words < 14 && snapshot.coverage.percent < 40) {
        const dimension = PROBE_PRIORITY.find(id => missing.includes(id));
        const probe =
          dimension !== undefined
            ? RUBRIC_DIMENSIONS.find(item => item.id === dimension)?.probe
            : null;
        if (probe && dimension !== undefined) {
          probedRef.current.add(dimension);
          setCoaching("Coaching");
          speak(probe, openMic);
          return;
        }
      }

      probedRef.current.clear();
      await grade(snapshot.text, snapshot, false);
    },
    [grade, openMic, speak, voice]
  );

  /**
   * Ramble guard. If the candidate keeps talking past the limit without ever
   * analysing, interrupt and ask for the missing step rather than letting the
   * answer wander.
   */
  useEffect(() => {
    if (!listening || respondingRef.current || speakingRef.current) return;

    const timer = window.setInterval(() => {
      if (!startedRef.current || finalizingRef.current) return;

      const snapshot = voice.turn;
      if (snapshot.elapsedMs < RAMBLE_LIMIT_MS) return;
      if (snapshot.metrics.wordCount < 15) return;

      const target = PROBE_PRIORITY.find(
        id =>
          snapshot.coverage.missing.includes(id) && !probedRef.current.has(id)
      );
      if (!target) return;

      const probe = RUBRIC_DIMENSIONS.find(item => item.id === target)?.probe;
      if (!probe) return;

      probedRef.current.add(target);
      finalizingRef.current = true;
      voice.abort();
      setCoaching("Interrupting to coach");
      speak(
        snapshot.elapsedMs > RAMBLE_LIMIT_MS * 1.8
          ? `Let me stop you there. ${probe}`
          : probe,
        openMic
      );
    }, 500);

    return () => window.clearInterval(timer);
  }, [listening, openMic, speak, voice]);

  const startSession = useCallback(
    async (nextSettings: InterviewSettings) => {
      setSettings(nextSettings);
      try {
        const result = await startMutation.mutateAsync(nextSettings);
        questionsRef.current = result.questions;
        questionIndexRef.current = 0;
        resultsRef.current = [];
        setQuestions(result.questions);
        setQuestionIndex(0);
        setResults([]);
        setMessages([{ role: "assistant", content: result.intro }]);
        setSummary(null);
        setTypeMode(false);
        setTyped("");
        setTurn(null);
        setCoaching(null);
        voice.reset();
        setPhase("interview");
        startedRef.current = true;
        setStarted(true);

        // Probe whether real-time voice is available before promising it.
        void streamTokenMutation
          .mutateAsync({})
          .then(token => setVoiceEnabled(token.enabled))
          .catch(() => setVoiceEnabled(false));

        speak(result.intro, openMic);
      } catch {
        toast.error("Couldn't book the interviewer. Please try again.");
      }
    },
    [openMic, speak, startMutation, streamTokenMutation, voice]
  );

  const stopSession = useCallback(() => {
    startedRef.current = false;
    finalizingRef.current = false;
    voice.abort();
    window.speechSynthesis?.cancel();
    speakingRef.current = false;
    setStarted(false);
    setSpeaking(false);
    setResponding(false);
    setCoaching(null);
    setTurn(null);
  }, [voice]);

  const toggleListening = () => {
    if (!startedRef.current || respondingRef.current) return;
    if (speaking) {
      window.speechSynthesis?.cancel();
      speakingRef.current = false;
      setSpeaking(false);
    }
    if (listening) {
      finalizingRef.current = true;
      void voice.end().then(snapshot => {
        finalizingRef.current = false;
        void handleTurnEnd(snapshot);
      });
    } else {
      openMic();
    }
  };

  const skipQuestion = () => {
    if (!startedRef.current || respondingRef.current) return;
    finalizingRef.current = true;
    voice.abort();
    setTurn(null);
    voice.reset();
    void grade("", null, true);
  };

  const submitTyped = () => {
    const trimmed = typed.trim();
    if (!trimmed || !startedRef.current || respondingRef.current) return;
    setTyped("");
    setTypeMode(false);
    finalizingRef.current = true;
    voice.abort();
    setTurn(null);
    voice.reset();
    void grade(trimmed, null, false);
  };

  useEffect(() => () => stopSession(), [stopSession]);

  const currentQuestion = questions[questionIndex];
  const latestResult = results[results.length - 1];

  const statusLabel = responding
    ? "Grading against the rubric…"
    : speaking
      ? "Your interviewer is responding…"
      : listening
        ? turn?.text
          ? "Listening — keep going."
          : "I'm listening. Take your time."
        : "Press the mic to answer, or type below.";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090f19] text-white">
      <style>{`@keyframes voiceBar { from { transform: scaleY(.45); opacity: .55 } to { transform: scaleY(1); opacity: 1 } }`}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(216,249,122,0.075),transparent_27%),radial-gradient(circle_at_50%_100%,rgba(130,169,255,0.05),transparent_33%)]" />
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-10 sm:py-7">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-[#d8f97a] text-[#101724]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="font-display text-[15px] font-semibold tracking-[-0.02em]">
              intervue
            </div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-white/30">
              spoken technical screen
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] px-3 py-1.5 text-[10px] text-white/35 sm:flex">
            <span
              className={`h-1.5 w-1.5 rounded-full ${phase === "interview" ? "bg-[#d8f97a] shadow-[0_0_10px_#d8f97a]" : "bg-white/25"}`}
            />
            {phase === "interview"
              ? started
                ? "Private voice room"
                : "Connecting…"
              : phase === "summary"
                ? "Screen complete"
                : "Ready to practice"}
          </div>
          {phase === "interview" && (
            <button
              onClick={() => {
                stopSession();
                setPhase("setup");
              }}
              className="flex items-center gap-2 rounded-full border border-[#ff8f70]/25 px-3 py-1.5 text-[10px] text-[#ffad9a] transition hover:bg-[#ff8f70]/10"
            >
              <X className="h-3 w-3" /> End
            </button>
          )}
        </div>
      </header>

      {phase === "summary" && summary && (
        <SummaryPanel
          results={results}
          summary={summary}
          onRestart={() => {
            void startSession(settings);
          }}
          onSettings={() => setPhase("setup")}
        />
      )}

      {phase === "setup" && (
        <InterviewSetup
          defaultSettings={settings}
          loading={startMutation.isPending}
          voiceReady={voiceEnabled}
          onStart={nextSettings => {
            void startSession(nextSettings);
          }}
        />
      )}

      {phase === "interview" && currentQuestion && (
        <section className="relative z-10 mx-auto flex min-h-[calc(100vh-92px)] w-full max-w-[760px] flex-col items-center px-5 pb-10 pt-4 sm:pt-8">
          <QuestionCard
            question={currentQuestion}
            index={questionIndex}
            total={questions.length}
          />

          {latestResult && (
            <div className="mt-3 flex w-full max-w-[680px] items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${latestResult.evaluation.status === "correct" ? "bg-[#57d6a7]/15 text-[#57d6a7]" : latestResult.evaluation.status === "partial" ? "bg-[#ffd47a]/15 text-[#ffd47a]" : "bg-[#ff8f70]/15 text-[#ff8f70]"}`}
              >
                <Check className="h-3 w-3" />
              </span>
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                  Coach note · {latestResult.evaluation.score}/100
                  {latestResult.coverage
                    ? ` · structure ${latestResult.coverage.percent}%`
                    : ""}
                </div>
                <p className="mt-1 text-[13px] leading-5 text-white/75">
                  {latestResult.evaluation.feedback}
                </p>
                {latestResult.evaluation.hint && (
                  <p className="mt-1 text-[12px] italic leading-5 text-[#ffd47a]/80">
                    {latestResult.evaluation.hint}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-3 w-full">
            <RubricMeter coverage={coverage} active={listening} />
          </div>

          <div className="mt-6">
            <VoiceOrb
              listening={listening}
              speaking={speaking}
              thinking={responding}
            />
          </div>
          <div className="mt-4">
            <LiveWaveform levels={levels} />
          </div>

          {coaching && (
            <div className="mt-1 flex items-center gap-1.5 rounded-full border border-[#82a9ff]/25 bg-[#82a9ff]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#82a9ff]">
              <Sparkles className="h-3 w-3" /> {coaching}
            </div>
          )}

          <div className="mt-3 flex min-h-[52px] max-w-[620px] flex-col items-center justify-center text-center">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/25">
              {responding
                ? "Intervue"
                : speaking
                  ? "Intervue"
                  : listening
                    ? "You"
                    : "Conversation"}
            </div>
            {responding ? (
              <p className="mt-1 font-mono text-[12px] text-white/55">
                {statusLabel}
              </p>
            ) : (
              <p className="mt-1 max-w-[560px] text-[14px] leading-6 text-white/70">
                {listening && turn?.text
                  ? turn.text
                  : speaking
                    ? latestResult?.evaluation.feedback || statusLabel
                    : statusLabel}
              </p>
            )}
          </div>

          <DeliveryTicker turn={turn ?? voice.turn} active={listening} />

          {micDenied && (
            <p className="mt-3 max-w-[520px] rounded-xl border border-[#ff8f70]/20 bg-[#ff8f70]/[0.06] px-4 py-2 text-center text-[12px] text-[#ffad9a]">
              {micDenied}
            </p>
          )}

          <div className="mt-5 flex items-center gap-2.5">
            <button
              onClick={toggleListening}
              className="flex items-center gap-2 rounded-full border border-[#d8f97a]/25 bg-[#d8f97a]/10 px-4 py-2 text-[11px] font-semibold text-[#d8f97a] transition hover:bg-[#d8f97a]/20"
            >
              {listening ? (
                <MicOff className="h-3.5 w-3.5" />
              ) : (
                <Mic className="h-3.5 w-3.5" />
              )}
              {listening ? "Stop mic" : "Answer"}
            </button>
            <button
              onClick={skipQuestion}
              disabled={responding}
              className="flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-2 text-[11px] font-semibold text-white/60 transition hover:bg-white/[0.06] disabled:opacity-40"
            >
              Skip
            </button>
            <button
              onClick={() => setTypeMode(value => !value)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold transition ${typeMode ? "border-[#82a9ff]/40 bg-[#82a9ff]/15 text-[#82a9ff]" : "border-white/[0.1] bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"}`}
            >
              <Keyboard className="h-3.5 w-3.5" /> Type
            </button>
            <button
              onClick={() => {
                setMuted(value => !value);
                if (!muted) window.speechSynthesis?.cancel();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03] text-white/50 transition hover:bg-white/[0.06]"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? (
                <MicOff className="h-3.5 w-3.5 text-[#ff8f70]" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {typeMode && (
            <div className="mt-4 flex w-full max-w-[560px] items-end gap-2">
              <textarea
                value={typed}
                onChange={event => setTyped(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey))
                    submitTyped();
                }}
                rows={2}
                placeholder="Type your answer, then hit send — I'll grade it aloud…"
                className="flex-1 resize-none rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-[13px] leading-5 text-white/85 outline-none placeholder:text-white/30 focus:border-[#d8f97a]/40"
              />
              <button
                onClick={submitTyped}
                disabled={!typed.trim() || responding}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8f97a] text-[#101724] transition hover:brightness-105 disabled:opacity-40"
              >
                {responding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          )}

          <div className="mt-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/25">
            <Radio className="h-3 w-3" />{" "}
            {started ? "Live technical screen" : "Preparing…"}
          </div>
        </section>
      )}
    </main>
  );
}
