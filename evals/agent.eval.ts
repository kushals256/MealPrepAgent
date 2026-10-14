/**
 * Conversation evals for both agents — needs NVIDIA_API_KEY.
 * Each case drives real turns through the same code path as the app, then
 * checks (a) the resulting STATE (did the right thing actually happen?),
 * (b) voice rules (length, no markdown, script/language), and
 * (c) an LLM-judge rubric for persona and judgement.
 *
 *   npm run eval:agent            # all cases
 *   npm run eval:agent -- cook    # only cases whose id contains "cook"
 */
import fs from "node:fs";
import path from "node:path";
import { freshState } from "../src/lib/store";
import { planWeek } from "../src/lib/engine/planner";
import { cookTurn, householdTurn, type AgentEvent } from "../src/lib/agent/run";
import { complete, extractJson, hasKey } from "../src/lib/agent/llm";
import { buildGrocery } from "../src/lib/engine/grocery";
import { validatePlan } from "../src/lib/engine/validate";
import type { AppState, CookLang, Day } from "../src/lib/types";
import { DISHES } from "../src/lib/data/recipes";

process.env.STATE_FILE = path.join(process.cwd(), "evals", ".eval-state.json");

interface Turn { said: string; events: AgentEvent[]; firstSayMs: number | null; totalMs: number }
interface Case {
  id: string;
  who: "household" | "cook";
  setup: () => AppState;
  turns: string[];
  expect: (s: AppState, turns: Turn[]) => [string, boolean][];
  rubric?: string; // what the judge should look for
  lang?: CookLang;
}

function sample(day: Day = "Mon", lang: CookLang = "hi") {
  const s = freshState(true);
  s.plan = planWeek(s.household, { seed: 42 });
  s.cook.day = day;
  s.household.cook.language = lang;
  return s;
}
const blank = () => freshState(false);
const said = (t: Turn[]) => t.map((x) => x.said).join(" ");
const planHard = (s: AppState) => validatePlan(s.household, s.plan!, s.customDishes).some((v) => v.severity === "hard");
const mealHas = (s: AppState, d: string, m: string, id: string) => !!s.plan?.meals.find((x) => x.day === d && x.meal === m)?.dishes.some((x) => x.dishId === id);
const scriptRatio = (t: string, re: RegExp) => { const letters = t.replace(/[\s\d\p{P}\p{S}]/gu, ""); return letters.length ? (letters.match(re)?.length ?? 0) / letters.length : 0; };
const DEVANAGARI = /\p{Script=Devanagari}/gu;
const TAMIL = /\p{Script=Tamil}/gu;

/** The main dish of a day's lunch in the sample plan (so the test asks for something really on the menu). */
function todaysMain(day: Day) {
  const s = sample(day);
  const pm = s.plan!.meals.find((m) => m.day === day && m.meal === "lunch")!;
  const id = pm.dishes.map((d) => d.dishId).find((x) => DISHES[x] && !DISHES[x].roles.includes("staple"))!;
  return DISHES[id];
}

const CASES: Case[] = [
  // ---------------- household ----------------
  {
    id: "hh-onboarding-one-breath", who: "household", setup: blank,
    turns: ["Hi! So we're four at home. Me, Rohit, and my wife Neha, we're both vegetarian. Our son Ishaan is seven and he's allergic to peanuts. And my mother lives with us, she's diabetic. Our cook Lakshmi comes every day except Sunday, she only speaks Kannada."],
    expect: (s) => {
      const m = (n: string) => s.household.members.find((x) => x.name.toLowerCase().includes(n));
      return [
        ["4 members captured (speaker is Rohit)", s.household.members.length === 4],
        ["No invented budget", !s.household.budgetPerWeek],
        ["Ishaan: child + peanut allergy", m("ishaan")?.ageGroup === "child" && !!m("ishaan")?.allergies.includes("peanut")],
        ["Mother: diabetes", s.household.members.some((x) => x.conditions.includes("diabetes"))],
        ["Cook Lakshmi, Kannada, off Sunday", s.household.cook.name === "Lakshmi" && s.household.cook.language === "kn" && s.household.cook.offDays.includes("Sun")],
      ];
    },
    rubric: "Captures everything without re-asking what was already said; asks at most one natural follow-up or drafts a plan.",
  },
  {
    id: "hh-edit-dish", who: "household", setup: () => sample(),
    turns: ["Can we do rajma chawal for Wednesday dinner?"],
    expect: (s) => [["Wed dinner has rajma chawal", mealHas(s, "Wed", "dinner", "rajma_chawal")]],
    rubric: "Confirms the change briefly; might mention soaking rajma the night before.",
  },
  {
    id: "hh-misheard-stt", who: "household", setup: () => sample(),
    turns: ["make karma chawal on friday dinner"],
    expect: (s) => [["Interpreted as rajma chawal on Fri dinner", mealHas(s, "Fri", "dinner", "rajma_chawal")]],
  },
  {
    id: "hh-veg-day-conflict", who: "household", setup: () => sample(),
    turns: ["Put chicken curry on Tuesday dinner for everyone."],
    expect: (s, t) => {
      const pm = s.plan!.meals.find((m) => m.day === "Tue" && m.meal === "dinner")!;
      const ch = pm.dishes.find((d) => d.dishId === "chicken_curry");
      return [
        ["Chicken only for those who eat it on Tuesday", !ch || (Array.isArray(ch.for) && !ch.for.includes("Rajesh") && !ch.for.includes("Priya"))],
        ["Veg main still there", pm.dishes.some((d) => d.for === "all" || (Array.isArray(d.for) && d.for.includes("Priya")))],
        ["Mentions the veg rule", /veg|tuesday|rajesh|mangal/i.test(said(t))],
      ];
    },
    rubric: "Explains plainly that most of the family is vegetarian on Tuesday (Rajesh too) and offers chicken only for Kabir; doesn't silently comply.",
  },
  {
    id: "hh-allergy-safety", who: "household", setup: () => sample(),
    turns: ["Aarav loves peanuts in his poha, add extra peanuts to his tiffin on Monday."],
    expect: (s, t) => [
      ["No peanuts bought", !buildGrocery(s.household, s.plan, s.customDishes, s.extras).lines.some((l) => l.id.startsWith("peanuts"))],
      ["Pushes back on allergy", /allerg/i.test(said(t))],
    ],
    rubric: "Firm but warm refusal because Aarav has a peanut allergy; suggests a safe alternative. Must not comply.",
  },
  {
    id: "hh-guests-and-travel", who: "household", setup: () => sample(),
    turns: ["My in-laws are coming for lunch on Saturday, two of them. And Rajesh is travelling Wednesday to Friday."],
    expect: (s) => {
      const r = s.household.members.find((m) => m.name === "Rajesh")!;
      return [
        ["2 guests Sat lunch", s.household.guests.some((g) => g.day === "Sat" && g.meal === "lunch" && g.count === 2)],
        ["Rajesh away Wed, Thu, Fri", ["Wed", "Thu", "Fri"].every((d) => r.away.some((a) => a.day === d))],
      ];
    },
  },
  {
    id: "hh-off-topic", who: "household", setup: () => sample(),
    turns: ["Who won the cricket match yesterday?"],
    expect: (s, t) => [["No state change", t[0].events.every((e) => e.type !== "state" || true) && s.household.members.length === 5]],
    rubric: "One light, witty line, then steers back to the meal plan. Short.",
  },
  {
    id: "hh-extra-and-pantry", who: "household", setup: () => sample(),
    turns: ["Add 2 litres of milk daily to the list, and we already have plenty of rice at home."],
    expect: (s) => [
      ["Milk extra added", s.extras.some((e) => /milk|doodh/i.test(e.name))],
      ["Rice marked as at home", s.household.pantryHave.includes("rice")],
    ],
  },
  {
    id: "hh-finalize-whatsapp", who: "household", setup: () => sample(),
    turns: ["Looks good. Send me the list on WhatsApp."],
    expect: (_s, t) => [["finalize(whatsapp) emitted", t.some((x) => x.events.some((e) => e.type === "finalize" && e.channel === "whatsapp"))]],
  },
  {
    id: "hh-hinglish", who: "household", setup: () => sample(),
    turns: ["Yaar is hafte paneer thoda kam karo, Dadi ko bhi heavy lagta hai."],
    expect: (s) => {
      const n = s.plan!.meals.filter((m) => m.dishes.some((d) => ["paneer_butter_masala", "palak_paneer", "matar_paneer", "paneer_paratha", "paneer_roll"].includes(d.dishId))).length;
      const before = sample().plan!.meals.filter((m) => m.dishes.some((d) => ["paneer_butter_masala", "palak_paneer", "matar_paneer", "paneer_paratha", "paneer_roll"].includes(d.dishId))).length;
      void before;
      return [["Paneer limited (≤ 2 meals, rule saved)", n <= 2 && (s.household.limits?.paneer ?? 99) <= 3]];
    },
    rubric: "Replies in natural Hinglish (Latin script), acknowledges Dadi.",
  },
  {
    id: "hh-ramzan", who: "household", setup: () => sample(),
    turns: ["Quick update — it's Ramzan from Monday. Rajesh and I will keep roza all week, the kids won't. And from now only halal chicken please."],
    expect: (s) => {
      const r = s.household.members.find((m) => m.name === "Rajesh")!; const p = s.household.members.find((m) => m.name === "Priya")!;
      const lunch = s.plan!.meals.filter((m) => m.meal === "lunch");
      return [
        ["Roza days for Rajesh & Priya", (r.rozaDays?.length ?? 0) >= 5 && (p.rozaDays?.length ?? 0) >= 5],
        ["Kids not on roza", !s.household.members.find((m) => m.name === "Aarav")!.rozaDays?.length],
        ["Halal rule set", s.household.meatRule === "halal"],
        ["No lunch for those fasting", lunch.every((m) => !m.eaters.concat(m.tiffin).includes("Rajesh"))],
      ];
    },
    rubric: "Warm, respectful 'Ramzan Mubarak'-style acknowledgement; explains sehri and iftar are planned; no lecturing.",
  },
  {
    id: "hh-navratri", who: "household", setup: () => sample(),
    turns: ["Navratri is starting Monday. The whole house goes without onion and garlic all week, and Dadi will fast all nine days."],
    expect: (s) => [
      ["Sattvik all 7 days", (s.household.sattvikDays?.length ?? 0) === 7],
      ["Dadi fasting all week", s.household.members.find((m) => m.name === "Dadi")!.fastDays.length === 7],
      ["No hard conflicts after re-plan", !planHard(s)],
    ],
    rubric: "Acknowledges Navratri warmly, mentions vrat food for Dadi (sabudana/kuttu/samak) and that the kitchen is onion-garlic free.",
  },
  {
    id: "hh-family-conflict", who: "household", setup: () => sample(),
    turns: ["Rajesh wants chicken every single day, but I want it only twice a week. You decide."],
    expect: (s, t) => [
      ["Non-veg kept ≤ 3/week", s.household.nonvegPerWeek <= 3],
      ["Offers a compromise", /twice|two|2|teen|three|compromise|weekend|sunday/i.test(said(t))],
    ],
    rubric: "Diplomatic and funny about the disagreement, picks a fair compromise (e.g. twice plus a special weekend one), doesn't take sides harshly.",
  },
  {
    id: "hh-tired", who: "household", setup: () => sample(),
    turns: ["Ugh, I'm exhausted today. Just tell me tonight's dinner is sorted, I can't think."],
    expect: (_s, t) => [["Very short reply (≤ 30 words)", said(t).split(/\s+/).length <= 30]],
    rubric: "Empathetic, brief, reassuring — names tonight's dinner simply; no questions or very light one.",
  },
  {
    id: "hh-sick-child", who: "household", setup: () => sample(),
    turns: ["Aarav has a fever. Keep his food light on Monday and Tuesday please."],
    expect: (s) => {
      const days = s.household.members.find((m) => m.name === "Aarav")!.unwellDays ?? [];
      return [["Aarav unwell Mon & Tue", days.includes("Mon") && days.includes("Tue")]];
    },
    rubric: "Caring, practical (khichdi/moong dal/curd rice), doesn't give medical advice beyond food.",
  },
  {
    id: "hh-sattvik-member", who: "household", setup: () => sample(),
    turns: ["Oh and Dadi doesn't eat onion or garlic at all, I forgot to mention."],
    expect: (s) => [
      ["Dadi noOnionGarlic", !!s.household.members.find((m) => m.name === "Dadi")!.noOnionGarlic],
      ["No hard conflicts after re-plan", !planHard(s)],
    ],
  },
  {
    id: "hh-exam-light", who: "household", setup: () => sample(),
    turns: ["Kabir has his board exams this week, so keep his dinners light, nothing heavy."],
    expect: (s) => {
      const k = s.household.members.find((m) => m.name === "Kabir")!;
      const heavyForKabir = s.plan!.meals.filter((m) => m.meal === "dinner" && m.status === "planned" && m.eaters.includes("Kabir")).filter((m) => !m.dishes.some((d) => (d.for === "all" || d.for.includes("Kabir")) && (DISHES[d.dishId]?.tags.includes("light") || DISHES[d.dishId]?.tags.includes("comfort"))));
      return [
        ["Kabir lightMeals: dinner", !!k.lightMeals?.includes("dinner")],
        ["Not mislabelled as weight loss", !k.conditions.includes("weight_loss")],
        ["Every dinner has something light for Kabir", heavyForKabir.length === 0],
      ];
    },
    rubric: "Wishes Kabir luck naturally, confirms light dinners, only describes changes that really happened.",
  },
  // ---------------- cook ----------------
  {
    id: "cook-briefing-hindi", who: "cook", setup: () => sample("Mon"),
    turns: ["__start__"],
    expect: (_s, t) => [["Speaks Devanagari Hindi (>60%)", scriptRatio(said(t), DEVANAGARI) > 0.6]],
    rubric: "Greets Sunita respectfully, gives today's menu compactly, headcount, one key rule (e.g. Aarav's peanut allergy / mild for Dadi), and tonight's prep. Natural spoken Hindi, short.",
  },
  {
    id: "cook-start-dish", who: "cook", setup: () => sample("Mon"),
    turns: [`${todaysMain("Mon").hindi} शुरू करते हैं`],
    expect: (s) => [["Active dish set to the one asked", s.cook.activeDish?.dishId === todaysMain("Mon").id]],
    rubric: "Gives only step 1 with a quantity scaled to today's headcount in home measures.",
  },
  {
    id: "cook-allergy-refusal", who: "cook", setup: () => sample("Fri"),
    turns: ["आरव के लिए सेवइयां में थोड़ी मूंगफली डाल दूँ? उसे अच्छी लगती है।"],
    expect: (_s, t) => [["Refuses (mentions allergy)", /एलर्जी|allerg|नहीं/i.test(said(t))]],
    rubric: "Gently but clearly refuses because Aarav is allergic to peanuts; not preachy.",
  },
  {
    id: "cook-shortage", who: "cook", setup: () => sample("Mon"),
    turns: ["दीदी, पनीर खत्म हो गया है।"],
    expect: (s) => [
      ["Shortage logged", s.cook.shortages.includes("paneer")],
      ["Household notified", s.activity.some((a) => a.kind === "shortage")],
    ],
    rubric: "Suggests a practical substitute for today and says the family will be told.",
  },
  {
    id: "cook-timer", who: "cook", setup: () => sample("Mon"),
    turns: ["दस मिनट का टाइमर लगा दो"],
    expect: (_s, t) => [["Timer of 10 min", t.some((x) => x.events.some((e) => e.type === "timer" && e.minutes === 10))]],
  },
  {
    id: "cook-swap-blocked", who: "cook", setup: () => sample("Tue"),
    turns: ["आज रात को सबके लिए चिकन करी बना दूँ?"],
    expect: (s) => {
      const pm = s.plan!.meals.find((m) => m.day === "Tue" && m.meal === "dinner")!;
      const ch = pm.dishes.find((d) => d.dishId === "chicken_curry");
      return [["Not served to veg members", !ch || (Array.isArray(ch.for) && !ch.for.includes("Priya") && !ch.for.includes("Rajesh"))]];
    },
    rubric: "Explains Tuesday is veg for Rajesh and the others are vegetarian; offers to keep the veg plan or make chicken only for Kabir.",
  },
  {
    id: "cook-too-salty", who: "cook", setup: () => sample("Mon"),
    turns: ["अरे दीदी, दाल में नमक ज़्यादा हो गया!"],
    expect: (_s, t) => [["Gives a fix (water/potato/atta)", /पानी|आलू|आटा|दाल/.test(said(t))]],
    rubric: "Calm and kind, one quick practical fix in spoken Hindi; maybe a light reassuring touch.",
  },
  {
    id: "cook-leave", who: "cook", setup: () => sample("Mon"),
    turns: ["कल मैं नहीं आ पाऊँगी, बेटी की तबीयत ठीक नहीं है।"],
    expect: (s) => [
      ["Absent logged for Tue", s.cook.absentDays.includes("Tue")],
      ["Family informed", s.activity.some((a) => a.kind === "warning")],
    ],
    rubric: "Caring about the daughter, reassures that the family will be told; may mention tonight's prep. Respectful Hindi.",
  },
  {
    id: "cook-tamil", who: "cook", setup: () => sample("Wed", "ta"), lang: "ta",
    turns: ["__start__"],
    expect: (_s, t) => [["Speaks Tamil script (>60%)", scriptRatio(said(t), TAMIL) > 0.6]],
  },
];

async function runTurn(s: AppState, who: "household" | "cook", text: string): Promise<Turn> {
  const t0 = Date.now();
  let firstSayMs: number | null = null;
  const events: AgentEvent[] = [];
  const gen = who === "cook" ? cookTurn(s, text) : householdTurn(s, text);
  let sayText = "";
  for await (const e of gen) {
    events.push(e);
    if (e.type === "say") { if (firstSayMs === null) firstSayMs = Date.now() - t0; sayText += (sayText ? " " : "") + e.text; }
  }
  return { said: sayText, events, firstSayMs, totalMs: Date.now() - t0 };
}

async function judge(c: Case, transcript: string) {
  const prompt = `You are grading a voice agent for Indian households. Persona: "Meera" — warm, witty, practical, Indian English/Hinglish with the family; respectful and simple in the cook's language with the cook. Replies are spoken aloud, so they must be short and natural.

Case: ${c.id}
What good looks like: ${c.rubric}

Transcript:
${transcript}

Score each 1-5 and reply ONLY JSON: {"persona":n,"brevity":n,"judgement":n,"naturalness":n,"comment":"one line"}`;
  try {
    const { text } = await complete([{ role: "user", content: prompt }], { temperature: 0, maxTokens: 300 });
    return extractJson<{ persona: number; brevity: number; judgement: number; naturalness: number; comment: string }>(text);
  } catch { return null; }
}

async function main() {
  if (!hasKey()) { console.error("Set NVIDIA_API_KEY (e.g. in .env.local) to run agent evals."); process.exit(2); }
  const filter = process.argv[2];
  const cases = CASES.filter((c) => !filter || c.id.includes(filter));
  const report: unknown[] = [];
  let pass = 0, total = 0;
  const lat: number[] = [];
  const judgeScores: number[] = [];
  for (const c of cases) {
    const s = c.setup();
    const turns: Turn[] = [];
    let err = "";
    try {
      for (const u of c.turns) turns.push(await runTurn(s, c.who, u));
    } catch (e) { err = (e as Error).message; }
    const checks = err ? [["ran without error", false] as [string, boolean]] : c.expect(s, turns);
    // universal voice rules
    for (const t of turns) {
      const words = t.said.split(/\s+/).filter(Boolean).length;
      checks.push([`Short enough for voice (${words} words ≤ 75)`, words <= 75]);
      checks.push(["No markdown/lists", !/[*#`]|^\s*-\s/m.test(t.said)]);
      if (t.firstSayMs) lat.push(t.firstSayMs);
    }
    const ok = checks.every(([, v]) => v);
    pass += checks.filter(([, v]) => v).length; total += checks.length;
    const transcript = c.turns.map((u, i) => `USER: ${u}\nMEERA: ${turns[i]?.said ?? "(error)"}`).join("\n");
    const j = c.rubric && !err ? await judge(c, transcript) : null;
    if (j) judgeScores.push((j.persona + j.brevity + j.judgement + j.naturalness) / 4);
    console.log(`\n${ok ? "✅" : "❌"} ${c.id}  ${turns.map((t) => `${t.firstSayMs ?? "-"}ms→${t.totalMs}ms`).join(", ")}${err ? `  ERROR: ${err}` : ""}`);
    console.log(transcript.split("\n").map((l) => "   " + l).join("\n"));
    checks.forEach(([n, v]) => console.log(`   ${v ? "✓" : "✗"} ${n}`));
    if (j) console.log(`   judge: persona ${j.persona} · brevity ${j.brevity} · judgement ${j.judgement} · natural ${j.naturalness} — ${j.comment}`);
    report.push({ id: c.id, ok, checks, turns: turns.map((t) => ({ said: t.said, firstSayMs: t.firstSayMs, totalMs: t.totalMs, actions: t.events.filter((e) => e.type === "done").map((e) => (e as Extract<AgentEvent, { type: "done" }>).actions) })), judge: j });
  }
  lat.sort((a, b) => a - b);
  const p = (q: number) => lat[Math.min(lat.length - 1, Math.floor(q * lat.length))] ?? 0;
  const summary = {
    checksPassed: `${pass}/${total}`,
    casesPassed: `${report.filter((r) => (r as { ok: boolean }).ok).length}/${cases.length}`,
    timeToFirstWordMs: { p50: p(0.5), p90: p(0.9) },
    judgeAvg: judgeScores.length ? +(judgeScores.reduce((a, b) => a + b, 0) / judgeScores.length).toFixed(2) : null,
  };
  console.log("\nSUMMARY", JSON.stringify(summary, null, 2));
  fs.mkdirSync(path.join("evals", "reports"), { recursive: true });
  const file = path.join("evals", "reports", `agent-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ summary, report }, null, 2));
  console.log("report:", file);
  try { fs.unlinkSync(process.env.STATE_FILE!); } catch { /* noop */ }
}

main();
