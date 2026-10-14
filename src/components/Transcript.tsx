"use client";

import { useEffect, useRef, useState } from "react";
import type { Line } from "./useVoiceAgent";

export function Transcript({ lines, interim, agentName = "Meera", userName = "You", className = "" }: { lines: Line[]; interim: string; agentName?: string; userName?: string; className?: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [lines, interim]);
  return (
    <div className={`overflow-y-auto scrollbar-thin space-y-3 pr-1 ${className}`}>
      {lines.map((l) => (
        <div key={l.id} className={`flex ${l.role === "user" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${l.role === "user" ? "bg-ink text-cream rounded-br-md" : l.role === "system" ? "bg-transparent text-muted italic text-sm" : "bg-paper border border-line rounded-bl-md"}`}>
            {l.role === "assistant" && <div className="text-[11px] font-semibold uppercase tracking-wider text-masala mb-0.5">{agentName}</div>}
            {l.role === "user" && <div className="text-[11px] font-semibold uppercase tracking-wider text-cream/60 mb-0.5">{userName}</div>}
            {l.text}
          </div>
        </div>
      ))}
      {interim && (
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] bg-ink/70 text-cream italic">{interim}…</div>
        </div>
      )}
      <div ref={end} />
    </div>
  );
}

export function TextInput({ onSend, placeholder, disabled }: { onSend: (t: string) => void; placeholder: string; disabled?: boolean }) {
  const [v, setV] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onSend(v); setV(""); } }}
    >
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 min-w-0 rounded-full border border-line bg-paper px-4 py-2.5 text-[15px] outline-none focus:border-haldi focus:ring-2 focus:ring-haldi/30"
      />
      <button className="rounded-full bg-ink text-cream px-4 py-2.5 text-sm font-semibold disabled:opacity-40" disabled={disabled || !v.trim()}>Send</button>
    </form>
  );
}
