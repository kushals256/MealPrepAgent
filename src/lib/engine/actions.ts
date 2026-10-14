import { INGREDIENTS, resolveIngredient } from "../data/ingredients";
import { member as newMember } from "../data/households";
import { DISHES, getDish, resolveDish } from "../data/recipes";
import {
  DAYS, MEALS, type Allergen, type AppState, type Condition, type CookLang, type Day, type Diet, type Dish,
  type DishRole, type Meal, type MeatType, type Member, type PlannedDish, type WeekPlan,
} from "../types";
import { dishFlags, memberFit } from "./constraints";
import { planWeek, refreshPlan, mealNotes, explainPlan } from "./planner";
import { planWithinBudget } from "./budget";
import { validatePlan } from "./validate";
import { snapshot, undo } from "../store";

// Applies structured actions emitted by the LLM. The LLM proposes; this code
// disposes — every action is validated, and results (including refusals) are
// fed back to the model so it never claims something that didn't happen.

export type Action = { type: string; [k: string]: unknown };

export interface ApplyResult {
  results: string[]; // human-readable outcomes fed back to the LLM
  problems: string[]; // things the agent must tell the user
  changed: boolean;
  planChanged: boolean;
  finalize?: { channel: "instamart" | "whatsapp"; phone?: string };
}

// ---------- normalisers (LLMs are creative with formats) ----------
const DAY_MAP: Record<string, Day> = {
  mon: "Mon", monday: "Mon", somvar: "Mon", tue: "Tue", tues: "Tue", tuesday: "Tue", mangalvar: "Tue",
  wed: "Wed", wednesday: "Wed", budhvar: "Wed", thu: "Thu", thur: "Thu", thurs: "Thu", thursday: "Thu", guruvar: "Thu",
  fri: "Fri", friday: "Fri", shukravar: "Fri", sat: "Sat", saturday: "Sat", shanivar: "Sat", sun: "Sun", sunday: "Sun", ravivar: "Sun",
};
export function day(x: unknown): Day | null {
  if (typeof x !== "string") return null;
  return DAY_MAP[x.toLowerCase().trim()] ?? null;
}
function days(x: unknown): Day[] {
  if (x === "weekdays") return ["Mon", "Tue", "Wed", "Thu", "Fri"];
  if (x === "weekends" || x === "weekend") return ["Sat", "Sun"];
  if (x === "all" || x === "everyday" || x === "daily") return [...DAYS];
  const arr = Array.isArray(x) ? x : typeof x === "string" ? x.split(/[,\s]+/) : [];
  return arr.flatMap((d) => (d === "weekdays" ? ["Mon", "Tue", "Wed", "Thu", "Fri"] as Day[] : day(d) ? [day(d)!] : []));
}
export function meal(x: unknown): Meal | null {
  if (typeof x !== "string") return null;
  const t = x.toLowerCase();
  if (t.startsWith("break") || t === "nashta" || t === "nasta") return "breakfast";
  if (t.startsWith("lun") || t === "tiffin" || t === "dopahar") return "lunch";
  if (t.startsWith("din") || t.startsWith("sup") || t === "raat") return "dinner";
  return null;
}
function meals(x: unknown): Meal[] {
  const arr = Array.isArray(x) ? x : typeof x === "string" ? x.split(/[,\s]+/) : [];
  return arr.map(meal).filter(Boolean) as Meal[];
}
const PLACEHOLDER = /^(unnamed|unknown|n\/?a|none|null|undefined|-|<.*>|\.\.\.|…)$/i;
const real = (x: unknown) => typeof x === "string" && x.trim() !== "" && !PLACEHOLDER.test(x.trim());
const strs = (x: unknown): string[] => (Array.isArray(x) ? x.map(String) : typeof x === "string" && x ? x.split(/,\s*/) : []);
const ALLERGENS: Allergen[] = ["peanut", "tree_nut", "dairy", "gluten", "sesame", "egg", "soy", "shellfish", "fish"];
function allergen(x: string): Allergen | null {
  const t = x.toLowerCase().replace(/s$/, "").replace(/[\s-]+/g, "_");
  if (ALLERGENS.includes(t as Allergen)) return t as Allergen;
  if (/peanut|groundnut|mungfali/.test(t)) return "peanut";
  if (/cashew|almond|walnut|pista|nut/.test(t)) return "tree_nut";
  if (/milk|lactose|dairy|paneer/.test(t)) return "dairy";
  if (/wheat|gluten|atta|celiac/.test(t)) return "gluten";
  if (/prawn|shrimp|crab|shell/.test(t)) return "shellfish";
  if (/til|sesame/.test(t)) return "sesame";
  return null;
}
const CONDS: Condition[] = ["diabetes", "hypertension", "high_protein", "lactose_intolerant", "weight_loss", "toddler", "pregnancy"];
function condition(x: string): Condition | null {
  const t = x.toLowerCase();
  if (CONDS.includes(t as Condition)) return t as Condition;
  if (/diab|sugar/.test(t)) return "diabetes";
  if (/bp|pressure|hypert/.test(t)) return "hypertension";
  if (/protein|gym|muscle/.test(t)) return "high_protein";
  if (/lactose/.test(t)) return "lactose_intolerant";
  if (/weight|diet|loss/.test(t)) return "weight_loss";
  if (/pregnan/.test(t)) return "pregnancy";
  return null;
}
function diet(x: unknown): Diet | null {
  const t = String(x ?? "").toLowerCase();
  if (!t) return null;
  if (t.includes("vegan")) return "vegan";
  if (t.includes("egg")) return "eggetarian";
  if (t.includes("non")) return "nonveg";
  if (t.includes("veg")) return "veg";
  return null;
}
function findMember(s: AppState, name: unknown): Member | undefined {
  const n = String(name ?? "").toLowerCase().trim();
  return s.household.members.find((m) => m.name.toLowerCase() === n) ?? s.household.members.find((m) => m.name.toLowerCase().includes(n) || n.includes(m.name.toLowerCase()));
}

const uniq = <T,>(a: T[]) => [...new Set(a)];

// ---------- plan helpers ----------
function getMeal(plan: WeekPlan, d: Day, m: Meal) {
  return plan.meals.find((x) => x.day === d && x.meal === m);
}

/** Re-pick only the slots that now violate a hard rule; leave everything else untouched. */
export function repairPlan(s: AppState): string[] {
  if (!s.plan) return [];
  s.plan = refreshPlan(s.household, s.plan, s.customDishes);
  const bad = new Set(validatePlan(s.household, s.plan, s.customDishes).filter((v) => v.severity === "hard").map((v) => `${v.day}:${v.meal}`));
  // newly-eaten meals with no dishes (e.g. someone is no longer eating out)
  for (const pm of s.plan.meals) if (pm.status === "planned" && pm.dishes.length === 0) bad.add(`${pm.day}:${pm.meal}`);
  if (!bad.size) return [];
  // Freeze every healthy slot (planWeek keeps locked slots verbatim), empty the
  // broken ones so they get re-picked, then restore the original lock flags.
  type Tmp = PlannedDish & { _temp?: boolean };
  const temp: WeekPlan = {
    ...s.plan,
    meals: s.plan.meals.map((pm) => ({
      ...pm,
      dishes: bad.has(`${pm.day}:${pm.meal}`) ? [] : pm.dishes.map((d) => ({ ...d, locked: true, _temp: !d.locked }) as Tmp),
    })),
  };
  const next = planWeek(s.household, { seed: s.plan.seed + 1, previous: temp, custom: s.customDishes, weekOf: s.plan.weekOf });
  next.meals.forEach((pm) => pm.dishes.forEach((d: Tmp) => { if (d._temp) d.locked = false; delete d._temp; }));
  s.plan = next;
  return [...bad].map((k) => k.replace(":", " "));
}

/** Put a dish into a meal slot, figuring out who can eat it. */
export function setDish(s: AppState, d: Day, m: Meal, dishText: string, opts: { replace?: string; forNames?: string[]; addOnly?: boolean; by?: "household" | "cook" }): { ok: boolean; msg: string } {
  if (!s.plan) return { ok: false, msg: "No plan yet — generate one first" };
  const pm = getMeal(s.plan, d, m);
  if (!pm) return { ok: false, msg: `${m} on ${d} isn't part of the plan (meals planned: ${s.household.meals.join(", ")})` };
  const id = resolveDish(dishText, s.customDishes);
  if (!id) return { ok: false, msg: `I don't know the dish "${dishText}" — use add_custom_dish with its ingredients first` };
  const dish = getDish(id, s.customDishes)!;
  const eaters = s.household.members.filter((x) => [...pm.eaters, ...pm.tiffin].includes(x.name));
  const target = opts.forNames?.length ? eaters.filter((x) => opts.forNames!.some((n) => x.name.toLowerCase() === n.toLowerCase())) : eaters;
  const fits = target.map((x) => ({ x, f: memberFit(x, dish, d, s.household) }));
  const canEat = fits.filter((f) => f.f.ok).map((f) => f.x.name);
  const cannot = fits.filter((f) => !f.f.ok);
  if (!canEat.length) return { ok: false, msg: `Can't serve ${dish.name} on ${d} ${m}: ${cannot.map((c) => c.f.reason).join("; ")}` };

  if (pm.status !== "planned") pm.status = "planned";
  // decide which dish(es) it replaces
  const roleOf = (x: Dish) => (x.roles.includes("complete") ? "complete" : x.roles[0]);
  const newRole = roleOf(dish);
  let removed: string[] = [];
  // a dish only some of the table can eat is an add-on next to the shared food
  const partial = cannot.length > 0;
  if (!opts.addOnly) {
    const rep = opts.replace ? resolveDish(opts.replace, s.customDishes) : null;
    const before = pm.dishes;
    pm.dishes = pm.dishes.filter((pd) => {
      const od = getDish(pd.dishId, s.customDishes);
      if (!od) return false;
      if (rep) return pd.dishId !== rep;
      if (opts.replace === "all") return false;
      // complete meal replaces main+side+staple for the same group; main replaces main, etc.
      const sameGroup = partial ? Array.isArray(pd.for) && pd.for.every((n) => canEat.includes(n)) : pd.for === "all" || (Array.isArray(pd.for) && pd.for.every((n) => canEat.includes(n)));
      if (!sameGroup) return true;
      const or = roleOf(od);
      if (newRole === "complete") return !["main", "side", "staple", "complete"].includes(or) || (Array.isArray(pd.for) && dishFlags(od).nonveg && !dishFlags(dish).nonveg);
      if (or === "complete" && ["main", "side"].includes(newRole)) return false;
      return or !== newRole || (dishFlags(od).nonveg !== dishFlags(dish).nonveg && Array.isArray(pd.for));
    });
    removed = before.filter((b) => !pm.dishes.includes(b)).map((b) => getDish(b.dishId, s.customDishes)?.name ?? b.dishId);
  }
  const forWho: PlannedDish["for"] = cannot.length || opts.forNames?.length ? canEat : "all";
  pm.dishes.push({ dishId: id, for: forWho, locked: true });
  // a main needs a staple alongside
  if (newRole === "main" && !pm.dishes.some((pd) => getDish(pd.dishId, s.customDishes)?.roles.some((r) => r === "staple" || r === "complete"))) {
    pm.dishes.push({ dishId: ["rajma", "kadhi", "sambar", "rasam"].includes(id) ? "rice" : "roti", for: forWho });
  }
  pm.notes = mealNotes(s.household, pm, s.customDishes);
  // anyone left with nothing gets covered by repair
  const left = cannot.map((c) => c.x.name);
  let msg = `${dish.name} set for ${d} ${m}${forWho === "all" ? "" : ` (for ${canEat.join(", ")})`}`;
  if (removed.length) msg += `, replacing ${removed.join(", ")}`;
  if (left.length) msg += `. ${cannot.map((c) => c.f.reason).join("; ")} — they'll get a separate dish`;
  if (dish.prepAhead) msg += `. Note: ${dish.prepAhead}`;
  msg += `. ${d} ${m} is now: ${pm.dishes.map((pd) => `${getDish(pd.dishId, s.customDishes)?.name}${pd.for === "all" ? " (everyone)" : ` (only ${pd.for.join(", ")})`}`).join(" + ")}`;
  return { ok: true, msg };
}

function findPlanned(s: AppState, text: string): { d: Day; m: Meal }[] {
  const id = resolveDish(text, s.customDishes);
  if (!id || !s.plan) return [];
  return s.plan.meals.filter((pm) => pm.dishes.some((x) => x.dishId === id)).map((pm) => ({ d: pm.day, m: pm.meal }));
}

/** Exactly which meal slots changed between two plans — the agent may only describe these. */
export function diffPlans(before: WeekPlan | null, after: WeekPlan | null, custom: Dish[]): string[] {
  if (!after) return [];
  const name = (id: string) => getDish(id, custom)?.name ?? id;
  const fmt = (pm: WeekPlan["meals"][number]) =>
    pm.status === "eat_out" ? "eating out" : pm.status === "skipped" ? "nobody home" :
    pm.dishes.map((d) => `${name(d.dishId)}${d.for === "all" ? "" : ` (${d.for.join(", ")})`}`).join(" + ") + (pm.guests ? ` [+${pm.guests} guests]` : "");
  if (!before) return ["A whole new week was planned"];
  const out: string[] = [];
  for (const pm of after.meals) {
    const old = before.meals.find((x) => x.day === pm.day && x.meal === pm.meal);
    const a = old ? fmt(old) : "", b = fmt(pm);
    if (a !== b) out.push(`${pm.day} ${pm.meal}: ${a || "—"} → ${b}`);
  }
  return out;
}

// ---------- main entry ----------
export function applyHouseholdActions(s: AppState, actions: Action[]): ApplyResult {
  const r: ApplyResult = { results: [], problems: [], changed: false, planChanged: false };
  if (!actions.length) return r;
  snapshot(s);
  const hh = s.household;
  let factsChanged = false;

  for (const a of actions) {
    try {
      switch (a.type) {
        case "update_household": {
          if (real(a.familyName)) hh.familyName = String(a.familyName);
          if (real(a.city)) hh.city = String(a.city);
          if (a.cuisines) hh.cuisines = uniq(strs(a.cuisines).map((c) => c.toLowerCase().replace(/\s+/g, "_")));
          if (a.meals) { const ms = meals(a.meals); if (ms.length) hh.meals = MEALS.filter((x) => ms.includes(x)); }
          if (a.nonvegPerWeek !== undefined) hh.nonvegPerWeek = Math.max(0, Math.min(14, Number(a.nonvegPerWeek) || 0));
          if (a.budgetPerWeek !== undefined) hh.budgetPerWeek = Number(a.budgetPerWeek) || undefined;
          if (a.note) hh.notes = uniq([...hh.notes, String(a.note)]);
          if (a.noNonvegAtHome !== undefined) hh.noNonvegAtHome = Boolean(a.noNonvegAtHome);
          if (a.sattvikDays !== undefined) hh.sattvikDays = days(a.sattvikDays);
          if (a.meatRule !== undefined) hh.meatRule = ["halal", "jhatka"].includes(String(a.meatRule)) ? (a.meatRule as "halal" | "jhatka") : undefined;
          r.results.push("Household details updated"); factsChanged = true; break;
        }
        case "upsert_member": {
          const name = String(a.name ?? "").trim();
          if (!name) { r.problems.push("A member needs a name (use a relation like 'Papa' if unknown)"); break; }
          let m = findMember(s, name);
          if (!m && a.isSpeaker) { const me = hh.members.find((x) => /^(me|you|myself)$/i.test(x.name)); if (me) { me.name = name; m = me; } }
          const created = !m;
          if (!m) { m = newMember({ name: name[0].toUpperCase() + name.slice(1) }); hh.members.push(m); }
          if (a.ageGroup && ["toddler", "child", "teen", "adult", "elderly"].includes(String(a.ageGroup))) m.ageGroup = a.ageGroup as Member["ageGroup"];
          if (a.age !== undefined) { const n = Number(a.age); if (n) m.ageGroup = n < 4 ? "toddler" : n < 13 ? "child" : n < 18 ? "teen" : n >= 65 ? "elderly" : "adult"; }
          const dt = diet(a.diet); if (dt) m.diet = dt;
          if (a.jain !== undefined) m.jain = Boolean(a.jain);
          if (a.noOnionGarlic !== undefined) m.noOnionGarlic = Boolean(a.noOnionGarlic);
          if (a.sunsetDinner !== undefined) m.sunsetDinner = Boolean(a.sunsetDinner);
          const meatsIn = strs(a.avoidMeats).map((x) => x.toLowerCase().replace(/s$/, "")).map((x) => (x === "prawn" || x === "shrimp" ? "seafood" : x === "goat" || x === "lamb" ? "mutton" : x === "beef" || x === "cow" ? "beef" : x === "pig" || x === "ham" || x === "bacon" ? "pork" : x)).filter((x) => ["beef", "pork", "mutton", "chicken", "fish", "seafood", "egg"].includes(x)) as MeatType[];
          if (meatsIn.length) m.avoidMeats = uniq([...(m.avoidMeats ?? []), ...meatsIn]);
          // models reach for these names — accept them rather than silently dropping the fact
          const awayIn = a.awayDays ?? (a.away === true ? a.days : a.away) ?? a.travelDays ?? a.absentDays;
          if (awayIn) {
            const list = Array.isArray(awayIn) && awayIn.length && typeof awayIn[0] === "object" ? (awayIn as { day: string; meals?: string[] }[]) : days(awayIn).map((d) => ({ day: d, meals: [] as string[] }));
            const allMeals = meals(a.meals);
            for (const x of list) { const dd = day(x.day); if (!dd) continue; m.away = m.away.filter((y) => y.day !== dd); const ms = x.meals?.length ? meals(x.meals) : allMeals; m.away.push({ day: dd, meals: ms.length === 3 ? [] : ms }); }
          }
          if (a.lightMeals) m.lightMeals = uniq([...(m.lightMeals ?? []), ...meals(a.lightMeals)]);
          if (a.fastingDays) m.fastDays = uniq([...m.fastDays, ...days(a.fastingDays)]);
          if (a.sickDays) m.unwellDays = uniq([...(m.unwellDays ?? []), ...days(a.sickDays)]);
          if (a.rozaDays) m.rozaDays = uniq([...(m.rozaDays ?? []), ...days(a.rozaDays)]);
          if (a.unwellDays) m.unwellDays = uniq([...(m.unwellDays ?? []), ...days(a.unwellDays)]);
          if (a.spice && ["none", "low", "medium", "high"].includes(String(a.spice))) m.spice = a.spice as Member["spice"];
          const al = strs(a.allergies).map(allergen).filter(Boolean) as Allergen[];
          const unknownAl = strs(a.allergies).filter((x) => !allergen(x));
          m.allergies = uniq([...m.allergies, ...al]);
          for (const u of unknownAl) { const ing = resolveIngredient(u); if (ing) { m.dislikes = uniq([...m.dislikes, u]); hh.bannedIngredients = uniq([...hh.bannedIngredients, ing]); r.results.push(`Treating "${u}" allergy as a household ban on ${INGREDIENTS[ing].name}`); } }
          m.conditions = uniq([...m.conditions, ...(strs(a.conditions).map(condition).filter(Boolean) as Condition[])]);
          m.likes = uniq([...m.likes, ...strs(a.likes)]);
          m.dislikes = uniq([...m.dislikes, ...strs(a.dislikes)]);
          if (a.vegDays) m.vegDays = uniq([...m.vegDays, ...days(a.vegDays)]);
          if (a.fastDays) m.fastDays = uniq([...m.fastDays, ...days(a.fastDays)]);
          if (a.tiffinDays) m.tiffinDays = uniq([...m.tiffinDays, ...days(a.tiffinDays)]);
          const rm = (a.remove ?? {}) as Record<string, unknown>;
          if (rm.allergies) { const x = strs(rm.allergies).map(allergen); m.allergies = m.allergies.filter((v) => !x.includes(v)); }
          if (rm.conditions) { const x = strs(rm.conditions).map(condition); m.conditions = m.conditions.filter((v) => !x.includes(v)); }
          if (rm.likes) { const x = strs(rm.likes).map((v) => v.toLowerCase()); m.likes = m.likes.filter((v) => !x.includes(v.toLowerCase())); }
          if (rm.dislikes) { const x = strs(rm.dislikes).map((v) => v.toLowerCase()); m.dislikes = m.dislikes.filter((v) => !x.includes(v.toLowerCase())); }
          if (rm.vegDays) { const x = days(rm.vegDays); m.vegDays = m.vegDays.filter((v) => !x.includes(v)); }
          if (rm.fastDays) { const x = days(rm.fastDays); m.fastDays = m.fastDays.filter((v) => !x.includes(v)); }
          if (rm.tiffinDays) { const x = days(rm.tiffinDays); m.tiffinDays = m.tiffinDays.filter((v) => !x.includes(v)); }
          if (rm.rozaDays) { const x = days(rm.rozaDays); m.rozaDays = (m.rozaDays ?? []).filter((v) => !x.includes(v)); }
          if (rm.unwellDays) { const x = days(rm.unwellDays); m.unwellDays = (m.unwellDays ?? []).filter((v) => !x.includes(v)); }
          if (rm.lightMeals) { const x = meals(rm.lightMeals); m.lightMeals = (m.lightMeals ?? []).filter((v) => !x.includes(v)); }
          if (rm.avoidMeats) { const x = strs(rm.avoidMeats); m.avoidMeats = (m.avoidMeats ?? []).filter((v) => !x.includes(v)); }
          if (m.ageGroup === "toddler") m.spice = "none";
          r.results.push(`${created ? "Added" : "Updated"} ${m.name}: ${m.ageGroup}, ${m.jain ? "Jain " : ""}${m.diet}${m.allergies.length ? `, allergic to ${m.allergies.join("/")}` : ""}${m.conditions.length ? `, ${m.conditions.join("/")}` : ""}${m.vegDays.length ? `, veg on ${m.vegDays.join("/")}` : ""}${m.fastDays.length ? `, fasts ${m.fastDays.join("/")}` : ""}${m.tiffinDays.length ? `, tiffin ${m.tiffinDays.join("/")}` : ""}${m.noOnionGarlic ? ", no onion/garlic" : ""}${m.avoidMeats?.length ? `, never ${m.avoidMeats.join("/")}` : ""}${m.rozaDays?.length ? `, roza ${m.rozaDays.join("/")}` : ""}${m.unwellDays?.length ? `, unwell ${m.unwellDays.join("/")}` : ""}${m.lightMeals?.length ? `, light ${m.lightMeals.join("/")}` : ""}`);
          if (m.diet !== "veg" && m.diet !== "vegan" && hh.nonvegPerWeek === 0 && m.diet === "nonveg") { hh.nonvegPerWeek = 3; r.results.push("Defaulted non-veg to 3 meals a week — ask if they want more/less"); }
          factsChanged = true; break;
        }
        case "rename_member": {
          const m = findMember(s, a.from);
          if (!m) { r.problems.push(`No member called ${a.from}`); break; }
          const old = m.name; m.name = String(a.to);
          s.plan?.meals.forEach((pm) => {
            pm.eaters = pm.eaters.map((n) => (n === old ? m.name : n));
            pm.tiffin = pm.tiffin.map((n) => (n === old ? m.name : n));
            pm.dishes.forEach((d) => { if (Array.isArray(d.for)) d.for = d.for.map((n) => (n === old ? m.name : n)); });
          });
          r.results.push(`Renamed ${old} to ${m.name}`); factsChanged = true; break;
        }
        case "remove_member": {
          const m = findMember(s, a.name);
          if (!m) { r.problems.push(`No member called ${a.name}`); break; }
          hh.members = hh.members.filter((x) => x !== m);
          r.results.push(`Removed ${m.name}`); factsChanged = true; break;
        }
        case "set_away": {
          const m = findMember(s, a.name);
          const ds = days(a.days ?? a.day);
          if (!m || !ds.length) { r.problems.push(`set_away needs a known member and day(s)`); break; }
          const ms = meals(a.meals);
          if (a.on === false) m.away = m.away.filter((x) => !ds.includes(x.day));
          else for (const d of ds) { m.away = m.away.filter((x) => x.day !== d); m.away.push({ day: d, meals: ms }); }
          r.results.push(`${m.name} ${a.on === false ? "is home again" : "away"} on ${ds.join(", ")}${ms.length ? ` (${ms.join(", ")})` : " (all day)"}`);
          factsChanged = true; break;
        }
        case "set_cook": {
          const c = hh.cook;
          if (a.name) c.name = String(a.name);
          if (a.language) { const l = String(a.language).toLowerCase().slice(0, 2); const map: Record<string, CookLang> = { hi: "hi", en: "en", ta: "ta", te: "te", kn: "kn", ka: "kn", ma: "mr", mr: "mr", be: "bn", bn: "bn", gu: "gu", ml: "ml" }; if (map[l]) c.language = map[l]; }
          if (a.offDays) c.offDays = days(a.offDays);
          if (a.meals) { const ms = meals(a.meals); if (ms.length) c.meals = ms; }
          if (a.maxWeekdayMinutes) c.maxWeekdayMinutes = Number(a.maxWeekdayMinutes) || c.maxWeekdayMinutes;
          r.results.push(`Cook: ${c.name}, speaks ${c.language}, off ${c.offDays.join("/") || "none"}, makes ${c.meals.join("/")}`);
          factsChanged = true; break;
        }
        case "add_guests": {
          const d = day(a.day), m = meal(a.meal);
          if (!d || !m) { r.problems.push("add_guests needs day and meal"); break; }
          hh.guests = hh.guests.filter((g) => !(g.day === d && g.meal === m));
          if (Number(a.count) > 0) hh.guests.push({ day: d, meal: m, count: Number(a.count), note: a.note ? String(a.note) : undefined });
          r.results.push(`${Number(a.count) > 0 ? `${a.count} guests` : "No guests"} for ${d} ${m}`); factsChanged = true; break;
        }
        case "set_eat_out": {
          const d = day(a.day), m = meal(a.meal);
          if (!d || !m) { r.problems.push("set_eat_out needs day and meal"); break; }
          hh.eatOut = hh.eatOut.filter((e) => !(e.day === d && e.meal === m));
          if (a.on !== false) hh.eatOut.push({ day: d, meal: m });
          r.results.push(`${d} ${m}: ${a.on !== false ? "eating out / ordering in" : "cooking at home"}`); factsChanged = true; break;
        }
        case "generate_plan": {
          if (!hh.members.length) { r.problems.push("Can't plan without knowing who's in the house"); break; }
          const fresh = Boolean(a.fresh);
          const res = planWithinBudget(hh, { previous: s.plan, custom: s.customDishes, seed: fresh || !s.plan ? undefined : s.plan.seed + 7 });
          s.plan = res.plan;
          if (hh.budgetPerWeek) r.results.push(res.met ? `This week's food costs ≈ ₹${res.total}, within the ₹${hh.budgetPerWeek} budget (the buy-list can be higher because dal/rice/atta come in packs that last beyond the week)` : `Even the leanest week uses ≈ ₹${res.total} of food, above the ₹${hh.budgetPerWeek} budget — tell the user honestly and offer levers (fewer paneer/non-veg meals, skip extras)`);
          r.results.push(`Why this plan: ${explainPlan(hh, s.plan, s.customDishes).join("; ")}`);
          const hard = validatePlan(hh, s.plan, s.customDishes).filter((v) => v.severity === "hard");
          r.results.push(`Plan generated for week of ${s.plan.weekOf}${hard.length ? ` with ${hard.length} unresolved conflicts: ${hard.slice(0, 3).map((h) => h.text).join("; ")}` : " — all diet/allergy rules satisfied"}`);
          if (s.phase === "onboarding") s.phase = "planning";
          r.planChanged = true; factsChanged = false; break;
        }
        case "set_dish": {
          const d = day(a.day), m = meal(a.meal);
          const ds = d ? [d] : days(a.days);
          if (!ds.length || !m) { r.problems.push("set_dish needs day(s) and meal"); break; }
          for (const dd of ds) {
            const out = setDish(s, dd, m, String(a.dish ?? ""), { replace: a.replace ? String(a.replace) : undefined, forNames: strs(a.for), addOnly: Boolean(a.add) });
            (out.ok ? r.results : r.problems).push(out.msg);
            if (out.ok) r.planChanged = true;
          }
          break;
        }
        case "remove_dish": {
          if (!s.plan) break;
          const d = day(a.day), m = meal(a.meal);
          const id = resolveDish(String(a.dish ?? ""), s.customDishes);
          const targets = d && m ? [{ d, m }] : findPlanned(s, String(a.dish ?? ""));
          let n = 0;
          for (const t of targets) {
            const pm = getMeal(s.plan, t.d, t.m)!;
            const before = pm.dishes.length;
            pm.dishes = pm.dishes.filter((x) => x.dishId !== id);
            n += before - pm.dishes.length;
          }
          r.results.push(n ? `Removed ${getDish(id ?? "", s.customDishes)?.name ?? a.dish} from ${n} meal(s)` : `${a.dish} wasn't in that meal`);
          r.planChanged = n > 0; break;
        }
        case "swap_meals": {
          if (!s.plan) break;
          const A = a.a as Record<string, unknown> | undefined, B = a.b as Record<string, unknown> | undefined;
          const da = day(A?.day), ma = meal(A?.meal), db = day(B?.day), mb = meal(B?.meal);
          if (!da || !ma || !db || !mb) { r.problems.push("swap_meals needs a:{day,meal} and b:{day,meal}"); break; }
          const pa = getMeal(s.plan, da, ma), pb = getMeal(s.plan, db, mb);
          if (!pa || !pb) { r.problems.push("One of those meals isn't in the plan"); break; }
          [pa.dishes, pb.dishes] = [pb.dishes.map((x) => ({ ...x, locked: true })), pa.dishes.map((x) => ({ ...x, locked: true }))];
          r.results.push(`Swapped ${da} ${ma} with ${db} ${mb}`); r.planChanged = true; break;
        }
        case "ban": {
          const dishId = a.dish ? resolveDish(String(a.dish), s.customDishes) : null;
          const ingId = a.ingredient ? resolveIngredient(String(a.ingredient)) : null;
          if (dishId) { hh.bannedDishes = uniq([...hh.bannedDishes, dishId]); r.results.push(`Won't plan ${getDish(dishId, s.customDishes)?.name} again`); }
          if (ingId) { hh.bannedIngredients = uniq([...hh.bannedIngredients, ingId]); r.results.push(`Avoiding ${INGREDIENTS[ingId].name} in all dishes`); }
          if (!dishId && !ingId) r.problems.push(`Couldn't identify "${a.dish ?? a.ingredient}" to remove`);
          // banning should override pins
          s.plan?.meals.forEach((pm) => pm.dishes.forEach((pd) => { if (pd.dishId === dishId) pd.locked = false; }));
          factsChanged = true; break;
        }
        case "limit": {
          const key = a.dish ? resolveDish(String(a.dish), s.customDishes) : a.ingredient ? resolveIngredient(String(a.ingredient)) : null;
          if (!key) { r.problems.push(`Couldn't identify "${a.dish ?? a.ingredient}" to limit`); break; }
          const n = Math.max(0, Math.round(Number(a.maxPerWeek)));
          if (Number.isNaN(n)) { r.problems.push("limit needs maxPerWeek"); break; }
          hh.limits = { ...(hh.limits ?? {}), [key]: n };
          // limits override pins on the meals that exceed them
          r.results.push(`${key.replace(/_/g, " ")} limited to ${n} meal${n === 1 ? "" : "s"} a week`);
          factsChanged = true; break;
        }
        case "unban": {
          const dishId = a.dish ? resolveDish(String(a.dish), s.customDishes) : null;
          const ingId = a.ingredient ? resolveIngredient(String(a.ingredient)) : null;
          hh.bannedDishes = hh.bannedDishes.filter((x) => x !== dishId);
          hh.bannedIngredients = hh.bannedIngredients.filter((x) => x !== ingId);
          if (hh.limits) { if (dishId) delete hh.limits[dishId]; if (ingId) delete hh.limits[ingId]; }
          r.results.push("Removed from the avoid list"); break;
        }
        case "add_custom_dish": {
          const name = String(a.name ?? "").trim();
          if (!name) break;
          const id = "custom_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
          const ings = (Array.isArray(a.ingredients) ? a.ingredients : []) as { name: string; qty?: number }[];
          const resolved = ings.map((i) => ({ id: resolveIngredient(i.name), qty: Number(i.qty) || 50, raw: i.name }));
          const unknown = resolved.filter((x) => !x.id).map((x) => x.raw);
          const roleIn = strs(a.roles ?? a.role) as DishRole[];
          const roles: DishRole[] = roleIn.filter((x) => ["breakfast", "main", "side", "staple", "complete", "fasting"].includes(x));
          const dish: Dish = {
            id, name, hindi: String(a.hindi ?? name), roles: roles.length ? roles : ["complete"], cuisine: String(a.cuisine ?? "home"),
            minutes: Number(a.minutes) || 30, tags: strs(a.tags), ingredients: resolved.filter((x) => x.id).map((x) => ({ id: x.id!, qty: x.qty })),
            steps: strs(a.steps), custom: true,
          };
          if (DISHES[id] === undefined) s.customDishes = [...s.customDishes.filter((d) => d.id !== id), dish];
          for (const u of unknown) s.extras.push({ name: u, qty: `for ${name}` });
          r.results.push(`Added family recipe "${name}"${unknown.length ? ` (${unknown.join(", ")} added to the list as extras)` : ""}`);
          break;
        }
        case "add_extra": {
          const name = String(a.name ?? a.item ?? "").trim();
          if (!name) break;
          s.extras = [...s.extras.filter((x) => x.name.toLowerCase() !== name.toLowerCase()), { name, qty: String(a.qty ?? "1") }];
          r.results.push(`Added ${name} (${a.qty ?? "1"}) to the grocery list`); break;
        }
        case "remove_extra": {
          const name = String(a.name ?? a.item ?? "").toLowerCase();
          const before = s.extras.length;
          s.extras = s.extras.filter((x) => !x.name.toLowerCase().includes(name));
          if (s.extras.length === before) {
            // probably a plan ingredient: treat as "already have it"
            const id = resolveIngredient(name);
            if (id) { hh.pantryHave = uniq([...hh.pantryHave, id]); r.results.push(`Marked ${INGREDIENTS[id].name} as already in the pantry — off the list`); }
            else r.problems.push(`"${name}" isn't on the list`);
          } else r.results.push(`Removed ${name} from the list`);
          break;
        }
        case "pantry": {
          const have = strs(a.have).map(resolveIngredient).filter(Boolean) as string[];
          const need = strs(a.need).map(resolveIngredient).filter(Boolean) as string[];
          hh.pantryHave = uniq([...hh.pantryHave.filter((x) => !need.includes(x)), ...have]);
          hh.pantryNeed = uniq([...hh.pantryNeed.filter((x) => !have.includes(x)), ...need]);
          r.results.push(`Pantry updated${have.length ? `; have: ${have.join(", ")}` : ""}${need.length ? `; need to buy: ${need.join(", ")}` : ""}`); break;
        }
        case "undo": {
          s.history.pop(); // the snapshot taken for this very batch
          r.results.push(undo(s) ? "Undid the last change" : "Nothing to undo");
          r.planChanged = true; break;
        }
        case "finalize": {
          const ch = String(a.channel ?? "").toLowerCase().includes("whats") ? "whatsapp" : "instamart";
          if (!s.plan) { r.problems.push("No plan to order for yet"); break; }
          r.finalize = { channel: ch, phone: a.phone ? String(a.phone) : undefined };
          r.results.push(ch === "instamart" ? "Instamart cart prepared (simulated) — the screen shows the cart for the user to confirm" : "WhatsApp message prepared — the screen shows a Send button");
          break;
        }
        default:
          r.problems.push(`Unknown action ${a.type}`);
      }
    } catch (e) {
      r.problems.push(`Action ${a.type} failed: ${(e as Error).message}`);
    }
  }
  if (factsChanged && s.plan) {
    const fixed = repairPlan(s);
    if (fixed.length) r.results.push(`Re-planned ${fixed.length} meal(s) affected by the change: ${fixed.slice(0, 6).join(", ")}`);
    r.planChanged = true;
  } else if (r.planChanged && s.plan) {
    const fixed = repairPlan(s);
    if (fixed.length) r.results.push(`Also re-planned ${fixed.join(", ")} so everyone has something`);
  }
  r.changed = true;
  if (!r.results.length && !r.problems.length) s.history.pop();
  return r;
}
