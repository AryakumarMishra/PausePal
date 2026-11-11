"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/components/Header";
import BuyerRail from "@/components/BuyerRail";
import MerchantRail from "@/components/MerchantRail";
import Spine from "@/components/Spine";
import { backendAlive } from "@/libs/api";
import { useTransactionFlow } from "@/libs/useTransactionFlow";
import { loadOrders } from "@/libs/store";
import type { StoredOrder } from "@/libs/types";

export default function Page() {
  const {
    state,
    beginCheckout,
    openApproval,
    requestVoid,
    abandon,
    reset,
    clearLedger,
  } = useTransactionFlow();

  const [backendUp, setBackendUp] = useState(false);
  const [orders, setOrders] = useState<StoredOrder[]>([]);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const up = await backendAlive();
      if (alive) setBackendUp(up);
    };
    check();
    const t = setInterval(check, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // re-read the day book whenever the flow advances
  useEffect(() => {
    setOrders(loadOrders());
  }, [state.history.length]);

  const handleClearLedger = useCallback(() => {
    clearLedger();
    setOrders([]);
  }, [clearLedger]);

  return (
    <div className="shell">
      <Header backendUp={backendUp} phase={state.phase} />

      <main className="split">
        <BuyerRail
          state={state}
          onBegin={beginCheckout}
          onOpenApproval={openApproval}
          onVoid={requestVoid}
          onAbandon={abandon}
          onReset={reset}
        />
        <Spine history={state.history} />
        <MerchantRail
          state={state}
          orders={orders}
          onClearLedger={handleClearLedger}
        />
      </main>

      <footer className="footer">
        <span>
          PayPal Orders v2 · intent AUTHORIZE · 20s grace guardrail
        </span>
        <span>
          FastAPI backend :8000 · Next.js frontend :3000 · sandbox
        </span>
      </footer>
    </div>
  );
}
