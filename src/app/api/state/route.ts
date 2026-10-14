import { NextResponse } from "next/server";
import { freshState, getState, saveState, snapshot, undo } from "@/lib/store";
import { viewModel } from "@/lib/view";
import { planWithinBudget } from "@/lib/engine/budget";
import { SCENARIOS } from "@/lib/data/households";
import { repairPlan, setDish } from "@/lib/engine/actions";
import { logActivity } from "@/lib/engine/cookActions";
import { buildGrocery } from "@/lib/engine/grocery";
import { DAYS, type Day, type Meal } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const since = Number(new URL(req.url).searchParams.get("since") ?? -1);
  const s = getState();
  if (since === s.version) return NextResponse.json({ unchanged: true, version: s.version });
  return NextResponse.json(viewModel(s));
}

// Direct UI manipulation (buttons) — the same engine the voice agent uses.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  let s = getState();
  switch (body.op) {
    case "reset":
      s = freshState(Boolean(body.sample));
      if (body.scenario && SCENARIOS[body.scenario]) { s.household = SCENARIOS[body.scenario](); s.phase = "planning"; }
      if (body.sample || body.scenario) s.plan = planWithinBudget(s.household, { seed: 42 }).plan;
      break;
    case "regenerate":
      snapshot(s);
      s.plan = planWithinBudget(s.household, { previous: s.plan, custom: s.customDishes }).plan;
      break;
    case "undo":
      undo(s);
      break;
    case "toggleLock": {
      const pm = s.plan?.meals.find((m) => m.day === body.day && m.meal === body.meal);
      pm?.dishes.forEach((d) => { if (d.dishId === body.dishId) d.locked = !d.locked; });
      break;
    }
    case "setDish": {
      snapshot(s);
      const r = setDish(s, body.day as Day, body.meal as Meal, body.dish, {});
      repairPlan(s);
      if (!r.ok) return NextResponse.json({ error: r.msg }, { status: 400 });
      break;
    }
    case "setCookDay":
      if (DAYS.includes(body.day)) { s.cook.day = body.day; s.cook.activeDish = undefined; s.cookChat = []; }
      break;
    case "setCookLang":
      s.household.cook.language = body.lang; s.cookChat = [];
      break;
    case "clearTimer":
      s.cook.timers = s.cook.timers.filter((t) => t.id !== body.id);
      break;
    case "order": {
      if (!s.plan) return NextResponse.json({ error: "No plan" }, { status: 400 });
      const g = buildGrocery(s.household, s.plan, s.customDishes, s.extras, s.cook.shortages);
      const channel = body.channel === "whatsapp" ? "whatsapp" : "instamart";
      s.orders.push({ channel, at: new Date().toISOString(), total: g.total, status: channel === "instamart" ? "placed_simulated" : "sent", phone: body.phone });
      s.phase = "ordered";
      logActivity(s, "household", "order", channel === "instamart" ? `Instamart order placed (simulated) — ₹${g.weeklyTotal} now, ₹${g.topupTotal} top-up on ${g.topupDay}` : "Grocery list sent on WhatsApp");
      // once groceries arrive, shortages are covered
      s.cook.shortages = []; s.household.pantryNeed = [];
      break;
    }
    case "clearChat":
      if (body.who === "cook") s.cookChat = []; else s.householdChat = [];
      break;
    default:
      return NextResponse.json({ error: "unknown op" }, { status: 400 });
  }
  saveState(s);
  return NextResponse.json(viewModel(s));
}
