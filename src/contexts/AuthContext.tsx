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
  const autoTriedRef = useRef(false);

  // Hydrate from storage + init the SDK.
  useEffect(() => {
    const existing = getCurrentUser();
    if (existing) {
      setUser(existing);
      setStatus("authenticated");
    } else {
      setStatus("unauthenticated");
    }
    initializePi()
      .then(() => setSdkReady(true))
      .catch(() => setSdkReady(false));
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      const next = await authenticatePi();
      setUser(next);
      setStatus("authenticated");
    } catch (err) {
      const code = (err as Error).message || "AUTH_FAILED";
      setError(describeAuthError(code));
      setStatus("unauthenticated");
    }
  }, []);

  const signOut = useCallback(() => {
    logoutPi();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  // Auto-trigger authentication inside Pi Browser once the SDK is ready.
  useEffect(() => {
    if (
      isSdkReady &&
      status === "unauthenticated" &&
      isPiBrowser() &&
      !autoTriedRef.current
    ) {
      autoTriedRef.current = true;
      void signIn();
    }
  }, [isSdkReady, status, signIn]);

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
