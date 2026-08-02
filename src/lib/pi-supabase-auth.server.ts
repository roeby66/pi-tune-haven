// Server-only: bridges a verified Pi identity to a real Supabase Auth user.
//
// Flow:
//   1. Pi access token is verified against https://api.minepi.com/v2/me (caller).
//   2. This module creates (or finds) the matching Supabase Auth user.
//   3. It mints a real Supabase session (access + refresh token) that the
//      browser installs via supabase.auth.setSession(), so every client query
//      runs under auth.uid() and RLS.
//
// The Supabase password is derived deterministically from PI_SESSION_SECRET and
// the Pi uid. It never leaves the server and is never shown to the user.
import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const EMAIL_DOMAIN = "pi.mypimusic.app";

function log(stage: string, extra?: Record<string, unknown>) {
  console.log(`[AUTH-SB] ${stage}`, extra ?? "");
}

function secret(): string {
  const s = process.env.PI_SESSION_SECRET;
  if (!s) throw new Error("PI_SESSION_SECRET is not configured");
  return s;
}

export function piEmailFor(uid: string): string {
  const safe = uid.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `pi_${safe}@${EMAIL_DOMAIN}`;
}

export function piPasswordFor(uid: string): string {
  // 64 hex chars — deterministic, high entropy, server-only.
  return createHmac("sha256", secret()).update(`pi-user:${uid}`).digest("hex");
}

function publishableClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY are not configured");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export interface PiSupabaseSession {
  authUserId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
}

/**
 * Creates or reuses the Supabase Auth user for a verified Pi uid and returns a
 * fresh Supabase session for it.
 */
export async function ensureSupabaseSessionForPi(
  uid: string,
  username: string,
  knownAuthUserId: string | null,
): Promise<PiSupabaseSession> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = piEmailFor(uid);
  const password = piPasswordFor(uid);

  let authUserId = knownAuthUserId;

  if (authUserId) {
    log("auth-user:known", { authUserId });
    // Keep the derived password in sync (secret rotation / legacy rows).
    const { error } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      password,
      email_confirm: true,
      user_metadata: { pi_uid: uid, pi_username: username },
    });
    if (error) {
      console.warn("[AUTH-SB] updateUserById failed, will retry create/sign-in", error.message);
      authUserId = null;
    }
  }

  if (!authUserId) {
    log("auth-user:create", { email });
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { pi_uid: uid, pi_username: username },
    });
    if (error) {
      // Most likely: user already exists but pi_users.auth_user_id was missing.
      log("auth-user:create-failed", { message: error.message });
    } else if (data.user) {
      authUserId = data.user.id;
      log("auth-user:created", { authUserId });
    }
  }

  // Mint the session with the publishable client (password grant).
  const anon = publishableClient();
  const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signInData.session || !signInData.user) {
    console.error("[AUTH-SB] signInWithPassword failed", signInError?.message);
    throw new Error(`SUPABASE_SIGNIN_FAILED: ${signInError?.message ?? "no session returned"}`);
  }

  authUserId = signInData.user.id;
  log("session:minted", {
    authUserId,
    expiresAt: signInData.session.expires_at,
  });

  return {
    authUserId,
    accessToken: signInData.session.access_token,
    refreshToken: signInData.session.refresh_token,
    expiresAt: signInData.session.expires_at ?? null,
  };
}
