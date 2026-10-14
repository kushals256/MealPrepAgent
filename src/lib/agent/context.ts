import { INGREDIENTS } from "../data/ingredients";
import { DISHES, getDish } from "../data/recipes";
import { buildGrocery, fmtQty } from "../engine/grocery";
import { explainPlan, prepTasks, standingNotes } from "../engine/planner";
import { servingsFor } from "../engine/grocery";
import { validatePlan } from "../engine/validate";
import { DAYS, type AppState, type Day, type Dish, type Household, type PlannedMeal } from "../types";

// Compact, LLM-friendly views of state. Keeping these short is what keeps a
// voice turn fast — the model never sees raw JSON of the whole week.

export function catalogText(custom: Dish[]) {
  const groups: Record<string, string[]> = {};
  for (const d of [...Object.values(DISHES), ...custom]) {
    const role = d.roles.includes("fasting") ? "fasting" : d.roles[0];
    (groups[role] ??= []).push(`${d.id}${d.custom ? "*" : ""}`);
  }
  return Object.entries(groups).map(([r, ids]) => `${r}: ${ids.join(", ")}`).join("\n");
}

export function householdText(hh: Household) {
  if (!hh.members.length) return "Household: nothing known yet.";
  const m = hh.members.map((x) => {
    const bits = [x.ageGroup, (x.jain ? "Jain " : "") + x.diet];
    if (x.allergies.length) bits.push(`ALLERGIC: ${x.allergies.join("/")}`);
    if (x.conditions.length) bits.push(x.conditions.join("/"));
    if (x.spice !== "medium") bits.push(`spice ${x.spice}`);
    if (x.vegDays.length) bits.push(`veg on ${x.vegDays.join("/")}`);
    if (x.fastDays.length) bits.push(`fasts ${x.fastDays.join("/")}`);
    if (x.tiffinDays.length) bits.push(`tiffin ${x.tiffinDays.length === 5 ? "weekdays" : x.tiffinDays.join("/")}`);
    if (x.likes.length) bits.push(`likes ${x.likes.join(", ")}`);
    if (x.dislikes.length) bits.push(`dislikes ${x.dislikes.join(", ")}`);
    if (x.away.length) bits.push(`away ${x.away.map((a) => `${a.day}${a.meals.length ? " " + a.meals.join("+") : ""}`).join(", ")}`);
    return `- ${x.name}: ${bits.join("; ")}`;
  });
  const c = hh.cook;
  return [
    `Household: ${hh.familyName || "(unnamed)"}${hh.city ? `, ${hh.city}` : ""}. Cuisines: ${hh.cuisines.join(", ") || "any"}. Meals planned: ${hh.meals.join(", ")}. Non-veg meals/week: ${hh.nonvegPerWeek}.${hh.budgetPerWeek ? ` Budget ₹${hh.budgetPerWeek}/week.` : ""}`,
    ...m,
    `Cook: ${c.name} (language ${c.language}), off ${c.offDays.join("/") || "never"}, makes ${c.meals.join("/")}, ~${c.maxWeekdayMinutes} min per weekday meal.`,
    hh.guests.length ? `Guests: ${hh.guests.map((g) => `${g.day} ${g.meal} +${g.count}`).join(", ")}` : "",
    hh.eatOut.length ? `Eating out: ${hh.eatOut.map((e) => `${e.day} ${e.meal}`).join(", ")}` : "",
    hh.bannedDishes.length || hh.bannedIngredients.length ? `Avoid: ${[...hh.bannedDishes, ...hh.bannedIngredients].join(", ")}` : "",
    hh.notes.length ? `Notes: ${hh.notes.join("; ")}` : "",
  ].filter(Boolean).join("\n");
}

function mealLine(pm: PlannedMeal, custom: Dish[]) {
  if (pm.status === "eat_out") return "eating out";
  if (pm.status === "skipped") return "nobody home";
  const ds = pm.dishes.map((pd) => `${getDish(pd.dishId, custom)?.name ?? pd.dishId}${pd.for === "all" ? "" : ` [${pd.for.join(",")}]`}${pd.locked ? "📌" : ""}`).join(" + ");
  const extra = [pm.guests ? `+${pm.guests} guests` : "", pm.cookedBy === "household" ? "family cooks" : "", pm.status === "done" ? "DONE" : ""].filter(Boolean).join(", ");
  return ds + (extra ? ` (${extra})` : "");
}

export function planText(s: AppState) {
  if (!s.plan) return "Plan: not generated yet.";
  const lines = DAYS.map((d) => {
    const ms = s.plan!.meals.filter((pm) => pm.day === d);
    return `${d}: ${ms.map((pm) => `${pm.meal[0].toUpperCase()}: ${mealLine(pm, s.customDishes)}`).join(" | ")}`;
  });
  const v = validatePlan(s.household, s.plan, s.customDishes);
  const hard = v.filter((x) => x.severity === "hard");
  return [`Plan (week of ${s.plan.weekOf}, 📌 = pinned by family):`, ...lines, hard.length ? `CONFLICTS: ${hard.map((h) => h.text).join("; ")}` : "No rule conflicts.", `Why this plan: ${explainPlan(s.household, s.plan, s.customDishes).join("; ")}`].join("\n");
}

export function groceryText(s: AppState) {
  if (!s.plan) return "";
  const g = buildGrocery(s.household, s.plan, s.customDishes, s.extras, s.cook.shortages);
  const budget = s.household.budgetPerWeek ? ` Budget ₹${s.household.budgetPerWeek}; food actually used this week ≈ ₹${g.consumedCost} (dal/rice/atta packs last longer than a week).` : "";
  const top = [...g.lines].sort((a, b) => b.cost - a.cost).slice(0, 5).map((l) => l.name).join(", ");
  return `Grocery list: ${g.lines.length} items, est ₹${g.total} (buy now ₹${g.weeklyTotal}, fresh top-up on ${g.topupDay} ₹${g.topupTotal}). Biggest spends: ${top}. Pantry to check: ${g.pantryCheck.map((p) => p.name).slice(0, 8).join(", ")}. Extras added: ${s.extras.map((e) => `${e.name} (${e.qty})`).join(", ") || "none"}.${budget}`;
}

export function activityText(s: AppState, n = 6) {
  if (!s.activity.length) return "";
  return "Recent kitchen updates:\n" + s.activity.slice(0, n).map((a) => `- [${a.who}] ${a.text}`).join("\n");
}

export function householdContext(s: AppState) {
  const ordered = s.orders.length ? `Orders: ${s.orders.map((o) => `${o.channel} ₹${o.total} (${o.status})`).join(", ")}` : "No order placed yet.";
  return [`Today is ${new Date().toDateString()}. Phase: ${s.phase}.`, householdText(s.household), planText(s), groceryText(s), ordered, activityText(s)].filter(Boolean).join("\n\n");
}

// ---------------- cook side ----------------

function homeMeasure(id: string, amt: number, unit: string) {
  if (id === "atta") return `${Math.round(amt)} g atta (~${Math.round(amt / 30)} rotis)`;
  if (["rice", "basmati", "toor_dal", "moong_dal", "masoor_dal", "chana_dal", "rajma", "chole", "urad_whole", "kala_chana", "poha", "suji"].includes(id)) {
    return `${Math.round(amt)} g ${INGREDIENTS[id].hindi} (~${(amt / 150).toFixed(1)} katori)`;
  }
  return `${fmtQty(Math.round(amt), unit)} ${INGREDIENTS[id]?.hindi ?? id}`;
}

export function cookDayText(s: AppState, day: Day) {
  if (!s.plan) return "No plan has been made yet by the family.";
  const hh = s.household;
  const out: string[] = [];
  const todays = s.plan.meals.filter((pm) => pm.day === day);
  for (const pm of todays) {
    if (pm.status === "eat_out" || pm.status === "skipped") { out.push(`${pm.meal.toUpperCase()}: ${pm.status === "eat_out" ? "family eating out — nothing to cook" : "nobody home"}`); continue; }
    const people = pm.eaters.length + pm.tiffin.length + pm.guests;
    out.push(`${pm.meal.toUpperCase()}${pm.status === "done" ? " (DONE)" : ""}${pm.cookedBy === "household" ? " (family is cooking this one)" : ""} — ${people} people (${[...pm.eaters, ...pm.tiffin].join(", ")}${pm.guests ? ` + ${pm.guests} guests` : ""})${pm.tiffin.length ? `; tiffin for ${pm.tiffin.join(", ")}` : ""}`);
    for (const pd of pm.dishes) {
      const d = getDish(pd.dishId, s.customDishes);
      if (!d) continue;
      const serv = servingsFor(hh, s.plan, pm, pd.for);
      const key = d.ingredients.filter((ri) => !INGREDIENTS[ri.id]?.pantryStaple || ["atta", "rice"].includes(ri.id)).slice(0, 7)
        .map((ri) => homeMeasure(ri.id, ri.qty * serv, INGREDIENTS[ri.id]?.unit ?? "g"));
      out.push(`  • ${d.name} [id ${d.id}]${pd.for === "all" ? "" : ` — only for ${pd.for.join(", ")}`}, ~${serv.toFixed(1)} portions, ${d.minutes} min. Quantities: ${key.join(", ")}.`);
      out.push(`    Steps: ${d.steps.map((st, i) => `(${i + 1}) ${st}`).join(" ")}`);
    }
    if (pm.notes.length) out.push(`  Notes: ${pm.notes.join("; ")}`);
  }
  const tomorrow = DAYS[(DAYS.indexOf(day) + 1) % 7];
  const prep = prepTasks(s.plan, s.customDishes).filter((t) => t.day === day);
  const tm = s.plan.meals.filter((pm) => pm.day === tomorrow && pm.status === "planned").map((pm) => `${pm.meal}: ${pm.dishes.map((pd) => getDish(pd.dishId, s.customDishes)?.name).join(" + ")}`).join(" | ");
  const active = s.cook.activeDish ? (() => {
    const d = getDish(s.cook.activeDish!.dishId, s.customDishes);
    return `IN PROGRESS: ${d?.name}, currently on step ${s.cook.activeDish!.step + 1}/${d?.steps.length}: "${d?.steps[s.cook.activeDish!.step]}"`;
  })() : "No dish in progress.";
  return [
    `TODAY is ${day}. Cook: ${hh.cook.name}.${s.cook.absentDays.includes(day) ? " (Cook had said they'd be off today.)" : ""}`,
    `Family rules: ${standingNotes(hh).join("; ") || "none special"}`,
    ...out,
    `TONIGHT'S PREP for tomorrow (${tomorrow}): ${prep.map((p) => p.text).join("; ") || "nothing to soak or marinate"}`,
    `Tomorrow's menu: ${tm || "not planned"}`,
    s.cook.shortages.length ? `Out of stock (already reported): ${s.cook.shortages.map((x) => INGREDIENTS[x]?.name ?? x).join(", ")}` : "",
    s.cook.leftovers.length ? `Leftovers in fridge: ${s.cook.leftovers.slice(-4).map((l) => `${getDish(l.dishId)?.name ?? l.dishId} from ${l.day} (${l.note})`).join(", ")}` : "",
    active,
  ].filter(Boolean).join("\n");
}
