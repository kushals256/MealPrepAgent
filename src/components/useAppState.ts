"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewModel } from "@/lib/view";

/** Shared state, polled so the household and cook screens stay in sync live. */
export function useAppState(pollMs = 2500) {
  const [vm, setVm] = useState<ViewModel | null>(null);
  const version = useRef(-1);

  const refresh = useCallback(async (force = false) => {
    try {
      const r = await fetch(`/api/state${force ? "" : `?since=${version.current}`}`, { cache: "no-store" });
      const j = await r.json();
      if (j.unchanged) return;
      version.current = j.version;
      setVm(j);
    } catch { /* offline — keep last state */ }
  }, []);

  useEffect(() => {
    refresh(true);
    const t = setInterval(() => refresh(), pollMs);
    return () => clearInterval(t);
  }, [refresh, pollMs]);

  const op = useCallback(async (body: Record<string, unknown>) => {
    const r = await fetch("/api/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    version.current = j.version;
    setVm(j);
    return j as ViewModel;
  }, []);

  return { vm, refresh: () => refresh(true), op };
}
