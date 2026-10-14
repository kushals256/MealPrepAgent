# Rasoi: Meera, the household meal-planning voice agent

Meera is a voice agent for Indian home kitchens. She does two jobs:

1. **Plans with the household.** You talk to her like a person, in English or Hinglish. She learns who eats what, plans the week, builds a consolidated grocery list, and closes with **Instamart** (simulated) or **WhatsApp** (a real share link).
2. **Runs the kitchen with the cook.** She gives a morning briefing, step-by-step recipes scaled to today's headcount, timers, rescue tips, substitutions and dish swaps. She speaks **in the cook's language** (Hindi, Tamil, Kannada, Telugu, Marathi, Bengali, Gujarati, Malayalam or English), and every deviation flows back to the family live.

This is not a recipe chatbot. It is a **constraint-first planning engine** with a character on top — built for the depth of a real Indian household, where one dinner has to work for conflicting diets, faith rules, allergies, fasting calendars, school tiffin, a time-bound cook, and a grocery list that should not rot by Thursday.

---

## How far we took it

### Planning engine — depth over slogans

The LLM **never writes the week**. It records facts and pins dishes. A deterministic, seeded engine in `src/lib/engine` fills up to 21 meal slots across ~89 Indian home dishes, then validates, minimally repairs, budgets and shops. Factors we actually encode (not prompt-hope):

- **Diet & faith:** veg / eggetarian / nonveg / vegan, veg days, Jain, no-onion-garlic / sattvik (person or whole kitchen), Ramzan roza, avoided meats, halal / jhatka, no-meat-in-this-kitchen
- **Health:** nine allergen classes; diabetes, BP, high-protein, lactose intolerance, weight loss, pregnancy, toddler spice caps
- **Calendar:** away meals, guests, eat-out, cook off-days, unwell / light days, weekday **tiffin** (packable)
- **Kitchen:** cook time budget, prep-ahead, seasonality, variety / protein rotation, spice, kid-friendly tags
- **Money:** age-scaled portions, real pack sizes, Thursday fresh top-up, pantry staples, consumed-cost budget search

Hard rules refuse unsafe dishes. Adaptable conflicts become cook notes (pull the Jain portion before onion goes in). After edits, only broken slots are re-planned — Sunday guests never reshuffle Monday. Every turn gets an exact plan diff so Meera cannot claim changes that did not happen.

### Character & voice — built to sound real

Meera is written as a late-thirties woman from a Lucknow joint family: warm, dry-witted, opinionated about food, Hinglish when you are, short when you are tired, and never a call-centre script. With the cook she is a respectful colleague — one step, katori/chammach measures, rescue tips.

Voice is first-class, not a TTS afterthought:

- Streaming JSON → **sentence-level** Edge neural TTS while actions are still generating (~**0.8s** median to first word)
- Family: expressive `en-IN-NeerjaExpressive`; cook: nine Indic neural voices + script guard (so Tamil hears Tamil script)
- STT endpointing that waits for mid-thought pauses; Space/orb barge-in; hands-free for wet hands
- Latency fillers ("ek second…") when the model is slow; model fallback chain measured on free NIM

### Real households, top-tier UX

Nine demo scenarios encode real conflict shapes (joint family, Jain Gujarati, Ramzan Hyderabad, Navratri sattvik, multi-allergy Tamil, tight budget, and more). Two live screens share one state: family plan/grocery/kitchen feed, and a phone-ready cook mode. No mic → type. No LLM key → buttons still drive the engine. Shortages the cook reports appear on the family **Kitchen feed** in about two seconds.

### Performance we protect

First-token timeout (~9s) then next model; sticky skip of failing endpoints; thinking disabled for voice; NDJSON event stream; cheap state polls; engine + agent eval suites that assert **resulting state** (and persona), not just fluent text. Latest engine run: **zero hard violations across 135 generated weeks**. Agent suite: judge **~4.8/5**, first word p50 **~0.8s**.

See **[WRITEUP.md](WRITEUP.md)** for the full design story — how far we took the problem, the character work, realism, UX bets, and trade-offs.

---

## Run it

Requirements: Node 20+ (tested on 25), **Chrome or Edge** (for the browser's speech recognition), and a free NVIDIA NIM key.

```bash
npm install
cp .env.example .env.local       # then put your key in it:
# NVIDIA_API_KEY=nvapi-...        (build.nvidia.com → any model → "Get API Key")
npm run dev                      # http://localhost:3000
```

- **http://localhost:3000**: the landing page. Tap the orb and talk. Or use **"Try a messy joint family"**, or pick one of the 9 demo households from the header.
- **http://localhost:3000/cook**: the cook's screen, ideally opened on a phone or a second tab. Use the day chips to pretend it's any day of the week.
- Both screens share the same state and update live.

No mic? Every screen also has a text box. Without an LLM key the engine, plan grid, grocery list and ordering still work through the buttons.

### Evals

```bash
npm run eval:engine     # deterministic, no key: 9 households × 15 seeds + edit scenarios
npm run eval:agent      # live LLM conversations (household + cook) + LLM-judge persona scores
npm run eval:agent -- cook     # filter by case id
npm run plan:demo -- ramzan_hyderabad 7    # print one household's week, violations, prep, groceries
```

---

## What's real and what's simulated

| Piece | Status |
|---|---|
| Planning engine, constraint checks, grocery maths | **Real.** Deterministic TypeScript in `src/lib/engine` |
| Conversation LLM | **Real.** NVIDIA NIM `nemotron-3-super-120b` (fallback: `nemotron-3-ultra-550b`, `nemotron-3.5-lightning`) |
| Voice output | **Real.** Microsoft Edge neural voices (free): `en-IN-NeerjaExpressive` for the family, `hi-IN-Swara` / `ta-IN-Pallavi` / … for the cook |
| Voice input | **Real.** Browser Web Speech API (`en-IN`, `hi-IN`, `ta-IN`, …) |
| WhatsApp | **Real** `wa.me` deep link with the formatted list |
| Instamart | **Simulated.** No public ordering API. Pack sizes and prices are a mock catalogue, but each item links to the real Instamart search |
| Persistence | A JSON file (`data/state.json`). One household, no auth |

---

## How it works

```
 Browser (household)            Browser (cook, phone)
  mic → Web Speech (en-IN)       mic → Web Speech (hi-IN / ta-IN …)
        │                               │
        ▼                               ▼
   POST /api/agent  ── NDJSON stream of {say | state | finalize | timer} ──►  sentence-by-sentence
        │                                                                     GET /api/tts (Edge neural)
        ▼                                                                     → queued audio playback
  LLM (NIM, streaming JSON: {"say", "actions", "followup"})
        │  "say" is spoken as soon as each sentence completes
        ▼
  Action layer (validates, normalises, refuses unsafe changes)
        │
        ▼
  Planning engine ── planner · constraints · validator · repair · budget search · grocery
        │
        ▼
  ENGINE RESULT + exact plan diff ──► (optional) 2nd LLM pass: Meera reports only what really happened
```

Key files:

- `src/lib/engine/constraints.ts` — who can eat what; hard vs adaptable cook notes
- `src/lib/engine/planner.ts` — scored seeded search; non-veg spreading; seasonality; explainPlan
- `src/lib/engine/actions.ts` — only LLM write-path; alias-tolerant; minimal repair
- `src/lib/engine/budget.ts` / `grocery.ts` — consumed-cost budget; packs; Thursday top-up
- `src/lib/agent/prompts.ts` / `run.ts` / `script.ts` — Meera's two personas; speak→act→ground loop; Indic script guard
- `src/components/useVoiceAgent.ts` — STT endpointing, TTS queue, barge-in, hands-free
- `evals/` — engine + agent suites

Full narrative: **[WRITEUP.md](WRITEUP.md)**.
