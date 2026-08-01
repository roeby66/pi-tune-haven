// Client-side wrapper around Pi.createPayment for MyPiMusic memberships.
// Uses the official Pi SDK Payments API. Never trusts client-side success —
// all activation is done server-side after Pi Platform verification.

import { ensurePiScopes, initializePi } from "@/lib/pi-auth";

export interface PiPaymentMetadata {
  type: "membership";
  plan_id: string;
  plan_name: string;
}

export interface PiPaymentRequest {
  amount: number;
  memo: string;
  metadata: PiPaymentMetadata;
}

export interface PiPaymentCallbacks {
  onReadyForServerApproval: (paymentId: string) => Promise<void> | void;
  onReadyForServerCompletion: (paymentId: string, txid: string) => Promise<void> | void;
  onCancel: (paymentId: string) => void;
  onError: (error: Error, payment?: unknown) => void;
}

interface PiWithPayments {
  createPayment?: (payment: PiPaymentRequest, callbacks: PiPaymentCallbacks) => void;
}

/** Trigger the official Pi Wallet payment flow. */
export async function createPiPayment(
  request: PiPaymentRequest,
  callbacks: PiPaymentCallbacks,
): Promise<void> {
  await initializePi();
  // Guarantee the current Pi session includes the "payments" scope. If the
  // cached session was created without it, ensurePiScopes will invalidate the
  // session and force a fresh Pi.authenticate() with the full scope set.
  await ensurePiScopes(["username", "payments"]);
  const Pi = (typeof window !== "undefined" ? window.Pi : undefined) as
    | (PiWithPayments & Record<string, unknown>)
    | undefined;
  if (!Pi || typeof Pi.createPayment !== "function") {
    payDiagError("CREATE_PAYMENT_CALLED", new Error("PI_PAYMENTS_UNAVAILABLE"));
    throw new Error("PI_PAYMENTS_UNAVAILABLE");
  }
  console.log("[PiPayments] createPayment", request);
  payDiagStage("CREATE_PAYMENT_CALLED", { amount: request.amount, memo: request.memo });
  Pi.createPayment(request, callbacks);
}

