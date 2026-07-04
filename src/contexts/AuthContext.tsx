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
import { authStart, authLog, authError, stageTimer } from "@/lib/auth-diagnostics";


export interface AppUser {
  uid: string;
  username: string;
  isAdmin: boolean;
  joinedAt: string;
}

interface AuthContextValue {
  user: AppUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
  isPiBrowser: boolean;
  isSdkReady: boolean;
  isAdmin: boolean;
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
  const inFlightRef = useRef(false);

  // Rehydrate from server session cookie + best-effort SDK init.
  useEffect(() => {
    let cancelled = false;
    getPiSession()
      .then((sess) => {
        if (cancelled) return;
        if (sess) {
          setUser(sess);
          setStatus("authenticated");
        } else {
          setStatus("unauthenticated");
        }
      })
      .catch(() => !cancelled && setStatus("unauthenticated"));

    if (isPiBrowser()) {
      initializePi()
        .then(() => !cancelled && setSdkReady(true))
        .catch(() => !cancelled && setSdkReady(false));
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    authStart("signIn");
    setError(null);
    setStatus("loading");
    const stopFlow = stageTimer("signIn:total");
    try {
      const stopPi = stageTimer("authenticatePi");
      const piUser: PiUser = await authenticatePi();
      stopPi({ uid: piUser.uid, tokenLen: piUser.accessToken?.length ?? 0 });
      authLog("pi-user-returned-to-context", {
        uid: piUser.uid,
        username: piUser.username,
        tokenLen: piUser.accessToken?.length ?? 0,
      });
      // Server-side verification with Pi API + session cookie.
      const stopVerify = stageTimer("verifyPiAuth (serverFn)");
      const verified = await verifyPiAuth({ data: { accessToken: piUser.accessToken } });
      stopVerify({ uid: verified.uid, isAdmin: verified.isAdmin });
      authLog("server-verified", verified);
      setUser(verified);
      setStatus("authenticated");
      stopFlow({ ok: true });
    } catch (err) {
      stopFlow({ ok: false });
      const raw = (err as Error)?.message || "AUTH_FAILED";
      authError("signIn", err);

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
      error,
      signIn,
      signOut,
    }),
    [user, status, isSdkReady, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
