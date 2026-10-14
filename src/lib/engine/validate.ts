import { getDish } from "../data/recipes";
import { DAYS, type Dish, type Household, type Member, type WeekPlan } from "../types";
import { isFasting, matchesPref, memberFit } from "./constraints";
import { limitKeys } from "./planner";

export interface Violation {
  severity: "hard" | "soft";
  day: string;
  meal: string;
  text: string;
}

/** Check a plan against every hard rule and the main soft ones. */
export function validatePlan(hh: Household, plan: WeekPlan, custom: Dish[]): Violation[] {
  const v: Violation[] = [];
  const byName = new Map(hh.members.map((m) => [m.name, m]));
  const seen = new Map<string, number[]>();

  for (const pm of plan.meals) {
    if (pm.status !== "planned" && pm.status !== "done") continue;
    const eaters = [...pm.eaters, ...pm.tiffin].map((n) => byName.get(n)).filter(Boolean) as Member[];
    const covered = new Map<string, number>();
    for (const pd of pm.dishes) {
      const d = getDish(pd.dishId, custom);
      if (!d) { v.push({ severity: "hard", day: pm.day, meal: pm.meal, text: `Unknown dish ${pd.dishId}` }); continue; }
      const who = pd.for === "all" ? eaters : (pd.for.map((n) => byName.get(n)).filter(Boolean) as Member[]);
      for (const m of who) {
        const f = memberFit(m, d, pm.day, hh);
        if (!f.ok) v.push({ severity: "hard", day: pm.day, meal: pm.meal, text: `${d.name} served to ${m.name}: ${f.reason}` });
        else if (!d.roles.includes("staple") && !(d.roles.length === 1 && d.roles[0] === "side")) covered.set(m.name, (covered.get(m.name) ?? 0) + 1);
        for (const dl of m.dislikes) if (matchesPref(dl, d)) v.push({ severity: "soft", day: pm.day, meal: pm.meal, text: `${m.name} dislikes ${dl} (${d.name})` });
      }
      if (hh.bannedDishes.includes(d.id)) v.push({ severity: "hard", day: pm.day, meal: pm.meal, text: `${d.name} was removed by the household` });
      for (const ri of d.ingredients) if (!ri.optional && hh.bannedIngredients.includes(ri.id)) v.push({ severity: "hard", day: pm.day, meal: pm.meal, text: `${d.name} uses banned ingredient ${ri.id}` });
      if (!d.roles.includes("staple")) seen.set(d.id, [...(seen.get(d.id) ?? []), DAYS.indexOf(pm.day)]);
      if (pm.cookedBy === "household" && d.minutes > 35) v.push({ severity: "soft", day: pm.day, meal: pm.meal, text: `${d.name} takes ${d.minutes} min on a cook's day off` });
    }
    for (const m of eaters) {
      if (!covered.get(m.name) && pm.dishes.length) {
        v.push({ severity: "hard", day: pm.day, meal: pm.meal, text: `${m.name} has nothing substantial to eat${isFasting(m, pm.day) ? " (fasting)" : ""}` });
      }
    }
  }
  if (hh.limits) {
    const count = new Map<string, number>();
    for (const pm of plan.meals) {
      if (pm.status !== "planned" && pm.status !== "done") continue;
      const keys = new Set(pm.dishes.flatMap((pd) => { const d = getDish(pd.dishId, custom); return d ? limitKeys(d) : []; }));
      for (const k of keys) {
        if (hh.limits[k] === undefined) continue;
        const n = (count.get(k) ?? 0) + 1;
        count.set(k, n);
        if (n > hh.limits[k]) v.push({ severity: "hard", day: pm.day, meal: pm.meal, text: `${k.replace(/_/g, " ")} is limited to ${hh.limits[k]}× a week` });
      }
    }
  }
  seen.forEach((days, id) => {
    const d = getDish(id, custom);
    const sorted = [...days].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] <= 1 && !d?.custom) {
        v.push({ severity: "soft", day: DAYS[sorted[i]], meal: "-", text: `${d?.name ?? id} repeats on consecutive days` });
      }
    }
  });
  return v;
}
