import { createPcmCaptureContext, CHUNK_MS } from "./audioEngine";
import type { TimedWord } from "@shared/rubric";

const ENDPOINT = "wss://streaming.assemblyai.com/v3/ws";
const SAMPLE_RATE = 16_000;
const SPEECH_MODEL = "universal-3-6-pro";

/** Technical vocabulary we want the model to stop mangling. */
const KEYTERMS = [
  "hash map",
  "hash set",
  "hashmap",
  "two pointers",
  "linked list",
  "binary search",
  "sliding window",
  "dynamic programming",
  "big O",
  "time complexity",
  "space complexity",
  "recursion",
  "backtracking",
  "complement",
  "stack",
  "heap",
  "prefix sum",
  "prefix sums",
  "bit manipulation",
  "divide and conquer",
  "in place",
  "edge case",
  "sorted array",
  "integer overflow",
  "array",
  "BFS",
  "DFS",
];

export type StreamStatus =
  | "idle"
  | "requesting-token"
  | "connecting"
  | "listening"
  | "finishing"
  | "error";

/** Root-mean-square of a PCM16 frame, normalized to 0..1. */
function rms(frame: ArrayBuffer): number {
  const samples = new Int16Array(frame);
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index]! / 0x8000;
    sum += value * value;
  }
  return Math.sqrt(sum / samples.length);
}

export type TurnEvent = {
  transcript: string;
  words: TimedWord[];
  endOfTurn: boolean;
  endOfTurnConfidence: number | null;
};

type StartOptions = {
  /** Mint a single-use token for this session. */
  getToken: () => Promise<{ token: string }>;
  /** The interviewer's last spoken line, fed back as decoding context. */
  agentContext?: string;
  onTurn: (event: TurnEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError: (message: string) => void;
  onStatusChange?: (status: StreamStatus) => void;
  /** RMS of the latest audio chunk, 0..1, for driving a real waveform. */
  onLevel?: (rms: number) => void;
};

/**
 * One AssemblyAI streaming session = one candidate answer.
 *
 * We deliberately open a session per answer rather than keeping one socket open
 * for the whole interview. Two reasons: the mic is not sampling while the
 * interviewer is speaking (so no echo bleed into the transcript), and streaming
 * is billed per session duration, so a long interview costs only as much audio
 * as the candidate actually spoke. It also gives every answer its own zeroed
 * word timeline, which is what the delivery metrics are computed against.
 */
export class AssemblyAiStream {
  private socket: WebSocket | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;
  private options: StartOptions | null = null;
  private finished = false;
  private closed = false;

  status: StreamStatus = "idle";

  get isActive() {
    return this.status === "listening" || this.status === "connecting";
  }

  private setStatus(status: StreamStatus) {
    this.status = status;
    this.options?.onStatusChange?.(status);
  }

  async start(options: StartOptions) {
    if (this.isActive) return;
    this.options = options;
    this.finished = false;
    this.closed = false;

    try {
      this.setStatus("requesting-token");
      const { token } = await options.getToken();

      this.setStatus("connecting");
      this.context = await createPcmCaptureContext(SAMPLE_RATE);
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      await this.openSocket(token, options.agentContext);

      this.source = this.context.createMediaStreamSource(this.mediaStream);
      this.node = new AudioWorkletNode(this.context, "pcm-capture", {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        processorOptions: { targetRate: SAMPLE_RATE, chunkMs: CHUNK_MS },
      });
      this.node.port.onmessage = event => {
        const frame = event.data as ArrayBuffer;
        if (this.socket?.readyState === WebSocket.OPEN) {
          this.socket.send(frame);
        }
        options.onLevel?.(rms(frame));
      };
      this.source.connect(this.node);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not start the microphone.";
      this.setStatus("error");
      this.teardown();
      options.onError(message);
    }
  }

  private openSocket(token: string, agentContext?: string) {
    return new Promise<void>((resolve, reject) => {
      const params = new URLSearchParams({
        token,
        speech_model: SPEECH_MODEL,
        sample_rate: String(SAMPLE_RATE),
        encoding: "pcm_s16le",
        include_partial_turns: "true",
        keyterms_prompt: JSON.stringify(KEYTERMS),
        // Abandoned tabs should not keep billing.
        inactivity_timeout: "45",
      });
      if (agentContext) {
        params.set("agent_context", agentContext.slice(0, 1750));
      }

      const socket = new WebSocket(`${ENDPOINT}?${params.toString()}`);
      socket.binaryType = "arraybuffer";
      this.socket = socket;

      let settled = false;

      socket.onopen = () => {
        // Authorisation happens in the handshake; audio is safe to send now.
        this.setStatus("listening");
        this.options?.onOpen?.();
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      socket.onmessage = event => {
        let message: {
          type?: string;
          error?: string;
          transcript?: string;
          end_of_turn?: boolean;
          end_of_turn_confidence?: number;
          words?: { text?: string; start?: number; end?: number }[];
        };
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }

        if (message.type === "Turn") {
          const words: TimedWord[] = (message.words ?? [])
            .filter(word => typeof word.text === "string")
            .map(word => ({
              text: word.text!,
              start: word.start ?? 0,
              end: word.end ?? 0,
            }));

          this.options?.onTurn({
            transcript: message.transcript ?? "",
            words,
            endOfTurn: message.end_of_turn === true,
            endOfTurnConfidence: message.end_of_turn_confidence ?? null,
          });
          return;
        }

        if (message.type === "Error") {
          this.options?.onError(message.error ?? "AssemblyAI stream error.");
        }
      };

      socket.onerror = () => {
        if (settled) return;
        settled = true;
        reject(new Error("Could not reach AssemblyAI's streaming endpoint."));
      };

      socket.onclose = () => {
        const wasFinishing = this.finished;
        this.teardown();
        this.options?.onClose?.();
        if (!wasFinishing) {
          this.options?.onError("The audio stream closed unexpectedly.");
        }
        if (!settled) {
          settled = true;
          reject(new Error("The audio stream closed before it opened."));
        }
      };
    });
  }

  /**
   * Tell AssemblyAI we are done, which finalises the open turn so we still get
   * the last words, then wait briefly for the server's acknowledgement before
   * dropping the socket. Skipping the wait loses the tail of the answer.
   */
  async stop() {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      this.teardown();
      return;
    }

    this.setStatus("finishing");
    this.finished = true;

    await new Promise<void>(resolve => {
      const done = setTimeout(resolve, 1500);
      socket.addEventListener(
        "close",
        () => {
          clearTimeout(done);
          resolve();
        },
        { once: true }
      );
      socket.send(JSON.stringify({ type: "Terminate" }));
    });

    // The server may acknowledge the Terminate without closing the socket, and
    // teardown only drops our reference to it, so close it explicitly.
    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      try {
        socket.close();
      } catch {
        /* already closing */
      }
    }

    this.teardown();
  }

  /** Stop the mic and socket immediately, without waiting for a final turn. */
  abort() {
    this.finished = true;
    try {
      this.socket?.close();
    } catch {
      /* already closing */
    }
    this.teardown();
  }

  private teardown() {
    this.node?.port.close();
    this.node?.disconnect();
    this.source?.disconnect();
    this.node = null;
    this.source = null;

    this.mediaStream?.getTracks().forEach(track => track.stop());
    this.mediaStream = null;

    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.socket = null;
    this.closed = true;
    this.setStatus("idle");
  }
}
