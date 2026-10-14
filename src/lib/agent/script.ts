import type { CookLang } from "../types";
import { complete, models } from "./llm";
import { LANGS } from "./prompts";

// Script guard for the cook's language. An Edge Hindi/Tamil voice reading Roman
// "Hinglish" sounds broken, and smaller models drift into Roman script for
// Tamil/Malayalam. Any sentence mostly outside the target script gets a fast
// rewrite pass before it reaches TTS — cost is paid only when the model drifts.

const SCRIPT: Record<CookLang, RegExp | null> = {
  en: null,
  hi: /\p{Script=Devanagari}/gu, mr: /\p{Script=Devanagari}/gu,
  ta: /\p{Script=Tamil}/gu, te: /\p{Script=Telugu}/gu, kn: /\p{Script=Kannada}/gu,
  bn: /\p{Script=Bengali}/gu, gu: /\p{Script=Gujarati}/gu, ml: /\p{Script=Malayalam}/gu,
};

export function scriptRatio(text: string, lang: CookLang) {
  const re = SCRIPT[lang];
  if (!re) return 1;
  const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, "");
  if (!letters.length) return 1;
  return (letters.match(re)?.length ?? 0) / letters.length;
}

// Which models write each language best on the free NIM tier (measured):
// super is fast and good at Hindi/Marathi/Kannada; ultra is needed for Tamil/Malayalam.
const PREFER_ULTRA: CookLang[] = ["ta", "ml", "te", "bn", "gu"];

export async function fixScript(text: string, lang: CookLang): Promise<string> {
  if (lang === "en" || scriptRatio(text, lang) >= 0.6) return text;
  const L = LANGS[lang];
  const chain = models();
  const ultra = chain.find((m) => m.includes("ultra"));
  const order = PREFER_ULTRA.includes(lang) && ultra ? [ultra, ...chain.filter((m) => m !== ultra)] : chain;
  try {
    const { text: out } = await complete(
      [
        { role: "system", content: `Rewrite the message as everyday spoken ${L.name} in ${L.script} script, the way a home cook in India talks. Keep names, dish names and numbers. Kitchen words like cooker, gas, tiffin, minute can stay but must be written in ${L.script} script. Output only the rewritten sentence.` },
        { role: "user", content: text },
      ],
      { temperature: 0.2, maxTokens: 300, models: order },
    );
    const clean = out.trim().replace(/^["“]|["”]$/g, "");
    return scriptRatio(clean, lang) > scriptRatio(text, lang) ? clean : text;
  } catch {
    return text;
  }
}
