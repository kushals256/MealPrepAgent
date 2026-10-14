import { INGREDIENTS } from "../data/ingredients";
import type { Day, Dish, Household, Meal, Member } from "../types";

// Hard constraints (diet, allergy, Jain, fasting) decide whether a member can
// eat a dish at all. Some conflicts are *adaptable* the way real kitchens do
// it — drop a garnish, or pull a Jain portion out before onion goes in — and
// those come back as cook notes instead of a rejection.

const AROMATICS = new Set(["onion", "garlic", "ginger"]);

export interface Fit {
  ok: boolean;
  /** Instructions that make it OK (shown to the cook). */
  adapt: string[];
  /** Optional ingredients that must be left out of the whole dish (allergy safety). */
  drop: string[];
  reason?: string;
}

export function effectiveDiet(m: Member, day: Day) {
  if ((m.diet === "nonveg" || m.diet === "eggetarian") && m.vegDays.includes(day)) return "veg" as const;
  return m.diet;
}

export function isFasting(m: Member, day: Day) {
  return m.fastDays.includes(day);
}

export function onRoza(m: Member, day: Day) {
  return Boolean(m.rozaDays?.includes(day));
}

export function isUnwell(m: Member, day: Day) {
  return Boolean(m.unwellDays?.includes(day));
}

export function wantsLight(m: Member, day: Day, meal: Meal) {
  return isUnwell(m, day) || Boolean(m.lightMeals?.includes(meal));
}

export function dishFlags(d: Dish) {
  let meat = false, egg = false, dairy = false;
  for (const ri of d.ingredients) {
    const ing = INGREDIENTS[ri.id];
    if (!ing || ri.optional) continue;
    if (ing.meat) meat = true;
    if (ing.egg) egg = true;
    if (ing.dairy && ri.id !== "ghee") dairy = true;
  }
  return { meat, egg, dairy, nonveg: meat || egg };
}

const JAIN_AVOID = new Set(["mushroom", "brinjal"]); // fungi and many-seeded vegetables

export function memberFit(m: Member, d: Dish, day: Day, hh?: Household): Fit {
  const fit: Fit = { ok: true, adapt: [], drop: [] };
  const fail = (reason: string): Fit => ({ ok: false, adapt: [], drop: [], reason });
  const flags = dishFlags(d);
  const fasting = isFasting(m, day);

  if (fasting && !d.roles.includes("fasting")) return fail(`${m.name} is fasting on ${day}`);

  const diet = effectiveDiet(m, day);
  if (diet === "veg" && flags.nonveg) return fail(`${m.name} is vegetarian${m.diet !== "veg" ? ` on ${day}` : ""}`);
  if (diet === "eggetarian" && flags.meat) return fail(`${m.name} doesn't eat meat`);
  if (diet === "vegan" && (flags.nonveg || flags.dairy)) return fail(`${m.name} is vegan`);
  if (hh?.noNonvegAtHome && flags.nonveg) return fail("this home doesn't cook non-veg in the kitchen");

  for (const ri of d.ingredients) {
    const ing = INGREDIENTS[ri.id];
    if (!ing) continue;
    if (ing.meatType && m.avoidMeats?.includes(ing.meatType) && !ri.optional) return fail(`${m.name} doesn't eat ${ing.meatType}`);
    const hit = (ing.allergens ?? []).find((a) => m.allergies.includes(a));
    if (hit) {
      if (ri.optional) fit.drop.push(ri.id);
      else return fail(`${m.name} is allergic to ${hit.replace("_", " ")} (${ing.name})`);
    }
    if (diet === "vegan" && ing.dairy && ri.id === "ghee") fit.adapt.push(`Use oil instead of ghee for ${m.name}`);
  }

  if (m.jain) {
    const avoid = d.ingredients.filter((ri) => JAIN_AVOID.has(ri.id) && !ri.optional);
    if (avoid.length) return fail(`${m.name} is Jain (no ${avoid.map((r) => INGREDIENTS[r.id].name.toLowerCase()).join(", ")})`);
    const roots = d.ingredients.filter((ri) => INGREDIENTS[ri.id]?.root);
    const hardRoots = roots.filter((ri) => !AROMATICS.has(ri.id) && !ri.optional);
    if (hardRoots.length) return fail(`${m.name} is Jain (${hardRoots.map((r) => INGREDIENTS[r.id].name).join(", ")})`);
    const aromatic = roots.filter((ri) => AROMATICS.has(ri.id));
    if (aromatic.length) {
      if (aromatic.every((r) => r.optional) || d.jainAdaptable) {
        fit.adapt.push(`Jain portion for ${m.name}: take it out before ${aromatic.map((r) => INGREDIENTS[r.id].hindi).join("/")} goes in`);
      } else return fail(`${m.name} is Jain (onion/garlic base)`);
    }
  } else if (m.noOnionGarlic || hh?.sattvikDays?.includes(day)) {
    // sattvik: onion & garlic only — ginger and potato are fine
    const og = d.ingredients.filter((ri) => ri.id === "onion" || ri.id === "garlic");
    if (og.length) {
      const why = m.noOnionGarlic ? `${m.name} doesn't eat onion/garlic` : `${day} is a no onion-garlic day`;
      if (og.every((r) => r.optional) || d.jainAdaptable) fit.adapt.push(`${m.noOnionGarlic ? `${m.name}'s portion` : "Whole dish"}: no onion/garlic${m.noOnionGarlic ? " — take it out before they go in" : ""}`);
      else return fail(why);
    }
  }
  return fit;
}

export function hasBanned(d: Dish, hh: Household) {
  if (hh.bannedDishes.includes(d.id)) return true;
  return d.ingredients.some((ri) => !ri.optional && hh.bannedIngredients.includes(ri.id));
}

export function matchesPref(pref: string, d: Dish) {
  const p = pref.toLowerCase().trim();
  if (!p) return false;
  if (d.id === p.replace(/ /g, "_") || d.name.toLowerCase().includes(p)) return true;
  return d.ingredients.some((ri) => {
    const ing = INGREDIENTS[ri.id];
    return !ri.optional && ing && (ing.id === p.replace(/ /g, "_") || ing.name.toLowerCase().includes(p) || ing.hindi === p);
  });
}

export function spiceSensitive(m: Member) {
  return m.spice === "none" || m.spice === "low" || m.ageGroup === "toddler";
}

export const PORTION: Record<Member["ageGroup"], number> = {
  toddler: 0.35,
  child: 0.6,
  teen: 1.1,
  adult: 1,
  elderly: 0.75,
};

export function portion(m: Member) {
  let p = PORTION[m.ageGroup];
  if (m.conditions.includes("high_protein")) p += 0.15;
  if (m.conditions.includes("weight_loss")) p -= 0.1;
  return p;
}
