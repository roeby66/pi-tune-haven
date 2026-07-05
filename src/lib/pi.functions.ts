// Server functions for Pi Network authentication verification.
import { createServerFn } from "@tanstack/react-start";

export interface VerifiedPiSession {
  uid: string;
  username: string;
  isAdmin: boolean;
  joinedAt: string;
}

/**
 * Verifies a Pi access token server-side by calling Pi's /v2/me endpoint.
 * On success:
 *  - upserts the pi_users row
 *  - grants `admin` role to the first-ever Pioneer to sign in
 *  - sets a signed httpOnly session cookie
 */
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

    const flowStart = Date.now();
    const log = (stage: string, extra?: Record<string, unknown>) => {
      const t = Date.now() - flowStart;
      console.log(`[AUTH-SRV][${t}ms] ${stage}`, extra ?? "");
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

    log("verifyPiAuth:start", { tokenLen: data.accessToken.length });

    // 1) Verify with Pi Platform.
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
    } catch (e) {
      const msg = (e as Error)?.message || "PI_VERIFY_FAILED";
      console.error("[verifyPiAuth] Pi API error:", msg);
      throw new Error(msg);
    }


    // Helper: rich supabase error logger.
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
      const isDev = process.env.NODE_ENV !== "production";
      const detail = `code=${e?.code ?? "?"} message=${e?.message ?? "?"} details=${e?.details ?? "?"} hint=${e?.hint ?? "?"}`;
      return isDev ? `DB_${stage}_FAILED: ${detail}` : `DB_${stage}_FAILED`;
    };

    // 2) SELECT-then-INSERT/UPDATE pi_users row (avoid blind upsert).
    await time("db:persist-pi_users", async () => {
      const { data: existing, error: selErr } = await supabaseAdmin
        .from("pi_users")
        .select("uid")
        .eq("uid", piMe.uid)
        .maybeSingle();
      if (selErr) {
        logSbError("select-pi_users", selErr);
        throw new Error(sbErrMsg("SELECT_PI_USERS", selErr));
      }
      log("db:pi_users:select-result", { found: !!existing });

      if (existing) {
        const { error: updErr } = await supabaseAdmin
          .from("pi_users")
          .update({ username: piMe.username, last_seen_at: new Date().toISOString() })
          .eq("uid", piMe.uid);
        if (updErr) {
          logSbError("update-pi_users", updErr);
          throw new Error(sbErrMsg("UPDATE_PI_USERS", updErr));
        }
        log("db:pi_users:updated");
      } else {
        const { error: insErr } = await supabaseAdmin
          .from("pi_users")
          .insert({ uid: piMe.uid, username: piMe.username, last_seen_at: new Date().toISOString() });
        if (insErr) {
          logSbError("insert-pi_users", insErr);
          throw new Error(sbErrMsg("INSERT_PI_USERS", insErr));
        }
        log("db:pi_users:inserted");
      }
    });

    // 3) Bootstrap: if no admin exists yet, grant this user admin.
    const adminCount = await time("db:count-admins", async () => {
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
      if (existingRole) return;
      const { error: insErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: piMe.uid, role });
      if (insErr) {
        logSbError(`insert-role-${role}`, insErr);
        throw new Error(sbErrMsg(`INSERT_ROLE_${role.toUpperCase()}`, insErr));
      }
    };
    if (adminCount === 0) {
      await time("db:grant-admin", () => grantRole("admin"));
    }
    await time("db:grant-user", () => grantRole("user"));

    // 4) Determine admin flag & join date.
    const roles = await time("db:select-roles", async () => {
      const { data: r } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", piMe.uid);
      return r;
    });
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");

    const profile = await time("db:select-profile", async () => {
      const { data: p } = await supabaseAdmin
        .from("pi_users")
        .select("joined_at")
        .eq("uid", piMe.uid)
        .single();
      return p;
    });

    // 5) Set signed session cookie.
    await time("cookie:set", async () => {
      setPiSessionCookie(piMe.uid, piMe.username);
    });

    log("verifyPiAuth:done", { totalMs: Date.now() - flowStart, uid: piMe.uid, isAdmin });

    return {
      uid: piMe.uid,
      username: piMe.username,
      isAdmin,
      joinedAt: profile?.joined_at ?? new Date().toISOString(),
    };
  });


/** Returns the current verified session (from cookie) if any. */
export const getPiSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<VerifiedPiSession | null> => {
    const { readPiSession } = await import("@/lib/pi-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sess = readPiSession();
    if (!sess) return null;
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", sess.uid);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    const { data: profile } = await supabaseAdmin
      .from("pi_users")
      .select("joined_at, username")
      .eq("uid", sess.uid)
      .single();
    return {
      uid: sess.uid,
      username: profile?.username ?? sess.username,
      isAdmin,
      joinedAt: profile?.joined_at ?? new Date().toISOString(),
    };
  },
);

export const signOutPi = createServerFn({ method: "POST" }).handler(async () => {
  const { clearPiSessionCookie } = await import("@/lib/pi-session.server");
  clearPiSessionCookie();
  return { ok: true };
});
