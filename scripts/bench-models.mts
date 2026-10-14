// Time-to-first-token + total latency + JSON compliance for candidate NIM models.
const KEY = process.env.NVIDIA_API_KEY!;
const models = process.argv.slice(2);
const sys = `You are Meera, a warm Indian kitchen voice agent. Reply ONLY with JSON {"say":"...","actions":[...],"followup":false}. Actions: {"type":"upsert_member","name":"","diet":"veg|nonveg","allergies":[]}`;
const user = "We're three — me, my husband who eats chicken, and our daughter Riya who is allergic to peanuts.";
for (const model of models) {
  const t0 = Date.now(); let first = 0; let text = "";
  try {
    const r = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: true, max_tokens: 400, temperature: 0.5, messages: [{ role: "system", content: sys }, { role: "user", content: user }], chat_template_kwargs: { thinking: false, enable_thinking: false } }) });
    if (!r.ok) { console.log(model, "HTTP", r.status, (await r.text()).slice(0, 160)); continue; }
    const rd = r.body!.getReader(); const dec = new TextDecoder(); let buf = "";
    while (true) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
      for (const line of buf.split("\n").slice(0, -1)) { if (!line.startsWith("data:") || line.includes("[DONE]")) continue; try { const d = JSON.parse(line.slice(5)).choices?.[0]?.delta?.content; if (d) { if (!first) first = Date.now() - t0; text += d; } } catch {} }
      buf = buf.slice(buf.lastIndexOf("\n") + 1); }
    let ok = false; try { ok = !!JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)).say; } catch {}
    console.log(`${model.padEnd(42)} first ${String(first).padStart(5)}ms total ${String(Date.now() - t0).padStart(5)}ms json:${ok}  ${text.replace(/\s+/g, " ").slice(0, 150)}`);
  } catch (e) { console.log(model, "ERR", (e as Error).message); }
}
