"use client";

import type { FlowState } from "@/libs/useTransactionFlow";
import { GRACE_SECONDS } from "@/libs/useTransactionFlow";
import type { StoredOrder } from "@/libs/types";

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-GB", { hour12: false });
}

function fmtMoney(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(2)}`;
}

function pillClass(status: StoredOrder["status"]) {
  switch (status) {
    case "AUTHORIZED":
    case "VOID_PENDING":
    case "VOID_REQUESTED":
      return "hold";
    case "CAPTURE_PENDING":
    case "CAPTURED":
      return "ok";
    case "VOIDED":
    case "ABANDONED":
      return "bad";
    default:
      return "idle";
  }
}

export default function MerchantRail({
  state,
  orders,
  onClearLedger,
}: {
  state: FlowState;
  orders: StoredOrder[];
  onClearLedger: () => void;
}) {
  const remaining = state.remaining ?? GRACE_SECONDS;
  const windowClosed = remaining <= 0;

  const holdBanner = (() => {
    switch (state.phase) {
      case "created":
        return (
          <div className="state-banner info">
            <span className="pulse" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span>Awaiting buyer approval — nothing at risk yet.</span>
          </div>
        );
      case "approved":
      case "voiding":
        return (
          <>
            <div className="state-banner hold">
              <span className="tag">Hold</span>
              <span>
                FUNDS ON HOLD · {fmtMoney(state.amount ?? 0, state.currency ?? "USD")} ·
                buyer may void for {String(Math.max(0, remaining)).padStart(2, "0")}s
              </span>
            </div>
            {state.authorizationId && (
              <div className="plate" style={{ marginTop: 10 }}>
                <div className="kv">
                  <span className="k">Authorization</span>
                  <span className="v">{state.authorizationId}</span>
                </div>
                <div className="kv">
                  <span className="k">Grace ends</span>
                  <span className="v">
                    T−{String(Math.max(0, remaining)).padStart(2, "0")}s
                    {windowClosed ? " · settling" : ""}
                  </span>
                </div>
              </div>
            )}
          </>
        );
      case "voided":
        return (
          <div className="state-banner void">
            <span className="tag">Voided</span>
            <span>Hold released — no capture, no revenue.</span>
          </div>
        );
      case "captured":
        return (
          <div className="state-banner ok">
            <span className="tag">Settled</span>
            <span>
              Capture complete — {fmtMoney(state.amount ?? 0, state.currency ?? "USD")}{" "}
              is yours.
            </span>
          </div>
        );
      case "abandoned":
        return (
          <div className="state-banner info">
            <span className="tag">Dropped</span>
            <span>Buyer abandoned before approval.</span>
          </div>
        );
      default:
        return (
          <div className="plate dim">
            No open order. The next one lands here the moment the buyer
            initiates.
          </div>
        );
    }
  })();

  return (
    <section className="rail">
      <div className="rail-head">
        <h2 className="rail-title">Merchant rail</h2>
        <span className="rail-tag">02 — the hand that gets paid</span>
      </div>
      <p className="rail-side">
        No controls here by design — the buyer owns the {GRACE_SECONDS}s
        kill switch, the guardrail settles the rest
      </p>

      {/* 01 — incoming */}
      <div className="section">
        <div className="section-head">
          <span className="section-num">01</span>
          <span className="section-title">Incoming</span>
        </div>
        {state.orderId ? (
          <div className="plate">
            <div className="kv">
              <span className="k">Order</span>
              <span className="v">{state.orderId}</span>
            </div>
            <div className="kv">
              <span className="k">Amount</span>
              <span className="v">
                {fmtMoney(state.amount ?? 0, state.currency ?? "USD")}
              </span>
            </div>
            <div className="kv">
              <span className="k">Backend state</span>
              <span className="v mono">{state.pollStatus ?? "—"}</span>
            </div>
          </div>
        ) : (
          <div className="plate dim">Counter idle.</div>
        )}
      </div>

      {/* 02 — exposure */}
      <div className="section">
        <div className="section-head">
          <span className="section-num">02</span>
          <span className="section-title">Exposure</span>
        </div>
        {holdBanner}
      </div>

      {/* 03 — day book */}
      <div className="section">
        <div className="section-head">
          <span className="section-num">03</span>
          <span className="section-title">Day book</span>
          <span style={{ flex: 1 }} />
          {orders.length > 0 && (
            <button className="btn ghost" onClick={onClearLedger}>
              Clear
            </button>
          )}
        </div>
        {orders.length === 0 ? (
          <div className="plate dim">
            Settled transactions will be journaled here.
          </div>
        ) : (
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Order</th>
                <th>Amount</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.orderId}>
                  <td>{fmtTime(o.updatedAt)}</td>
                  <td>{o.orderId.slice(0, 10)}…</td>
                  <td>
                    {fmtMoney(o.amount, o.currency)}
                  </td>
                  <td>
                    <span className={`status-pill ${pillClass(o.status)}`}>
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
