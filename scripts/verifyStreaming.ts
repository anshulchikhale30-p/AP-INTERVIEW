/**
 * Verifies that every query parameter we send is accepted by AssemblyAI's v3
 * streaming endpoint on the chosen model, and that the session actually opens.
 * Run with: npx tsx scripts/verifyStreaming.ts
 */
import "dotenv/config";
import { createStreamingToken } from "../server/_core/assemblyai";

const params = new URLSearchParams({
  speech_model: "universal-3-6-pro",
  sample_rate: "16000",
  encoding: "pcm_s16le",
  include_partial_turns: "true",
  keyterms_prompt: JSON.stringify(["hash map", "two pointers", "big O"]),
  inactivity_timeout: "45",
  agent_context: "Give me the time and space complexity.",
});

const { token } = await createStreamingToken({ maxSessionDurationSeconds: 120 });
params.set("token", token);

const url = `wss://streaming.assemblyai.com/v3/ws?${params.toString()}`;
console.log("Opening session…");

const socket = new WebSocket(url);
let opened = false;

const timeout = setTimeout(() => {
  console.error("FAIL: timed out waiting for Begin");
  process.exit(1);
}, 20_000);

socket.addEventListener("open", () => {
  console.log("socket open, sending 1s of silence");
  const silence = new Int16Array(16_000);
  socket.send(silence.buffer);
});

socket.addEventListener("message", event => {
  const message = JSON.parse(String(event.data));
  console.log("<-", message.type, JSON.stringify(message).slice(0, 240));

  if (message.type === "Begin") {
    opened = true;
    clearTimeout(timeout);
    socket.send(JSON.stringify({ type: "Terminate" }));
    return;
  }

  if (message.type === "Error") {
    clearTimeout(timeout);
    console.error("FAIL: server rejected the session:", message.error);
    process.exit(1);
  }

  if (message.type === "Termination") {
    console.log(
      opened
        ? "PASS: all streaming parameters accepted, session opened and terminated cleanly"
        : "FAIL: terminated without Begin"
    );
    process.exit(opened ? 0 : 1);
  }
});

socket.addEventListener("error", event => {
  clearTimeout(timeout);
  console.error("FAIL: socket error", event);
  process.exit(1);
});
