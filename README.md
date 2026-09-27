# intervue

**A voice agent that runs a real technical interview and tells you how to answer better.**

intervue asks you algorithm and data-structure questions out loud, listens while
you think out loud, and grades each answer against a five-part rubric. While you
talk it fills in a live answer meter, watches your pace and filler words, and
interrupts when your answer is drifting instead of waiting for you to finish.

Built with [AssemblyAI](https://www.assemblyai.com/) Universal-Streaming for
real-time speech-to-text with sub-second latency and server-side end-of-turn
detection.

---

## Why this exists

LeetCode-style preparation trains the *writing* of code. Real interviews test the
*explaining* of it, and almost nobody gets feedback on that part. Common feedback
is vague ("we'd like to see clearer communication") because humans cannot listen
and assess structure at the same time.

intervue closes that gap. It is not a coding sandbox. You never touch an editor.
You just talk, and it tells you specifically what was missing from your answer.

## What makes it different

**A rubric you can watch fill in.** Every answer is scored against five
dimensions a strong candidate covers: problem restatement, approach, data
structure, complexity, and edge cases. The meter updates live from the partial
transcript, so you see which part of the argument you skipped *while* you are
still talking.

**It interrupts a ramble.** If you keep talking past the limit without ever
analysing anything, the interviewer cuts in and asks for the specific step you
missed. Silence-then-lecture is a failure mode of most voice agents; this one
tries to keep you honest.

**It probes thin answers instead of grading them.** A four-word answer is not
graded, it is followed up on. A follow-up question is generated from the rubric
dimension you actually missed, not from a generic "can you elaborate?".

**Delivery is measured, not guessed.** Words per minute, filler rate and longest
pause are computed from AssemblyAI's word-level timestamps, then summarised into
concrete notes at the end.

**It keeps your key off the client.** The browser never sees the AssemblyAI
account key. The server mints a short-lived, single-use streaming token per turn.

## Architecture

```
browser (React)
  │
  │ 1. tRPC: interview.streamToken  ──▶  server
  │    ◀── single-use token (60s TTL)          │ AssemblyAI account key
  │                                             │ stays here
  │ 2. WebSocket wss://streaming.assemblyai.com/v3/ws?token=…
  │    ⇅ raw PCM16 mono @ 16 kHz, 100 ms frames
  │    ⇅ Begin / Turn / TurnFinalized / Termination
  │
  │ 3. tRPC: interview.answer  ──▶  server
  │    ◀── feedback, score, follow-up question    LLM grading + heuristic
  │                                            fallback when no LLM key
```

Audio goes **straight from the browser to AssemblyAI**. The app does not proxy
audio, does not buffer recordings, and does not need a WebSocket server of its
own. The Express service only serves the client and answers two tRPC calls.

### AssemblyAI features used

| Feature | Where |
| --- | --- |
| Universal-Streaming (`universal-3-6-pro`) | `client/src/lib/assemblyaiStream.ts` |
| Temporary streaming tokens | `server/_core/assemblyai.ts` |
| `end_of_turn` server-side turn detection | `assemblyaiStream.ts` → coaching loop |
| `include_partial_turns` live captioning | transcript + live rubric meter |
| `keyterms_prompt` per question | improves "Big O", "two pointers" accuracy |
| `agent_context` | biases the model toward interview vocabulary |
| `inactivity_timeout` | bounds a stalled turn |
| Word-level timestamps | WPM, pause and filler analysis in `shared/rubric.ts` |

## Audio pipeline

`getUserMedia` feeds an `AudioContext` running a custom `AudioWorkletProcessor`.
The worklet converts the browser's float samples to 16-bit PCM, resamples to
16 kHz, and posts a 100 ms frame at a time. RMS per frame drives the live
waveform.

The worklet source lives in `client/src/lib/audioEngine.ts` and is **executed
against a stubbed Web Audio global in the test suite**, so the resampling and
clamping that ship to the browser are actually covered.

## Live rubric

`shared/rubric.ts` is deliberately framework-free and runs identically in the
browser and on the server, which lets the live meter and the stored result share
one implementation.

Coverage is phrase-based, so partial answers earn partial credit. Phrases are
matched per question from a curated list, merged with a global list, and
normalised through the same function on both sides — so "O(n)", "o n" and
"O-N" all count as the same evidence, and a filler word inside a longer word
("summary", "likely") is not counted as a filler.

## Running locally

```bash
pnpm install
cp .env.example .env      # add ASSEMBLYAI_API_KEY
pnpm run dev              # http://localhost:3000
```

Requirements: Node 22, a modern browser with `AudioWorklet` support, and a
microphone. Chrome, Edge, Firefox and Safari are all supported; headphones
strongly recommended to avoid the interviewer hearing itself.

Without `ASSEMBLYAI_API_KEY` the app still runs and the typed-answer path still
works, so the UI is never a dead end.

### Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `ASSEMBLYAI_API_KEY` | for voice | Enables the real-time voice agent |
| `NVIDIA_API_KEY` | no | LLM grading (free signup) |
| `LLM_API_URL` / `LLM_API_KEY` / `LLM_MODEL` | no | Any OpenAI-compatible grader |
| `DATABASE_URL` | no | MySQL; omit to run in memory |

Grading falls back to a built-in heuristic grader when no LLM key is present.

## Deploying

`render.yaml` is included. Set `ASSEMBLYAI_API_KEY` in the dashboard, or:

```bash
render blueprint launch
```

Railway, Fly.io and any Node host work the same way — the service is one
process that respects `PORT`.

## Tests

```bash
pnpm run check   # tsc --noEmit
pnpm test        # vitest
```

Covers the rubric engine (coverage, delivery metrics, filler and pause maths),
the shipped AudioWorklet source, and the question-bank grader.

`npx tsx scripts/verifyStreaming.ts` performs a live check that the configured
AssemblyAI account accepts every streaming parameter the client sends. It
requires a real `ASSEMBLYAI_API_KEY`.

## Accessibility and honesty

- Every spoken turn has a visible transcript; the live caption line updates as
  you speak.
- Skip and typed-answer paths exist for candidates who cannot or prefer not to
  use a microphone.
- The interviewer says it is practice software, not a recruiter, and never
  claims otherwise.
- No audio is stored. Transcripts live in memory for the length of the session.

## Stack

React 18, TypeScript, Vite, tRPC, Express, Tailwind, AssemblyAI
Universal-Streaming, Vitest.
