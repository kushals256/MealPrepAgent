"use client";

import type { VoiceStatus } from "./useVoiceAgent";

const LABEL: Record<VoiceStatus, string> = {
  idle: "Tap to talk",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking — tap to interrupt",
};

export function VoiceOrb({ status, onClick, size = 168, labels }: { status: VoiceStatus; onClick: () => void; size?: number; labels?: Partial<Record<VoiceStatus, string>> }) {
  const color = status === "listening" ? "var(--mirch)" : status === "speaking" ? "var(--patta)" : "var(--haldi)";
  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <button
        onClick={onClick}
        aria-label={labels?.[status] ?? LABEL[status]}
        className="relative grid place-items-center rounded-full outline-none focus-visible:ring-4 ring-haldi/50"
        style={{ width: size, height: size }}
      >
        {(status === "listening" || status === "speaking") && (
          <>
            <span className="absolute inset-0 rounded-full" style={{ background: color, animation: "ripple 1.8s ease-out infinite" }} />
            <span className="absolute inset-0 rounded-full" style={{ background: color, animation: "ripple 1.8s ease-out .9s infinite" }} />
          </>
        )}
        <span
          className="absolute inset-0 rounded-full shadow-[0_18px_50px_-12px_rgba(138,75,32,.55)]"
          style={{
            background: `radial-gradient(circle at 32% 28%, #fff6dc 0%, ${color} 55%, color-mix(in srgb, ${color} 70%, #3b1d08) 100%)`,
            animation: status === "idle" ? "breathe 4s ease-in-out infinite" : undefined,
            transition: "background .4s",
          }}
        />
        {status === "thinking" && (
          <span className="absolute inset-3 rounded-full border-[3px] border-white/70 border-t-transparent" style={{ animation: "spin-slow 1s linear infinite" }} />
        )}
        <span className="relative flex items-end gap-[5px] h-10">
          {status === "speaking" || status === "listening"
            ? [0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="w-[6px] h-10 rounded-full bg-white/90 origin-bottom" style={{ animation: `bar ${0.7 + i * 0.13}s ease-in-out ${i * 0.08}s infinite` }} />
              ))
            : <MicIcon />}
        </span>
      </button>
      <div className="text-sm font-medium text-muted h-5">{labels?.[status] ?? LABEL[status]}</div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" />
    </svg>
  );
}
