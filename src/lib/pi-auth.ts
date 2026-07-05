// Pi Network authentication wrapper.
// Docs: https://github.com/pi-apps/pi-platform-docs
import { authLog, authWarn, authError, stageTimer, logEnvironmentSnapshot } from "./auth-diagnostics";


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

const DEFAULT_SCOPES: PiAuthScope[] = ["username", "payments", "wallet_address"];
const REQUIRED_SCOPES: PiAuthScope[] = ["username", "payments"];
const AUTH_TIMEOUT_MS = 20000;
const SDK_URL = "https://sdk.minepi.com/pi-sdk.js";
const STORAGE_KEY = "mypimusic.pi_user";
const SCOPES_KEY = "mypimusic.pi_scopes";

export function getGrantedScopes(): PiAuthScope[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SCOPES_KEY);
    return raw ? (JSON.parse(raw) as PiAuthScope[]) : [];
  } catch {
    return [];
  }
}

export function hasScope(scope: PiAuthScope): boolean {
  return getGrantedScopes().includes(scope);
}

/** Ensure current Pi session has all required scopes; re-authenticate if not. */
export async function ensurePiScopes(required: PiAuthScope[] = REQUIRED_SCOPES): Promise<PiUser> {
  const granted = getGrantedScopes();
  const missing = required.filter((s) => !granted.includes(s));
  if (missing.length === 0) {
    const cached = getCurrentUser();
    if (cached) return cached;
  }
  console.log("[AUTH] Scope check — granted:", granted, "required:", required, "missing:", missing);
  // Invalidate stale session and force a fresh authenticate with full scopes.
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(SCOPES_KEY);
  } catch {
    /* noop */
  }
  return authenticatePi();
}

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
  createPayment?: (payment: unknown, callbacks: unknown) => void;
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

async function waitForWindowPi(timeoutMs = 15000, intervalMs = 100): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (typeof window !== "undefined" && window.Pi && typeof window.Pi.init === "function") {
      authLog("waitForWindowPi:detected", { waitedMs: Date.now() - start });
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  authError("waitForWindowPi:timeout", new Error("SDK_UNAVAILABLE"), { waitedMs: timeoutMs });
  throw new Error("SDK_UNAVAILABLE");
}

export function initializePi(): Promise<void> {
  if (initPromise) {
    authLog("initializePi:reuse-existing-promise");
    return initPromise;
  }
  initPromise = (async () => {
    updateDebug({ initStarted: true, lastStep: "loading-sdk", lastError: null });
    const stopInject = stageTimer("injectPiSdkScript");
    try {
      await injectPiSdkScript();
      stopInject({ ok: true });
    } catch (e) {
      stopInject({ ok: false });
      const msg = (e as Error)?.message || "SDK_LOAD_FAILED";
      authError("injectPiSdkScript", e);
      updateDebug({ lastError: msg, lastStep: "sdk-load-failed" });
      initPromise = null;
      throw new Error(msg);
    }
    updateDebug({ lastStep: "waiting-for-window-pi" });
    logEnvironmentSnapshot();
    const stopWait = stageTimer("waitForWindowPi");
    try {
      await waitForWindowPi();
      stopWait({ ok: true });
    } catch {
      stopWait({ ok: false });
      updateDebug({ lastError: "SDK_UNAVAILABLE", lastStep: "no-sdk" });
      initPromise = null;
      throw new Error("SDK_UNAVAILABLE");
    }
    const Pi = window.Pi!;
    updateDebug({ sdkLoaded: true, lastStep: "calling-init" });
    const stopInit = stageTimer("Pi.init", { version: "2.0", sandbox: false });
    try {
      await Promise.resolve(Pi.init({ version: "2.0", sandbox: false }));
      stopInit({ ok: true });
      updateDebug({ initCompleted: true, lastStep: "init-completed" });
    } catch (e) {
      stopInit({ ok: false });
      const msg = (e as Error)?.message || "INIT_FAILED";
      authError("Pi.init", e);
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

let authInFlight: Promise<PiUser> | null = null;

export async function authenticatePi(): Promise<PiUser> {
  // Strict single-flight guard: if a call is already in flight, return the
  // same promise instead of triggering Pi.authenticate twice.
  if (authInFlight) {
    console.log("AUTH CLICKED (ignored: already in flight)");
    return authInFlight;
  }
  console.log("AUTH CLICKED");

  authInFlight = (async () => {
    // Pi.authenticate must ONLY run after Pi.init fully completes.
    const stopInit = stageTimer("initializePi (from authenticatePi)");
    try {
      await initializePi();
      stopInit({ ok: true });
    } catch (e) {
      stopInit({ ok: false });
      const msg = (e as Error)?.message || "INIT_FAILED";
      authError("initializePi-before-auth", e);
      updateDebug({ lastError: msg, lastStep: "init-failed-before-auth" });
      throw new Error(msg === "SDK_LOAD_FAILED" || msg === "SDK_UNAVAILABLE" ? msg : "INIT_FAILED");
    }

    if (!debugState.initCompleted) {
      authWarn("initCompleted-flag-false-after-init");
      updateDebug({ lastError: "INIT_NOT_COMPLETED", lastStep: "init-not-completed" });
      throw new Error("INIT_FAILED");
    }

    const Pi = window.Pi;
    if (!Pi) {
      authError("no-window-Pi-at-auth", new Error("SDK_UNAVAILABLE"));
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

    console.log("[AUTH] Requested scopes:", DEFAULT_SCOPES);
    authLog("Pi.authenticate:call", { scopes: DEFAULT_SCOPES });
    const stopAuth = stageTimer("Pi.authenticate", { scopes: DEFAULT_SCOPES });

    let result: PiAuthResult;
    try {
      result = await Promise.race([
        Pi.authenticate(DEFAULT_SCOPES, onIncompletePaymentFound),
        new Promise<PiAuthResult>((_, reject) =>
          setTimeout(() => reject(new Error("AUTH_TIMEOUT")), AUTH_TIMEOUT_MS),
        ),
      ]);
      stopAuth({ ok: true, uid: result?.user?.uid, hasToken: !!result?.accessToken });
      // Pi SDK resolves only when all requested scopes are granted, so treat
      // the requested scopes as the granted set.
      const granted = DEFAULT_SCOPES;
      console.log("[AUTH] Granted scopes:", granted);
      try {
        window.localStorage.setItem(SCOPES_KEY, JSON.stringify(granted));
      } catch {
        /* noop */
      }
      updateDebug({ authCompleted: true, lastStep: "authenticate-returned" });
    } catch (err) {
      stopAuth({ ok: false });
      const raw = (err as Error)?.message ?? "";
      const message = raw.toLowerCase();
      authError("Pi.authenticate", err);
      updateDebug({ lastError: raw || "AUTH_FAILED", lastStep: "authenticate-error" });
      if (raw === "AUTH_TIMEOUT") throw new Error("AUTH_TIMEOUT");
      if (message.includes("cancel")) throw new Error("AUTH_CANCELLED");
      if (message.includes("network")) throw new Error("NETWORK_ERROR");
      if (message.includes("not initialized")) throw new Error("INIT_TIMEOUT");
      throw new Error("AUTH_FAILED");
    }

    if (!result?.user?.uid) {
      authError("Pi.authenticate:no-user", new Error("NO_USER"));
      updateDebug({ lastError: "NO_USER", lastStep: "no-user" });
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
    authLog("pi-user-stored", { uid: user.uid, username: user.username });

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch {
      /* storage not available */
    }
    return user;
  })();

  try {
    return await authInFlight;
  } finally {
    authInFlight = null;
  }
}


export function logoutPi(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(SCOPES_KEY);
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
