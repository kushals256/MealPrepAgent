import { DISHES, getDish } from "../data/recipes";
import { INGREDIENTS } from "../data/ingredients";
import {
  DAYS, type Day, type Dish, type Household, type Meal, type Member, type PlannedDish,
  type PlannedMeal, type WeekPlan,
} from "../types";
import { dishFlags, effectiveDiet, hasBanned, isFasting, isUnwell, matchesPref, memberFit, onRoza, spiceSensitive, wantsLight } from "./constraints";

// The planner is deterministic given (household, seed, locked dishes). The LLM
// never invents the week — it edits household facts and pins dishes, and this
// engine fills the rest under hard constraints with a scored, seeded search.

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function nextMonday(from = new Date()) {
  const d = new Date(from);
  const dow = d.getDay(); // 0 Sun
  const add = dow === 1 ? 0 : (8 - dow) % 7;
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

export const proteinOf = (x: Dish) =>
  x.ingredients.find((ri) => !ri.optional && ri.qty >= 20 && (["pulses", "meat_fish"].includes(INGREDIENTS[ri.id]?.category) || ri.id === "paneer" || ri.id === "tofu"))?.id;

/** Rough ingredient cost of one adult serving (pantry staples excluded), from the simulated catalogue. */
export function dishCost(d: Dish) {
  let c = 0;
  for (const ri of d.ingredients) {
    const ing = INGREDIENTS[ri.id];
    if (!ing || ing.pantryStaple || ri.optional) continue;
    const perUnit = Math.min(...ing.packs.map((p) => p.price / p.size));
    c += perUnit * ri.qty;
  }
  return Math.round(c);
}

// Indian produce seasons (months, 1-12). In-season sabzi is cheaper, tastier and what the
// sabziwala actually has; methi/sarson/gajar/matar are winter, bhindi/lauki are summer-monsoon.
const SEASON: Record<string, number[]> = {
  methi: [10, 11, 12, 1, 2, 3], peas: [11, 12, 1, 2, 3], carrot: [11, 12, 1, 2, 3], cauliflower: [10, 11, 12, 1, 2, 3],
  spinach: [10, 11, 12, 1, 2, 3, 4], cabbage: [10, 11, 12, 1, 2, 3], radish: [11, 12, 1, 2],
  okra: [4, 5, 6, 7, 8, 9, 10], bottle_gourd: [3, 4, 5, 6, 7, 8, 9, 10], pumpkin: [6, 7, 8, 9, 10, 11], drumstick: [2, 3, 4, 5, 6],
};
export function inSeason(id: string, month: number) {
  const s = SEASON[id];
  return s ? s.includes(month) : null;
}

const isWeekend = (day: Day) => day === "Sat" || day === "Sun";
const dayIdx = (day: Day) => DAYS.indexOf(day);

export function eatersFor(hh: Household, day: Day, meal: Meal) {
  const home: Member[] = [];
  const tiffin: Member[] = [];
  for (const m of hh.members) {
    const away = m.away.some((a) => a.day === day && (a.meals.length === 0 || a.meals.includes(meal)));
    if (away) continue;
    if (meal === "lunch" && onRoza(m, day)) continue; // keeping roza: no lunch, sehri + iftar instead
    if (meal === "lunch" && m.tiffinDays.includes(day)) tiffin.push(m);
    else home.push(m);
  }
  return { home, tiffin, all: [...home, ...tiffin] };
}

interface Ctx {
  hh: Household;
  rand: () => number;
  used: Map<string, Day[]>; // dishId -> days used
  boughtPerishables: Set<string>;
  proteinUse: Map<string, number>;
  limitUse: Map<string, number>;
  nonvegLeft: number;
  custom: Dish[];
  /** ₹ per adult serving the budget allows for a whole meal (undefined = no budget). */
  budgetPerServing?: number;
  month: number;
}

export function limitKeys(d: Dish) {
  return [d.id, ...d.ingredients.filter((ri) => !ri.optional && ri.qty >= 15).map((ri) => ri.id)];
}

function overLimit(ctx: Ctx, d: Dish) {
  const lim = ctx.hh.limits;
  if (!lim) return false;
  return limitKeys(d).some((k) => lim[k] !== undefined && (ctx.limitUse.get(k) ?? 0) >= lim[k]);
}

function candidates(ctx: Ctx, role: Dish["roles"][number]) {
  return [...Object.values(DISHES), ...ctx.custom].filter((d) => d.roles.includes(role) && !hasBanned(d, ctx.hh) && !overLimit(ctx, d));
}

function fitsAll(d: Dish, members: Member[], day: Day, hh?: Household) {
  const fits = members.map((m) => ({ m, f: memberFit(m, d, day, hh) }));
  return fits.every((x) => x.f.ok) ? fits : null;
}

function score(ctx: Ctx, d: Dish, day: Day, meal: Meal, eaters: Member[], opts: { packable: boolean; cookedBy: "cook" | "household"; dayDishes: string[] }) {
  const { hh } = ctx;
  let s = 10 + ctx.rand() * 4;
  for (const m of eaters) {
    for (const l of m.likes) if (matchesPref(l, d)) s += 6;
    for (const dl of m.dislikes) if (matchesPref(dl, d)) s -= 18;
  }
  if (hh.cuisines.length) {
    if (hh.cuisines.includes(d.cuisine)) s += 4;
    else if (!["pan_indian", "modern"].includes(d.cuisine)) s -= 2;
  }
  // variety
  const prior = ctx.used.get(d.id) ?? [];
  for (const pd of prior) {
    const gap = Math.abs(dayIdx(pd) - dayIdx(day));
    s -= gap <= 1 ? 30 : gap <= 2 ? 16 : 12;
  }
  const p = proteinOf(d);
  if (p && opts.dayDishes.some((id) => { const o = getDish(id, ctx.custom); return o && proteinOf(o) === p; })) s -= 12;
  if (p) s -= 5 * (ctx.proteinUse.get(p) ?? 0);
  // effort
  const weekday = !isWeekend(day);
  if (opts.cookedBy === "household") s -= Math.max(0, d.minutes - 20) * 0.7;
  else if (weekday && d.minutes > hh.cook.maxWeekdayMinutes) s -= 12;
  if (meal === "breakfast" && weekday && d.minutes > 25) s -= 10;
  if (d.tags.includes("heavy")) s += isWeekend(day) ? 4 : -6;
  if (d.tags.includes("weekend") && isWeekend(day)) s += 3;
  if (meal === "dinner" && d.tags.includes("heavy") && weekday) s -= 3;
  if (opts.packable && (d.roles.includes("side") || d.roles.includes("complete") || d.roles.includes("breakfast")) && !d.tags.includes("packable")) s -= 10;
  // freshness: very perishable ingredients late in week cost a top-up trip
  if (d.ingredients.some((ri) => (INGREDIENTS[ri.id]?.shelfDays ?? 99) <= 2 && !ri.optional) && dayIdx(day) >= 3) s -= 2;
  // health
  const diabetic = eaters.some((m) => m.conditions.includes("diabetes"));
  if (diabetic) {
    if (d.tags.includes("diabetic_ok")) s += 3;
    if (d.ingredients.some((ri) => INGREDIENTS[ri.id]?.highGI && ri.qty >= 60)) s -= 4;
  }
  if (eaters.some((m) => m.conditions.includes("high_protein")) && d.tags.includes("high_protein")) s += 3;
  if (eaters.some((m) => m.conditions.includes("weight_loss")) && d.tags.includes("heavy")) s -= 4;
  if (eaters.some((m) => m.ageGroup === "child" || m.ageGroup === "toddler") && d.tags.includes("kid_friendly")) s += 2;
  if (eaters.some(spiceSensitive) && d.tags.includes("spicy")) s -= 2;
  // prep-ahead the night before needs someone in the kitchen
  if (d.prepAhead) {
    const prev = DAYS[(dayIdx(day) + 6) % 7];
    if (hh.cook.offDays.includes(prev)) s -= 4;
  }
  // money: with a budget, expensive dishes (mutton, prawns, paneer-heavy) must earn their place
  const cost = dishCost(d);
  if (ctx.budgetPerServing) {
    const share = d.roles.includes("complete") || d.roles.includes("breakfast") ? 1 : d.roles.includes("main") ? 0.6 : 0.3;
    const ratio = cost / (ctx.budgetPerServing * share);
    if (ratio > 1) s -= Math.min(20, (ratio - 1) * 10);
  } else if (cost > 120) s -= 2;
  // season
  for (const ri of d.ingredients) {
    const sea = inSeason(ri.id, ctx.month);
    if (sea === true) s += 1.5; else if (sea === false && ri.qty >= 40) s -= 2.5;
  }
  // reuse perishables already bought (less waste)
  let reuse = 0;
  for (const ri of d.ingredients) if (ctx.boughtPerishables.has(ri.id)) reuse += 1.5;
  s += Math.min(reuse, 4);
  return s;
}

function pick(ctx: Ctx, pool: Dish[], day: Day, meal: Meal, eaters: Member[], opts: Parameters<typeof score>[5]) {
  let best: { d: Dish; s: number } | null = null;
  for (const d of pool) {
    if (!fitsAll(d, eaters, day, ctx.hh)) continue;
    const s = score(ctx, d, day, meal, eaters, opts);
    if (!best || s > best.s) best = { d, s };
  }
  return best?.d ?? null;
}

function record(ctx: Ctx, id: string, day: Day) {
  ctx.used.set(id, [...(ctx.used.get(id) ?? []), day]);
  const d = getDish(id, ctx.custom);
  d?.ingredients.forEach((ri) => {
    if ((INGREDIENTS[ri.id]?.shelfDays ?? 99) <= 7) ctx.boughtPerishables.add(ri.id);
  });
  const p = d && proteinOf(d);
  if (p) ctx.proteinUse.set(p, (ctx.proteinUse.get(p) ?? 0) + 1);
  if (d) for (const k of new Set(limitKeys(d))) ctx.limitUse.set(k, (ctx.limitUse.get(k) ?? 0) + 1);
}

function stapleFor(ctx: Ctx, main: Dish, eaters: Member[], day: Day): string {
  const riceFirst = ["rajma", "kadhi", "sambar", "rasam", "fish_curry", "masoor_dal", "prawn_masala"].includes(main.id) || ["south_indian", "bengali", "coastal"].includes(main.cuisine);
  const options = riceFirst ? ["rice", "jeera_rice", "roti", "jowar_roti"] : ["roti", "jowar_roti", "rice", "jeera_rice"];
  for (const id of options) {
    const d = getDish(id, ctx.custom);
    if (d && !hasBanned(d, ctx.hh) && fitsAll(d, eaters, day, ctx.hh)) return id;
  }
  return "rice";
}

/** Optional ingredients nobody in the house may have (allergy) — kept out of the kitchen entirely. */
export function householdDrops(hh: Household, d: Dish): string[] {
  const out = new Set<string>();
  for (const m of hh.members) for (const ri of d.ingredients) {
    if (ri.optional && (INGREDIENTS[ri.id]?.allergens ?? []).some((a) => m.allergies.includes(a))) out.add(ri.id);
  }
  return [...out];
}

/** Standing kitchen rules the cook should always remember (shown in the daily briefing). */
export function standingNotes(hh: Household): string[] {
  const n: string[] = [];
  const allergic = hh.members.filter((m) => m.allergies.length);
  for (const m of allergic) n.push(`${m.name} is allergic to ${m.allergies.map((a) => a.replace("_", " ")).join(", ")} — never use it, not even as garnish`);
  const mild = hh.members.filter(spiceSensitive).map((m) => m.name);
  if (mild.length) n.push(`Keep ${mild.join(" & ")}'s portion mild — take it out before chilli goes in`);
  const lowSalt = hh.members.filter((m) => m.conditions.includes("hypertension")).map((m) => m.name);
  if (lowSalt.length) n.push(`Less salt for ${lowSalt.join(" & ")}`);
  const diab = hh.members.filter((m) => m.conditions.includes("diabetes")).map((m) => m.name);
  if (diab.length) n.push(`${diab.join(" & ")}: diabetic — no sugar, less rice/potato`);
  const jain = hh.members.filter((m) => m.jain).map((m) => m.name);
  if (jain.length) n.push(`${jain.join(" & ")} eat Jain — no onion, garlic, potato or other root vegetables`);
  for (const m of hh.members) if (m.vegDays.length && m.diet !== "veg") n.push(`${m.name} doesn't eat non-veg on ${m.vegDays.join(", ")}`);
  // meats the whole house avoids read as one rule; individual ones stay per person
  const meats = ["beef", "pork", "mutton", "chicken", "fish", "seafood", "egg"] as const;
  const houseWide = meats.filter((t) => hh.members.length > 0 && hh.members.every((m) => m.avoidMeats?.includes(t) || m.diet === "veg" || m.diet === "vegan"));
  const nonvegEaters = hh.members.some((m) => m.diet === "nonveg" || m.diet === "eggetarian");
  if (houseWide.length && nonvegEaters) n.push(`No ${houseWide.join(" or ")} in this house`);
  for (const m of hh.members) {
    const own = (m.avoidMeats ?? []).filter((t) => !houseWide.includes(t));
    if (own.length) n.push(`${m.name} never eats ${own.join(", ")}`);
  }
  const sattvik = hh.members.filter((m) => m.noOnionGarlic && !m.jain).map((m) => m.name);
  if (sattvik.length) n.push(`${sattvik.join(" & ")}: no onion or garlic`);
  if (hh.sattvikDays?.length) n.push(`No onion-garlic in the kitchen on ${hh.sattvikDays.join(", ")}`);
  if (hh.noNonvegAtHome) n.push("No meat or eggs are cooked in this kitchen");
  if (hh.meatRule) n.push(`Buy only ${hh.meatRule} meat`);
  const roza = hh.members.filter((m) => m.rozaDays?.length).map((m) => m.name);
  if (roza.length) n.push(`${roza.join(" & ")} keeping roza — sehri before dawn, iftar at sunset, no lunch`);
  return n;
}

/** Meal-specific notes for the cook: portions, allergy safety, guests, tiffin. */
export function mealNotes(hh: Household, pm: PlannedMeal, custom: Dish[]): string[] {
  const notes: string[] = [];
  const byName = new Map(hh.members.map((m) => [m.name, m]));
  const dishes = pm.dishes.map((pd) => ({ pd, d: getDish(pd.dishId, custom) })).filter((x) => x.d) as { pd: PlannedDish; d: Dish }[];
  const mild = new Set<string>();
  for (const { pd, d } of dishes) {
    const forMembers = (pd.for === "all" ? pm.eaters.concat(pm.tiffin) : pd.for).map((n) => byName.get(n)).filter(Boolean) as Member[];
    for (const m of forMembers) {
      memberFit(m, d, pm.day, hh).adapt.forEach((a) => notes.push(`${d.name}: ${a}`));
      if (spiceSensitive(m) && (d.tags.includes("spicy") || d.ingredients.some((ri) => ri.id === "red_chilli" || ri.id === "green_chilli"))) mild.add(m.name);
    }
    const drops = householdDrops(hh, d);
    if (drops.length) notes.push(`${d.name}: skip the ${drops.map((x) => INGREDIENTS[x].name.toLowerCase()).join(", ")} (allergy in the house)`);
  }
  if (mild.size) notes.push(`Mild portion for ${[...mild].join(" & ")} before adding chilli`);
  const eaters = pm.eaters.concat(pm.tiffin).map((n) => byName.get(n)).filter(Boolean) as Member[];
  const hasRice = dishes.some(({ d }) => d.ingredients.some((ri) => (ri.id === "rice" || ri.id === "basmati") && ri.qty >= 50));
  for (const m of eaters) {
    if (m.conditions.includes("diabetes") && hasRice) notes.push(`${m.name}: small rice portion, add an extra roti/salad`);
    if (m.ageGroup === "toddler") notes.push(`${m.name}: mash a plain, unspiced portion`);
  }
  for (const m of eaters) {
    if (onRoza(m, pm.day) && pm.meal === "breakfast") notes.push(`Sehri for ${m.name} before dawn (~4:45) — keep it ready the night before; filling, not salty`);
    if (onRoza(m, pm.day) && pm.meal === "dinner") notes.push(`Iftar for ${m.name} at sunset — dates, fruit and water first, then the meal`);
    if (isUnwell(m, pm.day)) notes.push(`${m.name} is unwell — light, less oil, no chilli`);
    if (m.sunsetDinner && pm.meal === "dinner") notes.push(`Serve ${m.name}'s dinner before sunset (chauvihar)`);
  }
  if (hh.sattvikDays?.includes(pm.day)) notes.push("No onion-garlic in the kitchen today");
  if (hh.meatRule && pm.dishes.some((pd) => { const d = getDish(pd.dishId, custom); return d && dishFlags(d).meat; })) notes.push(`Meat must be ${hh.meatRule}`);
  const fasting = eaters.filter((m) => isFasting(m, pm.day)).map((m) => m.name);
  if (fasting.length) notes.push(`${fasting.join(" & ")} fasting — use sendha namak, separate vessel`);
  if (pm.guests > 0) notes.push(`+${pm.guests} guest${pm.guests > 1 ? "s" : ""} — cook extra`);
  if (pm.tiffin.length) notes.push(`Pack tiffin for ${pm.tiffin.join(", ")} before they leave`);
  return [...new Set(notes)];
}

export function planWeek(hh: Household, opts: { seed?: number; previous?: WeekPlan | null; custom?: Dish[]; weekOf?: string; budgetScale?: number } = {}): WeekPlan {
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const custom = opts.custom ?? [];
  const weekOf = opts.weekOf ?? opts.previous?.weekOf ?? nextMonday();
  const ctx: Ctx = { hh, rand: mulberry32(seed), used: new Map(), boughtPerishables: new Set(), proteinUse: new Map(), limitUse: new Map(), nonvegLeft: hh.nonvegPerWeek, custom, month: new Date(weekOf + "T00:00:00").getMonth() + 1 };
  if (hh.budgetPerWeek) {
    // ~75% of a grocery budget goes into planned meals; the rest is milk, fruit, snacks
    let servings = 0;
    for (const day of DAYS) for (const meal of hh.meals) {
      if (hh.eatOut.some((e) => e.day === day && e.meal === meal)) continue;
      servings += eatersFor(hh, day, meal).all.reduce((a, m) => a + (m.ageGroup === "child" ? 0.6 : m.ageGroup === "toddler" ? 0.35 : 1), 0);
    }
    ctx.budgetPerServing = servings ? ((hh.budgetPerWeek * 0.75) / servings) * (opts.budgetScale ?? 1) : undefined;
  }
  const locked = new Map<string, PlannedDish[]>();
  for (const pm of opts.previous?.meals ?? []) {
    const l = pm.dishes.filter((d) => d.locked);
    if (l.length) locked.set(`${pm.day}:${pm.meal}`, l);
  }
  // count locked usage first so variety scoring respects them
  locked.forEach((ds, key) => ds.forEach((d) => record(ctx, d.dishId, key.split(":")[0] as Day)));

  // Pre-pick which dinners/lunches carry non-veg, spread across the week.
  const nonvegSlots = new Set<string>();
  {
    const eligible: string[] = [];
    for (const day of DAYS) for (const meal of ["dinner", "lunch"] as Meal[]) {
      if (hh.noNonvegAtHome || !hh.meals.includes(meal) || hh.eatOut.some((e) => e.day === day && e.meal === meal)) continue;
      const { all } = eatersFor(hh, day, meal);
      if (all.some((m) => effectiveDiet(m, day) === "nonveg" && !isFasting(m, day))) eligible.push(`${day}:${meal}`);
    }
    const dinners = eligible.filter((k) => k.endsWith("dinner"));
    const pool = dinners.length >= hh.nonvegPerWeek ? dinners : eligible;
    const want = Math.min(hh.nonvegPerWeek, pool.length);
    // spread evenly across the week with a little seeded jitter, never doubling up
    const step = pool.length / Math.max(1, want);
    for (let i = 0; i < want; i++) {
      let idx = Math.min(pool.length - 1, Math.floor(i * step + ctx.rand() * Math.max(0, step - 1)));
      while (nonvegSlots.has(pool[idx]) && idx < pool.length - 1) idx++;
      while (nonvegSlots.has(pool[idx]) && idx > 0) idx--;
      nonvegSlots.add(pool[idx]);
    }
  }

  const meals: PlannedMeal[] = [];
  for (const day of DAYS) {
    const dayDishes: string[] = [];
    for (const meal of hh.meals) {
      const { home, tiffin, all } = eatersFor(hh, day, meal);
      const guestCount = hh.guests.filter((g) => g.day === day && g.meal === meal).reduce((a, g) => a + g.count, 0);
      const cookedBy: PlannedMeal["cookedBy"] = hh.cook.offDays.includes(day) || !hh.cook.meals.includes(meal) ? "household" : "cook";
      const pm: PlannedMeal = { day, meal, status: "planned", dishes: [], eaters: home.map((m) => m.name), tiffin: tiffin.map((m) => m.name), guests: guestCount, notes: [], cookedBy };

      if (hh.eatOut.some((e) => e.day === day && e.meal === meal)) { pm.status = "eat_out"; meals.push(pm); continue; }
      if (all.length === 0 && guestCount === 0) { pm.status = "skipped"; meals.push(pm); continue; }

      const key = `${day}:${meal}`;
      const lockedHere = locked.get(key);
      const fasting = all.filter((m) => isFasting(m, day));
      const core = all.filter((m) => !isFasting(m, day));
      const sopts = { packable: tiffin.length > 0, cookedBy, dayDishes };

      // Pinned dishes stay. Anyone not already fed by them gets dishes picked for
      // their group (the whole table, the non-fasting group, or just the uncovered).
      const kept = (lockedHere ?? []).map((d) => ({ ...d }));
      const fed = (m: Member) => kept.some((pd) => {
        const d = getDish(pd.dishId, custom);
        if (!d || d.roles.every((r) => r === "staple" || r === "side")) return false;
        const who = pd.for === "all" ? all.map((x) => x.name) : pd.for;
        return who.includes(m.name) && memberFit(m, d, day, hh).ok;
      });
      const needCore = core.filter((m) => !fed(m));
      const needFast = fasting.filter((m) => !fed(m));
      const fresh: PlannedDish[] = [];
      const add = (d: Dish | null, forWho: PlannedDish["for"] = "all") => { if (d) fresh.push({ dishId: d.id, for: forWho }); };
      if (needCore.length) {
        const group = needCore;
        if (meal === "breakfast") {
          // meat breakfasts (keema paratha) only for sehri; eggs are fine any morning
          const sehri = group.some((m) => onRoza(m, day));
          add(pick(ctx, candidates(ctx, "breakfast").filter((d) => sehri || !dishFlags(d).meat), day, meal, group, sopts));
        } else {
          const nvEaters = group.filter((m) => effectiveDiet(m, day) === "nonveg");
          const wantNonveg = nonvegSlots.has(key) && nvEaters.length > 0 && !kept.some((pd) => dishFlags(getDish(pd.dishId, custom)!).nonveg);
          if (ctx.rand() < (isWeekend(day) ? 0.4 : 0.28)) {
            // meat only lands in the chosen non-veg slots; eggs count as non-veg too
            const allNv = wantNonveg && nvEaters.length === group.length;
            const pool = candidates(ctx, "complete").filter((d) => (allNv ? dishFlags(d).nonveg : !dishFlags(d).nonveg));
            add(pick(ctx, pool, day, meal, group, sopts));
          }
          if (!fresh.length) {
            // non-veg for everyone if everyone eats it; else a veg table + non-veg add-on
            const mains = candidates(ctx, "main");
            let main: Dish | null = null;
            if (wantNonveg && nvEaters.length === group.length) main = pick(ctx, mains.filter((d) => dishFlags(d).nonveg), day, meal, group, sopts);
            main = main ?? pick(ctx, mains.filter((d) => !dishFlags(d).nonveg), day, meal, group, sopts) ?? pick(ctx, mains.filter((d) => !dishFlags(d).meat), day, meal, group, sopts);
            if (main) {
              add(main);
              add(pick(ctx, candidates(ctx, "side"), day, meal, group, { ...sopts, dayDishes: [...dayDishes, main.id] }));
              add(getDish(stapleFor(ctx, main, group, day), custom) ?? null);
            }
          }
          if (wantNonveg && nvEaters.length < group.length && !fresh.some((pd) => dishFlags(getDish(pd.dishId, custom)!).nonveg)) {
            add(pick(ctx, candidates(ctx, "main").filter((d) => dishFlags(d).nonveg), day, meal, nvEaters, sopts), nvEaters.map((m) => m.name));
          }
        }
        // scope shared dishes to the group when not everyone at the table is in it
        if (group.length !== all.length) fresh.forEach((pd) => { if (pd.for === "all") pd.for = group.map((m) => m.name); });
      }
      if (needFast.length) add(pick(ctx, candidates(ctx, "fasting"), day, meal, needFast, sopts), needFast.map((m) => m.name));
      // someone unwell (or who wants light food at this meal): if the table's food isn't light,
      // a separate khichdi/moong dal/curd rice for them
      const unwell = needCore.filter((m) => wantsLight(m, day, meal));
      const isLight = (pd: PlannedDish) => { const d = getDish(pd.dishId, custom); return !!d && (d.tags.includes("light") || d.tags.includes("comfort")) && !d.tags.includes("spicy"); };
      if (unwell.length && !fresh.filter((pd) => !getDish(pd.dishId, custom)?.roles.includes("staple")).some(isLight)) {
        const pool = [...candidates(ctx, meal === "breakfast" ? "breakfast" : "complete"), ...candidates(ctx, "main")].filter((d) => (d.tags.includes("light") || d.tags.includes("comfort")) && !d.tags.includes("spicy"));
        const ld = pick(ctx, pool, day, meal, unwell, { ...sopts, packable: false });
        if (ld) {
          add(ld, unwell.map((m) => m.name));
          // and take them off the heavy shared dishes
          fresh.forEach((pd) => { if (pd.dishId !== ld.id && !getDish(pd.dishId, custom)?.roles.includes("staple")) pd.for = (pd.for === "all" ? all.map((m) => m.name) : pd.for).filter((n) => !unwell.some((u) => u.name === n)); });
          if (!ld.roles.includes("complete") && !ld.roles.includes("breakfast")) {
            const st = fresh.find((pd) => getDish(pd.dishId, custom)?.roles.includes("staple"));
            if (!st) add(getDish("rice", custom) ?? null, unwell.map((m) => m.name));
          }
        }
      }
      pm.dishes = [...kept, ...fresh].filter((pd) => pd.for === "all" || pd.for.length);
      for (const pd of fresh) record(ctx, pd.dishId, day);
      pm.dishes.forEach((pd) => dayDishes.push(pd.dishId));
      pm.notes = mealNotes(hh, pm, custom);
      meals.push(pm);
    }
  }
  return { weekOf, meals, seed, generatedAt: new Date().toISOString() };
}

/** The decisions behind a plan, in plain words — spoken by the agent and shown as "why this plan". */
export function explainPlan(hh: Household, plan: WeekPlan, custom: Dish[] = []): string[] {
  const out: string[] = [];
  const planned = plan.meals.filter((m) => m.status === "planned" || m.status === "done");
  const ds = (pm: PlannedMeal) => pm.dishes.map((pd) => ({ pd, d: getDish(pd.dishId, custom)! })).filter((x) => x.d);
  const nv = planned.filter((pm) => ds(pm).some(({ d }) => dishFlags(d).nonveg));
  if (nv.length) {
    const addon = nv.filter((pm) => ds(pm).some(({ pd, d }) => dishFlags(d).nonveg && pd.for !== "all"));
    out.push(`Non-veg on ${[...new Set(nv.map((m) => m.day))].join(", ")}${addon.length ? ", cooked as a separate dish so the vegetarians eat their own full meal" : ""}`);
  }
  for (const m of hh.members) {
    if (m.vegDays.length && m.diet !== "veg") out.push(`${m.name}'s ${m.vegDays.join("/")} kept vegetarian`);
    if (m.fastDays.length) out.push(`${m.name}'s ${m.fastDays.join("/")} fast: separate vrat food (sendha namak, no grains)`);
    if (m.rozaDays?.length) out.push(`${m.name}'s roza days: sehri and iftar planned, no lunch`);
    if (m.allergies.length) out.push(`${m.name}'s ${m.allergies.join("/")} allergy: those dishes are out and garnishes skipped for the whole house`);
    if (m.jain) out.push(`${m.name}: Jain — no root vegetables, mushroom or brinjal; Jain portions taken out before onion/garlic`);
    if (m.unwellDays?.length) out.push(`${m.name} unwell on ${m.unwellDays.join("/")}: light food just for them`);
    if (m.lightMeals?.length) out.push(`${m.name} gets a light ${m.lightMeals.join("/")} whenever the table's food is heavy`);
  }
  const diab = hh.members.filter((m) => m.conditions.includes("diabetes")).map((m) => m.name);
  if (diab.length) out.push(`For ${diab.join(" & ")}'s sugar: more millets and dals, rice kept small`);
  const tiffin = planned.filter((pm) => pm.tiffin.length);
  if (tiffin.length) out.push(`Tiffin days have dry, packable sabzis that survive till lunch`);
  const off = planned.filter((pm) => pm.cookedBy === "household");
  if (off.length) out.push(`${hh.cook.name}'s day off: quick dishes (under ~30 min) for whoever cooks`);
  const guests = planned.filter((pm) => pm.guests);
  for (const g of guests) out.push(`${g.day} ${g.meal}: +${g.guests} guests, quantities scaled up${ds(g).some(({ d }) => d.tags.includes("weekend") || d.tags.includes("heavy")) ? " and something a little special" : ""}`);
  const weekend = planned.filter((pm) => (pm.day === "Sat" || pm.day === "Sun") && ds(pm).some(({ d }) => d.tags.includes("weekend")));
  if (weekend.length) out.push(`The heavier, special dishes are on the weekend; weekdays stay light and quick`);
  const prep = prepTasks(plan, custom);
  if (prep.length) out.push(`${prep.length} night-before prep reminder${prep.length > 1 ? "s" : ""} (soaking rajma/chole, marinating) for the cook`);
  const month = new Date(plan.weekOf + "T00:00:00").getMonth() + 1;
  const seasonal = new Set<string>();
  planned.forEach((pm) => ds(pm).forEach(({ d }) => d.ingredients.forEach((ri) => { if (inSeason(ri.id, month)) seasonal.add(INGREDIENTS[ri.id].hindi); })));
  if (seasonal.size) out.push(`Leaning on what's in season now: ${[...seasonal].slice(0, 4).join(", ")}`);
  return out;
}

/** Re-derive attendance and notes for every meal without changing dishes (after household facts change). */
export function refreshPlan(hh: Household, plan: WeekPlan, custom: Dish[]): WeekPlan {
  const meals = plan.meals.map((pm) => {
    const { home, tiffin, all } = eatersFor(hh, pm.day, pm.meal);
    const guests = hh.guests.filter((g) => g.day === pm.day && g.meal === pm.meal).reduce((a, g) => a + g.count, 0);
    const eatOut = hh.eatOut.some((e) => e.day === pm.day && e.meal === pm.meal);
    const next: PlannedMeal = {
      ...pm,
      eaters: home.map((m) => m.name),
      tiffin: tiffin.map((m) => m.name),
      guests,
      cookedBy: hh.cook.offDays.includes(pm.day) || !hh.cook.meals.includes(pm.meal) ? "household" : "cook",
      status: pm.status === "done" ? "done" : eatOut ? "eat_out" : all.length === 0 && guests === 0 ? "skipped" : "planned",
      dishes: pm.dishes.map((pd) => (pd.for === "all" ? pd : { ...pd, for: pd.for.filter((n) => all.some((m) => m.name === n)) })).filter((pd) => pd.for === "all" || pd.for.length),
    };
    next.notes = mealNotes(hh, next, custom);
    return next;
  });
  return { ...plan, meals };
}

/** Prep the cook must do the evening before (soaking, marinating). */
export function prepTasks(plan: WeekPlan, custom: Dish[]) {
  const tasks: { day: Day; forDay: Day; meal: Meal; text: string; dishId: string }[] = [];
  for (const pm of plan.meals) {
    if (pm.status !== "planned") continue;
    for (const pd of pm.dishes) {
      const d = getDish(pd.dishId, custom);
      if (d?.prepAhead) tasks.push({ day: DAYS[(dayIdx(pm.day) + 6) % 7], forDay: pm.day, meal: pm.meal, text: `${d.prepAhead} — for ${pm.day} ${pm.meal} (${d.name})`, dishId: d.id });
    }
  }
  return tasks;
}
