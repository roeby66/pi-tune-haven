// Server functions for Pi Network authentication verification.
//
// Pipeline (all server-side, nothing trusted from the browser):
//   1. Verify the Pi access token with https://api.minepi.com/v2/me
//   2. Create / reuse the matching Supabase Auth user and mint a Supabase session
//   3. Upsert public.pi_users (linked to auth.users via auth_user_id)
//   4. Preserve / grant roles in public.user_roles
//   5. Set the signed httpOnly Pi session cookie (used by server functions)
import { createServerFn } from "@tanstack/react-start";

export interface VerifiedPiSession {
  uid: string;
  username: string;
  isAdmin: boolean;
  joinedAt: string;
  authUserId: string;
  supabase: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number | null;
  };
}

export const verifyPiAuth = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string }) => {
    if (!data || typeof data.accessToken !== "string" || data.accessToken.length < 8) {
      throw new Error("INVALID_ACCESS_TOKEN");
    }
    return data;
  })
  .handler(async ({ data }): Promise<VerifiedPiSession> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { setPiSessionCookie } = await import("@/lib/pi-session.server");
    const { ensureSupabaseSessionForPi } = await import("@/lib/pi-supabase-auth.server");

    const flowStart = Date.now();
    const log = (stage: string, extra?: Record<string, unknown>) => {
      console.log(`[AUTH-SRV][${Date.now() - flowStart}ms] ${stage}`, extra ?? "");
    };
    const time = async <T,>(stage: string, fn: () => Promise<T>): Promise<T> => {
      const s = Date.now();
      try {
        const v = await fn();
        log(`${stage}:end`, { durationMs: Date.now() - s });
        return v;
      } catch (e) {
        log(`${stage}:error`, { durationMs: Date.now() - s, err: (e as Error)?.message });
        throw e;
      }
    };

    log("STEP_1_VERIFY_PI_TOKEN:start", { tokenLen: data.accessToken.length });

    // ---------------------------------------------------------------- 1) Pi
    let piMe: { uid: string; username: string };
    try {
      const res = await time("pi./v2/me", () =>
        fetch("https://api.minepi.com/v2/me", {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        }),
      );
      const rawBody = await res.text();
      log("pi./v2/me:status", { status: res.status, bodyPreview: rawBody.slice(0, 200) });
      if (!res.ok) {
        throw new Error(`PI_VERIFY_FAILED: status=${res.status} body=${rawBody.slice(0, 200)}`);
      }
      let parsed: { uid?: string; username?: string } = {};
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        throw new Error(`PI_VERIFY_FAILED: non-json body=${rawBody.slice(0, 200)}`);
      }
      if (!parsed.uid || !parsed.username) {
        throw new Error(`PI_VERIFY_FAILED: missing uid/username in ${rawBody.slice(0, 200)}`);
      }
      piMe = { uid: parsed.uid, username: parsed.username };
      log("STEP_1_VERIFY_PI_TOKEN:ok", { uid: piMe.uid, username: piMe.username });
    } catch (e) {
      const msg = (e as Error)?.message || "PI_VERIFY_FAILED";
      console.error("[AUTH-SRV] Pi API error:", msg);
      throw new Error(msg);
    }

    const logSbError = (stage: string, error: unknown) => {
      const e = error as { code?: string; message?: string; details?: string; hint?: string } | null;
      console.error(`[AUTH-SRV] Supabase Error @${stage}`, {
        code: e?.code,
        message: e?.message,
        details: e?.details,
        hint: e?.hint,
      });
    };
    const sbErrMsg = (stage: string, error: unknown): string => {
      const e = error as { code?: string; message?: string; details?: string; hint?: string } | null;
      return `DB_${stage}_FAILED: code=${e?.code ?? "?"} message=${e?.message ?? "?"} details=${e?.details ?? "?"} hint=${e?.hint ?? "?"}`;
    };

    // ------------------------------------------- 2) existing profile lookup
    const existing = await time("STEP_2_LOAD_EXISTING_PROFILE", async () => {
      const { data: row, error } = await supabaseAdmin
        .from("pi_users")
        .select("uid, auth_user_id, joined_at")
        .eq("uid", piMe.uid)
        .maybeSingle();
      if (error) {
        logSbError("select-pi_users", error);
        throw new Error(sbErrMsg("SELECT_PI_USERS", error));
      }
      log("STEP_2_LOAD_EXISTING_PROFILE:result", {
        found: !!row,
        authUserId: row?.auth_user_id ?? null,
      });
      return row;
    });

    // ------------------------------------------- 3) Supabase Auth user/session
    const sbSession = await time("STEP_3_SUPABASE_AUTH_USER", () =>
      ensureSupabaseSessionForPi(piMe.uid, piMe.username, existing?.auth_user_id ?? null),
    );
    log("STEP_3_SUPABASE_AUTH_USER:ok", { authUserId: sbSession.authUserId });

    // ------------------------------------------- 4) upsert pi_users profile
    await time("STEP_4_UPSERT_PI_USERS", async () => {
      const payload = {
        uid: piMe.uid,
        username: piMe.username,
        auth_user_id: sbSession.authUserId,
        last_seen_at: new Date().toISOString(),
      };
      const { error } = await supabaseAdmin.from("pi_users").upsert(payload, { onConflict: "uid" });
      if (error) {
        logSbError("upsert-pi_users", error);
        throw new Error(sbErrMsg("UPSERT_PI_USERS", error));
      }
      log("STEP_4_UPSERT_PI_USERS:ok", { uid: piMe.uid, authUserId: sbSession.authUserId });
    });

    // ------------------------------------------- 5) roles (preserve existing)
    const adminCount = await time("STEP_5_COUNT_ADMINS", async () => {
      const { count, error } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      if (error) logSbError("count-admins", error);
      return count ?? 0;
    });

    const grantRole = async (role: "admin" | "user") => {
      const { data: existingRole, error: selErr } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", piMe.uid)
        .eq("role", role)
        .maybeSingle();
      if (selErr) {
        logSbError(`select-role-${role}`, selErr);
        throw new Error(sbErrMsg(`SELECT_ROLE_${role.toUpperCase()}`, selErr));
      }
      if (existingRole) {
        log("STEP_5_ROLE_PRESERVED", { role });
        return;
      }
      const { error: insErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: piMe.uid, role });
      if (insErr) {
        logSbError(`insert-role-${role}`, insErr);
        throw new Error(sbErrMsg(`INSERT_ROLE_${role.toUpperCase()}`, insErr));
      }
      log("STEP_5_ROLE_GRANTED", { role });
    };

    if (adminCount === 0) await time("STEP_5_BOOTSTRAP_ADMIN", () => grantRole("admin"));
    await time("STEP_5_GRANT_USER", () => grantRole("user"));

    const roles = await time("STEP_5_LOAD_ROLES", async () => {
      const { data: r } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", piMe.uid);
      return r;
    });
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");

    // ------------------------------------------- 6) signed session cookie
    await time("STEP_6_SET_COOKIE", async () => {
      setPiSessionCookie(piMe.uid, piMe.username);
    });

    log("AUTH_COMPLETE", {
      totalMs: Date.now() - flowStart,
      uid: piMe.uid,
      authUserId: sbSession.authUserId,
      isAdmin,
    });

    return {
      uid: piMe.uid,
      username: piMe.username,
      isAdmin,
      joinedAt: existing?.joined_at ?? new Date().toISOString(),
      authUserId: sbSession.authUserId,
      supabase: {
        accessToken: sbSession.accessToken,
        refreshToken: sbSession.refreshToken,
        expiresAt: sbSession.expiresAt,
      },
    };
  });

export interface PiSessionInfo {
  uid: string;
  username: string;
  isAdmin: boolean;
  joinedAt: string;
  authUserId: string | null;
}

/** Returns the current verified session (from the signed httpOnly cookie) if any. */
export const getPiSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<PiSessionInfo | null> => {
    const { readPiSession } = await import("@/lib/pi-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sess = readPiSession();
    if (!sess) {
      console.log("[AUTH-SRV] getPiSession: no cookie");
      return null;
    }
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", sess.uid);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    const { data: profile } = await supabaseAdmin
      .from("pi_users")
      .select("joined_at, username, auth_user_id")
      .eq("uid", sess.uid)
      .maybeSingle();
    console.log("[AUTH-SRV] getPiSession: ok", { uid: sess.uid, isAdmin });
    return {
      uid: sess.uid,
      username: profile?.username ?? sess.username,
      isAdmin,
      joinedAt: profile?.joined_at ?? new Date().toISOString(),
      authUserId: profile?.auth_user_id ?? null,
    };
  },
);

export const signOutPi = createServerFn({ method: "POST" }).handler(async () => {
  const { clearPiSessionCookie } = await import("@/lib/pi-session.server");
  clearPiSessionCookie();
  console.log("[AUTH-SRV] signOutPi: cookie cleared");
  return { ok: true };
});
