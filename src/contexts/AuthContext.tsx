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

  // Hydrate from storage + best-effort SDK init. Login is always button-driven.
  useEffect(() => {
    const existing = getCurrentUser();
    if (existing) {
      setUser(existing);
      setStatus("authenticated");
    } else {
      setStatus("unauthenticated");
    }
    let cancelled = false;
    // Only attempt init on mount when the Pi SDK environment is detected.
    // Otherwise defer init entirely to the sign-in button click.
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
