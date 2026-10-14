import { getState } from "@/lib/store";
import { cookTurn, householdTurn, type AgentEvent } from "@/lib/agent/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One voice turn, streamed as NDJSON so the browser can start speaking the
// first sentence while the model is still writing the rest.
export async function POST(req: Request) {
  const { text, who } = (await req.json().catch(() => ({}))) as { text?: string; who?: "household" | "cook" };
  const input = (text ?? "").trim().slice(0, 2000);
  if (!input) return new Response(JSON.stringify({ error: "empty" }), { status: 400 });
  const s = getState();
  const gen = who === "cook" ? cookTurn(s, input) : householdTurn(s, input);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (e: AgentEvent) => ctrl.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        for await (const e of gen) send(e);
      } catch (e) {
        console.error("[agent]", e);
        send({ type: "error", message: (e as Error).message });
      } finally {
        ctrl.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
