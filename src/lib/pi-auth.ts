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
  authStarted: boolean;
  authCompleted: boolean;
  userReturned: boolean;
  lastError: string | null;
  lastStep: string;
}

const DEFAULT_SCOPES: PiAuthScope[] = ["username"];
const AUTH_TIMEOUT_MS = 15000;
const SDK_TIMEOUT_MS = 10000;
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
  authStarted: false,
  authCompleted: false,
  userReturned: false,
  lastError: null,
  lastStep: "idle",
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

const log = (...args: unknown[]) => console.log("[PiAuth]", ...args);
const errLog = (...args: unknown[]) => console.error("[PiAuth]", ...args);

let initPromise: Promise<void> | null = null;

export function isPiBrowser(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.Pi !== "undefined") return true;
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  return /PiBrowser|Pi Network|minepi/i.test(ua);
}

function withTimeout<T>(p: Promise<T>, ms: number, code: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(code)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function injectPiSdkScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("SDK_UNAVAILABLE"));
      return;
    }
    if (window.Pi) {
      log("SDK already on window");
      return resolve();
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SDK_URL}"]`,
    );
    if (existing) {
      if (window.Pi) return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("SDK_LOAD_FAILED")),
        { once: true },
      );
      return;
    }
    log("Injecting SDK script:", SDK_URL);
    updateDebug({ lastStep: "injecting-sdk" });
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => {
      log("SDK script loaded");
      resolve();
    };
    script.onerror = () => {
      errLog("SDK script failed to load");
      reject(new Error("SDK_LOAD_FAILED"));
    };
    document.head.appendChild(script);
  });
}

function waitForPiSdk(timeoutMs = SDK_TIMEOUT_MS): Promise<PiSDK> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("SDK_UNAVAILABLE"));
      return;
    }
    if (window.Pi) return resolve(window.Pi);
    const start = Date.now();
    const id = window.setInterval(() => {
      if (window.Pi) {
        window.clearInterval(id);
        resolve(window.Pi);
      } else if (Date.now() - start > timeoutMs) {
        window.clearInterval(id);
        reject(new Error("SDK_UNAVAILABLE"));
      }
    }, 80);
  });
}

export async function initializePi(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      updateDebug({ initStarted: true, lastStep: "loading-sdk", lastError: null });
      log("Init start. isPiBrowser =", isPiBrowser());
      await injectPiSdkScript().catch((e) => {
        log("injectPiSdkScript fall-through:", (e as Error)?.message);
      });
      const Pi = await waitForPiSdk();
      updateDebug({ sdkLoaded: true, lastStep: "calling-init" });
      log("Pi SDK ready, calling Pi.init()");
      // Await Pi.init() directly. Don't impose a timeout — proceeding before
      // init resolves causes "SDK was not initialized" on authenticate.
      const ret = Pi.init({ version: "2.0", sandbox: false });
      if (ret && typeof (ret as Promise<void>).then === "function") {
        await ret;
      }
      // Small settle delay for SDKs that finalize state post-resolve.
      await new Promise((r) => setTimeout(r, 50));
      updateDebug({ initCompleted: true, lastStep: "init-completed" });
      log("Pi.init completed");
    } catch (err) {
      const msg = (err as Error)?.message || "INIT_FAILED";
      errLog("initializePi error:", err);
      updateDebug({ lastError: msg, lastStep: "init-error" });
      initPromise = null;
      throw err;
    }
  })();
  return initPromise;
}

export function resetPiInit(): void {
  initPromise = null;
  updateDebug({
    initStarted: false,
    initCompleted: false,
    authStarted: false,
    authCompleted: false,
    userReturned: false,
    lastError: null,
    lastStep: "reset",
  });
}

function onIncompletePaymentFound(payment: unknown) {
  log("Incomplete payment found:", payment);
}

export async function authenticatePi(): Promise<PiUser> {
  log("authenticatePi() called");
  updateDebug({
    authStarted: false,
    authCompleted: false,
    userReturned: false,
    lastError: null,
    lastStep: "ensuring-init",
  });
  await initializePi();
  const Pi = window.Pi;
  if (!Pi) {
    updateDebug({ lastError: "SDK_UNAVAILABLE", lastStep: "no-sdk" });
    throw new Error("SDK_UNAVAILABLE");
  }

  let result: PiAuthResult;
  try {
    updateDebug({ authStarted: true, lastStep: "calling-authenticate" });
    log("Calling Pi.authenticate() with scopes:", DEFAULT_SCOPES);
    result = await withTimeout(
      Pi.authenticate(DEFAULT_SCOPES, onIncompletePaymentFound),
      AUTH_TIMEOUT_MS,
      "AUTH_TIMEOUT",
    );
    updateDebug({ authCompleted: true, lastStep: "authenticate-returned" });
    log("Pi.authenticate completed", { uid: result?.user?.uid });
  } catch (err) {
    const raw = (err as Error)?.message ?? "";
    const message = raw.toLowerCase();
    errLog("Pi.authenticate error:", raw);
    updateDebug({ lastError: raw || "AUTH_FAILED", lastStep: "authenticate-error" });
    if (raw === "AUTH_TIMEOUT") throw new Error("AUTH_TIMEOUT");
    if (message.includes("cancel")) throw new Error("AUTH_CANCELLED");
    if (message.includes("network")) throw new Error("NETWORK_ERROR");
    if (message.includes("not initialized")) throw new Error("INIT_TIMEOUT");
    throw new Error("AUTH_FAILED");
  }

  if (!result?.user?.uid) {
    updateDebug({ lastError: "NO_USER", lastStep: "no-user" });
    throw new Error("AUTH_FAILED");
  }

  const user: PiUser = {
    uid: result.user.uid,
    username: result.user.username,
    accessToken: result.accessToken,
    authenticatedAt: new Date().toISOString(),
  };
  updateDebug({ userReturned: true, lastStep: "user-stored" });

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    /* storage not available */
  }
  return user;
}

export function logoutPi(): void {
  log("logoutPi()");
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
      return "Pi SDK took too long to initialize. Please try again.";
    case "AUTH_FAILED":
    default:
      return "Authentication failed. Please try again.";
  }
}
