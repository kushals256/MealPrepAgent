import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

export const dynamic = "force-dynamic";

// Microsoft Edge neural voices (free, no key): en-IN Neerja for the household,
// and the cook's own language (hi/ta/te/kn/mr/bn/gu/ml) for the kitchen.
// Synthesised server-side and cached; the browser falls back to
// speechSynthesis if this ever fails.

const ALLOWED = /^(en|hi|ta|te|kn|mr|bn|gu|ml|ur)-IN-[A-Za-z]+Neural$/;
const cache = new Map<string, Buffer>();
const clients = new Map<string, MsEdgeTTS>();

async function client(voice: string) {
  let c = clients.get(voice);
  if (!c) {
    c = new MsEdgeTTS({ connectionTimeoutMs: 8000, synthesisTimeoutMs: 15000 });
    await c.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    clients.set(voice, c);
  }
  return c;
}

function speakable(text: string) {
  return text
    .replace(/\s\+\s/g, ", ")
    .replace(/[*_#`>|~]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/₹\s?([\d,]+)/g, "$1 rupees")
    .replace(/\b(\d+)\s?g\b/g, "$1 grams")
    .replace(/\b(\d+)\s?kg\b/g, "$1 kilo")
    .replace(/\b(\d+)\s?ml\b/g, "$1 ml")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
}

function escapeXml(s: string) {
  return s.replace(/&/g, "and").replace(/</g, " ").replace(/>/g, " ");
}

async function synth(text: string, voice: string, rate: string) {
  const c = await client(voice);
  const { audioStream } = c.toStream(escapeXml(text), { rate });
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    audioStream.on("data", (d: Buffer) => chunks.push(d));
    audioStream.on("close", () => resolve());
    audioStream.on("error", reject);
  });
  const buf = Buffer.concat(chunks);
  if (!buf.length) throw new Error("empty audio");
  return buf;
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const text = speakable(u.searchParams.get("text") ?? "");
  const voice = u.searchParams.get("voice") ?? "en-IN-NeerjaExpressiveNeural";
  const rate = u.searchParams.get("rate") ?? "+0%";
  if (!text) return new Response("empty", { status: 400 });
  if (!ALLOWED.test(voice) || !/^[+-]\d{1,2}%$/.test(rate)) return new Response("bad voice", { status: 400 });
  const key = `${voice}|${rate}|${text}`;
  let buf = cache.get(key);
  if (!buf) {
    try {
      buf = await synth(text, voice, rate);
    } catch {
      clients.delete(voice); // stale websocket — retry once with a fresh client
      try { buf = await synth(text, voice, rate); } catch (e) {
        return new Response(`tts failed: ${(e as Error).message}`, { status: 502 });
      }
    }
    cache.set(key, buf);
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
  }
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" } });
}
