"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BackendFailure,
  createCheckout,
  pollReturn,
  voidTransaction,
} from "./api";
import type { LedgerStatus, StoredOrder, TxnStatus } from "./types";
import { findOrder, markOrderStatus, upsertOrder } from "./store";

export const GRACE_SECONDS = 20;
const POLL_INTERVAL_MS = 900;
const TICK_MS = 200;

export type Phase =
  | "idle"
  | "created"
  | "approved" // AUTHORIZED, grace window running
  | "voiding"
  | "voided"
  | "captured"
  | "abandoned";

export interface FlowEvent {
  at: number;
  status: LedgerStatus;
  label: string;
  actor: "BUYER" | "MERCHANT" | "GUARDRAIL";
}

export interface FlowState {
  phase: Phase;
  orderId: string | null;
  approvalUrl: string | null;
  amount: number | null;
  currency: string | null;
  authorizationId: string | null;
  /** ms timestamp of authorization moment (observed) */
  authorizedAt: number | null;
  /** ms timestamp when the grace window ends */
  deadline: number | null;
  deadlineIsExact: boolean;
  /** remaining grace seconds (from ticking clock) */
  remaining: number | null;
  lastError: string | null;
  notice: string | null;
  pollStatus: TxnStatus | null;
  history: FlowEvent[];
}

const initialState: FlowState = {
  phase: "idle",
  orderId: null,
  approvalUrl: null,
  amount: null,
  currency: null,
  authorizationId: null,
  authorizedAt: null,
  deadline: null,
  deadlineIsExact: false,
  remaining: null,
  lastError: null,
  notice: null,
  pollStatus: null,
  history: [],
};

function stamp(
  state: FlowState,
  status: LedgerStatus,
  label: string,
  actor: FlowEvent["actor"]
): FlowEvent[] {
  return [...state.history, { at: Date.now(), status, label, actor }];
}

export function useTransactionFlow() {
  const [state, setState] = useState<FlowState>(initialState);
  const [tick, setTick] = useState(0);

  const stateRef = useRef(state);
  stateRef.current = state;
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    const t = setInterval(() => setTick((v) => v + 1), TICK_MS);
    return () => {
      aliveRef.current = false;
      clearInterval(t);
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  // Grace countdown ticks
  useEffect(() => {
    const s = stateRef.current;
    if (!s.deadline) {
      if (s.remaining !== null) {
        setState((p) => ({ ...p, remaining: null }));
      }
      return;
    }
    const remaining = Math.max(
      0,
      Math.ceil((s.deadline - Date.now()) / 1000)
    );
    setState((p) => {
      if (p.deadline === null) return p;
      const r = Math.max(0, Math.ceil((p.deadline - Date.now()) / 1000));
      return p.remaining === r ? p : { ...p, remaining: r };
    });
    if (remaining <= 0 && s.phase === "approved") {
      setState((p) =>
        p.phase === "approved"
          ? {
              ...p,
              notice: "Grace window closed — hold can no longer be voided.",
            }
          : p
      );
    }
  }, [tick, state.deadline, state.phase]);

  const applyPoll = useCallback((pollStatus: TxnStatus | null) => {
    setState((p) => {
      const next = { ...p, pollStatus };
      let history = p.history;
      const push = (status: LedgerStatus, label: string, actor: FlowEvent["actor"]) => {
        history = stamp({ ...p, history }, status, label, actor);
        next.history = history;
      };
      switch (pollStatus) {
        case "VOID_PENDING":
          if (p.phase !== "voiding" && p.phase !== "voided") {
            next.phase = "voiding";
            push("VOID_PENDING", "Void claim accepted — releasing hold", "GUARDRAIL");
          }
          break;
        case "VOIDED":
          if (p.phase !== "voided") {
            next.phase = "voided";
            next.deadline = null;
            push("VOIDED", "Hold released — no money moved", "GUARDRAIL");
          }
          break;
        case "CAPTURE_PENDING":
          if (p.phase !== "captured") {
            next.phase = "captured";
            next.deadline = null;
            push("CAPTURE_PENDING", "Grace expired — capture claimed", "GUARDRAIL");
          }
          break;
        case "CAPTURED":
          if (p.phase !== "captured") {
            next.phase = "captured";
            next.deadline = null;
            push("CAPTURED", "Funds settled — capture complete", "GUARDRAIL");
          }
          break;
      }
      return next;
    });
  }, []);

  const pollLoop = useCallback(
    (orderId: string, attempt = 0) => {
      if (!aliveRef.current) return;
      pollTimer.current = setTimeout(async () => {
        if (!aliveRef.current) return;
        try {
          const res = await pollReturn(orderId);
          if (!aliveRef.current) return;
          if (res.kind === "authorized") {
            const s = stateRef.current;
            const firstAuth = s.phase !== "approved" && s.phase !== "voiding" && s.phase !== "voided";
            setState((p) => {
              const next: FlowState = { ...p, pollStatus: "AUTHORIZED" };
              let history = p.history;
              if (firstAuth) {
                next.phase = "approved";
                next.authorizationId = res.body.authorization_id ?? p.authorizationId;
                next.authorizedAt = Date.now();
                history = stamp(p, "AUTHORIZED", "Funds on hold — 20s grace window open", "GUARDRAIL");
                next.history = history;
              }
              if (res.body.grace_deadline) {
                const dl = Date.parse(res.body.grace_deadline);
                if (!Number.isNaN(dl)) {
                  next.deadline = dl;
                  next.deadlineIsExact = true;
                }
              } else if (next.deadline === null && firstAuth) {
                next.deadline = Date.now() + GRACE_SECONDS * 1000;
                next.deadlineIsExact = false;
              }
              return next;
            });
            markOrderStatus(orderId, "AUTHORIZED", {
              authorizationId: res.body.authorization_id,
            });
          } else {
            const status = res.body.status ?? null;
            if (status && status !== "CREATED") applyPoll(status);
            if (status === "CREATED") {
              setState((p) => ({ ...p, pollStatus: "CREATED" }));
            }
          }
        } catch (err) {
          if (err instanceof BackendFailure && err.httpStatus === 404) {
            setState((p) => ({
              ...p,
              lastError: "Transaction not found on backend",
            }));
          }
          // transient errors: keep polling
        }
        if (aliveRef.current) pollLoop(orderId, attempt + 1);
      }, POLL_INTERVAL_MS);
    },
    [applyPoll]
  );

  const startPolling = useCallback(
    (orderId: string) => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
      pollLoop(orderId);
    },
    [pollLoop]
  );

  const stopPolling = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;
  }, []);

  const beginCheckout = useCallback(
    async (amount: number, currency: string) => {
      setState((p) => ({
        ...initialState,
        history: p.history, // keep ledger
      }));
      try {
        const res = await createCheckout({ amount, currency });
        const order: StoredOrder = {
          orderId: res.order_id,
          amount,
          currency,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: "WAITING_APPROVAL",
        };
        upsertOrder(order);
        setState((p) => ({
          ...p,
          phase: "created",
          orderId: res.order_id,
          approvalUrl: res.approval_url,
          amount,
          currency,
          lastError: null,
          notice: null,
          history: stamp(p, "CREATED", `Order ${res.order_id} created — awaiting approval`, "BUYER"),
        }));
        startPolling(res.order_id);
      } catch (err) {
        setState((p) => ({
          ...p,
          lastError:
            err instanceof BackendFailure
              ? `Order creation failed: ${String((err.body as { message?: string; error?: string }).message ?? (err.body as { error?: string }).error ?? err.httpStatus)}`
              : "Cannot reach the PausePal backend — is it running on :8000?",
        }));
      }
    },
    [startPolling]
  );

  const openApproval = useCallback(() => {
    const url = stateRef.current.approvalUrl;
    if (!url) return;
    window.open(
      url,
      "pausepal_paypal_approval",
      "popup=yes,width=520,height=760,left=120,top=60"
    );
  }, []);

  const requestVoid = useCallback(async () => {
    const orderId = stateRef.current.orderId;
    if (!orderId) return;
    setState((p) => ({
      ...p,
      phase: "voiding",
      notice: null,
      history: stamp(p, "VOID_REQUESTED", "Buyer requested void — releasing hold", "BUYER"),
    }));
    stopPolling();
    try {
      await voidTransaction(orderId);
      markOrderStatus(orderId, "VOIDED");
      setState((p) => ({
        ...p,
        phase: "voided",
        deadline: null,
        history: stamp(p, "VOIDED", "Hold released — no money moved", "GUARDRAIL"),
      }));
    } catch (err) {
      const msg =
        err instanceof BackendFailure && err.httpStatus === 409
          ? "Window already closed — capture claimed by the guardrail"
          : err instanceof BackendFailure
            ? String(
                (err.body as { message?: string }).message ?? `HTTP ${err.httpStatus}`
              )
            : "Cannot reach the backend";
      setState((p) => {
        const isConflict = msg.startsWith("Window already closed");
        return {
          ...p,
          phase: isConflict ? p.phase : "approved",
          notice: msg,
          history: stamp(p, "VOID_REQUESTED", msg, "GUARDRAIL"),
        };
      });
      if (msg.startsWith("Window already closed")) startPolling(orderId);
      else startPolling(orderId);
    }
  }, [startPolling, stopPolling]);

  const abandon = useCallback(() => {
    const orderId = stateRef.current.orderId;
    stopPolling();
    if (orderId) {
      markOrderStatus(orderId, "ABANDONED");
      setState((p) => ({
        ...p,
        phase: "abandoned",
        deadline: null,
        history: stamp(p, "ABANDONED", "Order abandoned before approval", "BUYER"),
      }));
    }
  }, [stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setState((p) => ({ ...initialState, history: p.history }));
  }, [stopPolling]);

  const clearLedger = useCallback(() => {
    try {
      window.localStorage.removeItem("pausepal.orders.v1");
    } catch {
      /* noop */
    }
  }, []);

  return {
    state,
    beginCheckout,
    openApproval,
    requestVoid,
    abandon,
    reset,
    clearLedger,
  };
}
