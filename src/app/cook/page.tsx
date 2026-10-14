"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAppState } from "@/components/useAppState";
import { useVoiceAgent } from "@/components/useVoiceAgent";
import { VoiceOrb } from "@/components/VoiceOrb";
import { TextInput, Transcript } from "@/components/Transcript";
import { Badge } from "@/components/PlanGrid";
import { DAYS, type CookLang } from "@/lib/types";

const UI: Record<string, { hello: string; tap: string; listening: string; thinking: string; speaking: string; today: string; prep: string; step: string; people: string; ji: string; hint: string }> = {
  hi: { hello: "नमस्ते", tap: "बोलने के लिए दबाइए", listening: "सुन रही हूँ…", thinking: "सोच रही हूँ…", speaking: "बोल रही हूँ — रोकने के लिए दबाइए", today: "आज का खाना", prep: "आज रात की तैयारी", step: "स्टेप", people: "लोग", ji: "जी", hint: "बोलिए: “आज क्या बनाना है?” · “दाल शुरू करते हैं” · “आगे” · “पनीर खत्म हो गया” · “10 मिनट का टाइमर”" },
  en: { hello: "Namaste", tap: "Tap to talk", listening: "Listening…", thinking: "Thinking…", speaking: "Speaking — tap to stop", today: "Today's food", prep: "Tonight's prep", step: "Step", people: "people", ji: "ji", hint: "Say: “What's for today?” · “Let's start the dal” · “Next” · “Paneer is finished” · “10 minute timer”" },
};
const ALARM: Record<string, string> = { hi: "टाइमर पूरा हुआ", en: "Timer is done", ta: "டைமர் முடிந்தது", te: "టైమర్ పూర్తయింది", kn: "ಟೈಮರ್ ಮುಗಿದಿದೆ", mr: "टायमर संपला", bn: "টাইমার শেষ", gu: "ટાઈમર પૂરો થયો", ml: "ടൈമർ കഴിഞ്ഞു" };
const FILLERS: Record<string, string[]> = {
  hi: ["हम्म, एक सेकंड।", "अच्छा, देखती हूँ।"], en: ["Hmm, one second.", "Okay, let me see."], ta: ["ம்ம், ஒரு நிமிஷம்."], te: ["హ్మ్, ఒక్క నిమిషం."],
  kn: ["ಹ್ಮ್, ಒಂದು ನಿಮಿಷ."], mr: ["हम्म, एक मिनिट."], bn: ["হুম, এক সেকেন্ড।"], gu: ["હમ્મ, એક મિનિટ."], ml: ["ഹ്മ്, ഒരു നിമിഷം."],
};
// what the listen button "says" to Meera on the cook's behalf
const LISTEN: Record<string, (meal: string) => string> = {
  hi: (m) => `आज ${m === "breakfast" ? "नाश्ते" : m === "lunch" ? "दोपहर के खाने" : "रात के खाने"} में क्या बनाना है और किसके लिए क्या ध्यान रखना है?`,
  en: (m) => `What's for ${m} today, and anything special I should keep in mind?`,
};
const LANG_NAMES: Record<CookLang, string> = { hi: "हिन्दी", en: "English", ta: "தமிழ்", te: "తెలుగు", kn: "ಕನ್ನಡ", mr: "मराठी", bn: "বাংলা", gu: "ગુજરાતી", ml: "മലയാളം" };

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
    });
  } catch { /* noop */ }
}

export default function CookPage() {
  const { vm, refresh, op } = useAppState(2000);
  const [started, setStarted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef<Set<string>>(new Set());
  const lang = (vm?.cookLang.code ?? "hi") as CookLang;
  const t = UI[lang] ?? { ...UI.en, hello: vm?.cookLang.greet ?? "Namaste" };

  const agent = useVoiceAgent({
    who: "cook",
    sttLang: vm?.cookLang.stt ?? "hi-IN",
    voice: vm?.cookLang.voice ?? "hi-IN-SwaraNeural",
    rate: "-6%",
    onState: refresh,
    fillers: FILLERS[lang] ?? FILLERS.en,
  });

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  // timer alarms
  useEffect(() => {
    for (const tm of vm?.cook.timers ?? []) {
      if (tm.endsAt <= now && !fired.current.has(tm.id)) {
        fired.current.add(tm.id);
        beep();
        agent.say(`${ALARM[lang] ?? ALARM.en} — ${tm.label}`);
        op({ op: "clearTimer", id: tm.id }).catch(() => {});
      }
    }
  }, [now, vm?.cook.timers, agent, lang, op]);

  const begin = () => { setStarted(true); agent.wantListen.current = true; agent.sendText("__start__"); };

  if (!vm) return <div className="min-h-screen grid place-items-center text-muted">…</div>;
  const cookName = vm.household.cook.name;
  const today = vm.cook.day;
  const meals = vm.plan?.meals.filter((pm) => pm.day === today) ?? [];
  const prep = vm.prep.filter((p) => p.day === today);
  const active = vm.cook.activeDish;
  const activeDish = active ? vm.dishes[active.dishId] : null;
  const timers = vm.cook.timers.filter((x) => x.endsAt > now - 1500);

  return (
    <div className="min-h-screen texture">
      <header className="mx-auto max-w-5xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <Link href="/" className="text-sm text-muted hover:text-ink">← Household</Link>
        <div className="flex items-center gap-2 text-sm">
          <select value={lang} onChange={(e) => { op({ op: "setCookLang", lang: e.target.value }); agent.setLines([]); setStarted(false); }} className="rounded-full border border-line bg-paper px-3 py-1.5">
            {Object.entries(LANG_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-12">
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-xs text-muted mr-1">Demo — pretend today is:</span>
          {DAYS.map((d) => (
            <button key={d} onClick={() => { op({ op: "setCookDay", day: d }); agent.setLines([]); setStarted(false); }} className={`rounded-full px-3 py-1 text-sm font-semibold ${d === today ? "bg-ink text-cream" : "bg-paper border border-line"}`}>{d}</button>
          ))}
        </div>

        {!vm.plan ? (
          <div className="rounded-2xl border border-line bg-paper p-8 text-center">
            <div className="font-display text-3xl">{t.hello} {cookName} {t.ji} 🙏</div>
            <p className="text-muted mt-2">The family hasn&apos;t made this week&apos;s plan yet. Ask them to talk to Meera on the home screen.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-[1fr_1.1fr] gap-5">
            <section className="rounded-2xl border border-line bg-paper p-5 flex flex-col">
              <div className="font-display text-3xl">{t.hello} {cookName} {t.ji} 🙏</div>
              <div className="text-sm text-muted">{today} · {vm.cookLang.name}</div>
              <div className="flex justify-center py-5">
                <VoiceOrb status={agent.status} onClick={started ? agent.toggle : begin} size={170} labels={{ idle: t.tap, listening: t.listening, thinking: t.thinking, speaking: t.speaking }} />
              </div>
              {agent.error && <div className="text-xs text-mirch bg-mirch-soft rounded-lg px-3 py-2 mb-2">{agent.error}</div>}
              {timers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {timers.map((tm) => {
                    const left = Math.max(0, Math.round((tm.endsAt - now) / 1000));
                    return <div key={tm.id} className={`rounded-xl px-3 py-2 font-mono text-lg ${left === 0 ? "bg-mirch text-white" : "bg-haldi-soft text-masala"}`}>⏱ {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} <span className="font-sans text-xs">{tm.label}</span></div>;
                  })}
                </div>
              )}
              <Transcript lines={agent.lines} interim={agent.interim} agentName="Meera" userName={cookName} className="flex-1 min-h-[160px] max-h-[40vh]" />
              <div className="pt-3"><TextInput onSend={(x) => { setStarted(true); agent.sendText(x); }} placeholder={lang === "hi" ? "या लिखिए…" : "Or type…"} /></div>
              <p className="text-[11px] text-muted mt-2">{t.hint}</p>
            </section>

            <section className="space-y-4">
              {active && activeDish && (
                <div className="rounded-2xl bg-ink text-cream p-5">
                  <div className="text-xs uppercase tracking-wider text-haldi">{t.step} {active.step + 1} / {activeDish.steps.length} · {activeDish.name}</div>
                  <div className="font-display text-2xl mt-2 leading-snug">{activeDish.steps[active.step]}</div>
                  <div className="flex gap-1 mt-3">{activeDish.steps.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= active.step ? "bg-haldi" : "bg-cream/20"}`} />)}</div>
                </div>
              )}
              <div className="rounded-2xl border border-line bg-paper p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-masala mb-2">{t.today}</div>
                <div className="space-y-3">
                  {meals.map((pm) => {
                    const done = pm.status === "done";
                    const n = pm.eaters.length + pm.tiffin.length + pm.guests;
                    return (
                      <div key={pm.meal} className={`rounded-xl border border-line p-3 ${done ? "opacity-60" : ""}`}>
                        <div className="flex justify-between items-baseline gap-2">
                          <div className="font-semibold capitalize flex items-center gap-2">
                            {pm.meal}
                            {pm.status === "planned" && (
                              <button
                                onClick={() => { setStarted(true); agent.sendText(LISTEN[lang]?.(pm.meal) ?? LISTEN.en(pm.meal)); }}
                                className="rounded-full bg-haldi-soft text-masala text-xs px-2 py-0.5 font-semibold"
                                title="Meera explains this meal aloud"
                              >🔊 {lang === "hi" ? "सुनिए" : "Listen"}</button>
                            )}
                          </div>
                          <div className="text-xs text-muted">{pm.status === "eat_out" ? "eating out" : `${n} ${t.people}`}{pm.cookedBy === "household" ? " · family cooks" : ""}</div>
                        </div>
                        {pm.status !== "eat_out" && pm.status !== "skipped" && (
                          <div className="mt-1 space-y-0.5">
                            {pm.dishes.map((d) => (
                              <div key={d.dishId} className="text-[15px]">
                                <span className="font-medium">{vm.dishes[d.dishId]?.hindi && lang === "hi" ? vm.dishes[d.dishId].hindi : vm.dishes[d.dishId]?.name}</span>
                                {d.for !== "all" && <span className="text-xs text-masala"> — {d.for.join(", ")}</span>}
                                <span className="text-xs text-muted"> · {vm.dishes[d.dishId]?.minutes}m</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {done && <Badge tone="patta">done ✓</Badge>}
                          {pm.guests > 0 && <Badge tone="haldi">+{pm.guests} guests</Badge>}
                          {pm.tiffin.length > 0 && <Badge>tiffin: {pm.tiffin.join(", ")}</Badge>}
                        </div>
                        {pm.notes.length > 0 && <ul className="mt-1.5 text-xs text-muted space-y-0.5">{pm.notes.map((x, i) => <li key={i}>• {x}</li>)}</ul>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-paper p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-masala mb-1.5">{t.prep}</div>
                {prep.length ? <ul className="text-sm space-y-1">{prep.map((p, i) => <li key={i}>🫘 {p.text}</li>)}</ul> : <p className="text-sm text-muted">—</p>}
              </div>
              {vm.standing.length > 0 && (
                <div className="rounded-2xl border border-mirch/30 bg-mirch-soft/40 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-mirch mb-1.5">Family rules</div>
                  <ul className="text-sm space-y-1">{vm.standing.map((n, i) => <li key={i}>• {n}</li>)}</ul>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
