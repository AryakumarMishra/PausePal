export type TxnStatus =
  | "CREATED"
  | "AUTHORIZED"
  | "VOID_PENDING"
  | "VOIDED"
  | "CAPTURE_PENDING"
  | "CAPTURED";

export interface CreateCheckoutRequest {
  amount: number;
  currency: string;
}

export interface CreateCheckoutResponse {
  success: boolean;
  order_id: string;
  approval_url: string;
}

export interface ReturnAuthorizedResponse {
  success: true;
  order_id: string;
  status: "AUTHORIZED";
  message: string;
  authorization_id?: string;
  grace_deadline?: string;
}

export interface ReturnRejectedResponse {
  success?: false;
  status?: TxnStatus;
  message?: string;
  error?: string;
}

export interface VoidResponse {
  success: boolean;
  order_id?: string;
  status?: "VOIDED";
  message?: string;
}

export type BackendError = {
  httpStatus: number;
  body: ReturnRejectedResponse | VoidResponse;
};

export type LedgerStatus =
  | TxnStatus
  | "WAITING_APPROVAL"
  | "VOID_REQUESTED"
  | "ABANDONED";

export interface StoredOrder {
  orderId: string;
  amount: number;
  currency: string;
  createdAt: number;
  updatedAt: number;
  status: LedgerStatus;
  authorizationId?: string;
}
