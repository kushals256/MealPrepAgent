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

## How to run (zip or GitHub)

### What you need

| Requirement | Notes |
|---|---|
| **Node.js 20+** | Tested on Node 22/25. Check with `node -v`. Install from [nodejs.org](https://nodejs.org/) if needed. |
| **npm** | Comes with Node (`npm -v`). |
| **Chrome or Edge** | Voice input uses the browser Web Speech API (best with Indian English / Indic locales). Safari/Firefox are weaker for STT. |
| **NVIDIA NIM API key (free)** | For Meera’s conversation. Get one at [build.nvidia.com](https://build.nvidia.com) → open any model → **Get API Key**. Looks like `nvapi-...`. |

Mic and key are optional for a partial demo: without a key, the **plan engine, week grid, grocery list and order buttons still work**; without a mic, use the text box on every screen.

### Option A — from the submission zip

1. Unzip the archive (you should get a `MealPrepAgent/` folder).
2. Open a terminal in that folder:

```bash
cd MealPrepAgent
```

3. Install dependencies, add your key, start the app:

```bash
npm install

cp .env.example .env.local
# Open .env.local in an editor and set:
# NVIDIA_API_KEY=nvapi-your-key-here

npm run dev
```

4. Open **http://localhost:3000** in Chrome or Edge.

Stop the server anytime with `Ctrl+C` in the terminal.

### Option B — from GitHub

Repo: **https://github.com/kushals256/MealPrepAgent**

```bash
git clone https://github.com/kushals256/MealPrepAgent.git
cd MealPrepAgent

npm install

cp .env.example .env.local
# Edit .env.local → NVIDIA_API_KEY=nvapi-your-key-here

npm run dev
```

Then open **http://localhost:3000**.

### `.env.local` (do this once)

`.env.example` is the safe template (included in the zip and on GitHub). Copy it to `.env.local` — that file is gitignored and must never be committed or shared.

```bash
# .env.local
NVIDIA_API_KEY=nvapi-...
```

Optional (advanced):

```bash
# LLM_MODELS=nvidia/nemotron-3-super-120b-a12b,nvidia/nemotron-3-ultra-550b-a55b,nvidia/nemotron-3.5-lightning-30b-a3b
# LLM_BASE_URL=https://integrate.api.nvidia.com/v1
```

After changing `.env.local`, restart `npm run dev`.

### Using the app

| URL | What it is |
|---|---|
| **http://localhost:3000** | Household / family screen. Tap the orb (or press **Space**) and talk, or type below. Try **"Try a messy joint family"** or pick a demo household from the header. |
| **http://localhost:3000/cook** | Cook screen — open on a phone or second tab. Day chips pretend it’s any weekday. Meera speaks in the cook’s language. |

Both screens share live state. A shortage the cook reports shows up on the family’s **Kitchen feed** within about 2 seconds.

**Quick path without voice:** load a demo household → use buttons / text → open Week plan and Groceries → try Instamart (simulated) or WhatsApp (real share link).

### If something fails

- **`NVIDIA_API_KEY is not set` / banner about missing key** — create `.env.local` from `.env.example`, paste the key, restart `npm run dev`.
- **Mic blocked** — allow microphone for `localhost` in the browser, or use the text box.
- **Port 3000 in use** — stop the other process, or run `npx next dev -p 3001` and open that port.
- **Native module / SWC errors on macOS** — often quarantine on binaries after unzip; from the project folder run:  
  `xattr -cr node_modules` then `npm run dev` again.  
  If it still fails: `rm -rf node_modules && npm install`.
- **First `npm install` is slow** — normal; needs network once.

### Evals (optional)

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
