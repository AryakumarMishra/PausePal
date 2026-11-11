"use client";

import type { FlowEvent } from "@/libs/useTransactionFlow";

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-GB", { hour12: false });
}

export default function Spine({ history }: { history: FlowEvent[] }) {
  return (
    <aside className="spine-col">
      <h2 className="spine-title">Shared ledger</h2>
      <p className="spine-sub">One timeline · both counterparties</p>

      {history.length === 0 ? (
        <div className="spine-empty">
          NO ENTRIES YET
          <br />
          <br />
          Every state transition — order created, funds held, void or
          capture — lands here the moment the backend confirms it.
          Both sides of the counter read from this same record.
        </div>
      ) : (
        <div className="spine">
          {history.map((e, i) => {
            const isLast = i === history.length - 1;
            const bad = e.status === "VOIDED" || e.status === "ABANDONED";
            const cls = isLast ? (bad ? "bad" : "active") : "done";
            return (
              <div key={`${e.at}-${i}`} className={`spine-event ${cls}`}>
                <div className="spine-status">
                  {e.status}
                  <span className="spine-actor">{e.actor}</span>
                </div>
                <div className="spine-time">{fmtTime(e.at)}</div>
                <div className="spine-label">{e.label}</div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
