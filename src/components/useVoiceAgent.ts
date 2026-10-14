"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Browser voice loop:
//   mic (Web Speech API, Indian locale) -> /api/agent (NDJSON stream)
//   -> each finished sentence -> /api/tts (Edge neural voice) -> queued playback
// The first sentence starts playing while the model is still writing the rest.
// Half-duplex by design (no echo of Meera's own voice into the mic); tapping
// the orb or pressing Space barges in.

export type VoiceStatus = "idle" | "listening" | "thinking" | "speaking";

export interface Line {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
}

interface Opts {
  who: "household" | "cook";
  sttLang: string;
  voice: string;
  rate?: string;
  onState?: () => void;
  onFinalize?: (e: { channel: "instamart" | "whatsapp"; phone?: string }) => void;
  onTimer?: (e: { minutes: number; label: string }) => void;
  initialLines?: Line[];
  /** Short thinking sounds spoken if the first sentence is slow — humans don't go silent. */
  fillers?: string[];
}

type SR = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
};

const uid = () => Math.random().toString(36).slice(2, 9);

export function useVoiceAgent(o: Opts) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [lines, setLines] = useState<Line[]>(o.initialLines ?? []);
  const [interim, setInterim] = useState("");
  const [handsFree, setHandsFree] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [lastLatency, setLastLatency] = useState<number | null>(null);

  const opts = useRef(o);
  opts.current = o;
  const recRef = useRef<SR | null>(null);
  const finalBuf = useRef("");
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const queue = useRef<{ text: string; audio: Promise<string | null> }[]>([]);
  const playing = useRef(false);
  const streamOpen = useRef(false);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const handsFreeRef = useRef(handsFree);
  handsFreeRef.current = handsFree;
  const statusRef = useRef(status);
  statusRef.current = status;
  const wantListen = useRef(false);
  const turnStart = useRef(0);
  const fillerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<() => void>(() => {});

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    audioEl.current = new Audio();
    for (const f of opts.current.fillers ?? []) {
      fetch(`/api/tts?voice=${encodeURIComponent(opts.current.voice)}&rate=${encodeURIComponent(opts.current.rate ?? "+0%")}&text=${encodeURIComponent(f)}`).catch(() => {});
    }
    return () => { recRef.current?.abort(); abortRef.current?.abort(); audioEl.current?.pause(); };
  }, []);

  // ---------------- TTS ----------------
  const fetchAudio = useCallback(async (text: string): Promise<string | null> => {
    try {
      const u = `/api/tts?voice=${encodeURIComponent(opts.current.voice)}&rate=${encodeURIComponent(opts.current.rate ?? "+0%")}&text=${encodeURIComponent(text)}`;
      const r = await fetch(u);
      if (!r.ok) throw new Error(String(r.status));
      return URL.createObjectURL(await r.blob());
    } catch {
      return null;
    }
  }, []);

  const browserSpeak = (text: string) => new Promise<void>((resolve) => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = opts.current.sttLang;
      const v = speechSynthesis.getVoices().find((x) => x.lang === opts.current.sttLang) ?? speechSynthesis.getVoices().find((x) => x.lang.endsWith("-IN"));
      if (v) u.voice = v;
      u.onend = () => resolve(); u.onerror = () => resolve();
      speechSynthesis.speak(u);
    } catch { resolve(); }
  });

  const maybeResume = useCallback(() => {
    if (!playing.current && !streamOpen.current && queue.current.length === 0) {
      setStatus("idle");
      if (handsFreeRef.current && wantListen.current) setTimeout(() => startRef.current(), 250);
    }
  }, []);

  const pump = useCallback(async () => {
    if (playing.current) return;
    const next = queue.current.shift();
    if (!next) { maybeResume(); return; }
    playing.current = true;
    setStatus("speaking");
    if (turnStart.current) { setLastLatency(Date.now() - turnStart.current); turnStart.current = 0; }
    const url = await next.audio;
    if (!playing.current) return; // interrupted while loading
    if (url && audioEl.current) {
      await new Promise<void>((resolve) => {
        const a = audioEl.current!;
        a.src = url;
        a.onended = () => resolve();
        a.onerror = () => resolve();
        a.play().catch(() => browserSpeak(next.text).then(resolve));
      });
      URL.revokeObjectURL(url);
    } else {
      await browserSpeak(next.text);
    }
    playing.current = false;
    pump();
  }, [maybeResume]);

  const speak = useCallback((text: string) => {
    queue.current.push({ text, audio: fetchAudio(text) });
    pump();
  }, [fetchAudio, pump]);

  const stopSpeaking = useCallback(() => {
    queue.current = [];
    playing.current = false;
    audioEl.current?.pause();
    try { speechSynthesis.cancel(); } catch { /* noop */ }
  }, []);

  // ---------------- agent turn ----------------
  const send = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t) return;
    abortRef.current?.abort();
    stopSpeaking();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    if (t !== "__start__") setLines((l) => [...l, { id: uid(), role: "user", text: t }]);
    setStatus("thinking");
    setError(null);
    turnStart.current = Date.now();
    streamOpen.current = true;
    const aid = uid();
    let said = "";
    if (fillerTimer.current) clearTimeout(fillerTimer.current);
    const fillers = opts.current.fillers ?? [];
    if (fillers.length && t !== "__start__") {
      fillerTimer.current = setTimeout(() => {
        if (!said && !playing.current) speak(fillers[Math.floor(Math.random() * fillers.length)]);
      }, 1600);
    }
    try {
      const res = await fetch("/api/agent", { method: "POST", body: JSON.stringify({ text: t, who: opts.current.who }), signal: ctrl.signal, headers: { "Content-Type": "application/json" } });
      if (!res.ok || !res.body) throw new Error(`Agent error ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.type === "say") {
            if (fillerTimer.current) clearTimeout(fillerTimer.current);
            said = said ? `${said} ${e.text}` : e.text;
            const s = said;
            setLines((l) => (l.some((x) => x.id === aid) ? l.map((x) => (x.id === aid ? { ...x, text: s } : x)) : [...l, { id: aid, role: "assistant", text: s }]));
            speak(e.text);
          } else if (e.type === "state") opts.current.onState?.();
          else if (e.type === "finalize") opts.current.onFinalize?.(e);
          else if (e.type === "timer") opts.current.onTimer?.(e);
          else if (e.type === "error") throw new Error(e.message);
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        const msg = (e as Error).message;
        setError(msg.includes("NVIDIA_API_KEY") ? "LLM key missing — add NVIDIA_API_KEY to .env.local and restart." : `Hmm, that didn't go through (${msg}). Try again?`);
        const sorry = opts.current.who === "cook" ? "माफ़ कीजिए, नेटवर्क में दिक्कत है। एक बार फिर बोलिए।" : "Sorry, I lost you for a second there. Could you say that again?";
        if (!said) speak(sorry);
      }
    } finally {
      if (fillerTimer.current) clearTimeout(fillerTimer.current);
      streamOpen.current = false;
      if (!playing.current && queue.current.length === 0) maybeResume();
    }
  }, [speak, stopSpeaking, maybeResume]);

  // ---------------- STT ----------------
  const flushUtterance = useCallback(() => {
    const text = finalBuf.current.trim();
    finalBuf.current = "";
    setInterim("");
    try { recRef.current?.stop(); } catch { /* noop */ }
    if (text) send(text);
  }, [send]);

  const startListening = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setSupported(false); return; }
    if (statusRef.current === "listening") return;
    stopSpeaking();
    wantListen.current = true;
    try { recRef.current?.abort(); } catch { /* noop */ }
    const rec = new Ctor();
    rec.lang = opts.current.sttLang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    finalBuf.current = "";
    rec.onresult = (e) => {
      let inter = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalBuf.current += " " + r[0].transcript;
        else inter += r[0].transcript;
      }
      setInterim((finalBuf.current + " " + inter).trim());
      // endpointing: people pause mid-thought, so wait a beat after the last words
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(flushUtterance, inter ? 1800 : 1100);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { setError("Microphone blocked — allow mic access in the browser, or type below."); wantListen.current = false; }
      else if (e.error !== "no-speech" && e.error !== "aborted") setError(`Mic: ${e.error}`);
    };
    rec.onend = () => {
      if (statusRef.current === "listening") {
        if (finalBuf.current.trim()) { flushUtterance(); return; }
        // Chrome stops after silence — keep listening if hands-free
        if (wantListen.current && handsFreeRef.current) { try { rec.start(); return; } catch { /* fallthrough */ } }
        setStatus("idle");
      }
    };
    recRef.current = rec;
    try { rec.start(); setStatus("listening"); setError(null); } catch { /* already started */ }
  }, [flushUtterance, stopSpeaking]);

  startRef.current = startListening;

  const stopListening = useCallback(() => {
    wantListen.current = false;
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    try { recRef.current?.abort(); } catch { /* noop */ }
    setInterim("");
    setStatus((s) => (s === "listening" ? "idle" : s));
  }, []);

  /** Orb tap: start / barge-in / stop. */
  const toggle = useCallback(() => {
    const st = statusRef.current;
    if (st === "listening") {
      if (finalBuf.current.trim() || interim) flushUtterance();
      else stopListening();
    } else if (st === "speaking" || st === "thinking") {
      abortRef.current?.abort();
      stopSpeaking();
      streamOpen.current = false;
      setStatus("idle");
      setTimeout(() => startListening(), 50);
    } else {
      startListening();
    }
  }, [flushUtterance, interim, startListening, stopListening, stopSpeaking]);

  const sendText = useCallback((t: string) => { stopListening(); wantListen.current = handsFreeRef.current; send(t); }, [send, stopListening]);

  /** Speak without an LLM call (scripted greeting / timer alarms). */
  const say = useCallback((t: string, addLine = true) => {
    if (addLine) setLines((l) => [...l, { id: uid(), role: "assistant", text: t }]);
    speak(t);
  }, [speak]);

  return { status, lines, setLines, interim, handsFree, setHandsFree, error, setError, supported, toggle, startListening, stopListening, sendText, say, lastLatency, wantListen };
}
