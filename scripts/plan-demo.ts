import { SCENARIOS } from "../src/lib/data/households";
import { planWeek, prepTasks } from "../src/lib/engine/planner";
import { validatePlan } from "../src/lib/engine/validate";
import { buildGrocery, packLabel } from "../src/lib/engine/grocery";
import { getDish } from "../src/lib/data/recipes";

const key = process.argv[2] ?? "sharma";
const hh = SCENARIOS[key]();
const plan = planWeek(hh, { seed: Number(process.argv[3] ?? 42) });
for (const pm of plan.meals) {
  const ds = pm.dishes.map((d) => getDish(d.dishId)!.name + (d.for === "all" ? "" : ` [${d.for.join(",")}]`)).join(" + ");
  console.log(`${pm.day} ${pm.meal.padEnd(9)} ${pm.status === "planned" ? ds : pm.status} ${pm.cookedBy === "household" ? "(household)" : ""}`);
  pm.notes.forEach((n) => console.log("      • " + n));
}
console.log("\nVIOLATIONS", validatePlan(hh, plan, []));
console.log("\nPREP", prepTasks(plan, []).map((t) => `${t.day}: ${t.text}`));
const g = buildGrocery(hh, plan, [], []);
console.log("\nGROCERY", g.lines.map((l) => `${l.batch === "topup" ? "[TOPUP] " : ""}${l.name}: ${l.needed}${l.unit} -> ${packLabel(l)} ₹${l.cost}`).join("\n"));
console.log("Total", g.total, "pantry:", g.pantryCheck.map((p) => p.name).join(", "));
