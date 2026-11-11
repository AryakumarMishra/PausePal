"use client";

import { useState } from "react";
import type { FlowState } from "@/libs/useTransactionFlow";
import { GRACE_SECONDS } from "@/libs/useTransactionFlow";

const PRESETS = [12.5, 25, 60, 129.99];
const CURRENCIES = ["USD", "EUR", "GBP"];

function fmtMoney(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(2)}`;
}

export default function BuyerRail({
  state,
  onBegin,
  onOpenApproval,
  onVoid,
  onAbandon,
  onReset,
}: {
  state: FlowState;
  onBegin: (amount: number, currency: string) => void;
  onOpenApproval: () => void;
  onVoid: () => void;
  onAbandon: () => void;
  onReset: () => void;
}) {
  const [amountText, setAmountText] = useState("25.00");
  const [currency, setCurrency] = useState("USD");

  const amountNum = Number.parseFloat(amountText);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;

  const busy =
    state.phase === "created" ||
    state.phase === "approved" ||
    state.phase === "voiding";
  const canStartNew =
    !busy && amountValid && state.phase !== "created";

  const showApprove = state.phase === "created";
  const showHold =
    state.phase === "approved" || state.phase === "voiding";
  const showOutcome =
    state.phase === "voided" ||
    state.phase === "captured" ||
    state.phase === "abandoned";

  const remaining = state.remaining ?? GRACE_SECONDS;
  const windowClosed = remaining <= 0;
  const fillPct = Math.max(0, Math.min(100, (remaining / GRACE_SECONDS) * 100));

  return (
    <section className="rail">
      <div className="rail-head">
        <h2 className="rail-title">Buyer rail</h2>
        <span className="rail-tag">01 — the hand that pays</span>
      </div>
      <p className="rail-side">
        You create the order · you approve in PayPal · you hold the kill
        switch for {GRACE_SECONDS}s
      </p>

      {/* 01 — initiate */}
      <div className="section">
        <div className="section-head">
          <span className="section-num">01</span>
          <span className="section-title">Initiate</span>
        </div>
        <div className="amount-row">
          <div className="field">
            <span className="prefix">{currency === "USD" ? "$" : currency === "EUR" ? "€" : "£"}</span>
            <input
              className="amount-input"
              inputMode="decimal"
              placeholder="0.00"
              value={amountText}
              disabled={busy}
              onChange={(e) =>
                setAmountText(e.target.value.replace(/[^0-9.]/g, ""))
              }
              aria-label="Amount"
            />
          </div>
          <select
            className="currency-select"
            value={currency}
            disabled={busy}
            onChange={(e) => setCurrency(e.target.value)}
            aria-label="Currency"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={p}
              className={`chip ${amountText === p.toFixed(2) ? "active" : ""}`}
              disabled={busy}
              onClick={() => setAmountText(p.toFixed(2))}
            >
              {fmtMoney(p, currency)}
            </button>
          ))}
        </div>
        <div className="btn-row">
          <button
            className="btn primary"
            disabled={!canStartNew}
            onClick={() => onBegin(amountNum, currency)}
          >
            {busy ? "In flight…" : "Create order →"}
          </button>
        </div>
        <p className="section-note" style={{ marginTop: 10 }}>
          Funds are never charged here — only a PayPal order is drafted.
          Nothing settles until the guardrail decides.
        </p>
        {state.lastError && <div className="error-line">{state.lastError}</div>}
      </div>

      {/* 02 — approve */}
      {showApprove && (
        <div className="section">
          <div className="section-head">
            <span className="section-num">02</span>
            <span className="section-title">Approve</span>
          </div>
          <div className="plate">
            <div className="kv">
              <span className="k">Order</span>
              <span className="v">{state.orderId}</span>
            </div>
            <div className="kv">
              <span className="k">Amount</span>
              <span className="v">
                {fmtMoney(state.amount ?? 0, state.currency ?? currency)}
              </span>
            </div>
          </div>
          <div className="btn-row">
            <button className="btn primary" onClick={onOpenApproval}>
              Open PayPal approval ↗
            </button>
          </div>
          <div className="state-banner info">
            <span className="pulse" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span>
              Awaiting your approval in the PayPal window — this panel
              flips automatically once it clears.
            </span>
          </div>
          <p className="section-note" style={{ marginTop: 10 }}>
            PayPal will drop you on a plain JSON confirmation page — that
            is the backend&apos;s return endpoint doing the authorization.
            Close that tab and come back here.
          </p>
          <div className="btn-row">
            <button className="btn ghost" onClick={onAbandon}>
              Abandon order ✕
            </button>
          </div>
        </div>
      )}

      {/* 03 — the window */}
      {showHold && (
        <div className="section">
          <div className="section-head">
            <span className="section-num">03</span>
            <span className="section-title">The {GRACE_SECONDS}-second window</span>
          </div>
          <p className="section-note">
            Your money is on hold, not charged. Void now and the hold
            dissolves. Do nothing and it settles on its own.
          </p>
          <div className={`countdown ${windowClosed ? "closed" : ""}`}>
            <div className="countdown-row">
              <span className="countdown-label">
                {state.deadlineIsExact ? "Grace deadline" : "Grace deadline (est.)"}
              </span>
              <span className="countdown-digits mono">
                {String(remaining).padStart(2, "0")}
                <small>SEC</small>
              </span>
            </div>
            <div className="countdown-bar">
              <div
                className="fill"
                style={{ width: `${fillPct}%` }}
              />
            </div>
            <div className="sub">
              {windowClosed
                ? "WINDOW CLOSED — capture is being processed by the guardrail"
                : "VOID STOPS THE CAPTURE · SILENCE CONFIRMS IT"}
            </div>
          </div>
          {state.notice && <div className="error-line">{state.notice}</div>}
          <div className="btn-row">
            <button
              className="btn danger"
              disabled={state.phase === "voiding" || windowClosed}
              onClick={onVoid}
            >
              {state.phase === "voiding"
                ? "Voiding…"
                : "Void the hold ✕"}
            </button>
          </div>
        </div>
      )}

      {/* 04 — outcome */}
      {showOutcome && (
        <div className="section">
          <div className="section-head">
            <span className="section-num">04</span>
            <span className="section-title">Outcome</span>
          </div>
          <div className="receipt">
            <div className="receipt-head">
              <span className="receipt-stamp">PausePal · settlement note</span>
            </div>
            {state.phase === "abandoned" ? (
              <div className="big-amount">— VOID —</div>
            ) : (
              <div className="big-amount">
                {state.phase === "captured" ? "CAPTURED" : "VOIDED"}
              </div>
            )}
            <hr className="divider" />
            <div className="kv">
              <span className="k">Order</span>
              <span className="v">{state.orderId}</span>
            </div>
            <div className="kv">
              <span className="k">Amount</span>
              <span className="v">
                {fmtMoney(state.amount ?? 0, state.currency ?? currency)}
              </span>
            </div>
            {state.authorizationId && (
              <div className="kv">
                <span className="k">Authorization</span>
                <span className="v">{state.authorizationId}</span>
              </div>
            )}
            <div className="kv">
              <span className="k">Result</span>
              <span
                className="v"
                style={{
                  color:
                    state.phase === "captured" ? "var(--ok)" : "var(--void)",
                }}
              >
                {state.phase === "abandoned"
                  ? "Never approved"
                  : state.phase === "captured"
                    ? "Funds settled to merchant"
                    : "Hold released · $0 moved"}
              </span>
            </div>
          </div>
          <div className="btn-row">
            <button className="btn primary" onClick={onReset}>
              Start another ↺
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
