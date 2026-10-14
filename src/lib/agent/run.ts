import { applyHouseholdActions, diffPlans, type Action } from "../engine/actions";
import { applyCookActions } from "../engine/cookActions";
import { saveState } from "../store";
import type { AppState, ChatTurn } from "../types";
import { catalogText, cookDayText, householdContext } from "./context";
import { extractJson, SayStreamer, streamChat, type Msg } from "./llm";
import { cookSystem, householdSystem } from "./prompts";
import { fixScript } from "./script";

export type AgentEvent =
  | { type: "say"; text: string }
  | { type: "state"; version: number }
  | { type: "finalize"; channel: "instamart" | "whatsapp"; phone?: string }
  | { type: "timer"; minutes: number; label: string }
  | { type: "done"; say: string; model?: string; ms: number; actions: Action[]; results: string[] }
  | { type: "error"; message: string };

interface Reply { say?: string; actions?: Action[]; followup?: boolean }

const HISTORY_TURNS = 14;

async function* speakOnce(messages: Msg[]): AsyncGenerator<AgentEvent, { reply: Reply; raw: string; model?: string }> {
  const ss = new SayStreamer();
  let raw = "";
  let model: string | undefined;
  const it = streamChat(messages, { temperature: 0.55, maxTokens: 2200 });
  while (true) {
    const r = await it.next();
    if (r.done) { model = r.value.model; break; }
    raw += r.value;
    for (const s of ss.push(r.value)) yield { type: "say", text: s };
  }
  for (const s of ss.flush()) yield { type: "say", text: s };
  let reply = extractJson<Reply>(raw);
  if (!reply) {
    // model ignored the format — speak whatever prose it gave
    const prose = raw.replace(/```[\s\S]*?```/g, "").trim();
    reply = { say: prose.slice(0, 400), actions: [] };
    yield { type: "say", text: reply.say! };
  }
  if (!Array.isArray(reply.actions)) reply.actions = [];
  return { reply, raw, model };
}

function historyMsgs(h: ChatTurn[]): Msg[] {
  return h.slice(-HISTORY_TURNS).map((t) => ({ role: t.role, content: t.role === "assistant" ? JSON.stringify({ say: t.content }) : t.content }));
}

/** User/LLM language that means "please make or show the week plan". */
function wantsPlan(userText: string, say: string, hasPlan: boolean): boolean {
  const u = userText.toLowerCase();
  const s = say.toLowerCase();
  if (/\b(generate|make|create|draft|build|show|give|pull up)\b.{0,40}\bplan\b|\bplan\b.{0,24}\b(ready|please|now|show|generate|bana|dikha)/i.test(u)) return true;
  if (/\b(is|plan)\b.{0,20}\b(ready|taiyar)|dikha|bana(o|ao|ate)|show me/i.test(u)) return true;
  // model promised to generate / claimed ready while there is still no plan
  if (!hasPlan && /\b(generat\w*|plan aane|banaate|shuffling|one sec|ek second|ek minute|pull it up|dikhaati|plan ready|plan taiyar|taiyar hai)\b/i.test(s)) return true;
  return false;
}

function sayImpliesWork(say: string): boolean {
  return /\b(generat\w*|capture|update|draft|shuffling|ek second|one sec|one minute|ek minute|pull it up|dikhaati|plan aane|banaate|let me (see|put|update|capture|draft))\b/i.test(say);
}

function ensureGeneratePlan(actions: Action[], s: AppState, userText: string, say: string): Action[] {
  if (actions.some((a) => a.type === "generate_plan")) return actions;
  if (!s.household.members.length || s.plan) return actions;
  if (!wantsPlan(userText, say, false)) return actions;
  return [...actions, { type: "generate_plan", fresh: true }];
}

function isSparseHousehold(s: AppState): boolean {
  const hh = s.household;
  if (hh.city || hh.cuisines.length) return false;
  return hh.members.every(
    (m) =>
      m.diet === "veg" &&
      !m.allergies.length &&
      !m.conditions.length &&
      !m.noOnionGarlic &&
      !m.fastDays.length &&
      !m.tiffinDays.length &&
      !(m.vegDays?.length) &&
      !(m.lightMeals?.length),
  );
}

export async function* householdTurn(s: AppState, userText: string): AsyncGenerator<AgentEvent> {
  const t0 = Date.now();
  const system = householdSystem(catalogText(s.customDishes));
  const base: Msg[] = [
    { role: "system", content: system },
    ...historyMsgs(s.householdChat),
    { role: "user", content: `CURRENT STATE\n${householdContext(s)}\n\nUSER SAID: ${userText}` },
  ];
  const said: string[] = [];
  const allActions: Action[] = [];
  const allResults: string[] = [];
  let model: string | undefined;
  let msgs = base;
  let repairedEmpty = false;
  let repairedSparse = false;
  for (let loop = 0; loop < 4; loop++) {
    const gen = speakOnce(msgs);
    let out: { reply: Reply; raw: string; model?: string };
    while (true) {
      const r = await gen.next();
      if (r.done) { out = r.value; break; }
      if (r.value.type === "say") said.push(r.value.text);
      yield r.value;
    }
    model = out.model;
    let actions = out.reply.actions ?? [];
    const spoken = [...said].join(" ");
    const lastSay = said[said.length - 1] ?? "";

    // Model often narrates "I'll generate / update" with actions:[]. One repair
    // pass, then a hard generate_plan inject if they still asked for a plan.
    if (!actions.length && !repairedEmpty && (out.reply.followup || sayImpliesWork(lastSay) || wantsPlan(userText, lastSay, Boolean(s.plan)))) {
      repairedEmpty = true;
      console.warn("[agent] empty actions with work-implying say; repairing", { say: lastSay.slice(0, 120), followup: out.reply.followup });
      msgs = [
        ...base,
        { role: "assistant", content: out.raw || JSON.stringify({ say: lastSay, actions: [], followup: true }) },
        {
          role: "user",
          content:
            `You spoke but emitted actions:[]. Nothing was applied — plan is still ${s.plan ? "present" : "null"}.\n` +
            `Reply again with ONLY JSON. Keep "say" a short filler (under 8 words). ` +
            `REQUIRED: emit upsert_member / update_household for every fact already in this conversation that is missing from CURRENT STATE ` +
            `(diets, allergies, conditions, noOnionGarlic, city, cuisines, nonvegPerWeek, vegDays/sattvikDays, fastDays, tiffinDays, lightMeals). ` +
            `${!s.plan && s.household.members.length ? 'Also include {"type":"generate_plan","fresh":true} and set followup:true. ' : "followup:true if you change facts that need a re-plan."}`,
        },
      ];
      continue;
    }

    // Plan requested but model only emitted generate_plan while STATE is still
    // the blank onboarding defaults — ask once more for the missing facts.
    const onlyPlan = actions.length > 0 && actions.every((a) => a.type === "generate_plan");
    if (onlyPlan && !s.plan && isSparseHousehold(s) && s.householdChat.some((t) => t.role === "user") && !repairedSparse) {
      repairedSparse = true;
      msgs = [
        ...base,
        { role: "assistant", content: out.raw || JSON.stringify({ say: lastSay, actions, followup: true }) },
        {
          role: "user",
          content:
            `CURRENT STATE members are still blank defaults (all veg, no allergies/city). Before generate_plan, emit the upsert_member and update_household actions for facts already said in this chat, then {"type":"generate_plan","fresh":true}. Short filler "say". followup:true.`,
        },
      ];
      continue;
    }

    actions = ensureGeneratePlan(actions, s, userText, lastSay);
    if (!actions.length && !s.plan && wantsPlan(userText, lastSay, false) && s.household.members.length) {
      actions = [{ type: "generate_plan", fresh: true }];
    }

    allActions.push(...actions);
    const before = s.plan ? (JSON.parse(JSON.stringify(s.plan)) as typeof s.plan) : null;
    const res = applyHouseholdActions(s, actions);
    const changes = diffPlans(before, s.plan, s.customDishes);
    if (actions.length && s.plan) res.results.push(changes.length ? `PLAN CHANGES (the ONLY dish changes that happened): ${changes.length > 10 ? `${changes.length} meals re-planned, e.g. ` : ""}${changes.slice(0, 10).join("; ")}` : "PLAN CHANGES: none — no dishes changed");
    allResults.push(...res.results, ...res.problems.map((p) => `PROBLEM: ${p}`));
    if (actions.length) { saveState(s); yield { type: "state", version: s.version }; }
    if (res.finalize) yield { type: "finalize", ...res.finalize };
    const needMore = (out.reply.followup || res.problems.length > 0 || actions.some((a) => a.type === "generate_plan")) && actions.length > 0;
    if (!needMore) break;
    msgs = [
      ...base,
      { role: "assistant", content: out.raw },
      { role: "user", content: `ENGINE RESULT:\n${[...res.results, ...res.problems.map((p) => "PROBLEM: " + p)].join("\n")}\n\nUPDATED STATE\n${householdContext(s)}\n\nNow continue speaking as Meera. You already said: "${said.join(" ")}" — continue naturally from there without repeating it or re-using its opening word. In 1–2 short spoken sentences say what actually happened (any PROBLEM first, kindly), mention one smart thing from the result if there is one (only changes that literally appear in the ENGINE RESULT or UPDATED STATE — never describe changes you imagine), and move things forward with at most one question. Only add actions if something still needs doing; followup false.` },
    ];
  }
  const say = said.join(" ");
  s.householdChat = [...s.householdChat, { role: "user" as const, content: userText }, { role: "assistant" as const, content: say }].slice(-40);
  saveState(s);
  yield { type: "state", version: s.version };
  yield { type: "done", say, model, ms: Date.now() - t0, actions: allActions, results: allResults };
}

export async function* cookTurn(s: AppState, userText: string): AsyncGenerator<AgentEvent> {
  const t0 = Date.now();
  const lang = s.household.cook.language;
  const base: Msg[] = [
    { role: "system", content: cookSystem(s.household.cook.name, lang) },
    ...historyMsgs(s.cookChat),
    { role: "user", content: `KITCHEN CONTEXT\n${cookDayText(s, s.cook.day)}\n\n${userText === "__start__" ? "(The cook just opened the app. Greet them by name and give today's briefing.)" : `COOK SAID: ${userText}`}` },
  ];
  const said: string[] = [];
  const allActions: Action[] = [];
  const allResults: string[] = [];
  let model: string | undefined;
  let msgs = base;
  for (let loop = 0; loop < 2; loop++) {
    const gen = speakOnce(msgs);
    let out: { reply: Reply; raw: string; model?: string };
    while (true) {
      const r = await gen.next();
      if (r.done) { out = r.value; break; }
      if (r.value.type === "say") {
        const text = await fixScript(r.value.text, lang);
        said.push(text);
        yield { type: "say", text };
      } else yield r.value;
    }
    model = out.model;
    const actions = out.reply.actions ?? [];
    allActions.push(...actions);
    const res = applyCookActions(s, actions);
    allResults.push(...res.results, ...res.problems.map((p) => `PROBLEM: ${p}`));
    for (const t of res.timers) yield { type: "timer", ...t };
    if (actions.length) { saveState(s); yield { type: "state", version: s.version }; }
    const needMore = (out.reply.followup || res.problems.length > 0) && actions.length > 0;
    if (!needMore) break;
    msgs = [
      ...base,
      { role: "assistant", content: out.raw },
      { role: "user", content: `RESULT:\n${[...res.results, ...res.problems.map((p) => "PROBLEM: " + p)].join("\n")}\n\nUPDATED CONTEXT\n${cookDayText(s, s.cook.day)}\n\nContinue speaking to ${s.household.cook.name} in the same language. You already said: "${said.join(" ")}". Tell them what actually happened in 1–2 short sentences (if refused, explain why kindly and suggest an allowed option). followup false.` },
    ];
  }
  const say = said.join(" ");
  if (userText !== "__start__") s.cookChat = [...s.cookChat, { role: "user" as const, content: userText }, { role: "assistant" as const, content: say }].slice(-30);
  else s.cookChat = [...s.cookChat, { role: "assistant" as const, content: say }].slice(-30);
  saveState(s);
  yield { type: "state", version: s.version };
  yield { type: "done", say, model, ms: Date.now() - t0, actions: allActions, results: allResults };
}
