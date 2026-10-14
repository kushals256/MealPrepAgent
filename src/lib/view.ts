import { DISHES, getDish } from "./data/recipes";
import { buildGrocery, groceryMessage } from "./engine/grocery";
import { explainPlan, prepTasks, standingNotes } from "./engine/planner";
import { SCENARIOS } from "./data/households";
import { validatePlan } from "./engine/validate";
import { LANGS } from "./agent/prompts";
import { hasKey, models } from "./agent/llm";
import type { AppState } from "./types";

/** Everything the UI needs, derived server-side so client and agent agree. */
export function viewModel(s: AppState) {
  const ids = new Set<string>();
  s.plan?.meals.forEach((pm) => pm.dishes.forEach((d) => ids.add(d.dishId)));
  if (s.cook.activeDish) ids.add(s.cook.activeDish.dishId);
  const dishes = Object.fromEntries([...ids].map((id) => {
    const d = getDish(id, s.customDishes);
    return [id, d ? { name: d.name, hindi: d.hindi, minutes: d.minutes, tags: d.tags, steps: d.steps, prepAhead: d.prepAhead, custom: !!d.custom } : { name: id, hindi: "", minutes: 0, tags: [], steps: [], custom: true }];
  }));
  const grocery = s.plan ? buildGrocery(s.household, s.plan, s.customDishes, s.extras, s.cook.shortages) : null;
  return {
    version: s.version,
    phase: s.phase,
    household: s.household,
    plan: s.plan,
    dishes,
    grocery,
    groceryText: grocery ? groceryMessage(s.household, grocery) : "",
    violations: s.plan ? validatePlan(s.household, s.plan, s.customDishes) : [],
    prep: s.plan ? prepTasks(s.plan, s.customDishes) : [],
    standing: standingNotes(s.household),
    why: s.plan ? explainPlan(s.household, s.plan, s.customDishes) : [],
    scenarios: Object.entries(SCENARIOS).map(([key, mk]) => { const h = mk(); return { key, name: h.familyName, city: h.city, size: h.members.length }; }),
    cook: s.cook,
    cookLang: { code: s.household.cook.language, ...LANGS[s.household.cook.language] },
    activity: s.activity,
    orders: s.orders,
    householdChat: s.householdChat,
    cookChat: s.cookChat,
    llm: { configured: hasKey(), models: models() },
    catalogSize: Object.keys(DISHES).length,
  };
}

export type ViewModel = ReturnType<typeof viewModel>;
