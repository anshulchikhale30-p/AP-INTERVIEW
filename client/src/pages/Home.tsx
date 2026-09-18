import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Mic, MicOff, Phone, Radio, Sparkles, Volume2, Waves, X } from "lucide-react";
import { toast } from "sonner";

type ChatMessage = { role: "assistant" | "user"; content: string };

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

const intro = "Hi Aisha. I’m ready when you are. Tell me about a project you’re proud of, and the part you personally owned.";

function VoiceOrb({ listening, speaking }: { listening: boolean; speaking: boolean }) {
  return (
    <div className={`relative flex h-64 w-64 items-center justify-center rounded-full transition-all duration-700 sm:h-80 sm:w-80 ${listening ? "scale-105" : "scale-100"}`}>
      <div className={`absolute inset-0 rounded-full border transition-all duration-700 ${listening ? "animate-[pulse_2.2s_ease-in-out_infinite] border-[#d8f97a]/35 bg-[#d8f97a]/[0.035]" : "border-white/[0.07] bg-white/[0.015]"}`} />
      <div className={`absolute inset-8 rounded-full border transition-all duration-700 ${listening ? "border-[#d8f97a]/25" : "border-white/[0.07]"}`} />
      <div className={`absolute inset-16 rounded-full transition-all duration-500 ${speaking ? "scale-110 bg-[#ff8f70]/15" : listening ? "bg-[#d8f97a]/10" : "bg-white/[0.04]"}`} />
      <div className={`relative flex h-24 w-24 items-center justify-center rounded-full shadow-[0_0_70px_rgba(216,249,122,0.12)] transition-all duration-500 sm:h-28 sm:w-28 ${speaking ? "bg-[#ff8f70] text-[#241417]" : "bg-[#d8f97a] text-[#101724]"}`}>
        {speaking ? <Volume2 className="h-9 w-9" /> : listening ? <Waves className="h-9 w-9" /> : <Sparkles className="h-9 w-9" />}
      </div>
    </div>
  );
}

function Waveform({ active }: { active: boolean }) {
  return <div className="flex h-8 items-center justify-center gap-1.5 opacity-80">{[12, 24, 36, 18, 30, 44, 25, 39, 17, 29, 12].map((height, index) => <span key={index} className={`w-1 rounded-full transition-all duration-300 ${active ? "bg-[#d8f97a]" : "bg-white/20"}`} style={{ height: active ? `${height}px` : "5px", animation: active ? `voiceBar 900ms ease-in-out ${index * 70}ms infinite alternate` : "none" }} />)}</div>;
}

export default function Home() {
  const ask = trpc.interview.ask.useMutation();
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldListenRef = useRef(false);
  const speakingRef = useRef(false);
  const respondingRef = useRef(false);
  const startedRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [responding, setResponding] = useState(false);
  const [muted, setMuted] = useState(false);
  const [interim, setInterim] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: intro }]);
  const [lastHeard, setLastHeard] = useState("");

  const speak = useCallback((text: string, resumeListening = true) => {
    if (!("speechSynthesis" in window) || muted) {
      if (resumeListening) shouldListenRef.current = true;
      return;
    }
    window.speechSynthesis.cancel();
    shouldListenRef.current = false;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    utterance.pitch = 1.02;
    utterance.onstart = () => { speakingRef.current = true; setSpeaking(true); setListening(false); };
    utterance.onend = () => {
      speakingRef.current = false;
      setSpeaking(false);
      if (resumeListening && started) shouldListenRef.current = true;
    };
    window.speechSynthesis.speak(utterance);
  }, [muted, started]);

  const respond = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || ask.isPending || respondingRef.current) return;
    respondingRef.current = true;
    setResponding(true);
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setLastHeard(clean);
    setInterim("");
    setMessages((current) => [...current, { role: "user", content: clean }]);
    try {
      const result = await ask.mutateAsync({
        question: clean,
        mode: "Unlimited voice interview",
        level: "mid-level",
        transcript: messages.slice(-8),
      });
      const answer = result.answer || "Good start. What did you learn, and what would you change if you had another week?";
      setMessages((current) => [...current, { role: "assistant", content: answer }]);
      speak(answer);
    } catch {
      const fallback = "That’s useful context. Take me one level deeper — what was the hardest judgment call you made?";
      setMessages((current) => [...current, { role: "assistant", content: fallback }]);
      speak(fallback);
      toast.error("The coach briefly lost connection, so I’m continuing with a guided question.");
    } finally {
      respondingRef.current = false;
      setResponding(false);
    }
  }, [ask, messages, speak]);

  const beginListening = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      toast.info("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    if (recognitionRef.current || speakingRef.current || respondingRef.current || !startedRef.current) return;
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
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
      recognitionRef.current = null;
      setListening(false);
      if (event?.error === "no-speech" || event?.error === "aborted") {
        shouldListenRef.current = startedRef.current;
        return;
      }
      shouldListenRef.current = false;
      toast.error("I couldn’t hear that. Please try again.");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim("");
      if (shouldListenRef.current && startedRef.current && !speakingRef.current && !respondingRef.current) {
        window.setTimeout(() => { if (shouldListenRef.current && startedRef.current && !recognitionRef.current) beginListening(); }, 350);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
  }, [respond]);

  const startSession = () => {
    startedRef.current = true;
    setStarted(true);
    shouldListenRef.current = true;
    speak(intro, true);
  };

  const stopSession = () => {
    startedRef.current = false;
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    window.speechSynthesis?.cancel();
    setStarted(false);
    setListening(false);
    setSpeaking(false);
    setInterim("");
  };

  const toggleListening = () => {
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

  useEffect(() => {
    if (started && !speaking && !responding && shouldListenRef.current && !recognitionRef.current) {
      const timer = window.setTimeout(() => {
        if (startedRef.current && !speakingRef.current && !respondingRef.current && shouldListenRef.current && !recognitionRef.current) beginListening();
      }, 260);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [beginListening, responding, started, speaking]);

  useEffect(() => () => stopSession(), []);

  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant")?.content || intro;

  return <main className="relative min-h-screen overflow-hidden bg-[#090f19] text-white">
    <style>{`@keyframes voiceBar { from { transform: scaleY(.45); opacity: .55 } to { transform: scaleY(1); opacity: 1 } }`}</style>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(216,249,122,0.075),transparent_27%),radial-gradient(circle_at_50%_100%,rgba(130,169,255,0.05),transparent_33%)]" />
    <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-10 sm:py-7"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-[#d8f97a] text-[#101724]"><Sparkles className="h-4 w-4" /></div><div><div className="font-display text-[15px] font-semibold tracking-[-0.02em]">intervue</div><div className="text-[9px] uppercase tracking-[0.22em] text-white/30">voice interview</div></div></div><div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full border border-white/[0.08] px-3 py-1.5 text-[10px] text-white/35 sm:flex"><span className={`h-1.5 w-1.5 rounded-full ${started ? "bg-[#d8f97a] shadow-[0_0_10px_#d8f97a]" : "bg-white/25"}`} />{started ? "Private voice room" : "Ready to practice"}</div>{started && <button onClick={stopSession} className="flex items-center gap-2 rounded-full border border-[#ff8f70]/25 px-3 py-1.5 text-[10px] text-[#ffad9a] transition hover:bg-[#ff8f70]/10"><X className="h-3 w-3" /> End</button>}</div></header>
    <section className="relative z-10 mx-auto flex min-h-[calc(100vh-92px)] max-w-[980px] flex-col items-center px-5 pb-8 pt-8 text-center sm:pt-14"><div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#d8f97a]"><Radio className="h-3.5 w-3.5" /> {started ? "Live interview" : "Voice-first practice"}</div><h1 className="mt-5 max-w-[760px] font-display text-3xl font-medium leading-tight tracking-[-0.06em] text-white sm:text-5xl">{started ? (responding ? "Thinking about that." : speaking ? "Listen, then take your time." : listening ? "I’m listening." : "Your turn to speak.") : "Talk it out. Get sharper."}</h1><p className="mt-4 max-w-[520px] text-[13px] leading-6 text-white/40">{started ? (responding ? "Your answer is in. I’m shaping the most useful follow-up." : speaking ? "Your interviewer is responding with a tailored follow-up." : listening ? "Say as much as you need. I’ll keep the conversation moving." : "Tap the microphone whenever you’re ready to continue.") : "An unlimited, natural voice interview with an AI coach that asks the next useful question."}</p><div className="mt-9"><VoiceOrb listening={listening} speaking={speaking} /></div><div className="mt-6 h-11"><Waveform active={listening || speaking || responding} /></div>{started ? <div className="mt-5 flex min-h-[78px] max-w-[620px] flex-col items-center justify-center"><div className="text-[10px] uppercase tracking-[0.18em] text-white/25">{responding ? "Intervue" : speaking ? "Intervue" : listening ? "You" : "Conversation"}</div><p className="mt-2 text-[14px] leading-6 text-white/70">{interim || (responding ? "I heard you. Give me a moment..." : speaking ? latestAssistant : lastHeard || "The mic is ready whenever you are.")}</p></div> : <div className="mt-5 flex min-h-[78px] max-w-[550px] items-center justify-center"><p className="text-[14px] leading-6 text-white/45">No scripts. No timers. Just a thoughtful conversation that gets better with every answer.</p></div>}<div className="mt-8 flex items-center gap-4"><button disabled={responding} onClick={started ? toggleListening : startSession} className={`group flex h-16 min-w-[180px] items-center justify-center gap-3 rounded-full px-7 text-[13px] font-semibold transition active:scale-[0.97] disabled:cursor-wait disabled:opacity-50 ${started && listening ? "bg-[#ff8f70] text-[#241417] shadow-[0_0_40px_rgba(255,143,112,0.2)]" : "bg-[#d8f97a] text-[#101724] shadow-[0_0_40px_rgba(216,249,122,0.14)] hover:bg-[#e6ff9d]"}`}>{started ? (responding ? <><Waves className="h-5 w-5 animate-pulse" /> Thinking...</> : listening ? <><MicOff className="h-5 w-5" /> Pause listening</> : <><Mic className="h-5 w-5" /> Speak now</>) : <><Phone className="h-5 w-5" /> Start talking</>}</button>{started && <button onClick={() => { setMuted((value) => !value); if (!muted) window.speechSynthesis.cancel(); }} className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${muted ? "border-[#ff8f70]/40 bg-[#ff8f70]/10 text-[#ffad9a]" : "border-white/10 text-white/35 hover:border-white/20 hover:text-white/70"}`} aria-label={muted ? "Unmute AI voice" : "Mute AI voice"}>{muted ? <Volume2 className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>}</div><div className="mt-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-10 text-[10px] text-white/22"><span className="flex items-center gap-1.5"><Mic className="h-3 w-3" /> Browser mic</span><span className="h-1 w-1 rounded-full bg-white/15" /><span className="flex items-center gap-1.5"><Sparkles className="h-3 w-3" /> Adaptive follow-ups</span><span className="h-1 w-1 rounded-full bg-white/15" /><span>Unlimited practice</span></div></section>
  </main>;
}
