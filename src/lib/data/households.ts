import type { Household, Member } from "../types";

export function member(p: Partial<Member> & { name: string }): Member {
  return {
    ageGroup: "adult", diet: "veg", allergies: [], conditions: [], spice: "medium", likes: [], dislikes: [],
    vegDays: [], fastDays: [], tiffinDays: [], away: [], ...p,
  };
}

export function blankHousehold(): Household {
  return {
    familyName: "", city: "", cuisines: [], meals: ["breakfast", "lunch", "dinner"], nonvegPerWeek: 0,
    members: [], guests: [], eatOut: [],
    cook: { name: "Didi", language: "hi", offDays: [], meals: ["breakfast", "lunch", "dinner"], maxWeekdayMinutes: 45 },
    bannedDishes: [], bannedIngredients: [], pantryHave: [], pantryNeed: [], notes: [],
  };
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

/** A deliberately messy joint family — the default demo household. */
export function sharmaFamily(): Household {
  return {
    ...blankHousehold(),
    familyName: "Sharma family",
    city: "Bengaluru",
    cuisines: ["north_indian", "south_indian"],
    nonvegPerWeek: 3,
    members: [
      member({ name: "Rajesh", diet: "nonveg", vegDays: ["Tue", "Thu"], likes: ["chicken", "rajma"], tiffinDays: [...WEEKDAYS], spice: "high" }),
      member({ name: "Priya", diet: "veg", fastDays: ["Thu"], dislikes: ["baingan"], conditions: ["weight_loss"] }),
      member({ name: "Aarav", ageGroup: "child", diet: "eggetarian", allergies: ["peanut"], spice: "low", likes: ["paneer", "dosa"], dislikes: ["lauki"], tiffinDays: [...WEEKDAYS] }),
      member({ name: "Dadi", ageGroup: "elderly", diet: "veg", conditions: ["diabetes", "hypertension"], spice: "low", likes: ["khichdi"] }),
      member({ name: "Kabir", ageGroup: "teen", diet: "nonveg", conditions: ["high_protein"], away: [{ day: "Fri", meals: ["dinner"] }] }),
    ],
    guests: [{ day: "Sun", meal: "lunch", count: 3, note: "Priya's parents and brother" }],
    eatOut: [{ day: "Sat", meal: "dinner" }],
    cook: { name: "Sunita", language: "hi", offDays: ["Sun"], meals: ["breakfast", "lunch", "dinner"], maxWeekdayMinutes: 45 },
  };
}

/** Extra scenarios used by the eval suite. */
export const SCENARIOS: Record<string, () => Household> = {
  sharma: sharmaFamily,
  jain_gujarati: () => ({
    ...blankHousehold(),
    familyName: "Shah family", city: "Ahmedabad", cuisines: ["gujarati", "west_indian"],
    members: [
      member({ name: "Hetal", jain: true, diet: "veg" }),
      member({ name: "Nikhil", jain: true, diet: "veg", fastDays: ["Sat"] }),
      member({ name: "Mira", ageGroup: "toddler", jain: true, diet: "veg", spice: "none" }),
    ],
    cook: { name: "Kamla", language: "gu", offDays: [], meals: ["lunch", "dinner"], maxWeekdayMinutes: 40 },
  }),
  bachelor_gym: () => ({
    ...blankHousehold(),
    familyName: "Flat 4B", city: "Pune", cuisines: [], meals: ["breakfast", "dinner"], nonvegPerWeek: 5,
    members: [
      member({ name: "Arjun", diet: "nonveg", conditions: ["high_protein"], tiffinDays: [] }),
      member({ name: "Dev", diet: "eggetarian", allergies: ["gluten"], away: [{ day: "Sat", meals: [] }, { day: "Sun", meals: [] }] }),
    ],
    cook: { name: "Raju", language: "mr", offDays: ["Sun"], meals: ["breakfast", "dinner"], maxWeekdayMinutes: 30 },
  }),
  south_allergy: () => ({
    ...blankHousehold(),
    familyName: "Iyer family", city: "Chennai", cuisines: ["south_indian"],
    members: [
      member({ name: "Lakshmi", diet: "veg", conditions: ["diabetes"] }),
      member({ name: "Ravi", diet: "veg", conditions: ["lactose_intolerant"] }),
      member({ name: "Anu", ageGroup: "child", diet: "veg", allergies: ["tree_nut", "peanut", "sesame"], tiffinDays: ["Mon", "Tue", "Wed", "Thu", "Fri"] }),
    ],
    guests: [{ day: "Sat", meal: "dinner", count: 6 }],
    cook: { name: "Selvi", language: "ta", offDays: ["Wed"], meals: ["breakfast", "lunch", "dinner"], maxWeekdayMinutes: 45 },
  }),
  vegan_bengali: () => ({
    ...blankHousehold(),
    familyName: "Banerjee home", city: "Kolkata", cuisines: ["bengali"], nonvegPerWeek: 4,
    members: [
      member({ name: "Sourav", diet: "nonveg", likes: ["fish"] }),
      member({ name: "Tania", diet: "vegan" }),
      member({ name: "Dida", ageGroup: "elderly", diet: "veg", fastDays: ["Mon"], conditions: ["hypertension"] }),
    ],
    eatOut: [{ day: "Fri", meal: "dinner" }],
    cook: { name: "Mala", language: "bn", offDays: [], meals: ["lunch", "dinner"], maxWeekdayMinutes: 50 },
  }),
  ramzan_hyderabad: () => ({
    ...blankHousehold(),
    familyName: "Qureshi family", city: "Hyderabad", cuisines: ["hyderabadi", "north_indian"], nonvegPerWeek: 5, meatRule: "halal",
    members: [
      member({ name: "Imran", diet: "nonveg", avoidMeats: ["pork"], rozaDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] }),
      member({ name: "Sana", diet: "nonveg", avoidMeats: ["pork"], rozaDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] }),
      member({ name: "Zoya", ageGroup: "child", diet: "nonveg", avoidMeats: ["pork"], tiffinDays: ["Mon", "Tue", "Wed", "Thu", "Fri"] }),
      member({ name: "Ammi", ageGroup: "elderly", diet: "nonveg", avoidMeats: ["pork"], conditions: ["hypertension"], spice: "low" }),
    ],
    cook: { name: "Rehana", language: "hi", offDays: ["Fri"], meals: ["breakfast", "lunch", "dinner"], maxWeekdayMinutes: 50 },
  }),
  navratri_sattvik: () => ({
    ...blankHousehold(),
    familyName: "Agarwal family", city: "Jaipur", cuisines: ["north_indian"], sattvikDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    members: [
      member({ name: "Sunil", diet: "veg" }),
      member({ name: "Rekha", diet: "veg", fastDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] }),
      member({ name: "Tanvi", ageGroup: "teen", diet: "veg", fastDays: ["Mon", "Sun"] }),
      member({ name: "Bauji", ageGroup: "elderly", diet: "veg", conditions: ["diabetes"] }),
    ],
    cook: { name: "Geeta", language: "hi", offDays: [], meals: ["breakfast", "lunch", "dinner"], maxWeekdayMinutes: 45 },
  }),
  sikh_jhatka_mixed: () => ({
    ...blankHousehold(),
    familyName: "Gill family", city: "Ludhiana", cuisines: ["north_indian"], nonvegPerWeek: 3, meatRule: "jhatka",
    members: [
      member({ name: "Harpreet", diet: "nonveg", avoidMeats: ["beef", "pork", "mutton"] }),
      member({ name: "Simran", diet: "veg" }),
      member({ name: "Biji", ageGroup: "elderly", diet: "veg", noOnionGarlic: true, conditions: ["diabetes"] }),
      member({ name: "Jas", ageGroup: "teen", diet: "nonveg", conditions: ["high_protein"], avoidMeats: ["beef", "pork"], unwellDays: ["Mon", "Tue"] }),
    ],
    cook: { name: "Pinky", language: "hi", offDays: ["Sun"], meals: ["breakfast", "lunch", "dinner"], maxWeekdayMinutes: 45 },
  }),
  veg_kitchen_tight_budget: () => ({
    ...blankHousehold(),
    familyName: "Kulkarni family", city: "Nagpur", cuisines: ["maharashtrian"], budgetPerWeek: 2200, noNonvegAtHome: true, nonvegPerWeek: 3,
    members: [
      member({ name: "Aai", diet: "veg" }),
      member({ name: "Baba", diet: "veg", conditions: ["hypertension"] }),
      member({ name: "Rohan", ageGroup: "teen", diet: "nonveg" }),
      member({ name: "Pari", ageGroup: "child", diet: "veg", allergies: ["peanut"], tiffinDays: ["Mon", "Tue", "Wed", "Thu", "Fri"] }),
    ],
    cook: { name: "Mangal", language: "mr", offDays: ["Thu"], meals: ["lunch", "dinner"], maxWeekdayMinutes: 40 },
    meals: ["breakfast", "lunch", "dinner"],
  }),
};
