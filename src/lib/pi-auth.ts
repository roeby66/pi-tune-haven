// Pi Network authentication wrapper.
// Docs: https://github.com/pi-apps/pi-platform-docs

export interface PiUser {
  uid: string;
  username: string;
  accessToken: string;
  authenticatedAt: string;
}

export type PiAuthScope = "username" | "payments" | "wallet_address";

export interface PiAuthDebug {
  sdkLoaded: boolean;
  initStarted: boolean;
  initCompleted: boolean;
  initSkipped: boolean;
  authStarted: boolean;
  authCompleted: boolean;
  userReturned: boolean;
  lastError: string | null;
  lastStep: string;
  uid: string | null;
  username: string | null;
}

const DEFAULT_SCOPES: PiAuthScope[] = ["username", "payments"];
const AUTH_TIMEOUT_MS = 20000;
const SDK_URL = "https://sdk.minepi.com/pi-sdk.js";
const STORAGE_KEY = "mypimusic.pi_user";

interface PiAuthResult {
  accessToken: string;
  user: { uid: string; username: string };
}

interface PiSDK {
  init: (config: { version: string; sandbox?: boolean }) => Promise<void> | void;
  authenticate: (
    scopes: PiAuthScope[],
    onIncompletePaymentFound: (payment: unknown) => void,
  ) => Promise<PiAuthResult>;
}

declare global {
  interface Window {
    Pi?: PiSDK;
  }
}

const debugState: PiAuthDebug = {
  sdkLoaded: false,
  initStarted: false,
  initCompleted: false,
  initSkipped: false,
  authStarted: false,
  authCompleted: false,
  userReturned: false,
  lastError: null,
  lastStep: "idle",
  uid: null,
  username: null,
};

type DebugListener = (s: PiAuthDebug) => void;
const listeners = new Set<DebugListener>();

function updateDebug(patch: Partial<PiAuthDebug>) {
  Object.assign(debugState, patch);
  listeners.forEach((l) => l({ ...debugState }));
}

export function getPiDebug(): PiAuthDebug {
  return { ...debugState };
}

export function subscribePiDebug(fn: DebugListener): () => void {
  listeners.add(fn);
  fn({ ...debugState });
  return () => listeners.delete(fn);
}

let initPromise: Promise<void> | null = null;

export function isPiBrowser(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.Pi !== "undefined") return true;
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  return /PiBrowser|Pi Network|minepi/i.test(ua);
}

function injectPiSdkScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("SDK_UNAVAILABLE"));
      return;
    }
    if (window.Pi) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    if (existing) {
      if (window.Pi) return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("SDK_LOAD_FAILED")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("SDK_LOAD_FAILED"));
    document.head.appendChild(script);
  });
}

export function initializePi(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    console.log("INITIALIZE PI START");
    updateDebug({ initStarted: true, lastStep: "loading-sdk", lastError: null });
    try {
      await injectPiSdkScript();
    } catch (e) {
      const msg = (e as Error)?.message || "SDK_LOAD_FAILED";
      console.error("INITIALIZE PI FAILED (sdk load):", msg);
      updateDebug({ lastError: msg, lastStep: "sdk-load-failed" });
      initPromise = null;
      throw new Error(msg);
    }
    const Pi = window.Pi;
    if (!Pi) {
      console.error("INITIALIZE PI FAILED: window.Pi missing after load");
      updateDebug({ lastError: "SDK_UNAVAILABLE", lastStep: "no-sdk" });
      initPromise = null;
      throw new Error("SDK_UNAVAILABLE");
    }
    updateDebug({ sdkLoaded: true, lastStep: "calling-init" });
    try {
      await Promise.resolve(Pi.init({ version: "2.0", sandbox: false }));
      updateDebug({ initCompleted: true, lastStep: "init-completed" });
      console.log("INITIALIZE PI SUCCESS");
    } catch (e) {
      const msg = (e as Error)?.message || "INIT_FAILED";
      console.error("INITIALIZE PI FAILED:", msg);
      updateDebug({ lastError: msg, lastStep: "init-error" });
      initPromise = null;
      throw new Error("INIT_FAILED");
    }
  })();
  return initPromise;
}

export function resetPiInit(): void {
  initPromise = null;
  updateDebug({
    initStarted: false,
    initCompleted: false,
    initSkipped: false,
    authStarted: false,
    authCompleted: false,
    userReturned: false,
    lastError: null,
    lastStep: "reset",
    uid: null,
    username: null,
  });
}

function onIncompletePaymentFound(payment: unknown) {
  console.log("[PiAuth] Incomplete payment:", payment);
}

export async function authenticatePi(): Promise<PiUser> {
  console.log("LOGIN CLICKED");

  // Pi.authenticate must ONLY run after Pi.init fully completes.
  // No soft-timeout, no fallback — wait for confirmed init success.
  try {
    await initializePi();
  } catch (e) {
    const msg = (e as Error)?.message || "INIT_FAILED";
    console.error("AUTH BLOCKED: Pi.init did not complete:", msg);
    updateDebug({ lastError: msg, lastStep: "init-failed-before-auth" });
    throw new Error(msg === "SDK_LOAD_FAILED" || msg === "SDK_UNAVAILABLE" ? msg : "INIT_FAILED");
  }

  if (!debugState.initCompleted) {
    updateDebug({ lastError: "INIT_NOT_COMPLETED", lastStep: "init-not-completed" });
    throw new Error("INIT_FAILED");
  }

  const piExists = Boolean(window.Pi);
  console.log("WINDOW.PI EXISTS:", piExists);

  const Pi = window.Pi;
  if (!Pi) {
    updateDebug({ lastError: "SDK_UNAVAILABLE", lastStep: "no-sdk-at-auth" });
    throw new Error("SDK_UNAVAILABLE");
  }

  updateDebug({
    authStarted: true,
    authCompleted: false,
    userReturned: false,
    lastError: null,
    lastStep: "calling-authenticate",
  });

  console.log("AUTH CALLED", { scopes: DEFAULT_SCOPES });

  let result: PiAuthResult;
  try {
    // Note: NO timeout race here — the Pi popup may legitimately take a while
    // for the user to approve. We only timeout if the SDK itself never returns.
    result = await Promise.race([
      Pi.authenticate(DEFAULT_SCOPES, onIncompletePaymentFound),
      new Promise<PiAuthResult>((_, reject) =>
        setTimeout(() => reject(new Error("AUTH_TIMEOUT")), AUTH_TIMEOUT_MS),
      ),
    ]);
    updateDebug({ authCompleted: true, lastStep: "authenticate-returned" });
    console.log("AUTH SUCCESS", { uid: result?.user?.uid, username: result?.user?.username });
  } catch (err) {
    const raw = (err as Error)?.message ?? "";
    const message = raw.toLowerCase();
    console.error("AUTH ERROR:", raw);
    updateDebug({ lastError: raw || "AUTH_FAILED", lastStep: "authenticate-error" });
    if (raw === "AUTH_TIMEOUT") {
      console.error("AUTH FAILED: timeout");
      throw new Error("AUTH_TIMEOUT");
    }
    if (message.includes("cancel")) {
      console.error("AUTH FAILED: cancelled");
      throw new Error("AUTH_CANCELLED");
    }
    if (message.includes("network")) {
      console.error("AUTH FAILED: network");
      throw new Error("NETWORK_ERROR");
    }
    if (message.includes("not initialized")) {
      console.error("AUTH FAILED: SDK not initialized");
      throw new Error("INIT_TIMEOUT");
    }
    console.error("AUTH FAILED:", raw);
    throw new Error("AUTH_FAILED");
  }

  if (!result?.user?.uid) {
    updateDebug({ lastError: "NO_USER", lastStep: "no-user" });
    console.error("AUTH FAILED: no user returned");
    throw new Error("AUTH_FAILED");
  }

  const user: PiUser = {
    uid: result.user.uid,
    username: result.user.username,
    accessToken: result.accessToken,
    authenticatedAt: new Date().toISOString(),
  };
  updateDebug({
    userReturned: true,
    lastStep: "user-stored",
    uid: user.uid,
    username: user.username,
  });

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    /* storage not available */
  }
  return user;
}

export function logoutPi(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function getCurrentUser(): PiUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PiUser;
  } catch {
    return null;
  }
}

export function describeAuthError(code: string): string {
  switch (code) {
    case "PI_BROWSER_REQUIRED":
      return "For the best experience, please open MyPiMusic inside the Pi Browser.";
    case "SDK_UNAVAILABLE":
    case "SDK_LOAD_FAILED":
      return "Pi Network SDK is not available. Please open this app inside the Pi Browser and try again.";
    case "AUTH_CANCELLED":
      return "Sign-in was cancelled. Tap the button again to continue.";
    case "AUTH_TIMEOUT":
      return "Authentication timed out. Please try again.";
    case "NETWORK_ERROR":
      return "Network issue while signing in. Check your connection and try again.";
    case "INIT_TIMEOUT":
    case "INIT_FAILED":
      return "Pi SDK failed to initialize. Please try again.";
    case "AUTH_FAILED":
    default:
      return "Authentication failed. Please try again.";
  }
}
