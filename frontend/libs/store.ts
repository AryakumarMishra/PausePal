import type { LedgerStatus, StoredOrder } from "./types";

const KEY = "pausepal.orders.v1";

export function loadOrders(): StoredOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function upsertOrder(order: StoredOrder): void {
  const orders = loadOrders();
  const idx = orders.findIndex((o) => o.orderId === order.orderId);
  if (idx >= 0) orders[idx] = order;
  else orders.unshift(order);
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify(orders.slice(0, 50))
    );
  } catch {
    /* storage unavailable — demo still works in-memory */
  }
}

export function markOrderStatus(
  orderId: string,
  status: LedgerStatus,
  extra?: Partial<StoredOrder>
): void {
  const orders = loadOrders();
  const idx = orders.findIndex((o) => o.orderId === orderId);
  if (idx < 0) return;
  orders[idx] = {
    ...orders[idx],
    ...extra,
    status,
    updatedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(orders.slice(0, 50)));
  } catch {
    /* noop */
  }
}

export function findOrder(orderId: string): StoredOrder | undefined {
  return loadOrders().find((o) => o.orderId === orderId);
}
