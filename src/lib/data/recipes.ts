import type { Dish, DishRole } from "../types";

// Dish catalogue. Ingredient quantities are per ADULT serving in the
// ingredient's unit (g / ml / pc). "id:qty?" marks an optional/garnish
// ingredient that can be dropped for a member's allergy or Jain portion.
// Steps are deliberately short — the cook agent narrates them in the cook's
// language, scaled to the day's headcount.

interface D {
  id: string;
  name: string;
  hindi: string;
  roles: DishRole[];
  cuisine: string;
  minutes: number;
  tags?: string[];
  prepAhead?: string;
  jain?: boolean; // jainAdaptable
  ing: string;
  steps: string[];
}

const raw: D[] = [
  // ================= BREAKFAST =================
  { id: "poha", name: "Kanda Poha", hindi: "पोहा", roles: ["breakfast"], cuisine: "west_indian", minutes: 20, tags: ["quick", "light", "kid_friendly"], jain: true,
    ing: "poha:70, onion:40, potato:40, peanuts:10?, curry_leaves:2, mustard_seeds:1, turmeric:1, green_chilli:3, lemon:0.25, coriander:5?, oil:10, salt:2, sugar:3",
    steps: ["Rinse poha in a strainer, let it soften 5 minutes.", "Heat oil, crackle mustard seeds, add curry leaves, green chilli and peanuts.", "Add onion and diced potato, cook covered till potato is soft.", "Add turmeric, salt, a pinch of sugar, then the poha. Mix gently.", "Cover 2 minutes on low. Finish with lemon and coriander."] },
  { id: "upma", name: "Rava Upma", hindi: "उपमा", roles: ["breakfast"], cuisine: "south_indian", minutes: 20, tags: ["quick", "light"], jain: true,
    ing: "suji:60, onion:30, carrot:20, peas:15, curry_leaves:2, mustard_seeds:1, green_chilli:3, ginger:3, cashew:5?, ghee:5, oil:5, salt:2, coriander:4?",
    steps: ["Dry roast suji till fragrant, keep aside.", "Temper mustard seeds, curry leaves, chilli, ginger, cashews in oil.", "Add onion, carrot, peas; saute 3 minutes.", "Add 2.5 cups water per cup suji with salt, bring to boil.", "Pour suji slowly while stirring, cover and cook 2 minutes. Finish with ghee."] },
  { id: "aloo_paratha", name: "Aloo Paratha with Curd", hindi: "आलू पराठा", roles: ["breakfast"], cuisine: "north_indian", minutes: 35, tags: ["heavy", "weekend", "kid_friendly", "packable"],
    ing: "atta:90, potato:120, onion:15?, green_chilli:2, coriander:5, jeera:1, red_chilli:1, ghee:10, curd:80, salt:3",
    steps: ["Boil and mash potatoes. Mix chilli, coriander, jeera, salt, red chilli.", "Knead a soft atta dough, rest 10 minutes.", "Stuff a ball of dough with filling, seal and roll gently.", "Cook on hot tawa, flip, apply ghee both sides till golden.", "Serve with curd."] },
  { id: "paneer_paratha", name: "Paneer Paratha", hindi: "पनीर पराठा", roles: ["breakfast"], cuisine: "north_indian", minutes: 30, tags: ["high_protein", "packable", "kid_friendly"],
    ing: "atta:90, paneer:60, onion:15?, green_chilli:2, coriander:5, ghee:10, curd:60, salt:2",
    steps: ["Grate paneer, mix chilli, coriander, onion, salt.", "Knead soft dough and rest.", "Stuff, seal, roll gently.", "Roast on tawa with ghee till golden spots appear.", "Serve with curd."] },
  { id: "methi_thepla", name: "Methi Thepla", hindi: "मेथी थेपला", roles: ["breakfast"], cuisine: "gujarati", minutes: 30, tags: ["packable", "diabetic_ok"], jain: true,
    ing: "atta:70, besan:15, methi:40, curd:20, turmeric:1, red_chilli:1, ginger:3, oil:10, salt:2",
    steps: ["Chop methi finely.", "Mix atta, besan, methi, curd, spices and a little oil into a soft dough.", "Roll thin theplas.", "Cook on tawa with a little oil both sides.", "Serve with curd or pickle."] },
  { id: "idli_sambar", name: "Idli Sambar", hindi: "इडली सांभर", roles: ["breakfast"], cuisine: "south_indian", minutes: 30, tags: ["light", "kid_friendly", "fermented"],
    ing: "idli_batter:180, toor_dal:20, tomato:30, onion:20, drumstick:0.3, sambar_powder:5, tamarind:3, mustard_seeds:1, curry_leaves:2, oil:5, salt:3",
    steps: ["Grease idli plates, pour batter and steam 10-12 minutes.", "Pressure cook toor dal 3 whistles.", "Boil vegetables with tamarind water, sambar powder and salt.", "Add mashed dal and simmer 5 minutes.", "Temper mustard seeds and curry leaves, pour over sambar."] },
  { id: "masala_dosa", name: "Masala Dosa with Chutney", hindi: "मसाला डोसा", roles: ["breakfast"], cuisine: "south_indian", minutes: 35, tags: ["weekend", "kid_friendly", "fermented"],
    ing: "idli_batter:200, potato:100, onion:30, coconut:25, green_chilli:3, mustard_seeds:1, curry_leaves:2, turmeric:1, oil:12, salt:3",
    steps: ["Make potato masala: temper, add onion, turmeric, boiled mashed potato.", "Grind coconut, chilli and salt into chutney.", "Spread batter thin on a hot tawa, drizzle oil.", "When crisp, place masala and fold.", "Serve hot with chutney."] },
  { id: "besan_chilla", name: "Besan Chilla", hindi: "बेसन चीला", roles: ["breakfast"], cuisine: "north_indian", minutes: 20, tags: ["quick", "high_protein", "diabetic_ok", "packable"], jain: true,
    ing: "besan:60, onion:25, tomato:25, green_chilli:2, coriander:5, turmeric:1, oil:8, salt:2",
    steps: ["Whisk besan with water to a smooth pouring batter.", "Add chopped onion, tomato, chilli, coriander, turmeric, salt.", "Spread a ladle on a hot greased tawa.", "Cook till edges lift, flip and cook other side.", "Serve with green chutney or curd."] },
  { id: "moong_chilla", name: "Moong Dal Chilla", hindi: "मूंग दाल चीला", roles: ["breakfast"], cuisine: "north_indian", minutes: 25, tags: ["high_protein", "diabetic_ok", "light"], prepAhead: "Soak moong dal 4 hours or overnight", jain: true,
    ing: "moong_dal:60, ginger:3, green_chilli:2, coriander:5, onion:20?, oil:8, salt:2",
    steps: ["Grind soaked moong dal with ginger and chilli to a smooth batter.", "Add salt, coriander and onion.", "Spread thin on hot greased tawa.", "Cook both sides till golden.", "Serve with chutney."] },
  { id: "veg_oats", name: "Masala Oats", hindi: "मसाला ओट्स", roles: ["breakfast"], cuisine: "modern", minutes: 15, tags: ["quick", "diabetic_ok", "light"],
    ing: "oats:50, onion:20, carrot:20, peas:15, tomato:20, turmeric:1, oil:5, salt:2",
    steps: ["Saute onion, then carrot, peas, tomato.", "Add turmeric and salt.", "Add oats and 1.5 cups water per half cup oats.", "Cook 4-5 minutes till creamy.", "Serve hot."] },
  { id: "egg_bhurji_toast", name: "Egg Bhurji with Toast", hindi: "अंडा भुर्जी", roles: ["breakfast"], cuisine: "north_indian", minutes: 15, tags: ["quick", "high_protein", "kid_friendly"],
    ing: "egg:2, onion:30, tomato:30, green_chilli:2, turmeric:1, butter:8, bread:2, coriander:4, salt:2",
    steps: ["Saute onion and chilli in butter.", "Add tomato, turmeric, salt; cook soft.", "Break in eggs, scramble on medium heat.", "Finish with coriander.", "Serve with toasted bread."] },
  { id: "bread_omelette", name: "Masala Omelette and Bread", hindi: "ऑमलेट", roles: ["breakfast"], cuisine: "modern", minutes: 12, tags: ["quick", "high_protein", "packable"],
    ing: "egg:2, onion:20, green_chilli:1, coriander:3, bread:2, butter:8, salt:1",
    steps: ["Beat eggs with onion, chilli, coriander and salt.", "Pour onto a buttered pan.", "Cook, flip once.", "Toast bread.", "Serve together."] },
  { id: "veg_seviyan", name: "Vegetable Seviyan", hindi: "सेवइयां", roles: ["breakfast"], cuisine: "south_indian", minutes: 20, tags: ["quick", "kid_friendly", "packable"],
    ing: "vermicelli:60, onion:20, carrot:20, peas:15, mustard_seeds:1, curry_leaves:2, peanuts:8?, oil:8, salt:2, lemon:0.2",
    steps: ["Roast vermicelli golden.", "Temper mustard, curry leaves, peanuts.", "Add vegetables and saute.", "Add water and salt, boil, add vermicelli.", "Cook covered till water absorbs; finish with lemon."] },
  { id: "ven_pongal", name: "Ven Pongal", hindi: "पोंगल", roles: ["breakfast"], cuisine: "south_indian", minutes: 25, tags: ["light", "kid_friendly"], jain: true,
    ing: "rice:40, moong_dal:25, ghee:12, jeera:1, ginger:3, curry_leaves:2, cashew:6?, salt:2",
    steps: ["Pressure cook rice and moong dal with 4x water, 4 whistles.", "Mash lightly, add salt.", "Heat ghee, add pepper, jeera, ginger, curry leaves, cashews.", "Pour tempering over pongal and mix.", "Serve with chutney or sambar."] },
  { id: "ragi_dosa", name: "Instant Ragi Dosa", hindi: "रागी डोसा", roles: ["breakfast"], cuisine: "south_indian", minutes: 20, tags: ["diabetic_ok", "quick"],
    ing: "ragi_flour:50, suji:15, curd:20, onion:20?, green_chilli:2, curry_leaves:1, oil:8, salt:2",
    steps: ["Mix ragi, suji, curd and water to a thin batter; rest 10 minutes.", "Add chopped onion, chilli, curry leaves, salt.", "Pour from a height onto a hot tawa like rava dosa.", "Drizzle oil, cook till crisp.", "Serve with chutney."] },

  { id: "khaman_dhokla", name: "Khaman Dhokla", hindi: "ढोकला", roles: ["breakfast"], cuisine: "gujarati", minutes: 25, tags: ["light", "kid_friendly", "packable", "high_protein"], jain: true,
    ing: "besan:60, curd:20, lemon:0.2, sugar:5, mustard_seeds:1, green_chilli:1, curry_leaves:1, oil:6, salt:2, coriander:3?",
    steps: ["Whisk besan, curd, sugar, salt and water into a thick batter; rest 10 minutes.", "Add eno or soda with lemon juice just before steaming.", "Steam in a greased plate 12-15 minutes till a knife comes out clean.", "Temper mustard seeds, chilli and curry leaves; add a little sugar-water.", "Pour over, cut into squares, garnish with coriander."] },
  { id: "pesarattu", name: "Pesarattu (green moong dosa)", hindi: "पेसरट्टू", roles: ["breakfast"], cuisine: "south_indian", minutes: 25, tags: ["high_protein", "diabetic_ok"], prepAhead: "Soak whole moong overnight", jain: true,
    ing: "moong_whole:60, rice:10, ginger:3, green_chilli:2, onion:20?, jeera:1, oil:8, salt:2, coconut:20",
    steps: ["Grind soaked moong with a little rice, ginger, chilli, jeera and salt to a smooth batter.", "Spread thin on a hot tawa, sprinkle chopped onion.", "Drizzle oil, cook till crisp and golden.", "Fold and serve with coconut chutney."] },
  { id: "veg_uttapam", name: "Vegetable Uttapam", hindi: "उत्तपम", roles: ["breakfast"], cuisine: "south_indian", minutes: 20, tags: ["kid_friendly", "fermented", "quick"], jain: true,
    ing: "idli_batter:180, onion:25?, tomato:20, capsicum:15, green_chilli:1, coriander:3, oil:8, salt:1, coconut:20",
    steps: ["Spread a thick round of batter on the tawa.", "Press chopped onion, tomato, capsicum and coriander on top.", "Drizzle oil around, cover and cook 2 minutes.", "Flip and cook the topping side briefly.", "Serve with coconut chutney."] },
  { id: "veg_dalia", name: "Vegetable Dalia", hindi: "दलिया", roles: ["breakfast"], cuisine: "north_indian", minutes: 25, tags: ["diabetic_ok", "light", "comfort"], jain: true,
    ing: "dalia:50, moong_dal:10, carrot:20?, peas:20, tomato:20, jeera:1, ghee:5, turmeric:1, salt:2",
    steps: ["Roast dalia in ghee till fragrant.", "Add jeera, vegetables and turmeric.", "Add moong dal, salt and 3x water.", "Pressure cook 3 whistles.", "Serve hot — soft and light."] },
  { id: "sprouts_chaat", name: "Moong Sprouts Chaat", hindi: "स्प्राउट्स चाट", roles: ["breakfast"], cuisine: "north_indian", minutes: 10, tags: ["quick", "high_protein", "diabetic_ok", "light"], prepAhead: "Soak whole moong 2 nights ahead and keep wrapped to sprout",
    ing: "moong_whole:50, onion:20, tomato:25, cucumber:25, lemon:0.25, green_chilli:1, coriander:3, salt:1",
    steps: ["Steam the sprouts 5 minutes so they're easy to digest.", "Toss with chopped onion, tomato, cucumber.", "Add lemon, chilli, salt and chaat masala.", "Finish with coriander."] },
  { id: "keema_paratha_sehri", name: "Keema Paratha with Curd", hindi: "कीमा पराठा", roles: ["breakfast"], cuisine: "hyderabadi", minutes: 40, tags: ["high_protein", "heavy", "weekend"],
    ing: "atta:90, mutton_keema:70, onion:25, ginger:3, garlic:3, green_chilli:1, garam_masala:1, ghee:10, curd:80, salt:2",
    steps: ["Cook keema with onion, ginger-garlic and spices till completely dry.", "Knead a soft dough.", "Stuff the cooled keema, seal and roll gently.", "Roast with ghee on tawa.", "Serve with curd — very filling for sehri."] },
  // ================= STAPLES =================
  { id: "roti", name: "Phulka Roti", hindi: "रोटी", roles: ["staple"], cuisine: "north_indian", minutes: 15, tags: ["packable", "diabetic_ok"], jain: true,
    ing: "atta:90, ghee:3?, salt:0.5",
    steps: ["Knead soft dough with water and pinch of salt; rest 15 minutes.", "Roll thin rounds.", "Cook on tawa, then puff on open flame.", "Apply ghee if the family likes."] },
  { id: "rice", name: "Steamed Rice", hindi: "चावल", roles: ["staple"], cuisine: "pan_indian", minutes: 15, tags: [], jain: true,
    ing: "rice:75",
    steps: ["Wash rice twice.", "Cook with 2 to 2.5 times water — 3 whistles in cooker or open pot till soft."] },
  { id: "jeera_rice", name: "Jeera Rice", hindi: "जीरा राइस", roles: ["staple"], cuisine: "north_indian", minutes: 20, tags: ["kid_friendly"], jain: true,
    ing: "basmati:75, jeera:2, ghee:6, salt:1",
    steps: ["Soak basmati 20 minutes.", "Heat ghee, crackle jeera.", "Add rice, salt and 1.75x water.", "Cook covered on low till done; fluff with fork."] },
  { id: "jowar_roti", name: "Jowar Bhakri", hindi: "ज्वार भाकरी", roles: ["staple"], cuisine: "maharashtrian", minutes: 25, tags: ["diabetic_ok"], jain: true,
    ing: "jowar_flour:80, salt:0.5",
    steps: ["Knead jowar flour with hot water a little at a time.", "Pat into rounds by hand.", "Cook on tawa, sprinkle water on top, flip.", "Finish on open flame."] },

  // ================= MAINS (dal / curry) =================
  { id: "dal_tadka", name: "Dal Tadka", hindi: "दाल तड़का", roles: ["main"], cuisine: "north_indian", minutes: 30, tags: ["kid_friendly", "high_protein"], jain: true,
    ing: "toor_dal:40, tomato:30, onion:20, garlic:4, jeera:1, turmeric:1, red_chilli:1, ghee:6, hing:0.2, coriander:4, salt:3",
    steps: ["Wash and pressure cook toor dal with turmeric and salt, 3-4 whistles.", "Heat ghee, add jeera, hing, garlic.", "Add onion, then tomato and red chilli; cook till soft.", "Pour tadka into dal, simmer 3 minutes.", "Garnish with coriander."] },
  { id: "moong_dal", name: "Yellow Moong Dal", hindi: "मूंग दाल", roles: ["main"], cuisine: "north_indian", minutes: 25, tags: ["light", "kid_friendly", "diabetic_ok"], jain: true,
    ing: "moong_dal:40, tomato:25, jeera:1, turmeric:1, ghee:5, hing:0.2, ginger:3, coriander:4, salt:3",
    steps: ["Pressure cook moong dal with turmeric and salt, 2 whistles.", "Temper jeera, hing and ginger in ghee.", "Add tomato and cook till soft.", "Mix into dal, simmer 2 minutes.", "Finish with coriander."] },
  { id: "masoor_dal", name: "Masoor Dal", hindi: "मसूर दाल", roles: ["main"], cuisine: "bengali", minutes: 25, tags: ["light", "high_protein"], jain: true,
    ing: "masoor_dal:40, onion:20, tomato:20, garlic:3, turmeric:1, jeera:1, green_chilli:1, oil:6, salt:3, coriander:3",
    steps: ["Boil masoor dal with turmeric and salt till soft (no soaking needed).", "Temper jeera, garlic and chilli in oil.", "Add onion and tomato, cook down.", "Combine with dal and simmer.", "Garnish with coriander."] },
  { id: "dal_makhani", name: "Dal Makhani", hindi: "दाल मखनी", roles: ["main"], cuisine: "north_indian", minutes: 60, tags: ["heavy", "weekend", "high_protein"], prepAhead: "Soak whole urad and rajma overnight",
    ing: "urad_whole:45, rajma:10, tomato:50, onion:20, ginger:4, garlic:4, butter:10, cream:15, red_chilli:1, garam_masala:1, kasuri_methi:0.5, salt:3",
    steps: ["Pressure cook soaked urad and rajma 6-7 whistles till very soft.", "Saute ginger-garlic and onion in butter, add tomato puree, cook till oil separates.", "Add dal, red chilli, salt; simmer on low 25-30 minutes, stirring.", "Add cream, garam masala and crushed kasuri methi.", "Serve with a dot of butter."] },
  { id: "rajma", name: "Rajma Masala", hindi: "राजमा", roles: ["main"], cuisine: "north_indian", minutes: 45, tags: ["high_protein", "kid_friendly"], prepAhead: "Soak rajma overnight",
    ing: "rajma:55, onion:50, tomato:60, ginger:4, garlic:4, jeera:1, red_chilli:1, garam_masala:1, oil:10, salt:3, coriander:4",
    steps: ["Pressure cook soaked rajma with salt, 6-7 whistles till soft.", "Temper jeera, add onion and cook golden.", "Add ginger-garlic, tomato puree and spices; cook till oil separates.", "Add rajma with its water, mash a few beans, simmer 15 minutes.", "Garnish with coriander; best with rice."] },
  { id: "chole", name: "Punjabi Chole", hindi: "छोले", roles: ["main"], cuisine: "north_indian", minutes: 45, tags: ["high_protein", "heavy"], prepAhead: "Soak chole overnight",
    ing: "chole:55, onion:50, tomato:60, ginger:4, garlic:4, chole_masala:4, oil:10, salt:3, coriander:4",
    steps: ["Pressure cook soaked chole 5-6 whistles.", "Cook onion golden, add ginger-garlic.", "Add tomato and chole masala, cook till oil separates.", "Add chole with water, simmer 15 minutes, mash a few.", "Garnish with coriander and onion rings."] },
  { id: "kadhi", name: "Punjabi Kadhi", hindi: "कढ़ी", roles: ["main"], cuisine: "north_indian", minutes: 40, tags: ["kid_friendly"], jain: true,
    ing: "curd:100, besan:25, onion:20?, turmeric:1, jeera:1, hing:0.2, red_chilli:1, oil:8, salt:3, curry_leaves:1",
    steps: ["Whisk curd, besan, turmeric, salt and water without lumps.", "Temper jeera, hing, curry leaves in oil.", "Pour the mix, keep stirring till it boils (else it splits).", "Simmer on low 20-25 minutes.", "Finish with red chilli tadka."] },
  { id: "sambar", name: "Vegetable Sambar", hindi: "सांभर", roles: ["main"], cuisine: "south_indian", minutes: 35, tags: ["kid_friendly", "high_protein"],
    ing: "toor_dal:35, drumstick:0.3, pumpkin:30, tomato:30, onion:25, sambar_powder:6, tamarind:4, mustard_seeds:1, curry_leaves:2, hing:0.2, oil:6, salt:3",
    steps: ["Pressure cook toor dal soft.", "Boil vegetables in tamarind water with sambar powder, salt.", "Add mashed dal and simmer 8 minutes.", "Temper mustard seeds, curry leaves and hing.", "Pour over sambar."] },
  { id: "rasam", name: "Tomato Rasam", hindi: "रसम", roles: ["main"], cuisine: "south_indian", minutes: 20, tags: ["light", "quick"], jain: true,
    ing: "tomato:60, toor_dal:10, tamarind:3, garlic:3?, jeera:1, mustard_seeds:1, curry_leaves:1, hing:0.2, coriander:4, ghee:4, salt:2",
    steps: ["Boil tomato with tamarind water, salt and crushed pepper-jeera.", "Add a little cooked dal water.", "Bring to a froth — don't boil hard.", "Temper mustard, curry leaves, garlic, hing in ghee.", "Finish with coriander."] },
  { id: "palak_paneer", name: "Palak Paneer", hindi: "पालक पनीर", roles: ["main"], cuisine: "north_indian", minutes: 35, tags: ["high_protein", "diabetic_ok"], jain: false,
    ing: "spinach:150, paneer:70, onion:30, tomato:20, garlic:4, ginger:3, green_chilli:1, cream:10?, oil:8, garam_masala:0.5, salt:2",
    steps: ["Blanch spinach 2 minutes, plunge in cold water, puree.", "Saute onion, ginger-garlic, chilli; add tomato.", "Add spinach puree and salt, simmer 5 minutes.", "Add paneer cubes and garam masala, simmer 3 minutes.", "Finish with a little cream."] },
  { id: "paneer_butter_masala", name: "Paneer Butter Masala", hindi: "पनीर बटर मसाला", roles: ["main"], cuisine: "north_indian", minutes: 40, tags: ["heavy", "weekend", "kid_friendly", "high_protein"],
    ing: "paneer:80, tomato:80, onion:30, cashew:8?, butter:12, cream:15, ginger:3, garlic:3, red_chilli:1, kasuri_methi:0.5, sugar:2, salt:2",
    steps: ["Cook tomato, onion, cashews, ginger-garlic till soft; blend smooth.", "Heat butter, add the puree and red chilli; cook till glossy.", "Add salt, a pinch of sugar and water to adjust.", "Add paneer and simmer 3 minutes.", "Finish with cream and kasuri methi."] },
  { id: "matar_paneer", name: "Matar Paneer", hindi: "मटर पनीर", roles: ["main"], cuisine: "north_indian", minutes: 35, tags: ["high_protein", "kid_friendly"],
    ing: "paneer:60, peas:50, onion:40, tomato:50, ginger:3, garlic:3, red_chilli:1, garam_masala:0.5, oil:10, salt:2",
    steps: ["Make onion-tomato masala with ginger-garlic.", "Add spices and cook till oil separates.", "Add peas and water, cook till peas are soft.", "Add paneer and simmer 3 minutes.", "Finish with garam masala."] },
  { id: "chana_dal_lauki", name: "Chana Dal Lauki", hindi: "चना दाल लौकी", roles: ["main"], cuisine: "north_indian", minutes: 35, tags: ["diabetic_ok", "light"], jain: true,
    ing: "chana_dal:35, bottle_gourd:100, tomato:25, turmeric:1, jeera:1, hing:0.2, ginger:3, ghee:5, salt:3",
    steps: ["Soak chana dal 30 minutes.", "Pressure cook dal with lauki cubes, turmeric and salt, 3 whistles.", "Temper jeera, hing, ginger in ghee, add tomato.", "Combine and simmer 5 minutes.", "Garnish with coriander."] },
  { id: "kala_chana", name: "Kala Chana Curry", hindi: "काला चना", roles: ["main"], cuisine: "north_indian", minutes: 40, tags: ["high_protein", "diabetic_ok"], prepAhead: "Soak kala chana overnight",
    ing: "kala_chana:50, onion:40, tomato:50, ginger:3, garlic:3, dhaniya_powder:2, red_chilli:1, oil:8, salt:3",
    steps: ["Pressure cook soaked kala chana 6 whistles.", "Make onion-tomato masala with spices.", "Add chana and some cooking water.", "Simmer 10 minutes, mash a little to thicken.", "Garnish and serve."] },
  { id: "soya_curry", name: "Soya Chunks Curry", hindi: "सोया करी", roles: ["main"], cuisine: "north_indian", minutes: 30, tags: ["high_protein", "diabetic_ok"],
    ing: "soya_chunks:30, onion:40, tomato:50, ginger:3, garlic:3, red_chilli:1, garam_masala:0.5, oil:8, salt:2",
    steps: ["Boil soya chunks 5 minutes, squeeze out water.", "Cook onion-tomato masala with spices.", "Add soya and water, simmer 10 minutes.", "Adjust salt.", "Finish with garam masala."] },
  { id: "mushroom_matar", name: "Mushroom Matar", hindi: "मशरूम मटर", roles: ["main"], cuisine: "north_indian", minutes: 30, tags: ["diabetic_ok"],
    ing: "mushroom:90, peas:40, onion:35, tomato:45, ginger:3, garlic:3, red_chilli:1, oil:8, salt:2",
    steps: ["Wipe and slice mushrooms.", "Cook onion-tomato masala.", "Add mushrooms and peas, cook uncovered 8 minutes.", "Add little water and simmer.", "Garnish with coriander."] },
  { id: "egg_curry", name: "Anda Curry", hindi: "अंडा करी", roles: ["main"], cuisine: "north_indian", minutes: 30, tags: ["high_protein", "kid_friendly"],
    ing: "egg:2, onion:50, tomato:50, ginger:3, garlic:3, red_chilli:1, garam_masala:0.5, oil:10, salt:2, coriander:3",
    steps: ["Hard boil eggs 10 minutes, peel, make slits.", "Lightly fry eggs with turmeric and chilli.", "Cook onion-tomato masala till oil separates.", "Add water and eggs, simmer 8 minutes.", "Garnish with coriander."] },
  { id: "chicken_curry", name: "Home-style Chicken Curry", hindi: "चिकन करी", roles: ["main"], cuisine: "north_indian", minutes: 50, tags: ["high_protein", "spicy"],
    ing: "chicken:200, onion:70, tomato:50, curd:30, ginger:5, garlic:5, red_chilli:2, garam_masala:1, dhaniya_powder:2, oil:12, salt:3, coriander:4",
    steps: ["Marinate chicken with curd, salt, turmeric, red chilli 30 minutes.", "Cook onions till deep brown, add ginger-garlic.", "Add tomato and dry masalas; cook till oil separates.", "Add chicken, sear 5 minutes, then cover and cook 20-25 minutes.", "Finish with garam masala and coriander."] },
  { id: "butter_chicken", name: "Butter Chicken", hindi: "बटर चिकन", roles: ["main"], cuisine: "north_indian", minutes: 55, tags: ["heavy", "weekend", "high_protein", "kid_friendly"], prepAhead: "Marinate chicken in curd and spices the night before or 2 hours ahead",
    ing: "chicken_boneless:180, curd:40, tomato:90, butter:15, cream:20, cashew:8?, ginger:4, garlic:4, red_chilli:1, garam_masala:1, kasuri_methi:0.5, salt:3",
    steps: ["Marinate chicken in curd and spices; pan-roast till charred.", "Simmer tomato, cashew, ginger-garlic; blend smooth.", "Cook puree in butter till glossy.", "Add chicken and simmer 10 minutes.", "Finish with cream, kasuri methi and butter."] },
  { id: "fish_curry", name: "Fish Curry", hindi: "मछली करी", roles: ["main"], cuisine: "bengali", minutes: 35, tags: ["high_protein", "spicy", "light"],
    ing: "fish:150, mustard_oil:12, onion:30, tomato:30, turmeric:1, red_chilli:1, panch_phoron:1, green_chilli:2, salt:3",
    steps: ["Rub fish with turmeric and salt; shallow fry lightly in mustard oil.", "Temper panch phoron in the same oil.", "Add onion, tomato and spices; cook down.", "Add water, bring to boil and slide in fish.", "Simmer gently 8 minutes — don't stir hard."] },
  { id: "mutton_curry", name: "Mutton Curry", hindi: "मटन करी", roles: ["main"], cuisine: "north_indian", minutes: 90, tags: ["heavy", "weekend", "high_protein", "spicy"], prepAhead: "Marinate mutton overnight",
    ing: "mutton:180, onion:80, tomato:50, curd:40, ginger:6, garlic:6, red_chilli:2, garam_masala:1.5, oil:15, salt:3",
    steps: ["Marinate mutton in curd, ginger-garlic and spices.", "Brown onions deeply.", "Add mutton and bhuno on high 10 minutes.", "Add tomato and water; pressure cook 6-8 whistles.", "Simmer open to thicken; finish with garam masala."] },
  { id: "prawn_masala", name: "Prawn Masala", hindi: "झींगा मसाला", roles: ["main"], cuisine: "coastal", minutes: 30, tags: ["high_protein", "spicy"],
    ing: "prawns:120, onion:40, tomato:40, coconut:20, ginger:3, garlic:4, red_chilli:2, curry_leaves:2, oil:10, salt:2",
    steps: ["Marinate prawns with turmeric, chilli, salt.", "Saute onion, ginger-garlic, curry leaves.", "Add tomato and coconut, cook down.", "Add prawns and cook just 4-5 minutes.", "Don't overcook — they turn rubbery."] },

  { id: "gujarati_dal", name: "Gujarati Khatti Meethi Dal", hindi: "गुजराती दाल", roles: ["main"], cuisine: "gujarati", minutes: 30, tags: ["kid_friendly", "light"], jain: true,
    ing: "toor_dal:40, tomato:25, jaggery:6, tamarind:2, peanuts:5?, curry_leaves:1, mustard_seeds:1, hing:0.2, green_chilli:1, ghee:5, salt:3",
    steps: ["Pressure cook toor dal 4 whistles and whisk smooth.", "Add water, tomato, jaggery, tamarind and salt; boil 10 minutes.", "Temper mustard seeds, hing, curry leaves, chilli and peanuts in ghee.", "Pour tempering and simmer 5 more minutes.", "It should taste gently sweet-sour."] },
  { id: "gujarati_kadhi", name: "Gujarati Kadhi", hindi: "गुजराती कढ़ी", roles: ["main"], cuisine: "gujarati", minutes: 25, tags: ["light", "kid_friendly"], jain: true,
    ing: "curd:110, besan:20, jaggery:5, ginger:2, green_chilli:1, curry_leaves:1, jeera:1, ghee:5, salt:2",
    steps: ["Whisk curd, besan and water smooth; add jaggery, ginger-chilli paste and salt.", "Bring to a boil on medium, stirring constantly so it doesn't split.", "Simmer 10 minutes.", "Temper jeera, curry leaves in ghee and pour in.", "Thin and slightly sweet — serve with rice or khichdi."] },
  { id: "mag_nu_shaak", name: "Mag nu Shaak (whole moong)", hindi: "मूंग की सब्ज़ी", roles: ["main"], cuisine: "gujarati", minutes: 35, tags: ["high_protein", "diabetic_ok"], prepAhead: "Soak whole moong 6 hours or overnight", jain: true,
    ing: "moong_whole:45, tomato:30, ginger:2, green_chilli:1, jeera:1, hing:0.2, turmeric:1, dhaniya_powder:1, oil:6, salt:3, lemon:0.1",
    steps: ["Pressure cook soaked moong 3 whistles — it should hold shape.", "Temper jeera and hing, add tomato and ginger-chilli.", "Add spices, then moong with a little water.", "Simmer 8 minutes till thick.", "Finish with lemon."] },
  // ================= SIDES (sabzi / accompaniments) =================
  { id: "dal_palak", name: "Dal Palak", hindi: "दाल पालक", roles: ["main"], cuisine: "north_indian", minutes: 30, tags: ["diabetic_ok", "high_protein", "light"], jain: true,
    ing: "toor_dal:35, spinach:70, tomato:25, garlic:3, jeera:1, turmeric:1, ghee:5, hing:0.2, salt:3",
    steps: ["Pressure cook toor dal with turmeric.", "Temper jeera, hing and garlic in ghee.", "Add tomato, then chopped palak; cook 3 minutes.", "Add dal, simmer 5 minutes.", "Adjust salt and serve."] },
  { id: "cholar_dal", name: "Cholar Dal", hindi: "छोलार डाल", roles: ["main"], cuisine: "bengali", minutes: 35, tags: ["kid_friendly", "comfort"], jain: true,
    ing: "chana_dal:40, coconut:15, ginger:2, jeera:1, sugar:3, ghee:6, turmeric:1, salt:3",
    steps: ["Pressure cook chana dal with turmeric till soft but whole.", "Fry coconut bits in ghee till golden.", "Temper jeera and ginger; add dal, sugar and salt.", "Simmer 5 minutes.", "Finish with ghee — gently sweet, Bengali style."] },
  { id: "pithla", name: "Pithla", hindi: "पिठला", roles: ["main"], cuisine: "maharashtrian", minutes: 20, tags: ["quick", "high_protein", "comfort"],
    ing: "besan:35, onion:30, garlic:4, green_chilli:2, mustard_seeds:1, curry_leaves:1, turmeric:1, oil:8, salt:2, coriander:3",
    steps: ["Whisk besan with water, no lumps.", "Temper mustard, curry leaves, garlic and chilli; add onion.", "Pour in besan, stir continuously on low.", "Cook till it thickens and leaves the sides.", "Serve hot with bhakri."] },
  { id: "kootu", name: "Lauki Kootu", hindi: "कूटू", roles: ["main"], cuisine: "south_indian", minutes: 30, tags: ["light", "diabetic_ok", "comfort"], jain: true,
    ing: "moong_dal:25, bottle_gourd:90, coconut:15, jeera:1, mustard_seeds:1, curry_leaves:1, green_chilli:1, oil:5, salt:2",
    steps: ["Cook moong dal till soft.", "Cook lauki cubes in a little water with salt.", "Grind coconut, jeera and chilli; add with dal to lauki.", "Simmer 5 minutes.", "Temper mustard and curry leaves."] },
  { id: "keema_matar", name: "Keema Matar", hindi: "कीमा मटर", roles: ["main"], cuisine: "north_indian", minutes: 40, tags: ["high_protein", "spicy"],
    ing: "mutton_keema:130, peas:40, onion:50, tomato:40, ginger:4, garlic:4, red_chilli:1, garam_masala:1, oil:10, salt:2",
    steps: ["Brown onions well.", "Add ginger-garlic and keema; bhuno till it changes colour.", "Add tomato and spices; cook till oil separates.", "Add peas and a little water; cook covered 15 minutes.", "Finish with garam masala and coriander."] },
  { id: "aloo_gobhi", name: "Aloo Gobhi", hindi: "आलू गोभी", roles: ["side"], cuisine: "north_indian", minutes: 30, tags: ["packable", "kid_friendly"],
    ing: "cauliflower:120, potato:60, onion:20?, tomato:20, ginger:3, turmeric:1, jeera:1, dhaniya_powder:1, oil:10, salt:2, coriander:3",
    steps: ["Cut gobhi florets and potato cubes.", "Temper jeera, add ginger and onion.", "Add potato, cook 5 minutes, then gobhi and spices.", "Cover and cook on low without water, stirring gently.", "Finish with coriander."] },
  { id: "bhindi_masala", name: "Bhindi Masala", hindi: "भिंडी मसाला", roles: ["side"], cuisine: "north_indian", minutes: 25, tags: ["packable", "diabetic_ok", "kid_friendly"], jain: true,
    ing: "okra:130, onion:30, tomato:20, turmeric:1, dhaniya_powder:1, red_chilli:1, oil:10, salt:2",
    steps: ["Wash and fully dry bhindi before cutting (else it gets slimy).", "Fry bhindi on high heat without cover till non-sticky.", "Add onion and cook golden.", "Add tomato and spices; mix with bhindi.", "Cook 3 minutes and serve."] },
  { id: "beans_poriyal", name: "Beans Poriyal", hindi: "बीन्स पोरियल", roles: ["side"], cuisine: "south_indian", minutes: 20, tags: ["quick", "diabetic_ok", "packable", "light"], jain: true,
    ing: "beans:120, coconut:15, mustard_seeds:1, curry_leaves:1, urad_whole:2?, green_chilli:1, oil:6, salt:2",
    steps: ["Chop beans finely.", "Temper mustard, urad dal, curry leaves and chilli.", "Add beans and salt, sprinkle water, cook covered.", "When tender, add grated coconut.", "Mix and serve."] },
  { id: "cabbage_poriyal", name: "Cabbage Poriyal", hindi: "पत्ता गोभी", roles: ["side"], cuisine: "south_indian", minutes: 20, tags: ["quick", "diabetic_ok", "light"], jain: true,
    ing: "cabbage:130, peas:15, coconut:12, mustard_seeds:1, curry_leaves:1, green_chilli:1, oil:6, salt:2",
    steps: ["Shred cabbage finely.", "Temper mustard, curry leaves, chilli.", "Add cabbage and peas, cook on medium without cover.", "Add salt and coconut.", "Cook 2 more minutes."] },
  { id: "jeera_aloo", name: "Jeera Aloo", hindi: "जीरा आलू", roles: ["side"], cuisine: "north_indian", minutes: 20, tags: ["quick", "kid_friendly", "packable"],
    ing: "potato:130, jeera:2, green_chilli:1, turmeric:1, oil:8, salt:2, coriander:3",
    steps: ["Boil potatoes, peel and cube.", "Crackle jeera in oil, add chilli.", "Add potatoes, turmeric, salt.", "Toss on high till edges crisp.", "Finish with coriander."] },
  { id: "lauki_sabzi", name: "Lauki Sabzi", hindi: "लौकी सब्ज़ी", roles: ["side"], cuisine: "north_indian", minutes: 20, tags: ["light", "diabetic_ok"], jain: true,
    ing: "bottle_gourd:160, tomato:25, jeera:1, turmeric:1, green_chilli:1, oil:6, salt:2, coriander:3",
    steps: ["Peel and cube lauki.", "Temper jeera and chilli.", "Add tomato, then lauki, turmeric, salt.", "Cover and cook in its own water till soft.", "Finish with coriander."] },
  { id: "baingan_bharta", name: "Baingan Bharta", hindi: "बैंगन भर्ता", roles: ["side"], cuisine: "north_indian", minutes: 35, tags: ["diabetic_ok", "spicy"],
    ing: "brinjal:150, onion:40, tomato:40, garlic:4, green_chilli:2, oil:8, salt:2, coriander:4",
    steps: ["Roast brinjal directly on flame till skin chars and inside is soft.", "Peel and mash.", "Saute garlic, chilli, onion, then tomato.", "Add mashed brinjal and salt, cook 5 minutes.", "Finish with coriander."] },
  { id: "mix_veg", name: "Mix Veg", hindi: "मिक्स वेज", roles: ["side"], cuisine: "north_indian", minutes: 30, tags: ["kid_friendly", "packable"],
    ing: "carrot:40, beans:40, peas:30, cauliflower:40, potato:30, onion:25, tomato:30, oil:8, garam_masala:0.5, salt:2",
    steps: ["Chop all vegetables evenly.", "Make onion-tomato masala.", "Add hard veg first (carrot, potato), then beans, gobhi, peas.", "Cover and cook till just done.", "Finish with garam masala."] },
  { id: "methi_aloo", name: "Aloo Methi", hindi: "आलू मेथी", roles: ["side"], cuisine: "north_indian", minutes: 25, tags: ["packable"],
    ing: "methi:80, potato:90, garlic:3, jeera:1, red_chilli:1, oil:8, salt:2",
    steps: ["Clean and chop methi.", "Temper jeera and garlic.", "Add potato cubes and cook till half done.", "Add methi and salt; cook till methi wilts and potato is soft.", "Serve."] },
  { id: "kaddu_sabzi", name: "Khatta Meetha Kaddu", hindi: "कद्दू की सब्ज़ी", roles: ["side"], cuisine: "north_indian", minutes: 25, tags: ["kid_friendly"], jain: true,
    ing: "pumpkin:150, jaggery:5, jeera:1, hing:0.2, red_chilli:1, oil:6, salt:2, coriander:3",
    steps: ["Cube pumpkin with skin.", "Temper jeera and hing.", "Add pumpkin, salt and spices; cover and cook.", "Mash lightly, add jaggery and amchur.", "Garnish with coriander."] },
  { id: "carrot_peas", name: "Gajar Matar", hindi: "गाजर मटर", roles: ["side"], cuisine: "north_indian", minutes: 20, tags: ["quick", "kid_friendly", "packable"],
    ing: "carrot:90, peas:60, jeera:1, ginger:3, turmeric:1, oil:6, salt:2",
    steps: ["Dice carrots small.", "Temper jeera and ginger.", "Add carrot and peas with turmeric and salt.", "Cover and cook 8-10 minutes.", "Serve."] },
  { id: "kachumber_raita", name: "Cucumber Raita", hindi: "खीरा रायता", roles: ["side"], cuisine: "north_indian", minutes: 10, tags: ["quick", "light", "kid_friendly"], jain: true,
    ing: "curd:100, cucumber:50, jeera:0.5, salt:1, coriander:2",
    steps: ["Whisk curd smooth.", "Grate cucumber and squeeze lightly.", "Mix with roasted jeera powder and salt.", "Chill and serve."] },

  { id: "begun_bhaja", name: "Begun Bhaja", hindi: "बेगुन भाजा", roles: ["side"], cuisine: "bengali", minutes: 20, tags: ["quick"],
    ing: "brinjal:100, mustard_oil:12, turmeric:1, red_chilli:1, salt:2",
    steps: ["Slice brinjal into round slices.", "Rub with turmeric, chilli and salt; rest 10 minutes.", "Shallow fry in mustard oil till soft inside and crisp outside.", "Serve hot with dal-rice."] },
  { id: "avial", name: "Avial", hindi: "अवियल", roles: ["side"], cuisine: "south_indian", minutes: 30, tags: ["light"],
    ing: "carrot:30, beans:30, raw_banana:0.3, pumpkin:30, drumstick:0.2, coconut:25, curd:30, curry_leaves:2, green_chilli:1, oil:6, salt:2",
    steps: ["Cut vegetables into finger-length pieces.", "Cook with turmeric, salt and little water till just tender.", "Grind coconut, chilli and jeera coarsely; add.", "Add whisked curd off the heat.", "Finish with raw coconut oil and curry leaves."] },
  // ================= COMPLETE (one-pot meals) =================
  { id: "veg_pulao", name: "Veg Pulao with Raita", hindi: "वेज पुलाव", roles: ["complete"], cuisine: "north_indian", minutes: 35, tags: ["kid_friendly", "packable"],
    ing: "basmati:80, carrot:30, beans:30, peas:30, onion:30, ghee:8, jeera:1, garam_masala:0.5, curd:80, cucumber:30, salt:3",
    steps: ["Soak basmati 20 minutes.", "Temper whole spices and jeera in ghee, add sliced onion.", "Add vegetables and saute 3 minutes.", "Add rice, salt and 1.75x water; cook covered till done.", "Serve with cucumber raita."] },
  { id: "veg_khichdi", name: "Moong Dal Khichdi with Kadhi-style Curd", hindi: "खिचड़ी", roles: ["complete"], cuisine: "north_indian", minutes: 30, tags: ["light", "kid_friendly", "comfort"], jain: true,
    ing: "rice:50, moong_dal:30, peas:20, carrot:20?, ghee:8, jeera:1, hing:0.2, turmeric:1, curd:60, salt:3",
    steps: ["Wash rice and moong dal together.", "Temper jeera and hing in ghee, add vegetables.", "Add rice, dal, turmeric, salt and 4x water.", "Pressure cook 4 whistles.", "Serve with ghee on top and curd."] },
  { id: "veg_biryani", name: "Veg Dum Biryani", hindi: "वेज बिरयानी", roles: ["complete"], cuisine: "hyderabadi", minutes: 60, tags: ["heavy", "weekend"],
    ing: "basmati:90, carrot:30, beans:30, peas:25, potato:40, onion:60, curd:60, mint:4, biryani_masala:3, ghee:12, salt:3, cucumber:30",
    steps: ["Par-boil soaked basmati with whole spices till 70% done.", "Cook vegetables with curd, fried onion and biryani masala.", "Layer rice over vegetables, top with mint, fried onion and ghee.", "Seal and cook on dum (very low) 20 minutes.", "Serve with raita."] },
  { id: "chicken_biryani", name: "Chicken Biryani", hindi: "चिकन बिरयानी", roles: ["complete"], cuisine: "hyderabadi", minutes: 75, tags: ["heavy", "weekend", "high_protein", "kid_friendly"], prepAhead: "Marinate chicken 2+ hours (or overnight)",
    ing: "basmati:90, chicken:180, curd:60, onion:70, mint:5, biryani_masala:4, ginger:4, garlic:4, ghee:12, lemon:0.25, salt:3, cucumber:30",
    steps: ["Marinate chicken in curd, ginger-garlic, biryani masala, salt, lemon.", "Fry onions crisp golden.", "Par-boil rice 70% with whole spices.", "Layer chicken, rice, onions, mint; drizzle ghee.", "Seal and dum on low 25 minutes. Serve with raita."] },
  { id: "curd_rice", name: "Curd Rice", hindi: "दही चावल", roles: ["complete"], cuisine: "south_indian", minutes: 15, tags: ["light", "quick", "kid_friendly", "packable"], jain: true,
    ing: "rice:60, curd:120, mustard_seeds:1, curry_leaves:1, ginger:2, green_chilli:1?, milk:30, salt:2",
    steps: ["Cook rice soft and mash slightly; cool.", "Mix curd, a little milk and salt.", "Temper mustard, curry leaves, ginger, chilli.", "Pour tempering over curd rice.", "Serve with pickle."] },
  { id: "bisi_bele_bath", name: "Bisi Bele Bath", hindi: "बिसी बेले भात", roles: ["complete"], cuisine: "south_indian", minutes: 45, tags: ["comfort", "kid_friendly"],
    ing: "rice:50, toor_dal:30, carrot:30, beans:25, peas:20, tamarind:4, sambar_powder:6, ghee:8, cashew:5?, curry_leaves:2, salt:3",
    steps: ["Pressure cook rice and dal together very soft.", "Boil vegetables in tamarind water with bisi bele powder.", "Combine everything, adjust consistency — it should be flowing.", "Temper ghee, cashews, curry leaves.", "Serve hot with papad."] },
  { id: "lemon_rice", name: "Lemon Rice", hindi: "लेमन राइस", roles: ["complete"], cuisine: "south_indian", minutes: 20, tags: ["quick", "packable"], jain: true,
    ing: "rice:70, lemon:0.5, peanuts:12?, chana_dal:5, mustard_seeds:1, curry_leaves:2, turmeric:1, green_chilli:1, oil:8, salt:2, cucumber:40",
    steps: ["Cook rice and spread to cool so grains separate.", "Temper mustard, chana dal, peanuts, curry leaves, chilli, turmeric.", "Mix into rice with salt.", "Squeeze lemon off the heat.", "Serve with cucumber slices."] },
  { id: "pav_bhaji", name: "Pav Bhaji", hindi: "पाव भाजी", roles: ["complete"], cuisine: "west_indian", minutes: 45, tags: ["heavy", "weekend", "kid_friendly"],
    ing: "potato:100, cauliflower:40, peas:30, capsicum:30, tomato:70, onion:40, butter:20, bread:3, lemon:0.25, salt:3, red_chilli:1",
    steps: ["Pressure cook potato, gobhi and peas till very soft.", "Cook onion, capsicum and tomato in butter with pav bhaji masala.", "Add boiled veg and mash everything together; simmer.", "Toast buns in butter.", "Serve with onion and lemon."] },
  { id: "rajma_chawal", name: "Rajma Chawal", hindi: "राजमा चावल", roles: ["complete"], cuisine: "north_indian", minutes: 50, tags: ["high_protein", "comfort", "kid_friendly"], prepAhead: "Soak rajma overnight",
    ing: "rajma:55, rice:70, onion:50, tomato:60, ginger:4, garlic:4, jeera:1, red_chilli:1, garam_masala:1, oil:10, salt:3, coriander:4",
    steps: ["Pressure cook soaked rajma 6-7 whistles.", "Make onion-tomato-ginger-garlic masala.", "Add rajma, simmer 15 minutes, mash a few beans.", "Cook rice separately.", "Serve rajma over rice."] },
  { id: "paneer_roll", name: "Paneer Kathi Roll", hindi: "पनीर रोल", roles: ["complete"], cuisine: "modern", minutes: 30, tags: ["packable", "kid_friendly", "high_protein"],
    ing: "atta:70, paneer:70, onion:30, capsicum:30, curd:15, red_chilli:1, oil:8, salt:2",
    steps: ["Toss paneer cubes with curd, chilli and salt.", "Saute paneer with onion and capsicum on high.", "Make rotis.", "Roll filling inside roti, add onion and chutney.", "Wrap in foil for tiffin."] },
  { id: "egg_fried_rice", name: "Egg Fried Rice", hindi: "एग फ्राइड राइस", roles: ["complete"], cuisine: "indo_chinese", minutes: 20, tags: ["quick", "kid_friendly", "packable", "high_protein"],
    ing: "rice:75, egg:1.5, carrot:25, beans:20, capsicum:20, onion:20, garlic:3, oil:10, salt:2",
    steps: ["Use cold leftover rice ideally.", "Scramble eggs, keep aside.", "Stir fry garlic and vegetables on high.", "Add rice, salt, soy sauce; toss.", "Fold in eggs and serve."] },

  { id: "puliyogare", name: "Puliyogare (tamarind rice)", hindi: "पुलियोगरे", roles: ["complete"], cuisine: "south_indian", minutes: 25, tags: ["packable"], jain: true,
    ing: "rice:75, tamarind:7, jaggery:3, peanuts:10?, chana_dal:5, mustard_seeds:1, curry_leaves:2, sesame:2?, oil:10, salt:2, curd:60",
    steps: ["Cook rice and spread to cool.", "Simmer thick tamarind extract with jaggery, turmeric and salt.", "Temper mustard, chana dal, peanuts, curry leaves, red chilli.", "Mix tamarind paste and tempering into rice.", "Serve with curd — keeps well for tiffin."] },
  { id: "misal_pav", name: "Misal Pav", hindi: "मिसल पाव", roles: ["complete"], cuisine: "maharashtrian", minutes: 45, tags: ["weekend", "spicy", "high_protein"], prepAhead: "Soak whole moong (or matki) overnight",
    ing: "moong_whole:50, onion:40, tomato:40, coconut:15, garlic:3, red_chilli:2, oil:10, bread:2, lemon:0.25, salt:2",
    steps: ["Pressure cook sprouted moong 2 whistles.", "Roast onion and coconut, grind with garlic and spices.", "Make a thin spicy rassa with the masala and water.", "Add moong and simmer.", "Serve topped with onion, lemon, with pav."] },
  { id: "mutton_biryani", name: "Mutton Biryani", hindi: "मटन बिरयानी", roles: ["complete"], cuisine: "hyderabadi", minutes: 100, tags: ["heavy", "weekend", "high_protein"], prepAhead: "Marinate mutton overnight in curd and spices",
    ing: "basmati:90, mutton:170, curd:70, onion:70, mint:5, biryani_masala:4, ginger:5, garlic:5, ghee:14, lemon:0.25, salt:3, cucumber:30",
    steps: ["Marinate mutton in curd, ginger-garlic, biryani masala and fried onions.", "Pressure cook the mutton 4 whistles till tender.", "Par-boil rice 70% with whole spices.", "Layer mutton, rice, mint, fried onion and ghee.", "Dum on very low heat 25 minutes. Serve with raita."] },
  // ================= FASTING (vrat) =================
  { id: "sabudana_khichdi", name: "Sabudana Khichdi", hindi: "साबूदाना खिचड़ी", roles: ["fasting", "breakfast"], cuisine: "west_indian", minutes: 25, tags: ["fasting"], prepAhead: "Soak sabudana overnight (or 5-6 hours)",
    ing: "sabudana:80, potato:60, peanuts:20?, green_chilli:2, jeera:1, ghee:10, rock_salt:2, lemon:0.2, coriander:3",
    steps: ["Drain soaked sabudana well — pearls should be separate.", "Heat ghee, add jeera and chilli, then boiled potato cubes.", "Add sabudana, sendha namak and crushed peanuts.", "Toss on low till pearls turn translucent.", "Finish with lemon and coriander. Use only sendha namak — no regular salt for vrat."] },
  { id: "kuttu_paratha", name: "Kuttu Paratha with Aloo", hindi: "कुट्टू पराठा", roles: ["fasting"], cuisine: "north_indian", minutes: 30, tags: ["fasting"],
    ing: "kuttu_atta:70, potato:100, ghee:12, rock_salt:2, curd:60, green_chilli:1",
    steps: ["Mash boiled potato into kuttu atta with sendha namak — it binds the dough.", "Pat parathas between sheets (dough is fragile).", "Cook on tawa with ghee.", "Make simple vrat aloo with jeera and sendha namak.", "Serve with curd."] },
  { id: "samak_khichdi", name: "Samak Rice Khichdi", hindi: "समक खिचड़ी", roles: ["fasting"], cuisine: "north_indian", minutes: 25, tags: ["fasting", "light"],
    ing: "samak_rice:60, potato:50, peanuts:10?, ghee:8, jeera:1, green_chilli:1, rock_salt:2, curd:60",
    steps: ["Wash samak rice.", "Temper jeera and chilli in ghee, add potato.", "Add samak rice, sendha namak, 3x water.", "Cook covered till soft.", "Serve with curd."] },
  { id: "samak_lauki", name: "Samak Rice with Lauki & Curd (Jain-friendly)", hindi: "समक लौकी", roles: ["fasting"], cuisine: "gujarati", minutes: 25, tags: ["fasting", "light"],
    ing: "samak_rice:60, bottle_gourd:80, ghee:8, jeera:1, green_chilli:1, rock_salt:2, curd:80",
    steps: ["Wash samak rice.", "Temper jeera and chilli in ghee, add lauki cubes.", "Add samak rice, sendha namak and 3x water.", "Cook covered till soft.", "Serve with curd. No potato — safe for Jain vrat."] },
  { id: "kela_kuttu", name: "Raw Banana Sabzi with Kuttu Roti", hindi: "कच्चे केले की सब्ज़ी", roles: ["fasting"], cuisine: "north_indian", minutes: 30, tags: ["fasting"],
    ing: "raw_banana:1, kuttu_atta:60, ghee:10, jeera:1, rock_salt:2, curd:60, green_chilli:1",
    steps: ["Peel and cube raw banana; keep in water so it doesn't blacken.", "Temper jeera and chilli in ghee, add banana, sendha namak; cook covered till soft.", "Knead kuttu atta with warm water and a little mashed banana to bind.", "Pat small rotis and cook on tawa with ghee.", "Serve with curd."] },
  { id: "shakarkandi_chaat", name: "Shakarkandi Chaat & Fruit", hindi: "शकरकंदी चाट", roles: ["fasting"], cuisine: "north_indian", minutes: 20, tags: ["fasting", "light", "quick"],
    ing: "sweet_potato:150, lemon:0.25, rock_salt:1, banana:1, apple:0.5",
    steps: ["Boil or roast sweet potato till soft.", "Peel and cube.", "Toss with lemon and sendha namak.", "Serve with sliced fruit."] },
];


function parseIng(s: string) {
  return s.split(",").map((p) => {
    const [idRaw, qtyRaw] = p.trim().split(":");
    const optional = qtyRaw.endsWith("?");
    return { id: idRaw.trim(), qty: parseFloat(qtyRaw.replace("?", "")), ...(optional ? { optional } : {}) };
  });
}

export const DISHES: Record<string, Dish> = Object.fromEntries(
  raw.map((d) => [
    d.id,
    {
      id: d.id,
      name: d.name,
      hindi: d.hindi,
      roles: d.roles,
      cuisine: d.cuisine,
      minutes: d.minutes,
      tags: d.tags ?? [],
      prepAhead: d.prepAhead,
      jainAdaptable: d.jain,
      ingredients: parseIng(d.ing),
      steps: d.steps,
    } satisfies Dish,
  ]),
);

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

const DISH_ALIASES: Record<string, string> = {
  "dal": "dal_tadka", "daal": "dal_tadka", "dal fry": "dal_tadka", "arhar dal": "dal_tadka", "toor dal": "dal_tadka",
  "chana masala": "chole", "chhole": "chole", "chole bhature": "chole", "rajma rice": "rajma_chawal",
  "omelette": "bread_omelette", "omelet": "bread_omelette", "anda bhurji": "egg_bhurji_toast", "egg bhurji": "egg_bhurji_toast",
  "dosa": "masala_dosa", "idli": "idli_sambar", "khichdi": "veg_khichdi", "pulao": "veg_pulao", "biryani": "veg_biryani",
  "paneer makhani": "paneer_butter_masala", "shahi paneer": "paneer_butter_masala", "murgh makhani": "butter_chicken",
  "chicken": "chicken_curry", "mutton": "mutton_curry", "fish": "fish_curry", "machher jhol": "fish_curry",
  "thepla": "methi_thepla", "matki usal": "misal_pav", "tamarind rice": "puliyogare", "pulihora": "puliyogare", "keema": "keema_matar", "dalia": "veg_dalia", "daliya": "veg_dalia", "sprouts": "sprouts_chaat", "uttapam": "veg_uttapam", "chilla": "besan_chilla", "cheela": "besan_chilla", "oats": "veg_oats", "upma": "upma",
  "chapati": "roti", "phulka": "roti", "plain rice": "rice", "chawal": "rice", "bhakri": "jowar_roti",
  "bhindi": "bhindi_masala", "aloo gobi": "aloo_gobhi", "baingan": "baingan_bharta", "raita": "kachumber_raita",
  "sabudana": "sabudana_khichdi", "seviyan": "veg_seviyan", "vermicelli upma": "veg_seviyan", "pongal": "ven_pongal",
  "kathi roll": "paneer_roll", "fried rice": "egg_fried_rice", "palak": "palak_paneer", "lauki chana dal": "chana_dal_lauki",
};

/** Fuzzy-resolve a spoken dish name to a catalogue (or custom) dish id. */
export function resolveDish(text: string, custom: Dish[] = []): string | null {
  const all = [...Object.values(DISHES), ...custom];
  const t = norm(text);
  if (!t) return null;
  const byId = all.find((d) => d.id === t.replace(/ /g, "_"));
  if (byId) return byId.id;
  const exact = all.find((d) => norm(d.name) === t);
  if (exact) return exact.id;
  if (DISH_ALIASES[t]) return DISH_ALIASES[t];
  // token overlap score
  const tt = new Set(t.split(" ").filter((w) => w.length > 2 && !["with", "and", "the", "masala"].includes(w)));
  let best: { id: string; score: number } | null = null;
  for (const d of all) {
    const words = new Set(norm(d.name + " " + d.id.replace(/_/g, " ")).split(" "));
    let score = 0;
    tt.forEach((w) => { if (words.has(w)) score += 1; });
    const ratio = tt.size ? score / tt.size : 0;
    if (ratio >= 0.5 && (!best || score > best.score)) best = { id: d.id, score };
  }
  if (best) return best.id;
  for (const [alias, id] of Object.entries(DISH_ALIASES)) if (t.includes(alias)) return id;
  return null;
}

export function getDish(id: string, custom: Dish[] = []): Dish | undefined {
  return DISHES[id] ?? custom.find((d) => d.id === id);
}
