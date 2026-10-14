import type { Dish, Household, WeekPlan } from "../types";
import { buildGrocery } from "./grocery";
import { planWeek } from "./planner";

// Scoring alone only *nudges* towards cheaper dishes. When the household gave a
// budget, search: re-plan with progressively tighter per-serving targets and keep
// the cheapest week, stopping as soon as one fits. If none fits, say so honestly.

export function planWithinBudget(hh: Household, opts: Parameters<typeof planWeek>[1] = {}) {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const custom: Dish[] = opts.custom ?? [];
  let best: { plan: WeekPlan; total: number } | null = null;
  for (const scale of hh.budgetPerWeek ? [1, 0.8, 0.62, 0.48, 0.36] : [1]) {
    const plan = planWeek(hh, { ...opts, seed, budgetScale: scale });
    // judge the week on what it consumes; dal/rice/atta packs outlive the week
    const total = buildGrocery(hh, plan, custom, []).consumedCost;
    if (!best || total < best.total) best = { plan, total };
    if (!hh.budgetPerWeek || total <= hh.budgetPerWeek) break;
  }
  return { ...best!, met: !hh.budgetPerWeek || best!.total <= hh.budgetPerWeek };
}
