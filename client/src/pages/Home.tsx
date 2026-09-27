import { useCallback, useEffect, useRef, useState } from "react";
import type {
  InterviewDifficulty,
  InterviewQuestion,
  InterviewSummary,
} from "@shared/types";
import { trpc } from "@/lib/trpc";
import {
  Check,
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
import SummaryPanel, { type QuestionResult } from "@/pages/InterviewSummary";

type ChatMessage = { role: "assistant" | "user"; content: string };
type Phase = "setup" | "interview" | "summary";

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const DEFAULT_SETTINGS: InterviewSettings = {
  topics: [],
  difficulty: "mixed",
  count: 5,
};

function VoiceOrb({
  listening,
  speaking,
}: {
  listening: boolean;
  speaking: boolean;
}) {
  return (
    <div
      className={`relative flex h-56 w-56 items-center justify-center rounded-full transition-all duration-700 sm:h-64 sm:w-64 ${listening ? "scale-105" : "scale-100"}`}
    >
      <div
        className={`absolute inset-0 rounded-full border transition-all duration-700 ${listening ? "animate-[pulse_2.2s_ease-in-out_infinite] border-[#d8f97a]/35 bg-[#d8f97a]/[0.035]" : "border-white/[0.07] bg-white/[0.015]"}`}
      />
      <div
        className={`absolute inset-8 rounded-full border transition-all duration-700 ${listening ? "border-[#d8f97a]/25" : "border-white/[0.07]"}`}
      />
      <div
        className={`absolute inset-16 rounded-full transition-all duration-500 ${speaking ? "scale-110 bg-[#ff8f70]/15" : listening ? "bg-[#d8f97a]/10" : "bg-white/[0.04]"}`}
      />
      <div
        className={`relative flex h-24 w-24 items-center justify-center rounded-full shadow-[0_0_70px_rgba(216,249,122,0.12)] transition-all duration-500 sm:h-28 sm:w-28 ${speaking ? "bg-[#ff8f70] text-[#241417]" : "bg-[#d8f97a] text-[#101724]"}`}
      >
        {speaking ? (
          <Volume2 className="h-9 w-9" />
        ) : listening ? (
          <Waves className="h-9 w-9" />
        ) : (
          <Sparkles className="h-9 w-9" />
        )}
      </div>
    </div>
  );
}

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex h-8 items-center justify-center gap-1.5 opacity-80">
      {[12, 24, 36, 18, 30, 44, 25, 39, 17, 29, 12].map((height, index) => (
        <span
          key={index}
          className={`w-1 rounded-full transition-all duration-300 ${active ? "bg-[#d8f97a]" : "bg-white/20"}`}
          style={{
            height: active ? `${height}px` : "5px",
            animation: active
              ? `voiceBar 900ms ease-in-out ${index * 70}ms infinite alternate`
              : "none",
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

const DEFAULT_FALLBACK =
  "Good attempt. Let's sharpen your reasoning — name the data structure, then the time and space complexity.";

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

export default function Home() {
  const startMutation = trpc.interview.start.useMutation();
  const answerMutation = trpc.interview.answer.useMutation();

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldListenRef = useRef(false);
  const speakingRef = useRef(false);
  const respondingRef = useRef(false);
  const startedRef = useRef(false);
  const noSpeechTimerRef = useRef<number | null>(null);

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
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [responding, setResponding] = useState(false);
  const [muted, setMuted] = useState(false);
  const [typeMode, setTypeMode] = useState(false);
  const [typed, setTyped] = useState("");
  const [interim, setInterim] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastHeard, setLastHeard] = useState("");

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

  const speak = useCallback(
    (text: string, resumeListening = true) => {
      if (!("speechSynthesis" in window) || muted) {
        if (resumeListening) shouldListenRef.current = true;
        return;
      }
      window.speechSynthesis.cancel();
      shouldListenRef.current = false;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.98;
      utterance.pitch = 1.02;
      utterance.onstart = () => {
        speakingRef.current = true;
        setSpeaking(true);
        setListening(false);
      };
      utterance.onend = () => {
        speakingRef.current = false;
        setSpeaking(false);
        if (resumeListening && startedRef.current)
          shouldListenRef.current = true;
      };
      window.speechSynthesis.speak(utterance);
    },
    [muted]
  );

  const clearNoSpeechTimer = useCallback(() => {
    if (noSpeechTimerRef.current !== null) {
      window.clearTimeout(noSpeechTimerRef.current);
      noSpeechTimerRef.current = null;
    }
  }, []);

  const completeInterview = useCallback(
    (feedbackText: string, summaryResult: InterviewSummary) => {
      clearNoSpeechTimer();
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      startedRef.current = false;
      setStarted(false);
      setListening(false);
      setInterim("");
      setMessages(current => [
        ...current,
        { role: "assistant", content: feedbackText },
        { role: "assistant", content: summaryResult.closing },
      ]);
      setSummary(summaryResult);
      setPhase("summary");
      speak(summaryResult.closing, false);
    },
    [clearNoSpeechTimer, speak]
  );

  const respond = useCallback(
    async (text: string, skipped = false) => {
      const clean = text.trim();
      if (!clean && !skipped) return;
      if (respondingRef.current) return;
      const question = questionsRef.current[questionIndexRef.current];
      if (!question) return;

      respondingRef.current = true;
      setResponding(true);
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;

      if (!skipped) {
        setLastHeard(clean);
        setInterim("");
        setMessages(current => [...current, { role: "user", content: clean }]);
      }

      try {
        const result = await answerMutation.mutateAsync({
          questionId: question.id,
          questionIndex: questionIndexRef.current,
          count: questionsRef.current.length,
          difficulty: settingsRef.current.difficulty,
          answer: skipped ? "I'll pass on this one." : clean,
          skipped,
          transcript: messagesRef.current.slice(-8),
          history: resultsRef.current.map(r => ({
            questionId: r.question.id,
            status: r.evaluation.status,
            score: r.evaluation.score,
          })),
        });

        const evaluation = result.evaluation;
        resultsRef.current = [...resultsRef.current, { question, evaluation }];
        setResults(resultsRef.current);

        if (result.summary) {
          completeInterview(evaluation.feedback, result.summary);
          return;
        }

        const nextIndex = questionIndexRef.current + 1;
        const nextQuestion = questionsRef.current[nextIndex];
        questionIndexRef.current = nextIndex;
        setQuestionIndex(nextIndex);

        setMessages(current => [
          ...current,
          { role: "assistant", content: evaluation.feedback },
        ]);
        if (nextQuestion) {
          setMessages(current => [
            ...current,
            { role: "assistant", content: nextQuestion.prompt },
          ]);
          speak(`${evaluation.feedback} ${nextQuestion.prompt}`);
        } else {
          speak(evaluation.feedback);
        }
      } catch {
        const fallback =
          "That answer is worth exploring more. Describe your data structure, then weigh the time and space trade-offs.";
        setMessages(current => [
          ...current,
          { role: "assistant", content: fallback },
        ]);
        speak(fallback);
        toast.error(
          "I couldn't reach the grader. Keep going — I'll carry on with a guided question."
        );
      } finally {
        respondingRef.current = false;
        setResponding(false);
      }
    },
    [answerMutation, completeInterview, speak]
  );

  const beginListening = useCallback(() => {
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      toast.info(
        "Voice input is not supported in this browser. Try Chrome or Edge, or type your answer."
      );
      return;
    }
    if (
      recognitionRef.current ||
      speakingRef.current ||
      respondingRef.current ||
      !startedRef.current
    )
      return;
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => {
      setListening(true);
      clearNoSpeechTimer();
      noSpeechTimerRef.current = window.setTimeout(() => {
        if (
          recognitionRef.current !== recognition ||
          respondingRef.current ||
          speakingRef.current
        )
          return;
        shouldListenRef.current = false;
        recognition.stop();
        setListening(false);
        setInterim("");
        const nudge =
          "No problem. Take your time — walk me through your approach when you're ready.";
        setMessages(current => [
          ...current,
          { role: "assistant", content: nudge },
        ]);
        speak(nudge, true);
      }, 20000);
    };
    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      clearNoSpeechTimer();
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const transcript = event.results[index][0].transcript;
        if (event.results[index].isFinal) finalText += transcript;
        else interimText += transcript;
      }
      setInterim(interimText || finalText);
      if (finalText.trim()) {
        shouldListenRef.current = false;
        void respond(finalText);
      }
    };
    recognition.onerror = (event: any) => {
      clearNoSpeechTimer();
      recognitionRef.current = null;
      setListening(false);
      const alreadyResponding = respondingRef.current;
      if (
        event?.error === "no-speech" ||
        event?.error === "aborted" ||
        alreadyResponding
      ) {
        shouldListenRef.current = startedRef.current;
        return;
      }
      shouldListenRef.current = false;
      toast.error("I couldn't hear that. Please try again.");
    };
    recognition.onend = () => {
      clearNoSpeechTimer();
      recognitionRef.current = null;
      setListening(false);
      setInterim("");
      if (
        shouldListenRef.current &&
        startedRef.current &&
        !speakingRef.current &&
        !respondingRef.current
      ) {
        window.setTimeout(() => {
          if (
            shouldListenRef.current &&
            startedRef.current &&
            !recognitionRef.current &&
            !respondingRef.current
          )
            beginListening();
        }, 350);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  }, [clearNoSpeechTimer, respond, speak]);

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
        setPhase("interview");
        startedRef.current = true;
        shouldListenRef.current = true;
        setStarted(true);
        speak(result.intro, true);
      } catch {
        toast.error("Couldn't book the interviewer. Please try again.");
      }
    },
    [speak, startMutation]
  );

  const stopSession = useCallback(() => {
    clearNoSpeechTimer();
    startedRef.current = false;
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    window.speechSynthesis?.cancel();
    setStarted(false);
    setListening(false);
    setSpeaking(false);
    setResponding(false);
    setInterim("");
  }, [clearNoSpeechTimer]);

  const toggleListening = () => {
    if (!startedRef.current) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      speakingRef.current = false;
    }
    if (listening) {
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
    } else {
      shouldListenRef.current = true;
      beginListening();
    }
  };

  const skipQuestion = () => {
    if (startedRef.current && !respondingRef.current) void respond("", true);
  };

  const submitTyped = () => {
    const trimmed = typed.trim();
    if (!trimmed || !startedRef.current) return;
    setTyped("");
    void respond(trimmed);
  };

  useEffect(() => {
    if (
      phase === "interview" &&
      started &&
      !speaking &&
      !responding &&
      shouldListenRef.current &&
      !recognitionRef.current
    ) {
      const timer = window.setTimeout(() => {
        if (
          startedRef.current &&
          !speakingRef.current &&
          !respondingRef.current &&
          shouldListenRef.current &&
          !recognitionRef.current
        )
          beginListening();
      }, 420);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [beginListening, phase, responding, speaking, started]);

  useEffect(() => () => stopSession(), [stopSession]);

  const currentQuestion = questions[questionIndex];
  const latestResult = results[results.length - 1];
  const latestAssistant =
    [...messages].reverse().find(message => message.role === "assistant")
      ?.content || "";

  const statusLabel = responding
    ? "Weighing your answer against the rubric…"
    : speaking
      ? "Your interviewer is responding…"
      : listening
        ? "I'm listening. Take your time."
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
              hackerrank voice interview
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
            <div className="mt-4 flex w-full max-w-[680px] items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-left">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${latestResult.evaluation.status === "correct" ? "bg-[#57d6a7]/15 text-[#57d6a7]" : latestResult.evaluation.status === "partial" ? "bg-[#ffd47a]/15 text-[#ffd47a]" : "bg-[#ff8f70]/15 text-[#ff8f70]"}`}
              >
                <Check className="h-3 w-3" />
              </span>
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                  Coach note · {latestResult.evaluation.score}/100
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

          <div className="mt-8">
            <VoiceOrb listening={listening} speaking={speaking} />
          </div>
          <div className="mt-5 h-11">
            <Waveform active={listening || speaking || responding} />
          </div>

          <div className="mt-4 flex min-h-[52px] max-w-[620px] flex-col items-center justify-center text-center">
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
              <p className="mt-1 max-w-[520px] text-[14px] leading-6 text-white/70">
                {interim ||
                  (speaking
                    ? latestAssistant
                    : listening
                      ? "Go ahead — walk me through your reasoning."
                      : statusLabel)}
              </p>
            )}
          </div>

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
              Skip question
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
                placeholder="Type your answer here, then hit send — the interviewer will read and grade it aloud…"
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
