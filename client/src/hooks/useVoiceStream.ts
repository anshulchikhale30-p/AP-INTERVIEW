import { useCallback, useEffect, useRef, useState } from "react";
import {
  AssemblyAiStream,
  type StreamStatus,
} from "@/lib/assemblyaiStream";
import {
  analyzeDelivery,
  scoreRubric,
  type DeliveryMetrics,
  type RubricCoverage,
  type RubricOverrides,
  type TimedWord,
} from "@shared/rubric";

export type MergedTurn = {
  text: string;
  words: TimedWord[];
  metrics: DeliveryMetrics;
  coverage: RubricCoverage;
  /** Wall-clock milliseconds the candidate spent on this answer, gaps included. */
  elapsedMs: number;
};

type Options = {
  getToken: () => Promise<{ token: string }>;
  overrides?: RubricOverrides;
  /** Fired on every transcript update, including partials. */
  onPartial?: (turn: MergedTurn) => void;
  /** Fired when AssemblyAI signals the candidate finished their turn. */
  onTurnEnd?: (turn: MergedTurn) => void;
  onError?: (message: string) => void;
  onIdle?: (turn: MergedTurn) => void;
  /** RMS of the newest audio chunk, 0..1. */
  onLevel?: (rms: number) => void;
};

const EMPTY_COVERAGE = scoreRubric("");

/**
 * Wraps AssemblyAI's streaming session in the vocabulary of an interview turn.
 *
 * The interesting part is segment merging. When the coach interrupts to probe
 * a missing rubric element, the live session is closed and a new one opened,
 * which would otherwise throw away everything the candidate already said. So
 * every session's words are kept and re-based onto a single continuous timeline
 * before the turn is handed back, meaning delivery metrics survive interruption.
 */
export function useVoiceStream(options: Options) {
  const streamRef = useRef<AssemblyAiStream | null>(null);
  const segmentsRef = useRef<TimedWord[][]>([[]]);
  const offsetRef = useRef(0);
  const startedAtRef = useRef(0);
  const overridesRef = useRef<RubricOverrides | undefined>(undefined);
  const optionsRef = useRef(options);

  optionsRef.current = options;
  overridesRef.current = options.overrides;

  const [status, setStatus] = useState<StreamStatus>("idle");
  const [turn, setTurn] = useState<MergedTurn>(() => buildTurn([], 0));

  function buildTurn(words: TimedWord[], elapsedMs: number): MergedTurn {
    const text = words.map(word => word.text).join(" ").replace(/\s+/g, " ").trim();
    return {
      text,
      words,
      metrics: analyzeDelivery(words),
      coverage: scoreRubric(text, overridesRef.current),
      elapsedMs,
    };
  }

  const publish = useCallback((elapsedMs: number) => {
    const next = buildTurn(segmentsRef.current.flat(), elapsedMs);
    setTurn(next);
    return next;
  }, []);

  const reset = useCallback(() => {
    segmentsRef.current = [[]];
    offsetRef.current = 0;
    setTurn(buildTurn([], 0));
  }, []);

  /** Open a fresh AssemblyAI session that appends onto the current answer. */
  const begin = useCallback(
    async (agentContext?: string) => {
      if (streamRef.current?.isActive) return;

      const segmentStart = offsetRef.current;
      const wordsInSegment: TimedWord[] = [];
      segmentsRef.current.push(wordsInSegment);
      startedAtRef.current = performance.now();

      const stream = new AssemblyAiStream();
      streamRef.current = stream;

      const currentTurn = () =>
        publish(Math.round(performance.now() - startedAtRef.current));

      await stream.start({
        getToken: () => optionsRef.current.getToken(),
        agentContext,
        onStatusChange: setStatus,
        onLevel: rms => optionsRef.current.onLevel?.(rms),
        onError: message => optionsRef.current.onError?.(message),
        onTurn: event => {
          // AssemblyAI transcripts are immutable, so the last word is the
          // authoritative timeline. Re-base onto this segment's offset.
          wordsInSegment.length = 0;
          for (const word of event.words) {
            wordsInSegment.push({
              text: word.text,
              start: segmentStart + word.start,
              end: segmentStart + word.end,
            });
          }
          const snapshot = currentTurn();
          optionsRef.current.onPartial?.(snapshot);

          if (event.endOfTurn) {
            optionsRef.current.onTurnEnd?.(snapshot);
          }
        },
        onClose: () => {
          if (streamRef.current === stream) {
            setStatus("idle");
            streamRef.current = null;
          }
        },
      });

      if (stream.status === "error") {
        // Drop the empty segment so a failed attempt does not leave a gap.
        if (wordsInSegment.length === 0) segmentsRef.current.pop();
      }
    },
    [publish]
  );

  /** Close the current session, returning the fully merged answer. */
  const end = useCallback(async (): Promise<MergedTurn> => {
    const elapsed = Math.round(performance.now() - startedAtRef.current);
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) await stream.stop();

    const words = segmentsRef.current.flat();
    offsetRef.current = words.length
      ? words[words.length - 1]!.end
      : offsetRef.current;
    return publish(elapsed);
  }, [publish]);

  /** Tear everything down without producing a turn. */
  const abort = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.abort();
    setStatus("idle");
  }, []);

  useEffect(
    () => () => {
      streamRef.current?.abort();
      streamRef.current = null;
    },
    []
  );

  return {
    status,
    isListening: status === "listening" || status === "connecting",
    isFinishing: status === "finishing",
    turn,
    /** Live text only, for the caption line. */
    transcript: turn.text,
    coverage: turn.coverage || EMPTY_COVERAGE,
    metrics: turn.metrics,
    begin,
    end,
    abort,
    reset,
  };
}
