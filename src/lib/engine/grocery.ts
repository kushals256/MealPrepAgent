import { INGREDIENTS, resolveIngredient } from "../data/ingredients";
import { getDish } from "../data/recipes";
import { DAYS, type Day, type Dish, type ExtraItem, type GroceryLine, type GroceryList, type Household, type WeekPlan } from "../types";
import { portion } from "./constraints";
import { householdDrops } from "./planner";

// Plan -> consolidated grocery list.
//  * quantities scale with who actually eats each dish (portions by age,
//    guests, tiffins, people away),
//  * optional ingredients dropped for allergies are not bought,
//  * masalas/oil/salt are assumed in the pantry unless flagged as running out,
//  * very perishable items needed late in the week move to a mid-week top-up,
//  * needs are rounded up to real pack sizes (simulated Instamart catalogue).

const TOPUP_DAY: Day = "Thu";

export function servingsFor(hh: Household, plan: WeekPlan, mealKey: { day: Day; meal: string }, forWho: "all" | string[]) {
  const pm = plan.meals.find((m) => m.day === mealKey.day && m.meal === mealKey.meal);
  if (!pm) return 0;
  const names = forWho === "all" ? [...pm.eaters, ...pm.tiffin] : forWho;
  const people = hh.members.filter((m) => names.includes(m.name));
  let s = people.reduce((a, m) => a + portion(m), 0);
  if (forWho === "all") s += pm.guests;
  return Math.round(s * 100) / 100;
}

export function bestPacks(needed: number, packs: { size: number; price: number }[]) {
  // small exhaustive search over counts of up to the 3 pack sizes
  const sorted = [...packs].sort((a, b) => b.size - a.size);
  let best: { combo: number[]; cost: number; total: number } | null = null;
  const max = sorted.map((p) => Math.ceil(needed / p.size) + 1);
  const rec = (i: number, combo: number[]) => {
    if (i === sorted.length) {
      const total = combo.reduce((a, c, k) => a + c * sorted[k].size, 0);
      if (total < needed) return;
      const cost = combo.reduce((a, c, k) => a + c * sorted[k].price, 0);
      if (!best || cost < best.cost || (cost === best.cost && total < best.total)) best = { combo: [...combo], cost, total };
      return;
    }
    for (let c = 0; c <= Math.min(max[i], 12); c++) rec(i + 1, [...combo, c]);
  };
  rec(0, []);
  const b = best as { combo: number[]; cost: number; total: number } | null;
  if (!b) return { packs: [], cost: 0 };
  return {
    packs: b.combo.map((count, k) => ({ size: sorted[k].size, count, price: sorted[k].price })).filter((p) => p.count > 0),
    cost: b.cost,
  };
}

export function buildGrocery(hh: Household, plan: WeekPlan | null, custom: Dish[], extras: ExtraItem[], shortages: string[] = []): GroceryList {
  const need = new Map<string, { weekly: number; topup: number; usedIn: Set<string>; optionalOnly: boolean }>();
  const pantryCheck = new Map<string, Set<string>>();
  const topupIdx = DAYS.indexOf(TOPUP_DAY);

  for (const pm of plan?.meals ?? []) {
    if (pm.status === "eat_out" || pm.status === "skipped") continue;
    for (const pd of pm.dishes) {
      const d = getDish(pd.dishId, custom);
      if (!d) continue;
      const servings = servingsFor(hh, plan!, pm, pd.for);
      if (servings <= 0) continue;
      const dropped = new Set(householdDrops(hh, d));
      for (const ri of d.ingredients) {
        if (dropped.has(ri.id) || hh.bannedIngredients.includes(ri.id)) continue;
        const ing = INGREDIENTS[ri.id];
        if (!ing) continue;
        const staple = (ing.pantryStaple || hh.pantryHave.includes(ri.id)) && !hh.pantryNeed.includes(ri.id) && !shortages.includes(ri.id);
        if (staple) {
          pantryCheck.set(ri.id, (pantryCheck.get(ri.id) ?? new Set()).add(d.name));
          continue;
        }
        const e = need.get(ri.id) ?? { weekly: 0, topup: 0, usedIn: new Set<string>(), optionalOnly: true };
        if (!ri.optional) e.optionalOnly = false;
        const amt = ri.qty * servings;
        const late = DAYS.indexOf(pm.day) >= topupIdx && ing.shelfDays <= 4;
        if (late) e.topup += amt; else e.weekly += amt;
        e.usedIn.add(d.name);
        need.set(ri.id, e);
      }
    }
  }
  // shortages reported by the cook that the plan doesn't cover still need buying
  for (const id of [...shortages, ...hh.pantryNeed]) {
    if (!need.has(id) && INGREDIENTS[id]) {
      need.set(id, { weekly: INGREDIENTS[id].packs[0].size * 0.5, topup: 0, usedIn: new Set(["restock"]), optionalOnly: false });
      pantryCheck.delete(id);
    }
  }

  const lines: GroceryLine[] = [];
  let consumedCost = 0;
  need.forEach((e, id) => {
    const ing = INGREDIENTS[id];
    // a garnish-only need under a third of the smallest pack isn't worth buying
    const smallest = Math.min(...ing.packs.map((p) => p.size));
    if (e.optionalOnly && e.weekly + e.topup < smallest / 3) {
      pantryCheck.set(id, new Set([...(pantryCheck.get(id) ?? []), ...e.usedIn, "(optional garnish)"]));
      return;
    }
    consumedCost += (e.weekly + e.topup) * Math.min(...ing.packs.map((p) => p.price / p.size));
    for (const batch of ["weekly", "topup"] as const) {
      const amt = e[batch];
      if (amt <= 0) continue;
      const { packs, cost } = bestPacks(amt, ing.packs);
      lines.push({
        id: `${id}:${batch}`, name: ing.name, hindi: ing.hindi, category: ing.category,
        needed: Math.ceil(amt), unit: ing.unit, packs, cost, batch, usedIn: [...e.usedIn],
      });
    }
  });
  for (const x of extras) {
    const id = resolveIngredient(x.name);
    const ing = id ? INGREDIENTS[id] : null;
    lines.push({
      id: `extra:${x.name}`, name: x.name, hindi: ing?.hindi ?? "", category: ing?.category ?? "other",
      needed: 0, unit: x.qty, packs: ing ? [{ ...ing.packs[0], count: 1 }] : [], cost: ing ? ing.packs[0].price : 0,
      batch: "weekly", usedIn: ["added by you"], extra: true,
    });
  }
  const order = ["vegetables", "fruits", "dairy", "meat_fish", "pulses", "staples", "bakery", "spices", "other"];
  lines.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name));
  const weeklyTotal = lines.filter((l) => l.batch === "weekly").reduce((a, l) => a + l.cost, 0);
  const topupTotal = lines.filter((l) => l.batch === "topup").reduce((a, l) => a + l.cost, 0);
  return {
    lines,
    pantryCheck: [...pantryCheck.entries()].map(([id, s]) => ({ id, name: INGREDIENTS[id].name, usedIn: [...s] })),
    total: weeklyTotal + topupTotal,
    consumedCost: Math.round(consumedCost + lines.filter((l) => l.extra).reduce((a, l) => a + l.cost, 0)),
    weeklyTotal,
    topupTotal,
    topupDay: TOPUP_DAY,
  };
}

export function fmtQty(n: number, unit: string) {
  if (unit === "g") return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 ? 1 : 0)} kg` : `${n} g`;
  if (unit === "ml") return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 ? 1 : 0)} L` : `${n} ml`;
  if (unit === "pc") return `${n} pc`;
  return unit;
}

export function packLabel(l: GroceryLine) {
  if (l.extra) return l.unit;
  return l.packs.map((p) => `${p.count} × ${fmtQty(p.size, l.unit)}`).join(" + ");
}

/** Plain-text list for WhatsApp / SMS. */
export function groceryMessage(hh: Household, g: GroceryList) {
  const head = `🛒 *${hh.familyName} — groceries for the week*`;
  const section = (batch: "weekly" | "topup") => {
    const ls = g.lines.filter((l) => l.batch === batch);
    if (!ls.length) return "";
    const byCat = new Map<string, GroceryLine[]>();
    ls.forEach((l) => byCat.set(l.category, [...(byCat.get(l.category) ?? []), l]));
    let out = batch === "weekly" ? "\n*Buy now*" : `\n*Fresh top-up on ${g.topupDay}*`;
    byCat.forEach((items, cat) => {
      out += `\n_${cat.replace("_", " & ")}_\n` + items.map((l) => `• ${l.name}${l.hindi ? ` (${l.hindi})` : ""} — ${packLabel(l)}`).join("\n");
    });
    return out;
  };
  const pantry = g.pantryCheck.length ? `\n\n*Check pantry:* ${g.pantryCheck.map((p) => p.name).join(", ")}` : "";
  return `${head}\n${section("weekly")}\n${section("topup")}${pantry}\n\nEst. ₹${g.total} (simulated prices)`;
}
