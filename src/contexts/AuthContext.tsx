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
  getCurrentUser,
  initializePi,
  isPiBrowser,
  logoutPi,
  resetPiInit,
  type PiUser,
} from "@/lib/pi-auth";

interface AuthContextValue {
  user: PiUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
  isPiBrowser: boolean;
  isSdkReady: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PiUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [isSdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  // Strict mode: never restore a cached session. On every app launch the user
  // is unauthenticated until Pi.authenticate() returns a valid user object.
  // SDK init is best-effort and only runs when the Pi Browser is detected.
  useEffect(() => {
    // Proactively clear any legacy cached session.
    getCurrentUser();
    setUser(null);
    setStatus("unauthenticated");
    let cancelled = false;
    if (isPiBrowser()) {
      initializePi()
        .then(() => {
          if (!cancelled) setSdkReady(true);
        })
        .catch(() => {
          if (!cancelled) setSdkReady(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);
    setStatus("loading");
    try {
      const next = await authenticatePi();
      setUser(next);
      setStatus("authenticated");
    } catch (err) {
      const code = (err as Error).message || "AUTH_FAILED";
      setError(describeAuthError(code));
      setUser(null);
      setStatus("unauthenticated");
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const signOut = useCallback(() => {
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
