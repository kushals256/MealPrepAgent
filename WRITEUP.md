# Meera: write-up

## How far we took the problem

"Plan meals and make a grocery list" is the toy version of this problem. A real Indian household does not pick seven dinners from a menu. One kitchen has to feed people who disagree about almost everything — faith, spice, protein goals, allergies, fasting calendars, school tiffin that has to survive until 1 pm, a cook with forty-five minutes and a day off, a budget that does not stretch to paneer every night, and greens that rot if you buy them on Monday for Friday. The shared dinner is still *one* dinner: a full vegetarian thali for everyone, plus a chicken curry only for the people who eat it, a vrat plate for the person fasting, Dadi's portion pulled out before the chilli goes in.

We treated that as the product, not a footnote. The result is not a chatbot that "suggests recipes." It is a **constraint-first planning system** with a voice character on top — built so the hard rules are enforced in code, the soft preferences are scored deliberately, and Meera never gets to invent a week that would poison a child or break a fast.

That depth shows up everywhere: ~89 Indian home dishes with per-serving recipes, ~94 ingredients with pack sizes and shelf life, nine demo households that encode real conflict patterns, a multilingual cook mode, sentence-streaming voice, and evals that assert *state*, not vibes.

## The planning engine — how deep it goes

**The LLM talks; a deterministic engine plans.** Meera never writes the week. She turns speech into *facts* ("Ramzan from Monday", "paneer only twice", "Kabir away Wednesday dinner") and *pins* ("rajma chawal Wednesday"). A seeded planner then fills up to 21 meal slots under hard constraints. That split is the whole bet: conversation stays warm and flexible; safety, reproducibility and grocery maths stay testable.

### Factors the engine actually considers

We did not stop at "veg / non-veg." The constraint and scoring layers jointly reason over a wide stack of real-home factors:

| Layer | What we model |
|---|---|
| **Diet & faith** | veg / eggetarian / nonveg / vegan; per-person veg days; Jain (no root veg, mushroom, brinjal; optional sunset dinner); no-onion-garlic / sattvik days for a person or the whole kitchen; Ramzan roza (no lunch; sehri & iftar notes); avoided meats (chicken-but-not-mutton, no seafood…); halal / jhatka; "no meat cooked in this kitchen even if someone eats it outside" |
| **Health & allergy** | peanut, tree nut, dairy, gluten, sesame, egg, soy, shellfish, fish; diabetes, hypertension, high-protein, lactose intolerance, weight loss, pregnancy, toddler spice caps |
| **Calendar & attendance** | who is away which meals; guests; eat-out nights; cook off-days; unwell / light-meal days; weekday school **tiffin** (packable dishes that travel) |
| **Kitchen reality** | cook language & weekday time budget; prep-ahead (soak rajma the night before); seasonality; variety and protein rotation; spice levels; kid-friendly tags |
| **Money & shopping** | weekly budget search with progressive tightening; portions by age (toddler ≈ 0.35× adult, gym teen ≈ 1.25×); guests & tiffins counted; people away skipped; real pack sizes; **Thursday fresh top-up** for short-shelf greens/fish/chicken; pantry staples assumed unless reported short |

Hard conflicts refuse the dish. *Adaptable* conflicts become cook notes — drop an optional garnish house-wide, or pull a Jain/sattvik portion before onion goes in — because that is how Indian kitchens actually cope.

### Planning mechanics we invested in

- **Seeded search** with scoring, not greedy one-shot picks — so plans are reproducible for evals and still varied across seeds.
- **Non-veg slot spreading** across the week as *add-ons*, so vegetarians still get a complete meal on those nights.
- **Per-person dishes** when the table splits (fasting plate, light plate, non-veg for two).
- **Minimal repair, not regeneration.** After any change, a validator finds the broken slots and only those are re-planned. Adding Sunday guests never reshuffles Monday; pins survive "fresh ideas"; undo works.
- **Budget as consumed cost**, not shopping cart theatre — a 500g dal pack outlives the week, so we judge the food the week actually uses, then re-plan with tighter targets until it fits or tell you honestly it cannot.
- **Explainability.** `explainPlan` produces the "why this week" line humans need: non-veg days, fasts, allergies, tiffin logic, cook-off, seasonal greens, prep reminders.
- **Honesty by construction.** After each turn the engine computes an exact plan diff, and Meera is told "these are the ONLY changes that happened" before she speaks again — so she cannot claim a swap she never made.

This is how far we took "meal planning": past suggestions, into a **stateful household operating system** for one shared kitchen.

## Real-life household scenarios — depth, not demos

The nine scenario households are load-bearing design documents, not marketing cards. Each encodes a different shape of Indian domestic conflict:

- Messy joint family (mixed diets, veg Tue/Thu, peanut allergy, diabetes + BP, tiffins, fasts, guests, eat-out, cook off)
- Jain Gujarati home with a toddler and Saturday fasts
- Gluten-free gym bachelor with weekend travel
- Multi-allergy Tamil household hosting six guests
- Vegan + Bengali fish-eater under one roof
- Ramzan in Hyderabad with full-week roza and halal meat
- Navratri sattvik week (whole-kitchen no onion-garlic + fasts)
- Sikh jhatka home with a sick teen and a no-onion-garlic elder
- Tight-budget vegetarian kitchen where a teen eats non-veg *outside*

The catalogue matches that ambition: familiar Indian home food only, fasting dishes (sabudana, kuttu, samak…), packable tiffin tags, diabetic-ok and kid-friendly flags, `jainAdaptable` dishes, Hindi names for the cook, prep-ahead metadata. Beef and pork never appear. Meera never infers religion from a name — she asks neutrally.

Cook mode is the other half of the same depth: morning briefing, step-by-step in katori/chammach measures, timers, rescue tips, substitutions, dish swaps that still respect hard rules, and shortages that flow back to the family's Kitchen feed in ~2 seconds. The cook hears Meera in **their** language (Hindi, Tamil, Kannada, Telugu, Marathi, Bengali, Gujarati, Malayalam, or English), including a script guard so Tamil/Malayalam voices are not fed Romanised text.

## Character, voice, and sounding real

**Meera is a character, not an assistant persona sticker.** She is written as a late-thirties woman who grew up in a Lucknow joint family, lived in Pune and Bengaluru, and has opinions ("rajma without soaking? not in my kitchen"). She reacts before she answers, uses people's names, mirrors Hinglish when the family does, drops to one tired line when you are exhausted, and mediates fights ("chicken twice, plus Sunday biryani") instead of lecturing.

That personality is enforced in the prompt *and* in the runtime:

- Short spoken turns (usually under ~35 words), no markdown, no call-centre openers
- At most one question per turn; sensible defaults over interrogation
- Follow-up loop only when she must see the engine result before claiming anything
- Empty-action repair so "I'll generate the plan" without actions cannot strand the UI
- With the cook she becomes a respectful colleague — one step at a time, never a wall of recipe text

**Voice that feels live, not bolted on.** Model output streams as JSON; each finished sentence of `say` goes to Edge neural TTS while the model is still writing actions. Median time to first word is about **0.8s**. A short "hmm, ek second…" covers slow replies. STT waits ~1.1–1.8s of silence because people pause mid-thought. Space or the orb barges in. Hands-free mode lets the cook talk with wet hands. Family voice is expressive Indian English (`en-IN-NeerjaExpressive`); cook voices are language-matched neural voices across nine Indic locales. Speech-to-text mishears ("karma chawal") are handled as rajma chawal with a light confirm — because that is how real calls work.

The goal was simple and hard: **sound like someone who has stood in this kitchen before**, not like a meal-kit FAQ.

## Top-tier user experience — by design

We designed for two screens that share one live household:

1. **Family** — talk, watch the week grid fill, pin dishes, see "why this plan," groceries with Thursday top-up, Instamart (simulated, real search links) or WhatsApp (real share link), kitchen feed from the cook.
2. **Cook** — phone-friendly briefing, day chips, active steps, timers that beep in their language, shortages and swaps that update the family without a meeting.

No mic? Type. No LLM key? Buttons still drive the engine, plan grid and grocery list. Demo households load a full conflict world in one tap. Violations surface as badges, not silent failures. The UX bet is the same as the engine bet: **one shared plan, visible adaptations, live sync** — so the product feels like a kitchen, not a dashboard of cards.

## Performance — kept fast on purpose

Voice dies if the first word takes half a minute. We measured free NIM endpoints, kept the models that answer in ~1s with good Hinglish, and built a fallback chain (Nemotron-3-Super → Ultra → Lightning). A model that has not produced a token within **9s** is abandoned. Sticky skip avoids thrashing a dying endpoint. Reasoning/"thinking" is turned off for voice turns. Sentence-level TTS queues audio while the stream is still open. State polls are cheap (`?since=version`). The agent route streams NDJSON so the browser can speak before the turn finishes.

Evals keep that bar honest:

- **Engine suite** (no key): 9 households × 15 seeds + edit scenarios — hard violations, fasting coverage, allergy shopping bans, pack maths, roza/Navratri/budget specials, pin survival, undo. **39/39 checks; zero hard violations across 135 generated weeks** in the last full run.
- **Agent suite** (live LLM): multi-turn household + cook cases asserting *resulting state*, voice length/script rules, and an LLM-judge persona rubric. **Latest: 25/26 cases, 97/98 checks, judge 4.8/5, first word p50 ~0.8s / p90 ~3.3s.**

## Key decisions (short)

1. LLM records facts and pins; engine fills the week.
2. One shared meal + per-person adaptations, with adaptable cook notes.
3. India-specific rules as first-class data, never name-based religion guesses.
4. Minimal repair over full regeneration.
5. Practical grocery economics (portions, packs, Thursday top-up, consumed-cost budget).
6. Honesty via exact plan diffs fed back into speech.
7. A real character on both sides of the kitchen door.
8. Live voice: stream → sentence TTS → barge-in → hands-free.
9. Models and timeouts chosen by measurement, not brand names.

## Left out on purpose

- **Real Instamart ordering** — no public API; simulated honestly with real search links. WhatsApp is a real link.
- **Auth, multi-household DB** — a JSON file keeps the demo crisp.
- **Nutrition counting** — "dals and millets for Dadi's sugar" beats calorie theatre for a home cook.
- **Server-side STT / full-duplex barge-in** — browser STT is strong on Indian accents; half-duplex stops Meera hearing herself.

## What I'd do next

1. Phone-call and WhatsApp-voice channels for cooks without smartphones (Indic STT such as AI4Bharat / Sarvam).
2. Learn from uneaten food, cook swaps and re-orders — feed scoring weights per family.
3. A rolling pantry decremented by orders and cook usage.
4. Stronger Tamil/Telugu cook models plus a festival calendar (Navratri, Ramzan, Karva Chauth, Onam).
5. CI regression with simulated multi-turn callers.

---

We went deep on the unglamorous middle of Indian home cooking — constraints, adaptations, groceries, cook language, and a voice that does not break character — because that is where meal planning either becomes useful or stays a demo.
