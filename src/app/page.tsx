"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAppState } from "@/components/useAppState";
import { useVoiceAgent } from "@/components/useVoiceAgent";
import { VoiceOrb } from "@/components/VoiceOrb";
import { TextInput, Transcript } from "@/components/Transcript";
import { PlanGrid } from "@/components/PlanGrid";
import { GroceryPanel, OrderModal } from "@/components/Grocery";
import { ActivityFeed, FamilyPanel } from "@/components/Household";

const VOICE = "en-IN-NeerjaExpressiveNeural";
type Tab = "plan" | "grocery" | "family" | "kitchen";

export default function Home() {
  const { vm, refresh, op } = useAppState();
  const [order, setOrder] = useState<null | "instamart" | "whatsapp">(null);
  const [tab, setTab] = useState<Tab>("plan");
  const [started, setStarted] = useState(false);
  const hydrated = useRef(false);

  const agent = useVoiceAgent({
    who: "household",
    sttLang: "en-IN",
    voice: VOICE,
    onState: refresh,
    onFinalize: (e) => { setTab("grocery"); setOrder(e.channel); },
    fillers: ["Hmm, one sec.", "Achha, let me see.", "Hmm, okay.", "Ek second."],
  });

  // restore transcript from the server once
  useEffect(() => {
    if (vm && !hydrated.current) {
      hydrated.current = true;
      agent.setLines(vm.householdChat.map((t, i) => ({ id: `h${i}`, role: t.role, text: t.content })));
    }
  }, [vm, agent]);

  // switch to groceries the first time a plan exists? keep plan; but surface new kitchen activity
  const lastActivity = useRef<string | null>(null);
  useEffect(() => {
    const a = vm?.activity[0];
    if (!a || a.who !== "cook") return;
    if (lastActivity.current && lastActivity.current !== a.at) agent.setLines((l) => [...l, { id: a.at, role: "system", text: `Kitchen update — ${a.text}` }]);
    lastActivity.current = a.at;
  }, [vm?.activity, agent]);

  // Space bar = push to talk / barge in
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement) && started) { e.preventDefault(); agent.toggle(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [agent, started]);

  const greet = (v = vm) => {
    if (!v) return;
    let g: string;
    if (v.householdChat.length) g = "Welcome back! I've got everything from last time. What's changed?";
    else if (v.plan) g = `Namaste! I've loaded the ${v.household.familyName || "family"} — ${v.household.members.length} people, and a draft week is on screen. Tell me what you'd like to change, or ask me why I picked something.`;
    else g = "Namaste! I'm Meera. I'll plan your family's meals for the week, sort the groceries, and brief your cook every morning. So tell me — who all eat at home?";
    agent.wantListen.current = true;
    agent.say(g);
  };

  const begin = () => { setStarted(true); greet(); };
  const loadSample = async (scenario = "sharma") => {
    const v = await op({ op: "reset", scenario });
    agent.setLines([]);
    setStarted(true);
    setTab("plan");
    agent.wantListen.current = true;
    const hh = v.household;
    const intro = scenario === "sharma"
      ? "Namaste! I've loaded the Sharma family. Five people, Aarav's peanut allergy, Dadi's sugar, Priya's Thursday fast, and Sunita off on Sundays. The draft week is on screen. What would you like to change?"
      : `Namaste! I've loaded the ${hh.familyName} from ${hh.city}, ${hh.members.length} people. ${v.why[0] ?? ""}. The draft week is on screen — what would you like to change?`;
    agent.say(intro);
  };
  const startFresh = async () => {
    if (!confirm("Start over with a new household? This clears the plan.")) return;
    const v = await op({ op: "reset", sample: false });
    agent.setLines([]);
    setStarted(true);
    greet(v);
  };

  if (!vm) return <div className="min-h-screen grid place-items-center text-muted">Loading the kitchen…</div>;

  const showLanding = !started && !vm.plan && !vm.householdChat.length;

  return (
    <div className="min-h-screen texture">
      <Header scenarios={vm.scenarios} onSample={loadSample} onFresh={startFresh} onUndo={() => op({ op: "undo" })} />
      {!vm.llm.configured && (
        <div className="mx-auto max-w-6xl px-4"><div className="rounded-xl bg-mirch-soft text-mirch text-sm px-4 py-2 mb-3">No LLM key found. Add <code>NVIDIA_API_KEY</code> to <code>.env.local</code> and restart <code>npm run dev</code>. (Voice, plan engine and grocery list still work via the buttons.)</div></div>
      )}

      {showLanding ? (
        <main className="mx-auto max-w-5xl px-4 pt-6 pb-16">
          <section className="text-center">
            <p className="inline-block rounded-full bg-haldi-soft text-masala text-xs font-semibold px-3 py-1 mb-5">Voice-first · Indian English, Hindi & 7 more languages for the cook</p>
            <h1 className="font-display text-4xl sm:text-6xl leading-[1.05] tracking-tight">Plan the week&apos;s khana<br />by just <span className="text-mirch">talking</span>.</h1>
            <p className="mt-4 text-muted text-lg max-w-2xl mx-auto">Meera plans around your real household — Dadi&apos;s sugar, the kid&apos;s peanut allergy, Thursday fasts, tiffins and the cook&apos;s day off — builds the grocery list, and then talks your cook through it every day, in her language.</p>
            <div className="mt-10 flex justify-center"><VoiceOrb status={agent.status} onClick={begin} size={190} labels={{ idle: "Tap to start talking" }} /></div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button onClick={() => loadSample()} className="rounded-full border border-ink/15 bg-paper px-5 py-2.5 text-sm font-semibold hover:border-ink/40">Try a messy joint family →</button>
              <Link href="/cook" className="rounded-full border border-ink/15 bg-paper px-5 py-2.5 text-sm font-semibold hover:border-ink/40">I&apos;m the cook 👩‍🍳</Link>
            </div>
            {!agent.supported && <p className="mt-4 text-sm text-mirch">This browser has no speech recognition — use Chrome or Edge for voice. You can still type.</p>}
          </section>
          <section className="mt-16 grid sm:grid-cols-3 gap-4">
            {[
              ["🗣️", "Talks like family", "Hinglish welcome. Interrupt her anytime. She pushes back on paneer five days running."],
              ["🧮", "A real planning engine", "Allergies, Jain, fasts, veg-Tuesdays, tiffins, guests, the cook's time — checked on every change."],
              ["👩‍🍳", "Then runs the kitchen", "Morning briefing, step-by-step recipes, timers, shortages and swaps — in Hindi, Tamil, Kannada…"],
            ].map(([i, t, d]) => (
              <div key={t} className="rounded-2xl border border-line bg-paper p-5">
                <div className="text-2xl">{i}</div>
                <div className="font-display text-xl mt-2">{t}</div>
                <p className="text-sm text-muted mt-1">{d}</p>
              </div>
            ))}
          </section>
        </main>
      ) : (
        <main className="mx-auto max-w-[1400px] px-4 pb-10 grid lg:grid-cols-[400px_1fr] gap-5">
          <aside className="lg:sticky lg:top-4 lg:self-start rounded-2xl border border-line bg-paper/90 backdrop-blur p-4 flex flex-col lg:h-[calc(100vh-96px)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-xl">Meera</div>
                <div className="text-xs text-muted">your kitchen planner · {agent.lastLatency ? `${(agent.lastLatency / 1000).toFixed(1)}s to first word` : "en-IN voice"}</div>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                <input type="checkbox" checked={agent.handsFree} onChange={(e) => agent.setHandsFree(e.target.checked)} className="accent-[var(--patta)]" /> hands-free
              </label>
            </div>
            <div className="flex justify-center py-4"><VoiceOrb status={agent.status} onClick={() => { if (!started) setStarted(true); agent.toggle(); }} size={120} /></div>
            {agent.error && <div className="text-xs text-mirch bg-mirch-soft rounded-lg px-3 py-2 mb-2">{agent.error}</div>}
            <Transcript lines={agent.lines} interim={agent.interim} className="flex-1 min-h-[220px] max-h-[50vh] lg:max-h-none" />
            <div className="pt-3"><TextInput onSend={(t) => { setStarted(true); agent.sendText(t); }} placeholder="Or type — “Kabir is away Friday”" /></div>
            <div className="text-[11px] text-muted mt-2">Space = talk / interrupt · try “no paneer on Wednesday”, “my parents are coming Sunday lunch”, “send it on WhatsApp”</div>
          </aside>

          <section className="min-w-0">
            <nav className="flex gap-1 mb-4 overflow-x-auto scrollbar-thin">
              {([
                ["plan", "Week plan"],
                ["grocery", vm.grocery ? `Groceries · ₹${vm.grocery.total.toLocaleString("en-IN")}` : "Groceries"],
                ["family", `Family · ${vm.household.members.length}`],
                ["kitchen", `Kitchen feed${vm.activity.length ? ` · ${vm.activity.length}` : ""}`],
              ] as [Tab, string][]).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${tab === k ? "bg-ink text-cream" : "bg-paper border border-line hover:border-ink/30"}`}>{l}</button>
              ))}
            </nav>
            <div className="rounded-2xl border border-line bg-cream/60 p-4">
              {tab === "plan" && (vm.plan ? <PlanGrid vm={vm} onToggleLock={(day, meal, dishId) => op({ op: "toggleLock", day, meal, dishId })} /> : <Empty vm={vm} />)}
              {tab === "grocery" && (vm.grocery ? <GroceryPanel vm={vm} onOrder={setOrder} /> : <p className="text-muted text-sm">The list appears as soon as there&apos;s a plan.</p>)}
              {tab === "family" && <FamilyPanel vm={vm} />}
              {tab === "kitchen" && <ActivityFeed vm={vm} />}
            </div>
            {vm.plan && (
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <button onClick={() => op({ op: "regenerate" })} className="rounded-full border border-line bg-paper px-3 py-1.5 hover:border-ink/30">↻ Fresh ideas (keeps pins)</button>
                <Link href="/cook" target="_blank" className="rounded-full border border-line bg-paper px-3 py-1.5 hover:border-ink/30">Open cook mode in new tab ↗</Link>
              </div>
            )}
          </section>
        </main>
      )}
      {order && vm.grocery && (
        <OrderModal vm={vm} channel={order} onClose={() => setOrder(null)} onPlaced={(c, phone) => op({ op: "order", channel: c, phone })} />
      )}
    </div>
  );
}

function Empty({ vm }: { vm: NonNullable<ReturnType<typeof useAppState>["vm"]> }) {
  return (
    <div className="space-y-4">
      <p className="text-muted text-sm">No plan yet. As you talk, Meera fills in what she knows — once she knows who eats what, she drafts the week.</p>
      <FamilyPanel vm={vm} />
    </div>
  );
}

function Header({ scenarios, onSample, onFresh, onUndo }: { scenarios: { key: string; name: string; city: string; size: number }[]; onSample: (k: string) => void; onFresh: () => void; onUndo: () => void }) {
  return (
    <header className="mx-auto max-w-[1400px] px-4 py-4 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2">
        <span className="grid place-items-center w-9 h-9 rounded-full bg-haldi text-white font-display text-lg">र</span>
        <span className="font-display text-2xl">Rasoi</span>
        <span className="text-xs text-muted mt-1 hidden sm:inline">with Meera</span>
      </Link>
      <nav className="flex items-center gap-1 text-sm">
        <button onClick={onUndo} className="rounded-full px-3 py-1.5 hover:bg-paper">Undo</button>
        <select
          value=""
          onChange={(e) => e.target.value && onSample(e.target.value)}
          className="rounded-full px-3 py-1.5 bg-transparent hover:bg-paper hidden sm:inline cursor-pointer"
          title="Load a messy real-world household"
        >
          <option value="">Demo households…</option>
          {scenarios.map((x) => <option key={x.key} value={x.key}>{x.name} · {x.city} · {x.size}</option>)}
        </select>
        <button onClick={onFresh} className="rounded-full px-3 py-1.5 hover:bg-paper">New household</button>
        <Link href="/cook" className="rounded-full bg-ink text-cream px-4 py-1.5 font-semibold">Cook mode</Link>
      </nav>
    </header>
  );
}
