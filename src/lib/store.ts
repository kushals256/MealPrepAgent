import fs from "node:fs";
import path from "node:path";
import { blankHousehold, sharmaFamily } from "./data/households";
import type { AppState } from "./types";

// Single-household state, persisted to a JSON file so the household page and
// the cook page (another phone/tab) see the same plan live. A real product
// would use a database keyed by household; this is deliberately simple.

const FILE = process.env.STATE_FILE ?? path.join(process.cwd(), "data", "state.json");

export function freshState(sample = false): AppState {
  return {
    version: 1,
    household: sample ? sharmaFamily() : blankHousehold(),
    plan: null,
    customDishes: [],
    extras: [],
    activity: [],
    cook: { day: "Mon", timers: [], leftovers: [], shortages: [], absentDays: [], doneMeals: [] },
    orders: [],
    householdChat: [],
    cookChat: [],
    phase: sample ? "planning" : "onboarding",
    history: [],
  };
}

const g = globalThis as unknown as { __mealState?: AppState };

export function getState(): AppState {
  if (g.__mealState) return g.__mealState;
  try {
    g.__mealState = JSON.parse(fs.readFileSync(FILE, "utf8")) as AppState;
  } catch {
    g.__mealState = freshState();
  }
  return g.__mealState!;
}

export function saveState(s: AppState) {
  s.version += 1;
  g.__mealState = s;
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(s, null, 1));
  } catch {
    // read-only FS (e.g. serverless) — keep in memory only
  }
}

export function snapshot(s: AppState) {
  const snap = JSON.stringify({ household: s.household, plan: s.plan, customDishes: s.customDishes, extras: s.extras });
  s.history = [...s.history.slice(-14), snap];
}

export function undo(s: AppState) {
  const last = s.history.pop();
  if (!last) return false;
  Object.assign(s, JSON.parse(last));
  return true;
}
