# intervue — demo video script

Target length **2:30–3:00**. The MP4 is the only submission asset a judge
cannot click through, so it has to prove the thing works *without* narration
doing all the work.

## Before you record

- [ ] Deploy first and record the **live URL**, not `localhost`. Judges open
      links; a dead localhost demo loses the room.
- [ ] Confirm `ASSEMBLYAI_API_KEY` is set on the deployment.
- [ ] Quiet room. Wired headphones on. **The interviewer will hear itself
      otherwise** and the end-of-turn detection will fire on its own voice.
- [ ] Chrome or Edge. Grant the microphone when prompted, before you hit record.
- [ ] Clear the transcript/session by reloading the page so the recording
      starts clean.
- [ ] Record at 1920×1080, 30 fps. Do a 10-second test clip and check the audio
      before the real take.

> The audio quality of *your* voice is not judged. The transcript accuracy is.
> Speak clearly and at a natural pace.

---

## Shot 1 — the hook (0:00 – 0:15)

**Screen:** the setup screen.

**Say:**

> This is intervue. It's a voice agent that runs a real technical interview
> and tells you how to answer better — while you're still answering.

**Do not** explain the problem yet. Move.

---

## Shot 2 — the problem (0:15 – 0:30)

**Screen:** keep the setup screen. Prefer a clean cut here.

**Say:**

> Everyone prepares for the interview by practising the code. But the thing
> that actually fails people is explaining the answer — and almost nobody gets
> feedback on that part. When you do get it, it arrives in a rejection email
> weeks later, with no idea which sentence cost you the offer.

---

## Shot 3 — start the interview (0:30 – 0:45)

**Screen:** click through topic selection and difficulty, then press start.

**Say:**

> Pick a topic, and it asks the question out loud and opens the mic.

Wait for the question to finish. Do not talk over it.

---

## Shot 4 — the money shot (0:45 – 1:35)

**This is the shot the whole video exists for.** Keep the microphone
transcript and the answer meter in frame. Slow the pace down.

Answer **completely** on the first question, so the meter visibly fills:

> So the task is to find whether there's a duplicate in the list.
> My approach is a single pass with a hash set. As I walk the array, I check
> whether the current value is already in the set; if it is, I've found a
> duplicate and I can return early.
> The data structure is a hash set, because it gives me O(1) average lookup.
> So the time complexity is O(n) — linear in the length of the array — and the
> space complexity is also O(n), since the set can hold every element.
> Edge cases: an empty array, and an array with no duplicates, both just return
> without finding anything.

**Point at the meter while you speak:**

> You can see the rubric filling in as I talk. Restate, approach, data
> structure, complexity, edge cases — the interviewer is scoring the
> *structure* of my answer, not just whether I got the words right.

**Then say, deliberately:**

> …and that's the part nobody tells you. It knows *which* step I skipped,
> at the moment I skipped it.

---

## Shot 5 — the probe (1:35 – 1:55)

**Screen:** the next question.

Give a **thin** answer on purpose — four or five words:

> Uh, I dunno, just loop over stuff I guess.

**Say:**

> I gave it a four-word answer. It didn't grade that — it asked me a better
> question, built from the rubric step I actually missed.

Let the follow-up land. Pause. This beat is the differentiator; don't rush it.

---

## Shot 6 — the debrief (1:55 – 2:15)

**Screen:** the summary page.

**Say:**

> At the end it tells me two separate things. Whether the answer was right —
> that's a pass or fail against a checklist. And how I *said* it: words per
> minute, filler rate, longest pause, from AssemblyAI's word-level timestamps.
> Real numbers, not a vibe.

---

## Shot 7 — the engineering (2:15 – 2:40)

**Screen:** the repository. Show the AssemblyAI client and the rubric engine.

**Say:**

> The audio goes straight from the browser to AssemblyAI over a WebSocket —
> the server never touches it, doesn't buffer it, doesn't store it. The
> browser asks the server for a single-use streaming token, so the account key
> never ships to the client.

Show `client/src/lib/assemblyaiStream.ts`, then `shared/rubric.ts`.

> We use Universal-Streaming for sub-second partial transcripts, and
> server-side end-of-turn detection — so the agent knows when I stop talking
> without a silence timer, which is how most voice agents end up cutting people
> off. Word-level timestamps drive the delivery metrics, and keyterms per
> question keep "Big O" and "two pointers" transcribing correctly.

**If you have time, mention the bugs.** It reads as genuinely engineered:

> The test suite runs the actual AudioWorklet source against a stubbed Web
> Audio global. That's how we caught that AudioWorklet registration is per
> AudioContext — our "already loaded" cache meant only the first question could
> hear anything.

---

## Shot 8 — close (2:40 – 2:50)

**Screen:** back to the cover or the summary verdict.

**Say:**

> intervue. Stop practising the code. Practise the answer.

---

## Recording checklist

| Item | Status |
| --- | --- |
| Recorded against the deployed URL, not localhost | |
| Microphone permission pre-granted | |
| Transcript and answer meter legible at 1080p | |
| Thin-answer beat actually landed a probe | |
| No secrets, keys or `.env` visible in any terminal shot | |
| Under 3:00, audio present, ends on the closing line | |
