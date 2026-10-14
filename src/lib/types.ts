// Core domain types shared by the planning engine, agents and UI.

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = (typeof DAYS)[number];

export const MEALS = ["breakfast", "lunch", "dinner"] as const;
export type Meal = (typeof MEALS)[number];

export type Diet = "veg" | "eggetarian" | "nonveg" | "vegan";

export type Allergen =
  | "peanut"
  | "tree_nut"
  | "dairy"
  | "gluten"
  | "sesame"
  | "egg"
  | "soy"
  | "shellfish"
  | "fish";

export type Condition =
  | "diabetes"
  | "hypertension"
  | "high_protein"
  | "lactose_intolerant"
  | "weight_loss"
  | "toddler"
  | "pregnancy";

/** Meats people in India commonly avoid for religious/community/personal reasons. */
export type MeatType = "beef" | "pork" | "mutton" | "chicken" | "fish" | "seafood" | "egg";

export type SpiceLevel = "none" | "low" | "medium" | "high";

export type AgeGroup = "toddler" | "child" | "teen" | "adult" | "elderly";

export interface Absence {
  day: Day;
  meals: Meal[]; // empty = whole day
}

export interface Member {
  name: string;
  ageGroup: AgeGroup;
  diet: Diet;
  jain?: boolean; // no onion/garlic/root vegetables, no mushroom/brinjal
  /** Sattvik: no onion/garlic (many Brahmin / ISKCON / Swaminarayan homes). Root veg like potato are fine. */
  noOnionGarlic?: boolean;
  /** e.g. eats chicken & fish but not mutton; Hindus avoid beef, Muslims avoid pork. */
  avoidMeats?: MeatType[];
  /** Jain chauvihar — dinner served before sunset. */
  sunsetDinner?: boolean;
  allergies: Allergen[];
  conditions: Condition[];
  spice: SpiceLevel;
  likes: string[];
  dislikes: string[];
  /** Days this person avoids meat/egg even if nonveg (e.g. Tuesday/Thursday). */
  vegDays: Day[];
  /** Days this person fasts (vrat) — gets a fasting-compatible meal. */
  fastDays: Day[];
  /** Ramzan roza: sehri before dawn + iftar at sunset, no lunch. */
  rozaDays?: Day[];
  /** Prefers light food at these meals (exams, elderly, "no heavy dinners"). */
  lightMeals?: Meal[];
  /** Down with fever/upset stomach: light, low-oil food for them. */
  unwellDays?: Day[];
  /** Weekdays this person takes a packed lunch (school/office dabba). */
  tiffinDays: Day[];
  away: Absence[];
}

export interface GuestEvent {
  day: Day;
  meal: Meal;
  count: number;
  note?: string;
}

export interface EatOut {
  day: Day;
  meal: Meal;
}

export type CookLang = "hi" | "en" | "ta" | "te" | "kn" | "mr" | "bn" | "gu" | "ml";

export interface CookProfile {
  name: string;
  language: CookLang;
  offDays: Day[];
  meals: Meal[]; // meals the cook makes
  maxWeekdayMinutes: number; // effort budget per weekday meal
}

export interface Household {
  familyName: string;
  city: string;
  cuisines: string[]; // e.g. north_indian, south_indian, bengali, gujarati
  meals: Meal[]; // which meals to plan
  budgetPerWeek?: number;
  /** Some vegetarian homes never cook meat in the kitchen even if a member eats it outside. */
  noNonvegAtHome?: boolean;
  /** Days the whole kitchen is sattvik (no onion/garlic) — Navratri, Tuesdays, Sawan Mondays… */
  sattvikDays?: Day[];
  /** Meat sourcing: halal (Muslim homes) or jhatka (many Sikh / Hindu homes). */
  meatRule?: "halal" | "jhatka";
  nonvegPerWeek: number; // how many meals/week carry a non-veg dish (for non-veg eaters)
  members: Member[];
  guests: GuestEvent[];
  eatOut: EatOut[];
  cook: CookProfile;
  bannedDishes: string[]; // dish ids
  bannedIngredients: string[]; // ingredient ids
  /** "Paneer only twice a week": ingredient or dish id -> max meals per week. */
  limits?: Record<string, number>;
  /** Ingredient ids the household says they already have enough of. */
  pantryHave: string[];
  /** Ingredient ids explicitly marked as running out (overrides default pantry staples). */
  pantryNeed: string[];
  notes: string[];
}

export interface Ingredient {
  id: string;
  name: string;
  hindi: string;
  category:
    | "vegetables"
    | "fruits"
    | "dairy"
    | "staples"
    | "pulses"
    | "spices"
    | "meat_fish"
    | "bakery"
    | "other";
  unit: "g" | "ml" | "pc";
  /** Shelf life in days once bought; drives fresh top-up split. */
  shelfDays: number;
  /** Pack sizes available (in unit) with price (INR). Simulated Instamart catalogue. */
  packs: { size: number; price: number }[];
  /** Assumed in every Indian pantry unless the household says otherwise. */
  pantryStaple?: boolean;
  root?: boolean; // root veg / onion / garlic -> not Jain
  allergens?: Allergen[];
  meat?: boolean;
  meatType?: MeatType;
  egg?: boolean;
  dairy?: boolean;
  highGI?: boolean;
}

export type DishRole = "breakfast" | "main" | "side" | "staple" | "complete" | "fasting";

export interface RecipeIngredient {
  id: string; // ingredient id
  qty: number; // per adult serving, in ingredient unit
  optional?: boolean; // garnish / removable — dropped if it conflicts with someone
}

export interface Dish {
  id: string;
  name: string;
  hindi: string;
  roles: DishRole[];
  cuisine: string;
  minutes: number; // active cooking time
  prepAhead?: string; // e.g. "Soak rajma overnight"
  tags: string[]; // quick, packable, kid_friendly, high_protein, light, heavy, weekend, diabetic_ok, spicy
  ingredients: RecipeIngredient[];
  steps: string[];
  /** Can a Jain portion be separated before onion/garlic goes in? */
  jainAdaptable?: boolean;
  custom?: boolean;
}

export interface PlannedDish {
  dishId: string;
  /** Who eats it. "all" = everyone eating that meal. */
  for: "all" | string[];
  locked?: boolean; // pinned by the household — survives regeneration
}

export interface PlannedMeal {
  day: Day;
  meal: Meal;
  status: "planned" | "eat_out" | "skipped" | "done";
  dishes: PlannedDish[];
  eaters: string[]; // member names at home for this meal
  tiffin: string[]; // member names taking this meal packed
  guests: number;
  /** Per-member handling notes for the cook (spice, Jain portion, allergy). */
  notes: string[];
  cookedBy: "cook" | "household";
}

export interface WeekPlan {
  weekOf: string; // ISO date of Monday
  meals: PlannedMeal[];
  seed: number;
  generatedAt: string;
}

export interface GroceryLine {
  id: string;
  name: string;
  hindi: string;
  category: Ingredient["category"];
  needed: number; // in unit
  unit: string;
  packs: { size: number; count: number; price: number }[];
  cost: number;
  batch: "weekly" | "topup"; // topup = buy mid-week for freshness
  usedIn: string[]; // dish names
  extra?: boolean;
}

export interface GroceryList {
  lines: GroceryLine[];
  pantryCheck: { id: string; name: string; usedIn: string[] }[];
  total: number;
  /** What this week's meals actually consume (₹) — staples bought in packs last beyond the week. */
  consumedCost: number;
  weeklyTotal: number;
  topupTotal: number;
  topupDay: Day;
}

export interface ExtraItem {
  name: string;
  qty: string;
}

export interface ActivityItem {
  at: string;
  who: "household" | "cook" | "agent";
  kind: "info" | "change" | "shortage" | "leftover" | "warning" | "done" | "order";
  text: string;
}

export interface CookSession {
  day: Day;
  activeDish?: { dishId: string; meal: Meal; step: number };
  timers: { id: string; label: string; endsAt: number }[];
  leftovers: { dishId: string; note: string; day: Day }[];
  shortages: string[]; // ingredient ids out of stock
  absentDays: Day[];
  doneMeals: string[]; // `${day}:${meal}`
}

export interface Order {
  channel: "instamart" | "whatsapp";
  at: string;
  total: number;
  status: "placed_simulated" | "sent";
  phone?: string;
  message?: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AppState {
  version: number;
  household: Household;
  plan: WeekPlan | null;
  customDishes: Dish[];
  extras: ExtraItem[];
  activity: ActivityItem[];
  cook: CookSession;
  orders: Order[];
  householdChat: ChatTurn[];
  cookChat: ChatTurn[];
  phase: "onboarding" | "planning" | "review" | "ordered";
  history: string[]; // serialized snapshots for undo (bounded)
}
