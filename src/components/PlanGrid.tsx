"use client";

import { useEffect, useRef, useState } from "react";
import type { ViewModel } from "@/lib/view";
import { DAYS, type PlannedMeal } from "@/lib/types";

const MEAL_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" } as const;

function sig(pm: PlannedMeal) {
  return pm.status + pm.dishes.map((d) => d.dishId + (Array.isArray(d.for) ? d.for.join() : "")).join("|") + pm.guests;
}

export function PlanGrid({ vm, onToggleLock }: { vm: ViewModel; onToggleLock?: (day: string, meal: string, dishId: string) => void }) {
  const plan = vm.plan!;
  const prev = useRef<Map<string, string>>(new Map());
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const next = new Map(plan.meals.map((pm) => [`${pm.day}:${pm.meal}`, sig(pm)]));
    if (prev.current.size) {
      const c = new Set<string>();
      next.forEach((v, k) => { if (prev.current.get(k) !== v) c.add(k); });
      if (c.size && c.size < next.size) { setChanged(c); setTimeout(() => setChanged(new Set()), 2400); }
    }
    prev.current = next;
  }, [plan]);

  const meals = vm.household.meals;
  const hard = vm.violations.filter((v) => v.severity === "hard");
  const weekOf = new Date(plan.weekOf + "T00:00:00");

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div className="text-sm text-muted">Week of {weekOf.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {vm.household.members.length} people · cook {vm.household.cook.name}{vm.household.cook.offDays.length ? ` (off ${vm.household.cook.offDays.join(", ")})` : ""}</div>
        <div className={`text-xs font-semibold rounded-full px-2.5 py-1 ${hard.length ? "bg-mirch-soft text-mirch" : "bg-patta-soft text-patta"}`}>
          {hard.length ? `${hard.length} rule conflict${hard.length > 1 ? "s" : ""}` : "✓ All allergy & diet rules met"}
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-thin -mx-1 px-1">
        <div className="grid gap-2 min-w-[880px]" style={{ gridTemplateColumns: `86px repeat(7, minmax(0,1fr))` }}>
          <div />
          {DAYS.map((d, i) => {
            const date = new Date(weekOf); date.setDate(date.getDate() + i);
            return (
              <div key={d} className="text-center pb-1">
                <div className="font-display text-lg leading-none">{d}</div>
                <div className="text-[11px] text-muted">{date.getDate()}</div>
              </div>
            );
          })}
          {meals.map((m) => (
            <Row key={m} label={MEAL_LABEL[m]}>
              {DAYS.map((d) => {
                const pm = plan.meals.find((x) => x.day === d && x.meal === m);
                const key = `${d}:${m}`;
                if (!pm) return <div key={key} />;
                return <Cell key={key} pm={pm} vm={vm} flash={changed.has(key)} open={open === key} onOpen={() => setOpen(open === key ? null : key)} onToggleLock={onToggleLock} />;
              })}
            </Row>
          ))}
        </div>
      </div>
      {vm.why.length > 0 && (
        <div className="mt-4 rounded-xl border border-haldi/40 bg-haldi-soft/40 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-masala mb-1.5">Why this plan</div>
          <ul className="text-sm space-y-1 list-disc pl-4">{vm.why.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}
      {vm.prep.length > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-paper p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-masala mb-1.5">Night-before prep (Meera reminds the cook)</div>
          <ul className="text-sm space-y-1">
            {vm.prep.map((p, i) => <li key={i}><span className="font-semibold">{p.day} night:</span> {p.text}</li>)}
          </ul>
        </div>
      )}
      {vm.standing.length > 0 && (
        <div className="mt-3 rounded-xl border border-line bg-paper p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-masala mb-1.5">House rules the cook always gets</div>
          <ul className="text-sm space-y-1 list-disc pl-4">{vm.standing.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted pt-3">{label}</div>
      {children}
    </>
  );
}

function Cell({ pm, vm, flash, open, onOpen, onToggleLock }: { pm: PlannedMeal; vm: ViewModel; flash: boolean; open: boolean; onOpen: () => void; onToggleLock?: (d: string, m: string, id: string) => void }) {
  const done = vm.cook.doneMeals.includes(`${pm.day}:${pm.meal}`) || pm.status === "done";
  if (pm.status === "eat_out" || pm.status === "skipped") {
    return (
      <div className={`rounded-xl border border-dashed border-line p-2.5 text-xs text-muted grid place-items-center text-center min-h-[92px] ${flash ? "flash" : ""}`}>
        {pm.status === "eat_out" ? "🍽️ Eating out / ordering in" : "Nobody home"}
      </div>
    );
  }
  const viol = vm.violations.filter((v) => v.severity === "hard" && v.day === pm.day && v.meal === pm.meal);
  const shared = pm.dishes.filter((d) => d.for === "all");
  // group the rest by who eats them, and label a big group as "everyone except …"
  const everyone = [...pm.eaters, ...pm.tiffin];
  const groups = new Map<string, typeof pm.dishes>();
  pm.dishes.filter((d) => d.for !== "all").forEach((d) => { const k = (d.for as string[]).join(", "); groups.set(k, [...(groups.get(k) ?? []), d]); });
  const label = (names: string[]) => {
    const others = everyone.filter((n) => !names.includes(n));
    return names.length > 2 && others.length && others.length < names.length ? `everyone except ${others.join(", ")}` : names.join(", ");
  };
  return (
    <div
      onClick={onOpen}
      className={`group cursor-pointer rounded-xl border bg-paper p-2.5 text-[13px] leading-snug min-h-[92px] transition-shadow hover:shadow-md ${viol.length ? "border-mirch" : "border-line"} ${flash ? "flash" : ""} ${done ? "opacity-60" : ""}`}
    >
      <div className="space-y-0.5">
        {shared.map((d) => <DishName key={d.dishId} vm={vm} id={d.dishId} locked={d.locked} />)}
      </div>
      {[...groups.entries()].map(([k, ds]) => (
        <div key={k} className="mt-1.5 rounded-lg bg-haldi-soft/70 px-1.5 py-1">
          {ds.map((d) => <DishName key={d.dishId} vm={vm} id={d.dishId} locked={d.locked} />)}
          <div className="text-[11px] text-masala">for {label(k.split(", "))}</div>
        </div>
      ))}
      <div className="flex flex-wrap gap-1 mt-1.5">
        {pm.guests > 0 && <Badge tone="haldi">+{pm.guests} guests</Badge>}
        {pm.tiffin.length > 0 && <Badge>tiffin ×{pm.tiffin.length}</Badge>}
        {pm.cookedBy === "household" && <Badge tone="mirch">cook off</Badge>}
        {done && <Badge tone="patta">done ✓</Badge>}
        {pm.notes.length > 0 && !open && <Badge>{pm.notes.length} note{pm.notes.length > 1 ? "s" : ""}</Badge>}
      </div>
      {open && (
        <div className="mt-2 border-t border-line pt-2 space-y-1 text-[12px] text-muted" onClick={(e) => e.stopPropagation()}>
          {pm.notes.map((n, i) => <div key={i}>• {n}</div>)}
          {viol.map((v, i) => <div key={i} className="text-mirch">⚠ {v.text}</div>)}
          {onToggleLock && pm.dishes.map((d) => (
            <button key={d.dishId} onClick={() => onToggleLock(pm.day, pm.meal, d.dishId)} className="block text-left hover:text-ink">
              {d.locked ? "📌 Unpin" : "📍 Pin"} {vm.dishes[d.dishId]?.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DishName({ vm, id, locked }: { vm: ViewModel; id: string; locked?: boolean }) {
  const d = vm.dishes[id];
  return (
    <div className="font-medium text-ink">
      {d?.name ?? id}
      {locked && <span title="Pinned by family" className="ml-1 text-[10px]">📌</span>}
    </div>
  );
}

export function Badge({ children, tone }: { children: React.ReactNode; tone?: "haldi" | "mirch" | "patta" }) {
  const cls = tone === "haldi" ? "bg-haldi-soft text-masala" : tone === "mirch" ? "bg-mirch-soft text-mirch" : tone === "patta" ? "bg-patta-soft text-patta" : "bg-cream text-muted border border-line";
  return <span className={`inline-block rounded-full px-1.5 py-[1px] text-[10.5px] font-semibold ${cls}`}>{children}</span>;
}
