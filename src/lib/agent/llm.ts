// Thin OpenAI-compatible client for NVIDIA NIM (build.nvidia.com) with a
// model fallback chain. Any OpenAI-compatible endpoint works via env vars.

const BASE = process.env.LLM_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
const KEY = () => process.env.NVIDIA_API_KEY ?? process.env.LLM_API_KEY ?? "";

export function models(): string[] {
  return (process.env.LLM_MODELS ?? "nvidia/nemotron-3-super-120b-a12b,nvidia/nemotron-3-ultra-550b-a55b,nvidia/nemotron-3.5-lightning-30b-a3b")
    .split(",").map((s) => s.trim()).filter(Boolean);
}

export interface Msg { role: "system" | "user" | "assistant"; content: string }

export class LLMError extends Error {}

export function hasKey() {
  return Boolean(KEY());
}

/** Stream completion text deltas; falls back to the next model on error before any output. */
// Free NIM endpoints sometimes queue a request for a minute+. For voice that's a
// dead call, so a model that hasn't produced a token within FIRST_TOKEN_MS is
// abandoned and the next one in the chain is tried.
const FIRST_TOKEN_MS = Number(process.env.LLM_FIRST_TOKEN_MS ?? 9000);
const sticky: { model?: string; until: number } = { until: 0 };

export async function* streamChat(messages: Msg[], opts: { temperature?: number; maxTokens?: number; timeoutMs?: number; models?: string[] } = {}): AsyncGenerator<string, { model: string }> {
  if (!KEY()) throw new LLMError("NVIDIA_API_KEY is not set — add it to .env.local");
  let lastErr: unknown;
  // a model that just failed is skipped for a couple of minutes
  const chain = opts.models ?? models();
  const order = sticky.model && Date.now() < sticky.until ? [...chain.filter((m) => m !== sticky.model), sticky.model] : chain;
  for (const model of order) {
    const ctrl = new AbortController();
    let timer = setTimeout(() => ctrl.abort(), FIRST_TOKEN_MS);
    let emitted = false;
    try {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY()}`, Accept: "text/event-stream" },
        body: JSON.stringify({
          model, messages, stream: true,
          temperature: opts.temperature ?? 0.6, top_p: 0.95, max_tokens: opts.maxTokens ?? 1200,
          // ask hybrid-reasoning models to skip long thinking — this is a voice agent
          chat_template_kwargs: { thinking: false, enable_thinking: false },
        }),
      });
      if (!res.ok || !res.body) throw new LLMError(`${model}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let inThink = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const j = JSON.parse(data);
            let delta: string = j.choices?.[0]?.delta?.content ?? "";
            if (!delta) continue;
            // strip inline <think>…</think> blocks some models emit
            if (delta.includes("<think>")) { inThink = true; delta = delta.split("<think>")[0]; }
            if (inThink) {
              if (delta.includes("</think>")) { inThink = false; delta = delta.split("</think>").pop() ?? ""; } else continue;
            }
            if (delta) {
              if (!emitted) { clearTimeout(timer); timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 45000); }
              emitted = true; yield delta;
            }
          } catch { /* partial line */ }
        }
      }
      clearTimeout(timer);
      if (!emitted) throw new LLMError(`${model}: empty response`);
      return { model };
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (emitted) throw e; // can't silently switch model mid-sentence
      sticky.model = model; sticky.until = Date.now() + 120000;
      console.warn(`[llm] ${model} failed, trying next:`, (e as Error).message);
    }
  }
  throw lastErr instanceof Error ? lastErr : new LLMError(String(lastErr));
}

export async function complete(messages: Msg[], opts: { temperature?: number; maxTokens?: number; models?: string[] } = {}) {
  let out = "";
  const it = streamChat(messages, opts);
  while (true) {
    const r = await it.next();
    if (r.done) return { text: out, model: r.value.model };
    out += r.value;
  }
}

/** Pull the first JSON object out of model text (handles code fences, trailing commas). */
export function extractJson<T = Record<string, unknown>>(text: string): T | null {
  const t = text.replace(/```(?:json)?/g, "");
  const start = t.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        const raw = t.slice(start, i + 1);
        try { return JSON.parse(raw) as T; } catch {
          try { return JSON.parse(raw.replace(/,\s*([}\]])/g, "$1")) as T; } catch { return null; }
        }
      }
    }
  }
  return null;
}

/**
 * Incrementally extracts the value of the "say" field from a streaming JSON
 * response and emits whole sentences as soon as they're complete, so TTS can
 * start speaking before the model has finished writing its actions.
 */
export class SayStreamer {
  private raw = "";
  private pos = -1; // index into raw where say value starts
  private consumed = 0; // chars of decoded say already emitted
  private decoded = "";
  private closed = false;

  push(delta: string): string[] {
    this.raw += delta;
    if (this.pos < 0) {
      const m = /"say"\s*:\s*"/.exec(this.raw);
      if (!m) return [];
      this.pos = m.index + m[0].length;
    }
    if (!this.closed) this.decode();
    return this.sentences(false);
  }

  flush(): string[] {
    return this.sentences(true);
  }

  private decode() {
    let out = "";
    let i = this.pos;
    while (i < this.raw.length) {
      const c = this.raw[i];
      if (c === "\\") {
        if (i + 1 >= this.raw.length) break;
        const n = this.raw[i + 1];
        if (n === "u") {
          if (i + 6 > this.raw.length) break;
          out += String.fromCharCode(parseInt(this.raw.slice(i + 2, i + 6), 16));
          i += 6; continue;
        }
        out += n === "n" ? " " : n === "t" ? " " : n;
        i += 2; continue;
      }
      if (c === '"') { this.closed = true; break; }
      out += c; i++;
    }
    this.decoded = out;
  }

  private sentences(final: boolean): string[] {
    const pending = this.decoded.slice(this.consumed);
    const out: string[] = [];
    const re = /[^.!?।॥]+[.!?।॥]+["')\]]*(\s+|$)/g;
    let m: RegExpExecArray | null;
    let last = 0;
    while ((m = re.exec(pending))) {
      // only accept a boundary followed by whitespace (or end if the string closed)
      const endsAtEnd = m.index + m[0].length === pending.length;
      if (endsAtEnd && !/\s$/.test(m[0]) && !this.closed && !final) break;
      out.push(m[0].trim());
      last = m.index + m[0].length;
    }
    // merge very short fragments ("Achha.") with the next sentence for smoother TTS
    const merged: string[] = [];
    for (const s of out) {
      if (merged.length && merged[merged.length - 1].length < 14) merged[merged.length - 1] += " " + s;
      else merged.push(s);
    }
    this.consumed += last;
    if ((final || this.closed) && this.consumed < this.decoded.length) {
      const rest = this.decoded.slice(this.consumed).trim();
      if (rest) merged.push(rest);
      this.consumed = this.decoded.length;
    }
    return merged.filter(Boolean);
  }
}
