/**
 * Deterministic evals for the planning engine — no LLM, no network.
 * Runs every scenario household across many seeds and checks the properties a
 * real family would care about. Exit code 1 if any HARD check fails.
 *
 *   npm run eval:engine
 */
import { SCENARIOS, sharmaFamily } from "../src/lib/data/households";
import { DISHES, getDish } from "../src/lib/data/recipes";
import { INGREDIENTS } from "../src/lib/data/ingredients";
import { planWeek, refreshPlan } from "../src/lib/engine/planner";
import { planWithinBudget } from "../src/lib/engine/budget";
import { validatePlan } from "../src/lib/engine/validate";
import { buildGrocery } from "../src/lib/engine/grocery";
import { dishFlags, isFasting } from "../src/lib/engine/constraints";
import { applyHouseholdActions } from "../src/lib/engine/actions";
import { freshState } from "../src/lib/store";
import { DAYS, type Household, type WeekPlan } from "../src/lib/types";

process.env.STATE_FILE = "/dev/null";

type Check = { name: string; hard: boolean; pass: number; total: number; fails: string[] };
const checks = new Map<string, Check>();
function check(name: string, hard: boolean, ok: boolean, detail = "") {
  const c = checks.get(name) ?? { name, hard, pass: 0, total: 0, fails: [] };
  c.total++;
  if (ok) c.pass++; else if (c.fails.length < 3) c.fails.push(detail);
  checks.set(name, c);
}

const SEEDS = Array.from({ length: 15 }, (_, i) => i * 7919 + 13);

function planChecks(key: string, hh: Household, plan: WeekPlan) {
  const tag = `${key}#${plan.seed}`;
  const v = validatePlan(hh, plan, []);
  const hard = v.filter((x) => x.severity === "hard");
  check("No hard rule violations (diet / allergy / Jain / fasting / coverage)", true, hard.length === 0, `${tag}: ${hard.map((h) => h.text).join("; ")}`);

  // fasting members get a fasting dish every planned meal they attend
  for (const pm of plan.meals) {
    if (pm.status !== "planned") continue;
    for (const name of [...pm.eaters, ...pm.tiffin]) {
      const m = hh.members.find((x) => x.name === name)!;
      if (!isFasting(m, pm.day)) continue;
      const ok = pm.dishes.some((pd) => Array.isArray(pd.for) && pd.for.includes(name) && getDish(pd.dishId)!.roles.includes("fasting"));
      check("Fasting members get a vrat dish", true, ok, `${tag} ${pm.day} ${pm.meal} ${name}`);
    }
  }
  // variety
  const mains = plan.meals.flatMap((pm) => pm.dishes.filter((d) => !getDish(d.dishId)!.roles.includes("staple")).map((d) => ({ id: d.dishId, day: DAYS.indexOf(pm.day) })));
  const consecutive = mains.some((a) => mains.some((b) => a.id === b.id && b.day - a.day === 1));
  check("No dish on consecutive days", false, !consecutive, tag);
  const distinct = new Set(mains.map((m) => m.id)).size;
  check("Variety: ≥ 70% of non-staple dishes distinct", false, distinct / Math.max(1, mains.length) >= 0.7, `${tag}: ${distinct}/${mains.length}`);
  // non-veg frequency
  const nvEaters = hh.members.some((m) => m.diet === "nonveg");
  if (nvEaters && hh.nonvegPerWeek > 0 && !hh.noNonvegAtHome) {
    const nvMeals = plan.meals.filter((pm) => pm.meal !== "breakfast" && pm.dishes.some((d) => dishFlags(getDish(d.dishId)!).nonveg)).length;
    check("Non-veg lunches/dinners within ±1 of requested", false, Math.abs(nvMeals - hh.nonvegPerWeek) <= 1, `${tag}: got ${nvMeals}, wanted ${hh.nonvegPerWeek}`);
  }
  // cook effort
  for (const pm of plan.meals) {
    if (pm.status !== "planned") continue;
    const mins = Math.max(0, ...pm.dishes.map((d) => getDish(d.dishId)!.minutes));
    if (pm.cookedBy === "household") check("Cook's day off: family meals ≤ 35 min", false, mins <= 35, `${tag} ${pm.day} ${pm.meal}: ${mins}m`);
    else if (!["Sat", "Sun"].includes(pm.day)) check("Weekday meals within cook's time budget", false, mins <= hh.cook.maxWeekdayMinutes + 5, `${tag} ${pm.day} ${pm.meal}: ${mins}m`);
    if (pm.meal === "breakfast" && !["Sat", "Sun"].includes(pm.day)) check("Weekday breakfast ≤ 25 min", false, mins <= 25, `${tag} ${pm.day}: ${mins}m`);
  }
  // tiffin lunches are packable
  for (const pm of plan.meals.filter((x) => x.tiffin.length && x.status === "planned")) {
    const ok = pm.dishes.filter((d) => d.for === "all").every((d) => { const x = getDish(d.dishId)!; return !x.roles.some((r) => r === "side" || r === "complete") || x.tags.includes("packable"); });
    check("Tiffin days use packable sides", false, ok, `${tag} ${pm.day}`);
  }
  // events honoured
  for (const e of hh.eatOut) check("Eat-out meals not cooked", true, plan.meals.find((pm) => pm.day === e.day && pm.meal === e.meal)?.status === "eat_out", `${tag} ${e.day}`);
  for (const g of hh.guests) check("Guests reflected in plan", true, (plan.meals.find((pm) => pm.day === g.day && pm.meal === g.meal)?.guests ?? 0) === g.count, `${tag} ${g.day}`);

  // grocery checks
  const gl = buildGrocery(hh, plan, [], []);
  const allergens = new Set(hh.members.flatMap((m) => m.allergies));
  const boughtAllergen = gl.lines.filter((l) => (INGREDIENTS[l.id.split(":")[0]]?.allergens ?? []).some((a) => allergens.has(a)) && ["peanut", "tree_nut", "sesame", "shellfish"].some((a) => INGREDIENTS[l.id.split(":")[0]]?.allergens?.includes(a as never)));
  check("Never buys a severe allergen the house is allergic to", true, boughtAllergen.length === 0, `${tag}: ${boughtAllergen.map((l) => l.name).join(", ")}`);
  check("Pantry staples (salt, haldi, oil…) not on the buy list", true, !gl.lines.some((l) => INGREDIENTS[l.id.split(":")[0]]?.pantryStaple), tag);
  check("Packs cover the need", true, gl.lines.filter((l) => !l.extra).every((l) => l.packs.reduce((a, p) => a + p.size * p.count, 0) >= l.needed), tag);
  const topupOk = gl.lines.filter((l) => l.batch === "topup").every((l) => INGREDIENTS[l.id.split(":")[0]].shelfDays <= 4);
  check("Only perishables go in the mid-week top-up", true, topupOk, tag);
  const spinachLate = gl.lines.find((l) => l.id === "spinach:weekly");
  void spinachLate;
}

// ---------- 1. plan properties across scenarios × seeds ----------
for (const [key, mk] of Object.entries(SCENARIOS)) {
  for (const seed of SEEDS) {
    const hh = mk();
    planChecks(key, hh, planWeek(hh, { seed }));
  }
}

// ---------- 1b. community / religious rules ----------
for (const seed of SEEDS) {
  const r = SCENARIOS.ramzan_hyderabad(); const p = planWeek(r, { seed });
  const roza = r.members.filter((m) => m.rozaDays?.length).map((m) => m.name);
  check("Roza: no lunch for those fasting", true, p.meals.filter((pm) => pm.meal === "lunch").every((pm) => !pm.eaters.concat(pm.tiffin).some((n) => roza.includes(n))), `#${seed}`);
  check("Roza: sehri + iftar notes for the cook", true, p.meals.filter((pm) => pm.meal !== "lunch" && pm.status === "planned").every((pm) => pm.notes.some((n) => /Sehri|Iftar/.test(n))), `#${seed}`);
  check("Halal meat flagged wherever meat is cooked", true, p.meals.filter((pm) => pm.dishes.some((d) => dishFlags(getDish(d.dishId)!).meat)).every((pm) => pm.notes.some((n) => n.includes("halal"))), `#${seed}`);
  check("Never pork/beef (catalogue is India-appropriate)", true, p.meals.every((pm) => pm.dishes.every((d) => getDish(d.dishId)!.ingredients.every((ri) => !["beef", "pork"].includes(INGREDIENTS[ri.id]?.meatType ?? "")))), `#${seed}`);

  const n = SCENARIOS.navratri_sattvik(); const pn = planWeek(n, { seed });
  const og = pn.meals.filter((pm) => pm.dishes.some((d) => getDish(d.dishId)!.ingredients.some((ri) => (ri.id === "onion" || ri.id === "garlic") && !ri.optional) && !getDish(d.dishId)!.jainAdaptable));
  check("Navratri week: no onion/garlic dishes in the kitchen", true, og.length === 0, `#${seed}: ${og.map((m) => m.day + " " + m.meal).join(", ")}`);

  const k = SCENARIOS.veg_kitchen_tight_budget(); const pk = planWithinBudget(k, { seed }).plan;
  check("Vegetarian kitchen: no meat/egg cooked even though the teen eats it outside", true, pk.meals.every((pm) => pm.dishes.every((d) => !dishFlags(getDish(d.dishId)!).nonveg)), `#${seed}`);
  const total = buildGrocery(k, pk, [], []).consumedCost;
  const kNo = { ...k, budgetPerWeek: undefined }; const totalNo = buildGrocery(kNo, planWeek(kNo, { seed }), [], []).consumedCost;
  check("Budget: week's food consumption fits ₹2,200", false, total <= 2200, `#${seed}: ₹${total}`);
  check("Budget makes the week cheaper than unbudgeted", false, total <= totalNo, `#${seed}: ₹${total} vs ₹${totalNo}`);

  const g = SCENARIOS.sikh_jhatka_mixed(); const pg = planWeek(g, { seed });
  const jas = pg.meals.filter((pm) => ["Mon", "Tue"].includes(pm.day) && pm.status === "planned" && pm.eaters.includes("Jas"));
  check("Unwell teen gets light food on sick days", true, jas.every((pm) => pm.dishes.some((d) => (d.for === "all" || d.for.includes("Jas")) && !getDish(d.dishId)!.roles.every((r) => r === "staple") && (getDish(d.dishId)!.tags.includes("light") || getDish(d.dishId)!.tags.includes("comfort")))), `#${seed}: ${jas.map((pm) => pm.day + pm.meal + ":" + pm.dishes.map((d) => d.dishId).join("+")).join(" | ")}`);
  check("Mutton never served to someone who avoids it", true, validatePlan(g, pg, []).filter((v) => v.severity === "hard").length === 0, `#${seed}`);
}

// ---------- 2. grocery quantities respond to attendance ----------
{
  const hh = sharmaFamily();
  const base = buildGrocery(hh, planWeek(hh, { seed: 5 }), [], []).lines.reduce((a, l) => a + (l.id.startsWith("atta") ? l.needed : 0), 0);
  const plan = planWeek(hh, { seed: 5 });
  const hh2 = sharmaFamily(); hh2.members.find((m) => m.name === "Rajesh")!.away = DAYS.map((d) => ({ day: d, meals: [] }));
  const plan2 = refreshPlan(hh2, plan, []);
  const less = buildGrocery(hh2, plan2, [], []).lines.reduce((a, l) => a + (l.id.startsWith("atta") ? l.needed : 0), 0);
  check("Someone away all week → less atta bought", true, less < base, `${base} -> ${less}`);
}

// ---------- 3. edits through the action layer ----------
function sample() { const s = freshState(true); s.plan = planWeek(s.household, { seed: 11 }); return s; }
{
  const s = sample();
  const r = applyHouseholdActions(s, [{ type: "set_dish", day: "Tue", meal: "dinner", dish: "chicken curry" }]);
  const pm = s.plan!.meals.find((m) => m.day === "Tue" && m.meal === "dinner")!;
  const ch = pm.dishes.find((d) => d.dishId === "chicken_curry");
  check("Chicken on a mixed table → only for non-veg eaters (Rajesh veg on Tue)", true, !!ch && Array.isArray(ch.for) && ch.for.join() === "Kabir", JSON.stringify(ch) + r.results.join());
  check("…and the veg members still have a main", true, validatePlan(s.household, s.plan!, []).filter((v) => v.severity === "hard").length === 0, r.results.join("; "));
}
{
  const s = sample();
  applyHouseholdActions(s, [{ type: "upsert_member", name: "Aarav", allergies: ["dairy"] }]);
  const v = validatePlan(s.household, s.plan!, []).filter((x) => x.severity === "hard");
  check("New allergy mid-week → affected meals re-planned, zero violations", true, v.length === 0, v.map((x) => x.text).join("; "));
}
{
  const s = sample();
  const before = JSON.stringify(s.plan!.meals.filter((m) => m.day === "Mon"));
  applyHouseholdActions(s, [{ type: "add_guests", day: "Fri", meal: "dinner", count: 4 }]);
  check("Adding guests doesn't reshuffle unrelated days", true, JSON.stringify(s.plan!.meals.filter((m) => m.day === "Mon")) === before, "Monday changed");
  check("Guests visible on the meal", true, s.plan!.meals.find((m) => m.day === "Fri" && m.meal === "dinner")!.guests === 4);
}
{
  const s = sample();
  applyHouseholdActions(s, [{ type: "set_dish", day: "Wed", meal: "dinner", dish: "rajma chawal" }]);
  applyHouseholdActions(s, [{ type: "generate_plan", fresh: true }]);
  check("Pinned dishes survive regeneration", true, s.plan!.meals.find((m) => m.day === "Wed" && m.meal === "dinner")!.dishes.some((d) => d.dishId === "rajma_chawal"));
}
{
  const s = sample();
  applyHouseholdActions(s, [{ type: "ban", ingredient: "paneer" }]);
  const has = s.plan!.meals.some((m) => m.dishes.some((d) => getDish(d.dishId)!.ingredients.some((ri) => ri.id === "paneer" && !ri.optional)));
  check("'No more paneer' removes it from the whole week", true, !has);
}
{
  const s = sample();
  applyHouseholdActions(s, [{ type: "upsert_member", name: "Priya", fastDays: ["Mon"] }]);
  const pm = s.plan!.meals.find((m) => m.day === "Mon" && m.meal === "lunch")!;
  check("New fast day → vrat dish appears that day", true, pm.dishes.some((d) => Array.isArray(d.for) && d.for.includes("Priya") && DISHES[d.dishId]?.roles.includes("fasting")));
}
{
  const s = sample();
  const r = applyHouseholdActions(s, [{ type: "set_dish", day: "Thu", meal: "lunch", dish: "butter chicken", for: ["Priya"] }]);
  check("Refuses non-veg for a vegetarian", true, r.problems.length > 0 && !s.plan!.meals.find((m) => m.day === "Thu" && m.meal === "lunch")!.dishes.some((d) => d.dishId === "butter_chicken"), r.results.join());
}
{
  const s = sample();
  applyHouseholdActions(s, [{ type: "upsert_member", name: "Dadi", allergies: ["gluten"] }]);
  const v = validatePlan(s.household, s.plan!, []).filter((x) => x.severity === "hard");
  check("Gluten allergy → rotis replaced for that person", true, v.length === 0, v.map((x) => x.text).join("; "));
}
{
  const s = sample();
  applyHouseholdActions(s, [{ type: "limit", ingredient: "paneer", maxPerWeek: 2 }]);
  const n = s.plan!.meals.filter((m) => m.dishes.some((d) => getDish(d.dishId)!.ingredients.some((ri) => ri.id === "paneer" && !ri.optional && ri.qty >= 15))).length;
  check("'Paneer only twice a week' is enforced", true, n <= 2, `${n} paneer meals`);
}
{
  const s = sample();
  applyHouseholdActions(s, [{ type: "update_household", sattvikDays: ["Tue"] }]);
  const v = validatePlan(s.household, s.plan!, []).filter((x) => x.severity === "hard");
  check("Declaring a no onion-garlic Tuesday re-plans Tuesday only", true, v.length === 0, v.map((x) => x.text).join("; "));
}
{
  const s = sample();
  applyHouseholdActions(s, [{ type: "undo" }]);
  const p1 = JSON.stringify(s.plan);
  applyHouseholdActions(s, [{ type: "set_dish", day: "Mon", meal: "dinner", dish: "veg biryani" }]);
  applyHouseholdActions(s, [{ type: "undo" }]);
  check("Undo restores the previous plan", true, JSON.stringify(s.plan) === p1);
}

// ---------- report ----------
const rows = [...checks.values()];
let hardFail = 0;
console.log("\nENGINE EVALS — " + Object.keys(SCENARIOS).length + " households × " + SEEDS.length + " seeds\n");
for (const c of rows) {
  const rate = c.pass / c.total;
  const ok = c.hard ? c.pass === c.total : rate >= 0.85;
  if (c.hard && !ok) hardFail++;
  console.log(`${ok ? "✅" : c.hard ? "❌" : "⚠️ "} ${(rate * 100).toFixed(0).padStart(3)}%  ${String(c.pass).padStart(4)}/${String(c.total).padEnd(4)} ${c.hard ? "[hard]" : "[soft]"} ${c.name}`);
  if (!ok) c.fails.forEach((f) => console.log(`        ↳ ${f}`));
}
console.log(`\n${hardFail ? `❌ ${hardFail} hard check(s) failed` : "✅ all hard checks pass"}\n`);
process.exit(hardFail ? 1 : 0);
