"use client";

import { useState } from "react";
import type { ViewModel } from "@/lib/view";
import type { GroceryLine } from "@/lib/types";

const CAT: Record<string, string> = {
  vegetables: "🥬 Vegetables", fruits: "🍌 Fruits", dairy: "🥛 Dairy", meat_fish: "🍗 Meat, fish & eggs", pulses: "🫘 Dals & pulses",
  staples: "🌾 Staples", bakery: "🍞 Bakery", spices: "🌶️ Masalas", other: "🛍️ Other",
};

function fmt(n: number, unit: string) {
  if (unit === "g") return n >= 1000 ? `${+(n / 1000).toFixed(1)} kg` : `${n} g`;
  if (unit === "ml") return n >= 1000 ? `${+(n / 1000).toFixed(1)} L` : `${n} ml`;
  if (unit === "pc") return `${n} pc`;
  return unit;
}
const packText = (l: GroceryLine) => (l.extra ? l.unit : l.packs.map((p) => `${p.count}× ${fmt(p.size, l.unit)}`).join(" + "));

export function GroceryPanel({ vm, onOrder }: { vm: ViewModel; onOrder: (c: "instamart" | "whatsapp") => void }) {
  const g = vm.grocery!;
  const [batch, setBatch] = useState<"weekly" | "topup">("weekly");
  const lines = g.lines.filter((l) => l.batch === batch);
  const cats = [...new Set(lines.map((l) => l.category))];
  const ordered = vm.orders[vm.orders.length - 1];
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <div className="font-display text-3xl">₹{g.total.toLocaleString("en-IN")}</div>
          <div className="text-xs text-muted">to buy · {g.lines.length} items · simulated Instamart prices</div>
          <div className="text-xs text-muted">this week&apos;s food actually uses ≈ ₹{g.consumedCost.toLocaleString("en-IN")} — dal, rice & atta packs last longer{vm.household.budgetPerWeek ? <> · budget ₹{vm.household.budgetPerWeek.toLocaleString("en-IN")} <span className={g.consumedCost <= vm.household.budgetPerWeek ? "text-patta font-semibold" : "text-mirch font-semibold"}>{g.consumedCost <= vm.household.budgetPerWeek ? "✓ within" : "over"}</span></> : null}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onOrder("instamart")} className="rounded-full bg-[#fc8019] text-white px-4 py-2 text-sm font-semibold shadow-sm hover:brightness-105">Order on Instamart</button>
          <button onClick={() => onOrder("whatsapp")} className="rounded-full bg-[#25d366] text-white px-4 py-2 text-sm font-semibold shadow-sm hover:brightness-105">Send on WhatsApp</button>
        </div>
      </div>
      {ordered && <div className="mb-3 rounded-lg bg-patta-soft text-patta text-sm px-3 py-2">✓ {ordered.channel === "instamart" ? "Instamart order placed (simulated)" : "List sent on WhatsApp"} · {new Date(ordered.at).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit" })}. Changes since then show below.</div>}
      <div className="inline-flex rounded-full border border-line bg-paper p-1 mb-3 text-sm">
        <button onClick={() => setBatch("weekly")} className={`rounded-full px-3 py-1 ${batch === "weekly" ? "bg-ink text-cream" : ""}`}>Buy now · ₹{g.weeklyTotal}</button>
        <button onClick={() => setBatch("topup")} className={`rounded-full px-3 py-1 ${batch === "topup" ? "bg-ink text-cream" : ""}`}>Fresh top-up {g.topupDay} · ₹{g.topupTotal}</button>
      </div>
      {batch === "topup" && <p className="text-xs text-muted mb-2">Leafy greens, fish and chicken needed after Thursday are bought fresh mid-week so nothing rots in the fridge.</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        {cats.map((c) => (
          <div key={c} className="rounded-xl border border-line bg-paper p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-masala mb-2">{CAT[c] ?? c}</div>
            <ul className="space-y-1.5">
              {lines.filter((l) => l.category === c).map((l) => (
                <li key={l.id} className="flex justify-between gap-2 text-sm" title={`Used in: ${l.usedIn.join(", ")}`}>
                  <span>
                    <span className="font-medium">{l.name}</span>
                    {l.hindi && <span className="text-muted"> · {l.hindi}</span>}
                    {l.extra && <span className="ml-1 text-[10px] rounded bg-haldi-soft px-1">added</span>}
                    <span className="block text-[11px] text-muted truncate max-w-[220px]">{l.extra ? "added by you" : `need ~${fmt(l.needed, l.unit)} · ${l.usedIn.slice(0, 3).join(", ")}${l.usedIn.length > 3 ? "…" : ""}`}</span>
                  </span>
                  <span className="text-right whitespace-nowrap">
                    <span className="block text-[13px]">{packText(l)}</span>
                    <span className="block text-[11px] text-muted">{l.cost ? `₹${l.cost}` : "—"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {g.pantryCheck.length > 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-line p-3 text-sm">
          <span className="font-semibold">Check your pantry: </span>
          <span className="text-muted">{g.pantryCheck.map((p) => p.name).join(", ")}</span>
          <div className="text-[11px] text-muted mt-1">Assumed at home. Say “haldi khatam hai” and Meera adds it.</div>
        </div>
      )}
    </div>
  );
}

export function OrderModal({ vm, channel, onClose, onPlaced }: { vm: ViewModel; channel: "instamart" | "whatsapp"; onClose: () => void; onPlaced: (c: "instamart" | "whatsapp", phone?: string) => void }) {
  const g = vm.grocery!;
  const [phone, setPhone] = useState("");
  const [placed, setPlaced] = useState(false);
  const [copied, setCopied] = useState(false);
  const waUrl = `https://wa.me/${phone.replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")}?text=${encodeURIComponent(vm.groceryText)}`;
  return (
    <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto scrollbar-thin rounded-2xl bg-paper shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {channel === "instamart" ? (
          <>
            <div className="bg-[#fc8019] text-white px-5 py-4 rounded-t-2xl">
              <div className="text-xs uppercase tracking-wider opacity-80">Simulated — Instamart has no public ordering API</div>
              <div className="font-display text-2xl">Instamart cart</div>
            </div>
            <div className="p-5">
              {placed ? (
                <div className="text-center py-6">
                  <div className="text-5xl mb-2">🛵</div>
                  <div className="font-display text-2xl">Order placed (simulated)</div>
                  <p className="text-muted text-sm mt-1">₹{g.weeklyTotal} now · ₹{g.topupTotal} fresh top-up scheduled for {g.topupDay}. The cook has been told it&apos;s on the way.</p>
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-line text-sm">
                    {g.lines.filter((l) => l.batch === "weekly").map((l) => (
                      <li key={l.id} className="flex justify-between py-1.5 gap-2">
                        <a className="hover:underline" target="_blank" rel="noreferrer" href={`https://www.swiggy.com/instamart/search?custom_back=true&query=${encodeURIComponent(l.name)}`}>{l.name}</a>
                        <span className="text-muted whitespace-nowrap">{packText(l)} · ₹{l.cost}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between font-semibold mt-3"><span>Total now</span><span>₹{g.weeklyTotal}</span></div>
                  <div className="text-xs text-muted">+ ₹{g.topupTotal} fresh top-up on {g.topupDay}. Item names link to real Instamart search.</div>
                  <button onClick={() => { setPlaced(true); onPlaced("instamart"); }} className="mt-4 w-full rounded-full bg-[#fc8019] text-white py-3 font-semibold">Place order · ₹{g.weeklyTotal}</button>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="bg-[#075e54] text-white px-5 py-4 rounded-t-2xl">
              <div className="text-xs uppercase tracking-wider opacity-80">Real WhatsApp share link</div>
              <div className="font-display text-2xl">Send the list</div>
            </div>
            <div className="p-5 space-y-3">
              <pre className="whitespace-pre-wrap text-[12.5px] bg-[#e7ffdb] rounded-xl p-3 max-h-72 overflow-y-auto scrollbar-thin font-sans">{vm.groceryText}</pre>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional, e.g. 98xxxxxxxx) — blank lets you pick a chat" className="w-full rounded-full border border-line px-4 py-2 text-sm outline-none focus:border-haldi" />
              <div className="flex gap-2">
                <a href={waUrl} target="_blank" rel="noreferrer" onClick={() => onPlaced("whatsapp", phone || undefined)} className="flex-1 text-center rounded-full bg-[#25d366] text-white py-3 font-semibold">Open WhatsApp</a>
                <button onClick={() => { navigator.clipboard.writeText(vm.groceryText); setCopied(true); }} className="rounded-full border border-line px-4 font-semibold text-sm">{copied ? "Copied" : "Copy"}</button>
              </div>
            </div>
          </>
        )}
        <div className="px-5 pb-4"><button onClick={onClose} className="text-sm text-muted hover:text-ink">Close</button></div>
      </div>
    </div>
  );
}
