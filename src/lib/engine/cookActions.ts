import { INGREDIENTS, resolveIngredient } from "../data/ingredients";
import { getDish, resolveDish } from "../data/recipes";
import type { ActivityItem, AppState, Day, Meal } from "../types";
import { meal as normMeal, setDish, type Action, type ApplyResult } from "./actions";
import { repairPlan } from "./actions";
import { mealNotes } from "./planner";

// Actions the cook-side agent may take. The cook can adapt the day (missing
// ingredient, swap a dish, extra guests) but never break a hard household rule —
// setDish() refuses anything that violates diet, allergy, Jain or fasting.
// Every deviation lands in the household's activity feed.

export function logActivity(s: AppState, who: ActivityItem["who"], kind: ActivityItem["kind"], text: string) {
  s.activity = [{ at: new Date().toISOString(), who, kind, text }, ...s.activity].slice(0, 60);
}

export function applyCookActions(s: AppState, actions: Action[]): ApplyResult & { timers: { minutes: number; label: string }[] } {
  const r: ApplyResult & { timers: { minutes: number; label: string }[] } = { results: [], problems: [], changed: false, planChanged: false, timers: [] };
  const today = s.cook.day;
  const cookName = s.household.cook.name;
  for (const a of actions) {
    try {
      switch (a.type) {
        case "start_dish": {
          const id = resolveDish(String(a.dish ?? ""), s.customDishes);
          const m = normMeal(a.meal) ?? s.plan?.meals.find((pm) => pm.day === today && pm.dishes.some((d) => d.dishId === id))?.meal ?? "lunch";
          if (!id) { r.problems.push(`Unknown dish ${a.dish}`); break; }
          s.cook.activeDish = { dishId: id, meal: m, step: 0 };
          r.results.push(`Started ${getDish(id, s.customDishes)?.name} — step 1`); break;
        }
        case "set_step": {
          if (!s.cook.activeDish) { r.problems.push("No dish in progress"); break; }
          const d = getDish(s.cook.activeDish.dishId, s.customDishes);
          const n = Math.max(0, Math.min((d?.steps.length ?? 1) - 1, Number(a.step) - 1));
          s.cook.activeDish.step = n;
          r.results.push(`On step ${n + 1} of ${d?.steps.length}`); break;
        }
        case "timer": {
          const minutes = Number(a.minutes);
          if (!(minutes > 0 && minutes <= 240)) { r.problems.push("Timer needs minutes between 1 and 240"); break; }
          const label = String(a.label ?? "Timer");
          s.cook.timers = [...s.cook.timers.filter((t) => t.endsAt > Date.now()), { id: Math.random().toString(36).slice(2, 8), label, endsAt: Date.now() + minutes * 60000 }];
          r.timers.push({ minutes, label });
          r.results.push(`Timer set: ${label}, ${minutes} min`); break;
        }
        case "shortage": {
          const id = resolveIngredient(String(a.ingredient ?? ""));
          const label = id ? INGREDIENTS[id].name : String(a.ingredient);
          if (id) {
            s.cook.shortages = [...new Set([...s.cook.shortages, id])];
            s.household.pantryNeed = [...new Set([...s.household.pantryNeed, id])];
            s.household.pantryHave = s.household.pantryHave.filter((x) => x !== id);
          } else s.extras.push({ name: label, qty: "restock" });
          logActivity(s, "cook", "shortage", `${cookName}: ${label} is finished${a.substitute ? ` — using ${a.substitute} instead today` : ""}. Added to the grocery list.`);
          r.results.push(`${label} marked out of stock and added to the household's list`); r.changed = true; break;
        }
        case "leftover": {
          const id = resolveDish(String(a.dish ?? ""), s.customDishes);
          s.cook.leftovers = [...s.cook.leftovers, { dishId: id ?? String(a.dish), note: String(a.note ?? "some left"), day: today }];
          logActivity(s, "cook", "leftover", `${cookName}: leftover ${getDish(id ?? "", s.customDishes)?.name ?? a.dish} (${a.note ?? "some left"})`);
          r.results.push("Leftover noted"); r.changed = true; break;
        }
        case "change_dish": {
          const m: Meal | null = normMeal(a.meal);
          const d: Day = today;
          if (!m) { r.problems.push("change_dish needs the meal"); break; }
          const res = setDish(s, d, m, String(a.to ?? ""), { replace: a.from ? String(a.from) : undefined, by: "cook" });
          if (!res.ok) { r.problems.push(`Not allowed: ${res.msg}`); break; }
          repairPlan(s);
          logActivity(s, "cook", "change", `${cookName} changed ${d} ${m}: ${res.msg}${a.reason ? ` — reason: ${a.reason}` : ""}`);
          r.results.push(res.msg); r.planChanged = true; r.changed = true; break;
        }
        case "guests": {
          const m = normMeal(a.meal);
          const count = Number(a.count);
          if (!m || !(count >= 0)) { r.problems.push("guests needs meal and count"); break; }
          s.household.guests = s.household.guests.filter((g) => !(g.day === today && g.meal === m));
          if (count > 0) s.household.guests.push({ day: today, meal: m, count, note: "reported by cook" });
          const pm = s.plan?.meals.find((x) => x.day === today && x.meal === m);
          if (pm) { pm.guests = count; pm.notes = mealNotes(s.household, pm, s.customDishes); }
          logActivity(s, "cook", "info", `${cookName}: ${count} guest(s) for ${m} today — cooking extra`);
          r.results.push(`Cooking for ${count} extra at ${m}`); r.planChanged = true; r.changed = true; break;
        }
        case "meal_done": {
          const m = normMeal(a.meal);
          if (!m) break;
          s.cook.doneMeals = [...new Set([...s.cook.doneMeals, `${today}:${m}`])];
          const pm = s.plan?.meals.find((x) => x.day === today && x.meal === m);
          if (pm) pm.status = "done";
          if (s.cook.activeDish?.meal === m) s.cook.activeDish = undefined;
          logActivity(s, "cook", "done", `${cookName} finished ${m}${a.note ? ` — ${a.note}` : ""}`);
          r.results.push(`${m} marked done`); r.changed = true; break;
        }
        case "message_household": {
          const text = String(a.text ?? "").trim();
          if (!text) break;
          const kind = (["info", "warning", "shortage"].includes(String(a.kind)) ? a.kind : "info") as ActivityItem["kind"];
          logActivity(s, "cook", kind, `${cookName}: ${text}`);
          r.results.push("Message passed to the household"); r.changed = true; break;
        }
        case "absent": {
          const dd = String(a.day ?? "") as Day;
          s.cook.absentDays = [...new Set([...s.cook.absentDays, dd])];
          s.plan?.meals.forEach((pm) => { if (pm.day === dd) pm.cookedBy = "household"; });
          logActivity(s, "cook", "warning", `${cookName} won't come on ${dd}${a.reason ? ` (${a.reason})` : ""} — the family needs to cook or order in`);
          r.results.push(`Noted ${cookName} is off on ${dd}; household informed`); r.changed = true; r.planChanged = true; break;
        }
        default:
          r.problems.push(`Unknown action ${a.type}`);
      }
    } catch (e) {
      r.problems.push(`${a.type} failed: ${(e as Error).message}`);
    }
  }
  return r;
}
