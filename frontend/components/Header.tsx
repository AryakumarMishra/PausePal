"use client";

import { useEffect, useState } from "react";
import type { Phase } from "@/libs/useTransactionFlow";

function useClock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const f = () =>
      setNow(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    f();
    const t = setInterval(f, 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function stepFor(phase: Phase): { active: number; done: number } {
  switch (phase) {
    case "idle":
    case "created":
      return { active: 0, done: 0 };
    case "approved":
    case "voiding":
      return { active: 1, done: 1 };
    case "captured":
    case "voided":
      return { active: -1, done: 2 };
    default:
      return { active: 0, done: 0 };
  }
}

const STEPS = ["Authorize", "Hold", "Settle"] as const;

export default function Header({
  backendUp,
  phase,
}: {
  backendUp: boolean;
  phase: Phase;
}) {
  const clock = useClock();
  const { active, done } = stepFor(phase);

  return (
    <header className="masthead">
      <div className="masthead-brand">
        <h1 className="wordmark">
          PAUSE<span className="tick">PAL</span>
        </h1>
        <span className="masthead-sub">auth ▸ hold ▸ settle</span>
      </div>

      <div className="masthead-mid">
        <div className="flow-arrows mono">
          {STEPS.map((s, i) => (
            <span key={s} className="step">
              {i > 0 && <span className="arrow">──▸</span>}
              <span
                className={`dot ${i < done ? "done" : ""} ${
                  i === active ? "on" : ""
                }`}
              />
              <span>{s}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="masthead-status mono">
        <span className={`beacon ${backendUp ? "up" : "down"}`} aria-hidden />
        <span>
          {backendUp ? "Backend :8000 — live" : "Backend :8000 — offline"}
        </span>
        <span className="clock">{clock}</span>
      </div>
    </header>
  );
}
