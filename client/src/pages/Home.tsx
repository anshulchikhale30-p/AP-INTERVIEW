import { useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  Command,
  Flame,
  Gauge,
  Headphones,
  Info,
  LayoutDashboard,
  Lightbulb,
  Mic,
  MicOff,
  MoreHorizontal,
  Play,
  Radio,
  Search,
  Send,
  Settings2,
  Sparkles,
  Target,
  Trophy,
  Volume2,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

type View = "overview" | "practice" | "knowledge" | "progress";
type ChatMessage = { role: "assistant" | "user"; content: string; time?: string };

const knowledgeCards = [
  { icon: Target, title: "Behavioral", count: "42 prompts", color: "coral", description: "Stories, leadership, conflict, and your operating principles." },
  { icon: Code2, title: "Technical", count: "86 prompts", color: "lime", description: "Systems, coding, debugging, and architecture patterns." },
  { icon: BarChart3, title: "Product & case", count: "31 frameworks", color: "blue", description: "Product sense, execution, analytics, and trade-offs." },
];

const samplePrompts = [
  "Tell me about a project you're proud of.",
  "How would you improve a product you use every day?",
  "Design a rate limiter for a public API.",
];

const starterMessages: ChatMessage[] = [
  { role: "assistant", content: "Welcome to your practice room. I’ll be your interviewer today — thoughtful, direct, and on your side.", time: "09:41" },
  { role: "assistant", content: "Let’s start simple: tell me about a project you’re proud of and the part you personally owned.", time: "09:41" },
];

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "lime" | "orange" | "blue" }) {
  const tones = {
    neutral: "border-white/10 bg-white/[0.04] text-white/55",
    lime: "border-[#d8f97a]/20 bg-[#d8f97a]/10 text-[#d8f97a]",
    orange: "border-[#ff8f70]/20 bg-[#ff8f70]/10 text-[#ffaf99]",
    blue: "border-[#82a9ff]/20 bg-[#82a9ff]/10 text-[#a9c2ff]",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide ${tones[tone]}`}>{children}</span>;
}

function AppMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-[13px] bg-[#d8f97a] text-[#101724] shadow-[0_0_24px_rgba(216,249,122,0.16)]">
        <Sparkles className="h-4 w-4" strokeWidth={2.4} />
        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#ff8f70]" />
      </div>
      <div>
        <div className="font-display text-[15px] font-semibold tracking-[-0.02em] text-white">intervue</div>
        <div className="text-[9px] uppercase tracking-[0.22em] text-white/35">AI interview coach</div>
      </div>
    </div>
  );
}

function Sidebar({ view, setView, onStart }: { view: View; setView: (view: View) => void; onStart: () => void }) {
  const items: { key: View; label: string; icon: typeof LayoutDashboard }[] = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "practice", label: "Practice room", icon: Headphones },
    { key: "knowledge", label: "Knowledge base", icon: BookOpen },
    { key: "progress", label: "My progress", icon: BarChart3 },
  ];
  return (
    <aside className="hidden w-[238px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0b111d] px-4 py-5 lg:flex">
      <div className="px-3"><AppMark /></div>
      <div className="mt-11 px-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/25">Workspace</div>
      <nav className="mt-3 space-y-1">
        {items.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setView(key)} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${view === key ? "bg-white/[0.08] text-white shadow-[inset_2px_0_0_#d8f97a]" : "text-white/45 hover:bg-white/[0.04] hover:text-white/80"}`}>
            <Icon className={`h-4 w-4 ${view === key ? "text-[#d8f97a]" : "text-white/35 group-hover:text-white/70"}`} strokeWidth={1.8} />
            <span>{label}</span>
            {key === "practice" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#ff8f70]" />}
          </button>
        ))}
      </nav>
      <div className="mt-9 px-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/25">Your rhythm</div>
      <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
        <div className="flex items-center justify-between"><span className="text-[11px] text-white/45">Weekly goal</span><span className="text-[11px] text-[#d8f97a]">3 / 5</span></div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full w-3/5 rounded-full bg-[#d8f97a]" /></div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-white/35"><Flame className="h-3.5 w-3.5 text-[#ff8f70]" /> 7 day streak</div>
      </div>
      <div className="mt-auto border-t border-white/[0.07] pt-4">
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] text-white/40 transition hover:bg-white/[0.04] hover:text-white/70"><Settings2 className="h-4 w-4" /> Settings</button>
        <div className="mt-2 flex items-center gap-3 rounded-xl bg-white/[0.035] px-3 py-2.5"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ff8f70] text-[11px] font-bold text-[#241417]">AK</div><div className="min-w-0 flex-1"><div className="truncate text-[12px] font-medium text-white/75">Aisha Khan</div><div className="text-[10px] text-white/30">Free workspace</div></div><MoreHorizontal className="h-4 w-4 text-white/25" /></div>
      </div>
    </aside>
  );
}

function TopBar({ view, onStart }: { view: View; onStart: () => void }) {
  const labels = { overview: "Overview", practice: "Practice room", knowledge: "Knowledge base", progress: "My progress" };
  return <header className="flex h-[70px] items-center justify-between border-b border-white/[0.07] px-5 sm:px-8">
    <div className="flex items-center gap-2 text-[12px] text-white/30"><span>Workspace</span><ChevronRight className="h-3.5 w-3.5" /><span className="text-white/75">{labels[view]}</span></div>
    <div className="flex items-center gap-3"><button className="hidden items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[11px] text-white/40 transition hover:border-white/15 hover:text-white/70 sm:flex"><Command className="h-3.5 w-3.5" /> K <span className="text-white/20">⌘K</span></button><button onClick={onStart} className="flex items-center gap-2 rounded-lg bg-[#d8f97a] px-3.5 py-2 text-[11px] font-semibold text-[#101724] transition hover:bg-[#e6ff9d] active:scale-[0.97]"><Play className="h-3.5 w-3.5 fill-current" /> New session</button></div>
  </header>;
}

function StatCard({ icon: Icon, label, value, suffix, accent }: { icon: typeof Flame; label: string; value: string; suffix?: string; accent: string }) {
  return <div className="rounded-2xl border border-white/[0.07] bg-[#111a29]/80 p-4"><div className="flex items-center justify-between"><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}><Icon className="h-4 w-4" /></div><ArrowUpRight className="h-3.5 w-3.5 text-white/20" /></div><div className="mt-5 flex items-baseline gap-1"><span className="font-display text-2xl font-semibold tracking-[-0.05em] text-white">{value}</span>{suffix && <span className="text-xs text-white/35">{suffix}</span>}</div><div className="mt-1 text-[11px] text-white/35">{label}</div></div>;
}

function Overview({ onStart, setView }: { onStart: () => void; setView: (view: View) => void }) {
  return <div className="space-y-7 p-5 sm:p-8">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#d8f97a] shadow-[0_0_10px_#d8f97a]" /><span className="text-[11px] uppercase tracking-[0.2em] text-[#d8f97a]">Wednesday, 18 September</span></div><h1 className="font-display text-3xl font-medium tracking-[-0.055em] text-white sm:text-[38px]">Ready when you are, <span className="text-[#d8f97a]">Aisha.</span></h1><p className="mt-2 text-[13px] text-white/40">Build the calm confidence that shows up when it matters.</p></div><button onClick={() => setView("progress")} className="flex items-center gap-2 self-start rounded-lg border border-white/[0.09] px-3.5 py-2.5 text-[11px] text-white/55 transition hover:border-white/20 hover:text-white/90 sm:self-auto">View your progress <ArrowUpRight className="h-3.5 w-3.5" /></button></div>
    <div className="grid gap-3 sm:grid-cols-3"><StatCard icon={Flame} label="Current streak" value="7" suffix="days" accent="bg-[#ff8f70]/10 text-[#ff9b80]" /><StatCard icon={Gauge} label="Average answer score" value="78" suffix="/ 100" accent="bg-[#d8f97a]/10 text-[#d8f97a]" /><StatCard icon={Clock3} label="Practice this week" value="42" suffix="min" accent="bg-[#82a9ff]/10 text-[#a9c2ff]" /></div>
    <section className="relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#111a29] p-6 sm:p-7"><div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#d8f97a]/[0.07] blur-3xl" /><div className="relative flex flex-col justify-between gap-7 sm:flex-row sm:items-center"><div className="max-w-[510px]"><div className="flex items-center gap-2"><Pill tone="lime">Recommended next</Pill><span className="text-[10px] text-white/30">12 min</span></div><h2 className="mt-4 font-display text-2xl font-medium tracking-[-0.045em] text-white">Product sense warm-up</h2><p className="mt-2 max-w-[470px] text-[13px] leading-6 text-white/45">A focused session on clarifying ambiguous problems, prioritizing trade-offs, and connecting decisions to user value.</p><div className="mt-5 flex flex-wrap gap-2"><Pill tone="orange">Mid-level</Pill><Pill>Product manager</Pill><Pill>Voice-first</Pill></div><button onClick={onStart} className="mt-6 flex items-center gap-2 rounded-xl bg-[#d8f97a] px-4 py-3 text-[12px] font-semibold text-[#101724] transition hover:bg-[#e6ff9d] active:scale-[0.98]"><Mic className="h-4 w-4" /> Start interview <ChevronRight className="h-4 w-4" /></button></div><div className="hidden h-[182px] w-[238px] shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#0d1523] sm:flex"><div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-[#d8f97a]/30"><div className="absolute inset-2 rounded-full border border-[#d8f97a]/20" /><div className="absolute inset-5 rounded-full bg-[#d8f97a]/10" /><Radio className="relative h-7 w-7 text-[#d8f97a]" /></div></div></div></section>
    <div><div className="mb-4 flex items-end justify-between"><div><h2 className="font-display text-lg font-medium tracking-[-0.03em] text-white">Choose your lane</h2><p className="mt-1 text-[12px] text-white/35">Practice with the interview mode that matches your next move.</p></div><button onClick={() => setView("knowledge")} className="hidden items-center gap-1 text-[11px] text-[#d8f97a] sm:flex">Browse all <ArrowUpRight className="h-3.5 w-3.5" /></button></div><div className="grid gap-3 md:grid-cols-3">{knowledgeCards.map(({ icon: Icon, title, count, color, description }) => <button key={title} onClick={onStart} className="group rounded-2xl border border-white/[0.07] bg-[#111a29]/55 p-4 text-left transition hover:-translate-y-0.5 hover:border-white/15 hover:bg-[#142031]"><div className="flex items-start justify-between"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${color === "coral" ? "bg-[#ff8f70]/10 text-[#ff9b80]" : color === "lime" ? "bg-[#d8f97a]/10 text-[#d8f97a]" : "bg-[#82a9ff]/10 text-[#a9c2ff]"}`}><Icon className="h-4 w-4" /></div><ChevronRight className="h-4 w-4 text-white/15 transition group-hover:translate-x-0.5 group-hover:text-white/50" /></div><div className="mt-5 flex items-center gap-2"><h3 className="text-[13px] font-medium text-white/85">{title}</h3><span className="text-[10px] text-white/25">{count}</span></div><p className="mt-2 text-[11px] leading-5 text-white/35">{description}</p></button>)}</div></div>
    <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]"><section className="rounded-2xl border border-white/[0.07] bg-[#111a29]/55 p-5"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-medium tracking-[-0.03em] text-white">Recent sessions</h2><p className="mt-1 text-[11px] text-white/30">Small reps, compounding confidence.</p></div><button className="text-white/25 transition hover:text-white/60"><MoreHorizontal className="h-5 w-5" /></button></div><div className="mt-5 space-y-1">{[["Behavioral · Leadership", "Yesterday", "84", "#d8f97a"], ["Technical · System design", "Mon, Sep 16", "72", "#82a9ff"], ["Product · Analytics", "Fri, Sep 13", "78", "#ff8f70"]].map(([name, date, score, color]) => <div key={name} className="flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-white/[0.035]"><div className="h-8 w-1 rounded-full" style={{ backgroundColor: color }} /><div className="min-w-0 flex-1"><div className="truncate text-[12px] text-white/70">{name}</div><div className="mt-1 text-[10px] text-white/28">{date}</div></div><div className="text-right"><div className="font-display text-[15px] text-white/80">{score}</div><div className="text-[9px] uppercase tracking-wider text-white/25">score</div></div><ChevronRight className="h-3.5 w-3.5 text-white/20" /></div>)}</div></section><section className="rounded-2xl border border-white/[0.07] bg-[#111a29]/55 p-5"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg font-medium tracking-[-0.03em] text-white">One good note</h2><p className="mt-1 text-[11px] text-white/30">From your last feedback.</p></div><Lightbulb className="h-4 w-4 text-[#d8f97a]" /></div><blockquote className="mt-6 border-l border-[#d8f97a]/50 pl-4 text-[13px] leading-6 text-white/65">“Your examples are strong. Lead with the <span className="text-[#d8f97a]">decision</span> sooner, then let the detail earn its place.”</blockquote><div className="mt-5 flex items-center gap-2 text-[10px] text-white/25"><Sparkles className="h-3.5 w-3.5 text-[#d8f97a]" /> Intervue coaching insight</div></section></div>
  </div>;
}

function PracticeRoom({ onExit }: { onExit: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);
  const ask = trpc.interview.ask.useMutation();

  const currentTurn = messages.filter((message) => message.role === "user").length + 1;
  const progress = Math.min(92, 22 + currentTurn * 13);

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    utterance.pitch = 1.02;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const send = async (text = input) => {
    const clean = text.trim();
    if (!clean || ask.isPending) return;
    setInput("");
    const userMessage: ChatMessage = { role: "user", content: clean, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setMessages((current) => [...current, userMessage]);
    try {
      const result = await ask.mutateAsync({ question: clean, mode: "Product sense warm-up", level: "mid-level", transcript: messages.slice(-6).map(({ role, content }) => ({ role, content })) });
      const answer = result.answer || "That’s a useful starting point. Let’s make the trade-off explicit — what would you optimize for first, and why?";
      setMessages((current) => [...current, { role: "assistant", content: answer, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
      speak(answer);
    } catch {
      const fallback = "Good instinct. I’d like you to go one level deeper: what signal would tell you that your approach is working?";
      setMessages((current) => [...current, { role: "assistant", content: fallback, time: "now" }]);
      speak(fallback);
      toast.error("Coach connection was interrupted — continuing with a guided prompt.");
    }
  };

  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.info("Voice capture is not supported in this browser. You can still type your answer.");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((result: any) => result[0].transcript).join("");
      setInput(transcript);
    };
    recognition.onerror = () => { setIsListening(false); toast.error("I couldn’t hear that. Try again or type your response."); };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  return <div className="flex min-h-[calc(100vh-70px)] flex-col"><div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4 sm:px-8"><div className="flex items-center gap-3"><button onClick={onExit} className="rounded-lg p-1.5 text-white/35 transition hover:bg-white/[0.06] hover:text-white"><X className="h-4 w-4" /></button><div><div className="flex items-center gap-2"><span className="text-[12px] font-medium text-white/80">Product sense warm-up</span><Pill tone="lime">Live</Pill></div><div className="mt-1 flex items-center gap-2 text-[10px] text-white/30"><Clock3 className="h-3 w-3" /> 08:24 elapsed <span className="text-white/15">·</span> Question {currentTurn} of 6</div></div></div><div className="hidden items-center gap-2 sm:flex"><button className="rounded-lg p-2 text-white/30 transition hover:bg-white/[0.05] hover:text-white"><Info className="h-4 w-4" /></button><button className="rounded-lg p-2 text-white/30 transition hover:bg-white/[0.05] hover:text-white"><MoreHorizontal className="h-4 w-4" /></button></div></div><div className="grid flex-1 lg:grid-cols-[1fr_340px]"><section className="flex min-h-[570px] flex-col border-b border-white/[0.07] lg:border-b-0 lg:border-r"><div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-5 py-7 sm:px-10"><div className="mb-6 flex items-center justify-between"><div className="text-[10px] uppercase tracking-[0.18em] text-white/25">Conversation</div><div className="flex items-center gap-2 text-[10px] text-white/30"><div className="h-1 w-1 rounded-full bg-[#d8f97a]" /> AI interviewer is listening</div></div><div className="flex-1 space-y-5 overflow-auto pr-1">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] ${message.role === "user" ? "items-end" : "items-start"}`}><div className="mb-1.5 flex items-center gap-2 text-[10px] text-white/25">{message.role === "assistant" ? <><div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#d8f97a]/10 text-[#d8f97a]"><Sparkles className="h-3 w-3" /></div><span>Intervue</span></> : <><span>You</span><div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#ff8f70]/10 text-[#ff9b80]">AK</div></>}{message.time && <span className="text-white/15">{message.time}</span>}</div><div className={`rounded-2xl px-4 py-3 text-[13px] leading-6 ${message.role === "user" ? "rounded-tr-sm bg-[#ff8f70]/10 text-[#ffd0c4]" : "rounded-tl-sm border border-white/[0.07] bg-[#111a29] text-white/70"}`}>{message.content}</div>{message.role === "assistant" && index === messages.length - 1 && <button onClick={() => speak(message.content)} className="mt-2 flex items-center gap-1.5 text-[10px] text-white/25 transition hover:text-[#d8f97a]"><Volume2 className="h-3 w-3" /> Play voice</button>}</div></div>)}</div><div className="mt-7"><div className="mb-3 flex flex-wrap gap-2">{samplePrompts.slice(0, 2).map((prompt) => <button key={prompt} onClick={() => setInput(prompt)} className="rounded-full border border-white/[0.08] px-3 py-1.5 text-[10px] text-white/35 transition hover:border-white/20 hover:text-white/65">{prompt}</button>)}</div><div className="rounded-2xl border border-white/[0.1] bg-[#111a29] p-2 shadow-[0_12px_35px_rgba(0,0,0,0.18)]"><div className="flex items-end gap-2"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Type your answer or use the mic..." rows={2} className="min-h-[52px] flex-1 resize-none bg-transparent px-3 py-2 text-[13px] leading-6 text-white outline-none placeholder:text-white/25" /><div className="flex items-center gap-1.5"><button onClick={toggleMic} className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${isListening ? "bg-[#ff8f70] text-[#241417] shadow-[0_0_22px_rgba(255,143,112,0.28)]" : "bg-white/[0.06] text-white/50 hover:bg-white/[0.1] hover:text-white"}`}>{isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button><button onClick={() => send()} disabled={!input.trim() || ask.isPending} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d8f97a] text-[#101724] transition hover:bg-[#e6ff9d] disabled:cursor-not-allowed disabled:opacity-30"><Send className="h-4 w-4" /></button></div></div></div><div className="mt-2 flex items-center justify-between px-1 text-[10px] text-white/20"><span>Shift + Enter for a new line</span>{isListening ? <span className="flex items-center gap-1.5 text-[#ff9b80]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff8f70]" /> Listening live</span> : isSpeaking ? <span className="flex items-center gap-1.5 text-[#d8f97a]"><Volume2 className="h-3 w-3" /> Speaking</span> : <span>Voice mode ready</span>}</div></div></div></section><aside className="bg-[#0b111d] p-5 sm:p-7"><div className="flex items-center justify-between"><div className="text-[10px] uppercase tracking-[0.18em] text-white/25">Session guide</div><span className="text-[11px] text-white/30">{progress}%</span></div><div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-[#d8f97a] transition-all duration-300" style={{ width: `${progress}%` }} /></div><div className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-[#d8f97a]"><BrainCircuit className="h-4 w-4" /><span className="text-[12px] font-medium">Coach mode</span></div><p className="mt-3 text-[11px] leading-5 text-white/40">I’ll ask one question at a time, follow your signal, and give you a concise debrief at the end.</p></div><div className="mt-7"><div className="flex items-center justify-between"><div className="text-[11px] font-medium text-white/60">What we’re listening for</div><Target className="h-3.5 w-3.5 text-white/25" /></div><div className="mt-4 space-y-3">{[["Problem framing", "Clarify before you solve", true], ["Decision quality", "Make trade-offs visible", false], ["Communication", "Lead with the signal", false]].map(([title, subtitle, complete]) => <div key={title as string} className="flex gap-3"><div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${complete ? "border-[#d8f97a]/50 bg-[#d8f97a]/10 text-[#d8f97a]" : "border-white/10 text-white/20"}`}>{complete ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</div><div><div className="text-[11px] text-white/65">{title as string}</div><div className="mt-0.5 text-[10px] text-white/28">{subtitle as string}</div></div></div>)}</div></div><div className="mt-8 border-t border-white/[0.07] pt-6"><div className="flex items-center gap-2 text-[11px] text-white/45"><WandSparkles className="h-3.5 w-3.5 text-[#ff8f70]" /> Real-time signal</div><p className="mt-2 text-[11px] leading-5 text-white/30">Try answering in <span className="text-white/55">60–90 seconds</span>. Specific beats polished.</p></div></aside></div></div>;
}

function Knowledge({ setView }: { setView: (view: View) => void }) {
  const [query, setQuery] = useState("");
  const topics = useMemo(() => [
    ["STAR stories", "Turn experience into a clear, memorable story.", "Behavioral", "18 cards"],
    ["System design", "Scope, model, scale, and communicate trade-offs.", "Technical", "24 cards"],
    ["Product sense", "Find the user problem before jumping to solutions.", "Product", "16 cards"],
    ["Metrics & analytics", "Choose north stars, guardrails, and diagnostic cuts.", "Product", "12 cards"],
    ["Coding patterns", "Explain your thinking while you solve in real time.", "Technical", "32 cards"],
    ["Leadership principles", "Show how you create clarity and momentum.", "Behavioral", "14 cards"],
  ].filter((topic) => topic.join(" ").toLowerCase().includes(query.toLowerCase())), [query]);
  return <div className="space-y-7 p-5 sm:p-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><Pill tone="blue">The Intervue library</Pill><h1 className="mt-4 font-display text-3xl font-medium tracking-[-0.055em] text-white">The answers behind the answers.</h1><p className="mt-2 max-w-[570px] text-[13px] leading-6 text-white/40">Frameworks, patterns, and prompts to help you think clearly under pressure — not memorize a script.</p></div><div className="relative w-full sm:w-[230px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search playbooks" className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-9 pr-3 text-[12px] text-white outline-none placeholder:text-white/25 focus:border-[#d8f97a]/30" /></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{topics.map(([title, description, category, count]) => <button key={title} onClick={() => toast.success(`${title} playbook opened`)} className="group rounded-2xl border border-white/[0.07] bg-[#111a29]/55 p-5 text-left transition hover:-translate-y-0.5 hover:border-white/15 hover:bg-[#142031]"><div className="flex items-center justify-between"><Pill tone={category === "Technical" ? "lime" : category === "Product" ? "blue" : "orange"}>{category}</Pill><BookOpen className="h-4 w-4 text-white/20 transition group-hover:text-[#d8f97a]" /></div><h3 className="mt-7 font-display text-lg font-medium tracking-[-0.03em] text-white/90">{title}</h3><p className="mt-2 text-[12px] leading-5 text-white/38">{description}</p><div className="mt-6 flex items-center justify-between text-[10px] text-white/25"><span>{count}</span><span className="flex items-center gap-1 text-white/35 group-hover:text-[#d8f97a]">Explore <ArrowUpRight className="h-3 w-3" /></span></div></button>)}</div><section className="rounded-2xl border border-[#d8f97a]/15 bg-[#d8f97a]/[0.04] p-5 sm:p-6"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2 text-[#d8f97a]"><Lightbulb className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-[0.17em]">A better way to prepare</span></div><h2 className="mt-3 font-display text-xl tracking-[-0.04em] text-white">Learn the shape, not the sentence.</h2><p className="mt-2 max-w-[560px] text-[12px] leading-5 text-white/40">Intervue adapts the next prompt to your answer, so you practice the judgment interviewers actually evaluate.</p></div><button onClick={() => setView("practice")} className="flex shrink-0 items-center gap-2 rounded-xl bg-[#d8f97a] px-4 py-3 text-[11px] font-semibold text-[#101724] transition hover:bg-[#e6ff9d]"><Play className="h-3.5 w-3.5 fill-current" /> Try a prompt</button></div></section></div>;
}

function Progress({ onStart }: { onStart: () => void }) {
  return <div className="space-y-7 p-5 sm:p-8"><div><Pill tone="lime">Your practice graph</Pill><h1 className="mt-4 font-display text-3xl font-medium tracking-[-0.055em] text-white">Consistency is the advantage.</h1><p className="mt-2 text-[13px] text-white/40">You’re getting clearer, faster, and more structured.</p></div><div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]"><section className="rounded-2xl border border-white/[0.07] bg-[#111a29]/55 p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg text-white">Skill pulse</h2><p className="mt-1 text-[11px] text-white/30">Average across your last 5 sessions</p></div><Pill tone="lime">+8% this month</Pill></div><div className="mt-8 space-y-5">{[["Story structure", 84, "#d8f97a"], ["Clarity & brevity", 76, "#82a9ff"], ["Trade-off thinking", 71, "#ff8f70"], ["Executive presence", 68, "#c5a7ff"]].map(([name, value, color]) => <div key={name as string}><div className="mb-2 flex items-center justify-between text-[11px]"><span className="text-white/55">{name as string}</span><span className="text-white/35">{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color as string }} /></div></div>)}</div></section><section className="rounded-2xl border border-white/[0.07] bg-[#111a29]/55 p-5 sm:p-6"><div className="flex items-center gap-2 text-[#ff9b80]"><Trophy className="h-4 w-4" /><span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Next unlock</span></div><h2 className="mt-5 font-display text-2xl tracking-[-0.04em] text-white">The sharpener</h2><p className="mt-2 text-[12px] leading-5 text-white/35">Complete 3 more technical sessions with a 75+ score.</p><div className="mt-6 flex items-end gap-2"><span className="font-display text-3xl text-[#d8f97a]">2</span><span className="mb-1 text-[11px] text-white/30">of 5 complete</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full w-2/5 rounded-full bg-[#d8f97a]" /></div><button onClick={onStart} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.09] py-3 text-[11px] text-white/60 transition hover:border-[#d8f97a]/30 hover:text-[#d8f97a]"><Zap className="h-3.5 w-3.5" /> Continue the streak</button></section></div><section className="rounded-2xl border border-white/[0.07] bg-[#111a29]/55 p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-lg text-white">Weekly cadence</h2><p className="mt-1 text-[11px] text-white/30">Minutes practiced over the last 7 days</p></div><span className="text-[11px] text-[#d8f97a]">42 min total</span></div><div className="mt-8 flex h-36 items-end gap-2 sm:gap-4">{[["M", 38], ["T", 62], ["W", 46], ["T", 84], ["F", 33], ["S", 69], ["S", 24]].map(([day, height], index) => <div key={`${day}-${index}`} className="flex flex-1 flex-col items-center gap-2"><div className="flex h-full w-full items-end justify-center"><div className={`w-full max-w-[34px] rounded-t-lg transition hover:opacity-80 ${index === 3 ? "bg-[#d8f97a]" : "bg-white/[0.12]"}`} style={{ height: `${height}%` }} /></div><span className="text-[10px] text-white/25">{day}</span></div>)}</div></section></div>;
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [inSession, setInSession] = useState(false);
  const content = inSession ? <PracticeRoom onExit={() => setInSession(false)} /> : view === "overview" ? <Overview onStart={() => setInSession(true)} setView={setView} /> : view === "knowledge" ? <Knowledge setView={setView} /> : view === "progress" ? <Progress onStart={() => setInSession(true)} /> : <PracticeRoom onExit={() => setInSession(false)} />;
  return <div className="min-h-screen bg-[#0b111d] text-white"><div className="flex min-h-screen"><Sidebar view={view} setView={(next) => { setView(next); setInSession(false); }} onStart={() => setInSession(true)} /><main className="min-w-0 flex-1"><TopBar view={view} onStart={() => setInSession(true)} />{content}</main></div></div>;
}
