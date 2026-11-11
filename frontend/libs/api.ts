import type {
  BackendError,
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  ReturnAuthorizedResponse,
  ReturnRejectedResponse,
  VoidResponse,
} from "./types";

const BASE = "/backend";

async function parseJsonOrThrow(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new BackendFailure(res.status, {
      httpStatus: res.status,
      body: { error: `Non-JSON response (HTTP ${res.status})` },
    });
  }
}

export class BackendFailure extends Error {
  httpStatus: number;
  body: ReturnRejectedResponse | VoidResponse;

  constructor(httpStatus: number, detail: BackendError) {
    super(`HTTP ${httpStatus}`);
    this.httpStatus = detail.httpStatus;
    this.body = detail.body;
  }
}

export async function createCheckout(
  req: CreateCheckoutRequest
): Promise<CreateCheckoutResponse> {
  const res = await fetch(`${BASE}/checkout/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const body = (await parseJsonOrThrow(res)) as CreateCheckoutResponse;
  if (!res.ok || !body.success) {
    throw new BackendFailure(res.status, {
      httpStatus: res.status,
      body: body as unknown as ReturnRejectedResponse,
    });
  }
  return body;
}

export type PollResult =
  | { kind: "authorized"; body: ReturnAuthorizedResponse }
  | { kind: "rejected"; body: ReturnRejectedResponse };

/**
 * GET /paypal/return is idempotent on the backend:
 *  - 200 AUTHORIZED (+ grace_deadline when this call performs the authorize)
 *  - 400/404 with the current DB status otherwise
 * so polling it gives us full state-machine visibility.
 */
export async function pollReturn(token: string): Promise<PollResult> {
  const res = await fetch(
    `${BASE}/paypal/return?token=${encodeURIComponent(token)}`,
    { cache: "no-store" }
  );
  const body = (await parseJsonOrThrow(res)) as
    | ReturnAuthorizedResponse
    | ReturnRejectedResponse;
  if (res.ok && body && "status" in body && body.status === "AUTHORIZED") {
    return {
      kind: "authorized",
      body: body as ReturnAuthorizedResponse,
    };
  }
  return { kind: "rejected", body: body as ReturnRejectedResponse };
}

export async function voidTransaction(
  orderId: string
): Promise<VoidResponse> {
  const res = await fetch(
    `${BASE}/transactions/${encodeURIComponent(orderId)}/cancel`,
    { method: "POST" }
  );
  const body = (await parseJsonOrThrow(res)) as VoidResponse;
  if (!res.ok || !body.success) {
    throw new BackendFailure(res.status, {
      httpStatus: res.status,
      body,
    });
  }
  return body;
}

/** Liveness probe: any HTTP answer (even 400) means the backend is up. */
export async function backendAlive(): Promise<boolean> {
  try {
    await fetch(`${BASE}/paypal/return`, { cache: "no-store" });
    return true;
  } catch {
    return false;
  }
}
