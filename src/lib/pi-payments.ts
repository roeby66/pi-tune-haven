// Client-side wrapper around Pi.createPayment for MyPiMusic memberships.
// Uses the official Pi SDK Payments API. Never trusts client-side success —
// all activation is done server-side after Pi Platform verification.

import { initializePi } from "@/lib/pi-auth";

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
  const Pi = (typeof window !== "undefined" ? window.Pi : undefined) as
    | (PiWithPayments & Record<string, unknown>)
    | undefined;
  if (!Pi || typeof Pi.createPayment !== "function") {
    throw new Error("PI_PAYMENTS_UNAVAILABLE");
  }
  console.log("[PiPayments] createPayment", request);
  Pi.createPayment(request, callbacks);
}
