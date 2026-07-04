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


    // 2) Upsert pi_users row.
    await time("db:upsert-pi_users", async () => {
      const { error: upsertErr } = await supabaseAdmin
        .from("pi_users")
        .upsert(
          {
            uid: piMe.uid,
            username: piMe.username,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "uid" },
        );
      if (upsertErr) {
        console.error("[verifyPiAuth] upsert error", upsertErr);
        throw new Error("DB_UPSERT_FAILED");
      }
    });

    // 3) Bootstrap: if no admin exists yet, grant this user admin.
    const adminCount = await time("db:count-admins", async () => {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      return count ?? 0;
    });
    if (adminCount === 0) {
      await time("db:grant-admin", async () => {
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: piMe.uid, role: "admin" }, { onConflict: "user_id,role" });
      });
    }
    await time("db:grant-user", async () => {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: piMe.uid, role: "user" }, { onConflict: "user_id,role" });
    });

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
