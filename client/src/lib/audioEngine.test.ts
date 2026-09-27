import { describe, expect, it } from "vitest";
import { CHUNK_MS, PCM_WORKLET_SOURCE } from "./audioEngine";

/**
 * Runs the actual AudioWorklet source against a stubbed Web Audio global, so the
 * resampling and PCM conversion that ships to the browser are covered by tests
 * rather than only by a manual microphone check.
 */
type ProcessorInstance = {
  port: { messages: ArrayBuffer[] };
  process: (inputs: unknown[]) => boolean;
};

/**
 * Runs the actual AudioWorklet source against a stubbed Web Audio global, so the
 * resampling and PCM conversion that ships to the browser are covered by tests
 * rather than only by a manual microphone check.
 */
function loadProcessor(sourceSampleRate: number, targetRate: number) {
  const registry: Record<string, new (options?: unknown) => ProcessorInstance> =
    {};

  class AudioWorkletProcessorStub {
    port = {
      messages: [] as ArrayBuffer[],
      postMessage(data: ArrayBuffer) {
        this.messages.push(data);
      },
    };
  }

  const registerProcessor = (name: string, ctor: unknown) => {
    registry[name] = ctor as new (options?: unknown) => ProcessorInstance;
  };

  // The worklet reads `sampleRate`, `AudioWorkletProcessor` and
  // `registerProcessor` as free globals, exactly as it does in a browser.
  const load = new Function(
    "sampleRate",
    "AudioWorkletProcessor",
    "registerProcessor",
    PCM_WORKLET_SOURCE
  ) as (
    sampleRate: number,
    stub: unknown,
    register: unknown
  ) => void;

  load(sourceSampleRate, AudioWorkletProcessorStub, registerProcessor);

  return new registry["pcm-capture"]!({
    processorOptions: { targetRate, chunkMs: CHUNK_MS },
  });
}

describe("pcm capture worklet", () => {
  it("emits 16-bit frames of the requested chunk length", () => {
    const sourceRate = 16_000;
    const processor = loadProcessor(sourceRate, 16_000);

    // One 128-frame render quantum at a time, like the real audio thread.
    const frames = Math.round((CHUNK_MS * sourceRate) / 1000);
    for (let rendered = 0; rendered < frames; rendered += 128) {
      const quantum = new Float32Array(128).fill(0.5);
      processor.process([[quantum]]);
    }

    expect(processor.port.messages).toHaveLength(1);
    const samples = new Int16Array(processor.port.messages[0]!);
    expect(samples).toHaveLength(frames);
    // 0.5 full-scale should land near half of Int16 max.
    expect(samples[0]).toBeGreaterThan(15_000);
    expect(samples[0]).toBeLessThan(17_000);
  });

  it("decimates a 48 kHz source down to 16 kHz", () => {
    const processor = loadProcessor(48_000, 16_000);

    const frames = Math.round((CHUNK_MS * 16_000) / 1000);
    const sourceFrames = (frames * 48_000) / 16_000;
    for (let rendered = 0; rendered < sourceFrames; rendered += 128) {
      const quantum = new Float32Array(128).fill(0.5);
      processor.process([[quantum]]);
    }

    expect(processor.port.messages).toHaveLength(1);
    const samples = new Int16Array(processor.port.messages[0]!);
    expect(samples).toHaveLength(frames);
  });

  it("clamps out-of-range samples instead of wrapping", () => {
    const processor = loadProcessor(16_000, 16_000);

    for (let rendered = 0; rendered < 1600; rendered += 128) {
      const quantum = new Float32Array(128).fill(3);
      processor.process([[quantum]]);
    }

    const samples = new Int16Array(processor.port.messages[0]!);
    for (const sample of samples) {
      expect(sample).toBeLessThanOrEqual(32_767);
      expect(sample).toBeGreaterThanOrEqual(-32_768);
    }
  });

  it("tolerates a render quantum with no input channel", () => {
    const processor = loadProcessor(16_000, 16_000);

    expect(processor.process([[]])).toBe(true);
    expect(processor.process([undefined as never])).toBe(true);
    expect(processor.port.messages).toHaveLength(0);
  });
});
