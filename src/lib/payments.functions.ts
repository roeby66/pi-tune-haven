// Server-side membership + Pi payment verification for MyPiMusic.
// All state changes happen here after calling the official Pi Platform API.
import { createServerFn } from "@tanstack/react-start";

const PI_API_BASE = "https://api.minepi.com/v2";

export interface MembershipPlan {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price: number;
  currency: string;
  billing_cycle: string;
  duration_days: number;
  sort_order: number;
  benefits: string[];
}

export interface ActiveMembership {
  id: string;
  plan_id: string;
  plan_name: string;
  membership_level: string;
  membership_status: string;
  started_at: string | null;
  expires_at: string | null;
}

async function piApi(path: string, init: RequestInit = {}): Promise<Response> {
  const key = process.env.PI_API_KEY;
  if (!key) throw new Error("PI_API_KEY not configured on server");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Key ${key}`);
  headers.set("Content-Type", "application/json");
  return fetch(`${PI_API_BASE}${path}`, { ...init, headers });
}

async function logEvent(paymentId: string | null, eventType: string, message: string, raw?: unknown) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payment_logs").insert({
      payment_id: paymentId,
      event_type: eventType,
      event_message: message,
      raw_response: (raw ?? null) as never,
    });
  } catch (e) {
    console.error("[payments] payment_logs insert failed", e);
  }
}

// -------- List active plans (public) --------
export const listMembershipPlans = createServerFn({ method: "GET" }).handler(
  async (): Promise<MembershipPlan[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("membership_plans")
      .select("id,name,display_name,description,price,currency,billing_cycle,duration_days,sort_order,benefits")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      ...p,
      price: Number(p.price),
      benefits: Array.isArray(p.benefits) ? (p.benefits as string[]) : [],
    })) as MembershipPlan[];
  },
);

// -------- Current user's active membership --------
export const getMyMembership = createServerFn({ method: "GET" }).handler(
  async (): Promise<ActiveMembership | null> => {
    const { readPiSession } = await import("@/lib/pi-session.server");
    const sess = readPiSession();
    if (!sess) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_memberships")
      .select("id,membership_plan_id,membership_level,membership_status,started_at,expires_at, membership_plans(name)")
      .eq("user_uid", sess.uid)
      .eq("membership_status", "active")
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const planRow = (data as unknown as { membership_plans?: { name?: string } }).membership_plans;
    return {
      id: data.id,
      plan_id: data.membership_plan_id,
      plan_name: planRow?.name ?? data.membership_level,
      membership_level: data.membership_level,
      membership_status: data.membership_status,
      started_at: data.started_at,
      expires_at: data.expires_at,
    };
  },
);

// -------- Step A: server approval --------
export const approveMembershipPayment = createServerFn({ method: "POST" })
  .inputValidator((data: { paymentId: string; planId: string }) => {
    if (!data?.paymentId || !data?.planId) throw new Error("INVALID_INPUT");
    return data;
  })
  .handler(async ({ data }) => {
    const { requirePiSession } = await import("@/lib/pi-session.server");
    const sess = requirePiSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load plan.
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("membership_plans")
      .select("*")
      .eq("id", data.planId)
      .eq("is_active", true)
      .single();
    if (planErr || !plan) throw new Error("PLAN_NOT_FOUND");

    // Fetch payment metadata from Pi to double-check amount + memo.
    const piRes = await piApi(`/payments/${data.paymentId}`);
    const piBody = await piRes.text();
    await logEvent(data.paymentId, "pi_get_payment", `status=${piRes.status}`, safeJson(piBody));
    if (!piRes.ok) throw new Error(`PI_GET_FAILED: ${piRes.status}`);
    const piPayment = safeJson(piBody) as {
      identifier: string;
      user_uid?: string;
      amount: number;
      memo?: string;
      metadata?: { plan_id?: string };
    };
    if (piPayment.user_uid && piPayment.user_uid !== sess.uid) {
      throw new Error("PAYMENT_USER_MISMATCH");
    }
    if (Number(piPayment.amount) !== Number(plan.price)) {
      throw new Error(`AMOUNT_MISMATCH: expected ${plan.price} got ${piPayment.amount}`);
    }
    if (piPayment.metadata?.plan_id && piPayment.metadata.plan_id !== plan.id) {
      throw new Error("PLAN_MISMATCH");
    }

    // Upsert pending row.
    const { error: upErr } = await supabaseAdmin.from("membership_payments").upsert(
      {
        payment_id: data.paymentId,
        user_uid: sess.uid,
        membership_plan_id: plan.id,
        amount: plan.price,
        currency: plan.currency,
        payment_status: "pending",
        memo: piPayment.memo ?? null,
        metadata: { plan_name: plan.name },
      },
      { onConflict: "payment_id" },
    );
    if (upErr) throw new Error(`DB_UPSERT_FAILED: ${upErr.message}`);

    // Call Pi /approve.
    const approveRes = await piApi(`/payments/${data.paymentId}/approve`, { method: "POST" });
    const approveBody = await approveRes.text();
    await logEvent(data.paymentId, "pi_approve", `status=${approveRes.status}`, safeJson(approveBody));
    if (!approveRes.ok) {
      await supabaseAdmin
        .from("membership_payments")
        .update({ payment_status: "failed" })
        .eq("payment_id", data.paymentId);
      throw new Error(`PI_APPROVE_FAILED: ${approveRes.status} ${approveBody.slice(0, 200)}`);
    }
    return { ok: true };
  });

// -------- Step B: server completion + verification + activation --------
export const completeMembershipPayment = createServerFn({ method: "POST" })
  .inputValidator((data: { paymentId: string; txid: string }) => {
    if (!data?.paymentId || !data?.txid) throw new Error("INVALID_INPUT");
    return data;
  })
  .handler(async ({ data }): Promise<{ ok: true; membership: ActiveMembership }> => {
    const { requirePiSession } = await import("@/lib/pi-session.server");
    const sess = requirePiSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Look up our pending payment row.
    const { data: payRow, error: payErr } = await supabaseAdmin
      .from("membership_payments")
      .select("*, membership_plans(*)")
      .eq("payment_id", data.paymentId)
      .single();
    if (payErr || !payRow) throw new Error("PAYMENT_NOT_FOUND");
    if (payRow.user_uid !== sess.uid) throw new Error("PAYMENT_USER_MISMATCH");
    const plan = (payRow as unknown as { membership_plans: MembershipPlan & { duration_days: number; name: string } }).membership_plans;
    if (!plan) throw new Error("PLAN_NOT_FOUND");

    // Idempotency: if already completed, just return current membership.
    if (payRow.payment_status === "completed") {
      const current = await currentMembershipOrThrow(sess.uid);
      return { ok: true, membership: current };
    }

    // Call Pi /complete.
    const compRes = await piApi(`/payments/${data.paymentId}/complete`, {
      method: "POST",
      body: JSON.stringify({ txid: data.txid }),
    });
    const compBody = await compRes.text();
    await logEvent(data.paymentId, "pi_complete", `status=${compRes.status}`, safeJson(compBody));
    if (!compRes.ok) {
      await supabaseAdmin
        .from("membership_payments")
        .update({ payment_status: "failed" })
        .eq("payment_id", data.paymentId);
      throw new Error(`PI_COMPLETE_FAILED: ${compRes.status} ${compBody.slice(0, 200)}`);
    }

    // Verify: fetch payment again and confirm developer_completed + txid.
    const verifyRes = await piApi(`/payments/${data.paymentId}`);
    const verifyBody = await verifyRes.text();
    await logEvent(data.paymentId, "pi_verify", `status=${verifyRes.status}`, safeJson(verifyBody));
    const verified = safeJson(verifyBody) as {
      transaction?: { txid?: string; verified?: boolean };
      status?: { developer_completed?: boolean; transaction_verified?: boolean };
    };
    const txid = verified.transaction?.txid ?? data.txid;
    const isVerified =
      verified.transaction?.verified === true ||
      verified.status?.transaction_verified === true ||
      verified.status?.developer_completed === true;
    if (!isVerified) throw new Error("PAYMENT_NOT_VERIFIED");

    const nowIso = new Date().toISOString();

    // Mark payment as completed.
    await supabaseAdmin
      .from("membership_payments")
      .update({
        payment_status: "completed",
        transaction_id: txid,
        tx_hash: txid,
        paid_at: nowIso,
        verified_at: nowIso,
      })
      .eq("payment_id", data.paymentId);

    // Get previous membership for history.
    const { data: prev } = await supabaseAdmin
      .from("user_memberships")
      .select("membership_level, membership_status")
      .eq("user_uid", sess.uid)
      .eq("membership_status", "active")
      .maybeSingle();

    // Expire existing active memberships.
    await supabaseAdmin
      .from("user_memberships")
      .update({ membership_status: "expired" })
      .eq("user_uid", sess.uid)
      .eq("membership_status", "active");

    // Insert new active membership.
    const expiresAt = new Date(Date.now() + plan.duration_days * 24 * 60 * 60 * 1000).toISOString();
    const { data: newMem, error: memErr } = await supabaseAdmin
      .from("user_memberships")
      .insert({
        user_uid: sess.uid,
        membership_plan_id: plan.id,
        membership_level: plan.name,
        membership_status: "active",
        started_at: nowIso,
        expires_at: expiresAt,
        auto_renew: false,
        renewal_status: "manual",
      })
      .select("id, membership_plan_id, membership_level, membership_status, started_at, expires_at")
      .single();
    if (memErr || !newMem) throw new Error(`MEMBERSHIP_INSERT_FAILED: ${memErr?.message}`);

    // History.
    await supabaseAdmin.from("membership_history").insert({
      user_uid: sess.uid,
      previous_plan: prev?.membership_level ?? "free",
      new_plan: plan.name,
      action: prev ? "upgrade_or_switch" : "activate",
      description: `Activated ${plan.display_name} via Pi payment ${data.paymentId}`,
    });

    return {
      ok: true,
      membership: {
        id: newMem.id,
        plan_id: newMem.membership_plan_id,
        plan_name: plan.name,
        membership_level: newMem.membership_level,
        membership_status: newMem.membership_status,
        started_at: newMem.started_at,
        expires_at: newMem.expires_at,
      },
    };
  });

// -------- Step C: user cancelled --------
export const cancelMembershipPayment = createServerFn({ method: "POST" })
  .inputValidator((data: { paymentId: string }) => {
    if (!data?.paymentId) throw new Error("INVALID_INPUT");
    return data;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("membership_payments")
      .update({ payment_status: "cancelled" })
      .eq("payment_id", data.paymentId);
    await logEvent(data.paymentId, "user_cancelled", "User cancelled in Pi Wallet");
    return { ok: true };
  });

async function currentMembershipOrThrow(uid: string): Promise<ActiveMembership> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_memberships")
    .select("id, membership_plan_id, membership_level, membership_status, started_at, expires_at, membership_plans(name)")
    .eq("user_uid", uid)
    .eq("membership_status", "active")
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("NO_ACTIVE_MEMBERSHIP");
  const planRow = (data as unknown as { membership_plans?: { name?: string } }).membership_plans;
  return {
    id: data.id,
    plan_id: data.membership_plan_id,
    plan_name: planRow?.name ?? data.membership_level,
    membership_level: data.membership_level,
    membership_status: data.membership_status,
    started_at: data.started_at,
    expires_at: data.expires_at,
  };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return { raw: s.slice(0, 500) };
  }
}
