/**
 * AudioWorklet processor that converts raw microphone audio into the mono
 * 16-bit PCM frames AssemblyAI's streaming API expects.
 *
 * The worklet runs on the audio rendering thread, so it must be plain JS with no
 * imports. Shipping it as a source string and loading it from a Blob URL keeps
 * it out of the bundler's module graph, which means the same code path works in
 * dev, in the Vite production build, and behind any CDN.
 */

/** AssemblyAI wants chunks between 50ms and 1000ms. 100ms is a safe middle. */
export const CHUNK_MS = 100;

export const PCM_WORKLET_SOURCE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.targetRate = opts.targetRate || 16000;
    this.samplesPerChunk = Math.round((opts.chunkMs || 100) * this.targetRate / 1000);
    // Fractional when the browser ignores our requested sample rate (e.g. 44100).
    this.ratio = sampleRate / this.targetRate;
    this.out = new Float32Array(this.samplesPerChunk);
    this.outLen = 0;
    this.acc = 0;
    this.accCount = 0;
  }

  flush() {
    if (this.outLen === 0) return;
    const pcm = new Int16Array(this.outLen);
    for (let i = 0; i < this.outLen; i++) {
      const s = Math.max(-1, Math.min(1, this.out[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    this.outLen = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) {
      // Box-filter while decimating so downsampling does not alias.
      this.acc += channel[i];
      this.accCount += 1;
      if (this.accCount >= this.ratio) {
        this.out[this.outLen++] = this.acc / this.accCount;
        this.acc = 0;
        this.accCount = 0;
        if (this.outLen >= this.samplesPerChunk) this.flush();
      }
    }
    return true;
  }
}

registerProcessor('pcm-capture', PcmCaptureProcessor);
`;

let workletLoaded = false;

/**
 * Create an AudioContext already running the PCM capture worklet. Requesting a
 * 16 kHz context means the worklet's resampling ratio is 1 on browsers that
 * honour it, but the worklet still handles the case where they do not.
 */
export async function createPcmCaptureContext(
  targetRate = 16_000
): Promise<AudioContext> {
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextCtor) {
    throw new Error("This browser does not support the Web Audio API.");
  }

  const context = new AudioContextCtor({ sampleRate: targetRate });

  if (!workletLoaded) {
    const blob = new Blob([PCM_WORKLET_SOURCE], {
      type: "application/javascript",
    });
    const url = URL.createObjectURL(blob);
    try {
      await context.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    workletLoaded = true;
  }

  return context;
}
