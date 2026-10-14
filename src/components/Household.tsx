"use client";

import type { ViewModel } from "@/lib/view";
import { Badge } from "./PlanGrid";

const AGE: Record<string, string> = { toddler: "👶", child: "🧒", teen: "🧑", adult: "🧑‍🦱", elderly: "👵" };

export function FamilyPanel({ vm }: { vm: ViewModel }) {
  const hh = vm.household;
  if (!hh.members.length) return <p className="text-muted text-sm">Nobody yet — tell Meera who eats at home.</p>;
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        {hh.members.map((m) => (
          <div key={m.name} className="rounded-xl border border-line bg-paper p-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{AGE[m.ageGroup]}</span>
              <div>
                <div className="font-semibold">{m.name}</div>
                <div className="text-xs text-muted">{m.ageGroup} · {m.jain ? "Jain " : ""}{m.diet}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {m.allergies.map((a) => <Badge key={a} tone="mirch">allergy: {a.replace("_", " ")}</Badge>)}
              {m.conditions.map((c) => <Badge key={c} tone="haldi">{c.replace("_", " ")}</Badge>)}
              {m.vegDays.length > 0 && <Badge>veg on {m.vegDays.join(", ")}</Badge>}
              {m.fastDays.length > 0 && <Badge>fasts {m.fastDays.join(", ")}</Badge>}
              {m.tiffinDays.length > 0 && <Badge>tiffin {m.tiffinDays.length === 5 ? "weekdays" : m.tiffinDays.join(", ")}</Badge>}
              {m.spice !== "medium" && <Badge>spice {m.spice}</Badge>}
              {m.noOnionGarlic && <Badge tone="haldi">no onion-garlic</Badge>}
              {(m.avoidMeats ?? []).length > 0 && <Badge>no {m.avoidMeats!.join(", ")}</Badge>}
              {(m.rozaDays ?? []).length > 0 && <Badge tone="patta">roza {m.rozaDays!.length === 7 ? "all week" : m.rozaDays!.join(", ")}</Badge>}
              {(m.unwellDays ?? []).length > 0 && <Badge tone="mirch">unwell {m.unwellDays!.join(", ")}</Badge>}
              {m.sunsetDinner && <Badge>dinner before sunset</Badge>}
              {m.away.map((a, i) => <Badge key={i}>away {a.day}{a.meals.length ? ` ${a.meals.join("+")}` : ""}</Badge>)}
            </div>
            {(m.likes.length > 0 || m.dislikes.length > 0) && (
              <div className="text-xs text-muted mt-2">
                {m.likes.length > 0 && <div>❤️ {m.likes.join(", ")}</div>}
                {m.dislikes.length > 0 && <div>✗ {m.dislikes.join(", ")}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-line bg-paper p-3 text-sm space-y-1">
        <div><span className="font-semibold">Cook:</span> {hh.cook.name} · speaks {vm.cookLang.name} · makes {hh.cook.meals.join(", ")} · off {hh.cook.offDays.join(", ") || "never"}</div>
        {hh.guests.length > 0 && <div><span className="font-semibold">Guests:</span> {hh.guests.map((g) => `${g.day} ${g.meal} +${g.count}`).join(", ")}</div>}
        {hh.eatOut.length > 0 && <div><span className="font-semibold">Eating out:</span> {hh.eatOut.map((e) => `${e.day} ${e.meal}`).join(", ")}</div>}
        {(hh.bannedDishes.length > 0 || hh.bannedIngredients.length > 0) && <div><span className="font-semibold">Avoiding:</span> {[...hh.bannedDishes, ...hh.bannedIngredients].join(", ").replace(/_/g, " ")}</div>}
        <div><span className="font-semibold">Non-veg:</span> {hh.noNonvegAtHome ? "never cooked at home" : `${hh.nonvegPerWeek} meals/week`}{hh.meatRule ? ` · ${hh.meatRule} only` : ""}{hh.cuisines.length ? ` · leaning ${hh.cuisines.join(", ").replace(/_/g, " ")}` : ""}</div>
        {(hh.sattvikDays ?? []).length > 0 && <div><span className="font-semibold">No onion-garlic in the kitchen:</span> {hh.sattvikDays!.length === 7 ? "all week" : hh.sattvikDays!.join(", ")}</div>}
        {hh.limits && Object.keys(hh.limits).length > 0 && <div><span className="font-semibold">Limits:</span> {Object.entries(hh.limits).map(([k, v]) => `${k.replace(/_/g, " ")} ≤ ${v}×/week`).join(", ")}</div>}
        {hh.budgetPerWeek && <div><span className="font-semibold">Budget:</span> ₹{hh.budgetPerWeek.toLocaleString("en-IN")}/week</div>}
      </div>
    </div>
  );
}

const KIND_ICON: Record<string, string> = { shortage: "🧺", change: "🔁", leftover: "🥡", warning: "⚠️", done: "✅", order: "🛒", info: "💬" };

export function ActivityFeed({ vm, compact }: { vm: ViewModel; compact?: boolean }) {
  if (!vm.activity.length) return <p className="text-sm text-muted">Nothing from the kitchen yet. When the cook reports a shortage, swaps a dish or finishes a meal, it shows up here live.</p>;
  return (
    <ul className="space-y-2">
      {vm.activity.slice(0, compact ? 4 : 40).map((a, i) => (
        <li key={i} className="flex gap-2 text-sm rounded-lg bg-paper border border-line px-3 py-2">
          <span>{KIND_ICON[a.kind] ?? "•"}</span>
          <span className="flex-1">{a.text}</span>
          <span className="text-[11px] text-muted whitespace-nowrap">{new Date(a.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
        </li>
      ))}
    </ul>
  );
}
