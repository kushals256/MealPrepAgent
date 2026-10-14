import type { Ingredient } from "../types";

// Ingredient master. Pack sizes and prices are a SIMULATED Instamart catalogue
// (roughly Bangalore quick-commerce prices) — there is no public Instamart API.
// Units: g, ml or pc. shelfDays drives the weekly vs mid-week top-up split.

type I = Omit<Ingredient, "packs"> & { packs: [number, number][] };

const raw: I[] = [
  // ---------- vegetables ----------
  { id: "onion", name: "Onion", hindi: "pyaaz", category: "vegetables", unit: "g", shelfDays: 20, packs: [[1000, 45], [500, 25]], root: true },
  { id: "tomato", name: "Tomato", hindi: "tamatar", category: "vegetables", unit: "g", shelfDays: 6, packs: [[1000, 40], [500, 22]] },
  { id: "potato", name: "Potato", hindi: "aloo", category: "vegetables", unit: "g", shelfDays: 20, packs: [[1000, 38], [500, 20]], root: true, highGI: true },
  { id: "garlic", name: "Garlic", hindi: "lehsun", category: "vegetables", unit: "g", shelfDays: 25, packs: [[100, 30], [250, 65]], root: true },
  { id: "ginger", name: "Ginger", hindi: "adrak", category: "vegetables", unit: "g", shelfDays: 14, packs: [[100, 18], [250, 40]], root: true },
  { id: "green_chilli", name: "Green chilli", hindi: "hari mirch", category: "vegetables", unit: "g", shelfDays: 7, packs: [[100, 12]] },
  { id: "coriander", name: "Coriander leaves", hindi: "dhaniya patta", category: "vegetables", unit: "g", shelfDays: 3, packs: [[100, 15]] },
  { id: "curry_leaves", name: "Curry leaves", hindi: "kadi patta", category: "vegetables", unit: "g", shelfDays: 5, packs: [[50, 10]] },
  { id: "mint", name: "Mint leaves", hindi: "pudina", category: "vegetables", unit: "g", shelfDays: 3, packs: [[100, 15]] },
  { id: "lemon", name: "Lemon", hindi: "nimbu", category: "vegetables", unit: "pc", shelfDays: 10, packs: [[4, 25]] },
  { id: "spinach", name: "Spinach (palak)", hindi: "palak", category: "vegetables", unit: "g", shelfDays: 2, packs: [[250, 25]] },
  { id: "methi", name: "Fenugreek leaves (methi)", hindi: "methi", category: "vegetables", unit: "g", shelfDays: 2, packs: [[250, 25]] },
  { id: "okra", name: "Bhindi (okra)", hindi: "bhindi", category: "vegetables", unit: "g", shelfDays: 3, packs: [[250, 25], [500, 45]] },
  { id: "cauliflower", name: "Cauliflower", hindi: "gobhi", category: "vegetables", unit: "g", shelfDays: 5, packs: [[600, 45]] },
  { id: "cabbage", name: "Cabbage", hindi: "patta gobhi", category: "vegetables", unit: "g", shelfDays: 10, packs: [[700, 35]] },
  { id: "capsicum", name: "Capsicum", hindi: "shimla mirch", category: "vegetables", unit: "g", shelfDays: 6, packs: [[250, 30]] },
  { id: "carrot", name: "Carrot", hindi: "gajar", category: "vegetables", unit: "g", shelfDays: 10, packs: [[500, 35]], root: true },
  { id: "beans", name: "French beans", hindi: "beans", category: "vegetables", unit: "g", shelfDays: 5, packs: [[250, 30]] },
  { id: "peas", name: "Green peas", hindi: "matar", category: "vegetables", unit: "g", shelfDays: 4, packs: [[250, 35], [500, 65]] },
  { id: "bottle_gourd", name: "Lauki (bottle gourd)", hindi: "lauki", category: "vegetables", unit: "g", shelfDays: 6, packs: [[800, 35]] },
  { id: "brinjal", name: "Brinjal", hindi: "baingan", category: "vegetables", unit: "g", shelfDays: 5, packs: [[500, 35]] },
  { id: "pumpkin", name: "Pumpkin", hindi: "kaddu", category: "vegetables", unit: "g", shelfDays: 10, packs: [[500, 30]] },
  { id: "drumstick", name: "Drumstick", hindi: "sahjan", category: "vegetables", unit: "pc", shelfDays: 5, packs: [[3, 30]] },
  { id: "cucumber", name: "Cucumber", hindi: "kheera", category: "vegetables", unit: "g", shelfDays: 5, packs: [[500, 30]] },
  { id: "sweet_potato", name: "Sweet potato", hindi: "shakarkandi", category: "vegetables", unit: "g", shelfDays: 14, packs: [[500, 40]], root: true },
  { id: "raw_banana", name: "Raw banana", hindi: "kaccha kela", category: "vegetables", unit: "pc", shelfDays: 5, packs: [[3, 30]] },
  { id: "mushroom", name: "Mushroom", hindi: "mushroom", category: "vegetables", unit: "g", shelfDays: 3, packs: [[200, 55]] },
  // ---------- fruits ----------
  { id: "banana", name: "Banana", hindi: "kela", category: "fruits", unit: "pc", shelfDays: 4, packs: [[6, 45], [12, 85]] },
  { id: "dates", name: "Dates (khajoor)", hindi: "khajoor", category: "fruits", unit: "g", shelfDays: 60, packs: [[250, 120], [500, 220]] },
  { id: "apple", name: "Apple", hindi: "seb", category: "fruits", unit: "pc", shelfDays: 14, packs: [[4, 140]] },
  // ---------- dairy ----------
  { id: "milk", name: "Milk (toned)", hindi: "doodh", category: "dairy", unit: "ml", shelfDays: 2, packs: [[500, 30], [1000, 58]], dairy: true, allergens: ["dairy"] },
  { id: "curd", name: "Curd (dahi)", hindi: "dahi", category: "dairy", unit: "g", shelfDays: 5, packs: [[400, 40], [1000, 90]], dairy: true, allergens: ["dairy"] },
  { id: "paneer", name: "Paneer", hindi: "paneer", category: "dairy", unit: "g", shelfDays: 5, packs: [[200, 95], [500, 220]], dairy: true, allergens: ["dairy"] },
  { id: "ghee", name: "Ghee", hindi: "ghee", category: "dairy", unit: "ml", shelfDays: 180, packs: [[500, 330], [200, 145]], dairy: true, allergens: ["dairy"], pantryStaple: true },
  { id: "butter", name: "Butter", hindi: "makkhan", category: "dairy", unit: "g", shelfDays: 60, packs: [[100, 58], [500, 275]], dairy: true, allergens: ["dairy"] },
  { id: "cream", name: "Fresh cream", hindi: "malai", category: "dairy", unit: "ml", shelfDays: 7, packs: [[200, 70]], dairy: true, allergens: ["dairy"] },
  { id: "tofu", name: "Tofu", hindi: "tofu", category: "dairy", unit: "g", shelfDays: 6, packs: [[200, 90]], allergens: ["soy"] },
  // ---------- meat / fish / egg ----------
  { id: "egg", name: "Eggs", hindi: "anda", category: "meat_fish", unit: "pc", shelfDays: 14, packs: [[6, 48], [12, 92], [30, 220]], egg: true, meatType: "egg", allergens: ["egg"] },
  { id: "chicken", name: "Chicken curry cut", hindi: "chicken", category: "meat_fish", unit: "g", shelfDays: 2, packs: [[500, 190], [1000, 360]], meat: true, meatType: "chicken" },
  { id: "chicken_boneless", name: "Chicken boneless", hindi: "boneless chicken", category: "meat_fish", unit: "g", shelfDays: 2, packs: [[450, 240]], meat: true, meatType: "chicken" },
  { id: "mutton", name: "Mutton curry cut", hindi: "mutton", category: "meat_fish", unit: "g", shelfDays: 2, packs: [[500, 450]], meat: true, meatType: "mutton" },
  { id: "mutton_keema", name: "Mutton keema", hindi: "keema", category: "meat_fish", unit: "g", shelfDays: 1, packs: [[500, 480]], meat: true, meatType: "mutton" },
  { id: "fish", name: "Fish (rohu/seer, cleaned)", hindi: "machhli", category: "meat_fish", unit: "g", shelfDays: 1, packs: [[500, 320]], meat: true, meatType: "fish", allergens: ["fish"] },
  { id: "prawns", name: "Prawns (cleaned)", hindi: "jhinga", category: "meat_fish", unit: "g", shelfDays: 1, packs: [[250, 280]], meat: true, meatType: "seafood", allergens: ["shellfish"] },
  // ---------- staples ----------
  { id: "atta", name: "Whole wheat atta", hindi: "atta", category: "staples", unit: "g", shelfDays: 90, packs: [[5000, 260], [1000, 62]], allergens: ["gluten"] },
  { id: "rice", name: "Sona masoori rice", hindi: "chawal", category: "staples", unit: "g", shelfDays: 180, packs: [[5000, 380], [1000, 82]], highGI: true },
  { id: "basmati", name: "Basmati rice", hindi: "basmati", category: "staples", unit: "g", shelfDays: 180, packs: [[1000, 145]] },
  { id: "poha", name: "Poha (flattened rice)", hindi: "poha", category: "staples", unit: "g", shelfDays: 90, packs: [[500, 45]] },
  { id: "suji", name: "Suji (semolina)", hindi: "suji", category: "staples", unit: "g", shelfDays: 90, packs: [[500, 40]], allergens: ["gluten"] },
  { id: "besan", name: "Besan (gram flour)", hindi: "besan", category: "staples", unit: "g", shelfDays: 90, packs: [[500, 60]] },
  { id: "idli_batter", name: "Idli/dosa batter", hindi: "idli batter", category: "staples", unit: "g", shelfDays: 3, packs: [[1000, 80]] },
  { id: "oats", name: "Rolled oats", hindi: "oats", category: "staples", unit: "g", shelfDays: 120, packs: [[500, 110]], allergens: ["gluten"] },
  { id: "dalia", name: "Dalia (broken wheat)", hindi: "dalia", category: "staples", unit: "g", shelfDays: 120, packs: [[500, 50]], allergens: ["gluten"] },
  { id: "ragi_flour", name: "Ragi flour", hindi: "ragi atta", category: "staples", unit: "g", shelfDays: 90, packs: [[500, 55]] },
  { id: "jowar_flour", name: "Jowar flour", hindi: "jowar atta", category: "staples", unit: "g", shelfDays: 90, packs: [[500, 60]] },
  { id: "sabudana", name: "Sabudana", hindi: "sabudana", category: "staples", unit: "g", shelfDays: 180, packs: [[500, 70]] },
  { id: "kuttu_atta", name: "Kuttu atta (buckwheat)", hindi: "kuttu atta", category: "staples", unit: "g", shelfDays: 90, packs: [[500, 95]] },
  { id: "samak_rice", name: "Samak rice (vrat ke chawal)", hindi: "samak", category: "staples", unit: "g", shelfDays: 180, packs: [[500, 90]] },
  { id: "vermicelli", name: "Vermicelli", hindi: "seviyan", category: "staples", unit: "g", shelfDays: 120, packs: [[400, 40]], allergens: ["gluten"] },
  { id: "bread", name: "Whole wheat bread", hindi: "bread", category: "bakery", unit: "pc", shelfDays: 4, packs: [[20, 55]], allergens: ["gluten"] },
  { id: "maida", name: "Maida", hindi: "maida", category: "staples", unit: "g", shelfDays: 120, packs: [[500, 35]], allergens: ["gluten"] },
  { id: "oil", name: "Sunflower oil", hindi: "tel", category: "staples", unit: "ml", shelfDays: 180, packs: [[1000, 165]], pantryStaple: true },
  { id: "mustard_oil", name: "Mustard oil", hindi: "sarson ka tel", category: "staples", unit: "ml", shelfDays: 180, packs: [[1000, 185]] },
  { id: "coconut", name: "Grated coconut", hindi: "nariyal", category: "staples", unit: "g", shelfDays: 3, packs: [[200, 45]] },
  { id: "sugar", name: "Sugar", hindi: "cheeni", category: "staples", unit: "g", shelfDays: 365, packs: [[1000, 50]], pantryStaple: true },
  { id: "jaggery", name: "Jaggery", hindi: "gud", category: "staples", unit: "g", shelfDays: 180, packs: [[500, 60]] },
  { id: "tamarind", name: "Tamarind", hindi: "imli", category: "staples", unit: "g", shelfDays: 180, packs: [[200, 45]], pantryStaple: true },
  { id: "peanuts", name: "Peanuts", hindi: "mungfali", category: "staples", unit: "g", shelfDays: 90, packs: [[500, 85]], allergens: ["peanut"] },
  { id: "cashew", name: "Cashews", hindi: "kaju", category: "staples", unit: "g", shelfDays: 120, packs: [[100, 120]], allergens: ["tree_nut"] },
  { id: "sesame", name: "Sesame seeds", hindi: "til", category: "staples", unit: "g", shelfDays: 180, packs: [[100, 35]], allergens: ["sesame"] },
  { id: "soya_chunks", name: "Soya chunks", hindi: "soya badi", category: "pulses", unit: "g", shelfDays: 180, packs: [[200, 45]], allergens: ["soy"] },
  // ---------- pulses ----------
  { id: "toor_dal", name: "Toor dal", hindi: "arhar dal", category: "pulses", unit: "g", shelfDays: 180, packs: [[1000, 175], [500, 92]] },
  { id: "moong_dal", name: "Yellow moong dal", hindi: "moong dal", category: "pulses", unit: "g", shelfDays: 180, packs: [[500, 80]] },
  { id: "masoor_dal", name: "Masoor dal", hindi: "masoor dal", category: "pulses", unit: "g", shelfDays: 180, packs: [[500, 70]] },
  { id: "chana_dal", name: "Chana dal", hindi: "chana dal", category: "pulses", unit: "g", shelfDays: 180, packs: [[500, 65]] },
  { id: "urad_whole", name: "Whole urad (black)", hindi: "sabut urad", category: "pulses", unit: "g", shelfDays: 180, packs: [[500, 85]] },
  { id: "rajma", name: "Rajma", hindi: "rajma", category: "pulses", unit: "g", shelfDays: 180, packs: [[500, 95]] },
  { id: "chole", name: "Kabuli chana", hindi: "chole", category: "pulses", unit: "g", shelfDays: 180, packs: [[500, 85]] },
  { id: "kala_chana", name: "Kala chana", hindi: "kala chana", category: "pulses", unit: "g", shelfDays: 180, packs: [[500, 70]] },
  { id: "moong_whole", name: "Whole green moong", hindi: "sabut moong", category: "pulses", unit: "g", shelfDays: 180, packs: [[500, 75]] },
  // ---------- spices (pantry by default) ----------
  { id: "salt", name: "Salt", hindi: "namak", category: "spices", unit: "g", shelfDays: 999, packs: [[1000, 28]], pantryStaple: true },
  { id: "turmeric", name: "Turmeric", hindi: "haldi", category: "spices", unit: "g", shelfDays: 365, packs: [[100, 32]], pantryStaple: true },
  { id: "red_chilli", name: "Red chilli powder", hindi: "laal mirch", category: "spices", unit: "g", shelfDays: 365, packs: [[100, 40]], pantryStaple: true },
  { id: "jeera", name: "Cumin seeds", hindi: "jeera", category: "spices", unit: "g", shelfDays: 365, packs: [[100, 45]], pantryStaple: true },
  { id: "mustard_seeds", name: "Mustard seeds", hindi: "rai", category: "spices", unit: "g", shelfDays: 365, packs: [[100, 22]], pantryStaple: true },
  { id: "garam_masala", name: "Garam masala", hindi: "garam masala", category: "spices", unit: "g", shelfDays: 365, packs: [[100, 65]], pantryStaple: true },
  { id: "dhaniya_powder", name: "Coriander powder", hindi: "dhaniya powder", category: "spices", unit: "g", shelfDays: 365, packs: [[100, 30]], pantryStaple: true },
  { id: "hing", name: "Asafoetida", hindi: "hing", category: "spices", unit: "g", shelfDays: 365, packs: [[50, 60]], pantryStaple: true },
  { id: "sambar_powder", name: "Sambar powder", hindi: "sambar masala", category: "spices", unit: "g", shelfDays: 365, packs: [[100, 55]] },
  { id: "chole_masala", name: "Chole masala", hindi: "chole masala", category: "spices", unit: "g", shelfDays: 365, packs: [[100, 60]] },
  { id: "kasuri_methi", name: "Kasuri methi", hindi: "kasuri methi", category: "spices", unit: "g", shelfDays: 365, packs: [[25, 35]], pantryStaple: true },
  { id: "rock_salt", name: "Sendha namak", hindi: "sendha namak", category: "spices", unit: "g", shelfDays: 999, packs: [[500, 45]] },
  { id: "panch_phoron", name: "Panch phoron", hindi: "panch phoran", category: "spices", unit: "g", shelfDays: 365, packs: [[100, 40]] },
  { id: "biryani_masala", name: "Biryani masala", hindi: "biryani masala", category: "spices", unit: "g", shelfDays: 365, packs: [[50, 55]] },
];

export const INGREDIENTS: Record<string, Ingredient> = Object.fromEntries(
  raw.map((r) => [r.id, { ...r, packs: r.packs.map(([size, price]) => ({ size, price })) }]),
);

const ALIASES: Record<string, string> = {
  pyaz: "onion", pyaaz: "onion", kanda: "onion", tamatar: "tomato", aloo: "potato", alu: "potato",
  lehsun: "garlic", lasun: "garlic", adrak: "ginger", mirchi: "green_chilli", "hari mirch": "green_chilli",
  dhaniya: "coriander", cilantro: "coriander", palak: "spinach", bhindi: "okra", "lady finger": "okra", ladyfinger: "okra",
  gobhi: "cauliflower", gobi: "cauliflower", matar: "peas", lauki: "bottle_gourd", doodhi: "bottle_gourd",
  baingan: "brinjal", eggplant: "brinjal", kaddu: "pumpkin", doodh: "milk", dahi: "curd", yogurt: "curd", yoghurt: "curd",
  anda: "egg", eggs: "egg", chawal: "rice", arhar: "toor_dal", "toor dal": "toor_dal", "tur dal": "toor_dal",
  "moong dal": "moong_dal", "masoor dal": "masoor_dal", "chana dal": "chana_dal", chana: "chole", chickpeas: "chole",
  mungfali: "peanuts", peanut: "peanuts", groundnut: "peanuts", kaju: "cashew", cashews: "cashew", til: "sesame",
  haldi: "turmeric", jeera: "jeera", cumin: "jeera", namak: "salt", tel: "oil", "cooking oil": "oil", cheeni: "sugar",
  gud: "jaggery", besan: "besan", suji: "suji", rava: "suji", sooji: "suji", maida: "maida", "wheat flour": "atta",
  flour: "atta", capsicum: "capsicum", "shimla mirch": "capsicum", gajar: "carrot", carrots: "carrot", nimbu: "lemon",
  lime: "lemon", pudina: "mint", "curry leaf": "curry_leaves", "kadi patta": "curry_leaves", machhli: "fish",
  jhinga: "prawns", shrimp: "prawns", makhan: "butter", malai: "cream", "chicken breast": "chicken_boneless",
  "soya": "soya_chunks", nariyal: "coconut", "kasuri methi": "kasuri_methi", "garam masala": "garam_masala",
  "red chilli": "red_chilli", "chilli powder": "red_chilli", rajma: "rajma", "kidney beans": "rajma",
  "idli batter": "idli_batter", khajoor: "dates", keema: "mutton_keema", mince: "mutton_keema", "broken wheat": "dalia", daliya: "dalia", "dosa batter": "idli_batter", kela: "banana", seb: "apple", "sendha namak": "rock_salt",
};

/** Resolve a free-text ingredient name (English/Hindi/Hinglish) to an ingredient id. */
export function resolveIngredient(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
  if (!t) return null;
  const asId = t.replace(/ /g, "_");
  if (INGREDIENTS[asId]) return asId;
  if (ALIASES[t]) return ALIASES[t];
  const singular = t.replace(/(es|s)$/, "");
  if (ALIASES[singular]) return ALIASES[singular];
  if (INGREDIENTS[singular.replace(/ /g, "_")]) return singular.replace(/ /g, "_");
  for (const ing of Object.values(INGREDIENTS)) {
    const n = ing.name.toLowerCase();
    if (n === t || ing.hindi === t || n.startsWith(t + " ") || n.includes(`(${t})`)) return ing.id;
  }
  for (const [alias, id] of Object.entries(ALIASES)) {
    if (t.includes(alias) && alias.length >= 4) return id;
  }
  return null;
}
