import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  authenticatePi,
  describeAuthError,
  initializePi,
  isPiBrowser,
  logoutPi,
  resetPiInit,
  type PiUser,
} from "@/lib/pi-auth";
import { verifyPiAuth, getPiSession, signOutPi } from "@/lib/pi.functions";
import { supabase } from "@/integrations/supabase/client";
import { authStart, authLog, authError, stageTimer } from "@/lib/auth-diagnostics";
import {
  authDiagStart,
  authDiagStage,
  authDiagFact,
  authDiagError,
  authDiagFinish,
  authDiagVerifyCookie,
} from "@/lib/auth-diagnostic-logger";


export interface AppUser {
  uid: string;
  username: string;
  isAdmin: boolean;
  joinedAt: string;
  authUserId?: string | null;
}

interface AuthContextValue {
  user: AppUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
  isPiBrowser: boolean;
  isSdkReady: boolean;
  isAdmin: boolean;
  /** True once a real Supabase Auth session exists in this browser. */
  hasSupabaseSession: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [isSdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSupabaseSession, setHasSupabaseSession] = useState(false);
  const inFlightRef = useRef(false);

  // Rehydrate from server session cookie + best-effort SDK init.
  useEffect(() => {
    let cancelled = false;
    console.log("[AUTH] rehydrate: checking Supabase session + Pi cookie");

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[AUTH] supabase.onAuthStateChange", { event, present: !!session });
      setHasSupabaseSession(!!session);
    });

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const sbSession = data.session;
      console.log("[AUTH] rehydrate: supabase session", {
        present: !!sbSession,
        userId: sbSession?.user?.id ?? null,
      });
      setHasSupabaseSession(!!sbSession);

      let sess = null as Awaited<ReturnType<typeof getPiSession>>;
      try {
        sess = await getPiSession();
      } catch {
        /* ignore */
      }
      if (cancelled) return;

      // Both halves of the identity must be present: the signed Pi cookie
      // (server functions) AND a live Supabase session (RLS + payments).
      if (sess && sbSession) {
        console.log("[AUTH] rehydrate: pi session cookie valid", { uid: sess.uid });
        setUser(sess);
        setStatus("authenticated");
      } else {
        console.log("[AUTH] rehydrate: incomplete session", {
          piCookie: !!sess,
          supabase: !!sbSession,
        });
        if (sess && !sbSession) {
          // Stale cookie without a Supabase session — clear it so the user
          // gets a clean sign-in instead of failing RLS/payment calls.
          try {
            await signOutPi();
          } catch {
            /* ignore */
          }
        }
        setUser(null);
        setStatus("unauthenticated");
      }
    })();

    if (isPiBrowser()) {
      initializePi()
        .then(() => !cancelled && setSdkReady(true))
        .catch(() => !cancelled && setSdkReady(false));
    }
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);


  const signIn = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    authStart("signIn");
    authDiagStart("login-button");
    setError(null);
    setStatus("loading");
    const stopFlow = stageTimer("signIn:total");
    try {
      const stopPi = stageTimer("authenticatePi");
      const piUser: PiUser = await authenticatePi();
      stopPi({ uid: piUser.uid, tokenLen: piUser.accessToken?.length ?? 0 });
      authDiagStage("ACCESS_TOKEN_RECEIVED", { tokenLen: piUser.accessToken?.length ?? 0 });
      authDiagFact("accessTokenReceived", true);
      authDiagFact("accessTokenLength", piUser.accessToken?.length ?? 0);
      authLog("pi-user-returned-to-context", {
        uid: piUser.uid,
        username: piUser.username,
        tokenLen: piUser.accessToken?.length ?? 0,
      });
      // Server-side verification with Pi API + session cookie.
      const stopVerify = stageTimer("verifyPiAuth (serverFn)");
      authDiagStage("BACKEND_AUTH_REQUEST_STARTED");
      authDiagStage("COOKIE_WRITE_STARTED");
      authDiagStage("SUPABASE_SESSION_STARTED");
      const verified = await verifyPiAuth({ data: { accessToken: piUser.accessToken } });
      authDiagStage("BACKEND_AUTH_RESPONSE", { uid: verified.uid, isAdmin: verified.isAdmin });
      authDiagStage("COOKIE_WRITE_COMPLETED");
      authDiagVerifyCookie();
      authDiagStage("COOKIE_READ_VERIFIED");
      authDiagStage("SUPABASE_SESSION_COMPLETED");
      authDiagFact("sessionCreated", true);
      authDiagFact("userId", verified.uid);
      authDiagFact("username", verified.username);
      stopVerify({ uid: verified.uid, isAdmin: verified.isAdmin });

      // Install the real Supabase Auth session so every client query and RLS
      // policy runs under auth.uid().
      console.log("[AUTH] STEP: installing Supabase session", {
        authUserId: verified.authUserId,
        expiresAt: verified.supabase.expiresAt,
      });
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: verified.supabase.accessToken,
        refresh_token: verified.supabase.refreshToken,
      });
      if (sessionError || !sessionData.session) {
        console.error("[AUTH] Supabase setSession failed", sessionError?.message);
        throw new Error(`SUPABASE_SESSION_FAILED: ${sessionError?.message ?? "no session"}`);
      }
      setHasSupabaseSession(true);
      console.log("[AUTH] Supabase session active", {
        userId: sessionData.session.user.id,
      });
      authLog("server-verified", { ...verified });
      authDiagStage("USER_PROFILE_LOADING");
      setUser({
        uid: verified.uid,
        username: verified.username,
        isAdmin: verified.isAdmin,
        joinedAt: verified.joinedAt,
        authUserId: verified.authUserId,
      });
      setStatus("authenticated");
      authDiagStage("USER_PROFILE_LOADED");
      authDiagStage("AUTH_SUCCESS");
      authDiagStage("REDIRECT_STARTED", { targetRoute: "/home" });
      authDiagFact("targetRoute", "/home");
      stopFlow({ ok: true });
    } catch (err) {
      stopFlow({ ok: false });
      const raw = (err as Error)?.message || "AUTH_FAILED";
      authError("signIn", err);
      authDiagError("signIn", err);
      authDiagFinish(raw.includes("TIMEOUT") ? "TIMEOUT" : "FAILED");

      // If it's a known short code, translate; otherwise show the raw server error.
      const known = /^(PI_BROWSER_REQUIRED|SDK_UNAVAILABLE|SDK_LOAD_FAILED|AUTH_CANCELLED|AUTH_TIMEOUT|NETWORK_ERROR|INIT_TIMEOUT|INIT_FAILED|AUTH_FAILED)$/;
      setError(known.test(raw) ? describeAuthError(raw) : raw);
      setUser(null);
      setStatus("unauthenticated");
    } finally {
      inFlightRef.current = false;
    }

  }, []);

  const signOut = useCallback(async () => {
    try {
      await signOutPi();
    } catch {
      /* ignore */
    }
    try {
      await supabase.auth.signOut();
      console.log("[AUTH] Supabase session cleared");
    } catch (e) {
      console.warn("[AUTH] supabase.signOut failed", e);
    }
    setHasSupabaseSession(false);
    logoutPi();
    resetPiInit();
    inFlightRef.current = false;
    setError(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isPiBrowser: isPiBrowser(),
      isSdkReady,
      isAdmin: !!user?.isAdmin,
      hasSupabaseSession,
      error,
      signIn,
      signOut,
    }),
    [user, status, isSdkReady, hasSupabaseSession, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
