// Pi Network authentication wrapper.
// Docs: https://github.com/pi-apps/pi-platform-docs

export interface PiUser {
  uid: string;
  username: string;
  accessToken: string;
  authenticatedAt: string;
}

export type PiAuthScope = "username" | "payments" | "wallet_address";

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
      log("SDK script tag already present, waiting for load");
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
      log("Init start. isPiBrowser =", isPiBrowser());
      await injectPiSdkScript().catch((e) => {
        log("injectPiSdkScript fall-through:", (e as Error)?.message);
      });
      const Pi = await waitForPiSdk();
      log("Pi SDK ready, calling Pi.init()");
      // Some SDK builds return undefined from init() instead of a promise.
      // Wrap in Promise.resolve and a short timeout so we never hang.
      await withTimeout(
        Promise.resolve(Pi.init({ version: "2.0", sandbox: !isPiBrowser() })),
        5000,
        "INIT_TIMEOUT",
      ).catch((e) => {
        // Pi.init may have completed synchronously even if it didn't return.
        // Tolerate INIT_TIMEOUT — proceed if window.Pi.authenticate exists.
        if ((e as Error).message === "INIT_TIMEOUT" && window.Pi?.authenticate) {
          log("Pi.init() did not resolve, but authenticate is available — continuing");
          return;
        }
        throw e;
      });
      log("Pi.init completed");
    } catch (err) {
      errLog("initializePi error:", err);
      initPromise = null;
      throw err;
    }
  })();
  return initPromise;
}

export function resetPiInit(): void {
  initPromise = null;
}

function onIncompletePaymentFound(payment: unknown) {
  log("Incomplete payment found:", payment);
}

export async function authenticatePi(): Promise<PiUser> {
  log("authenticatePi() called");
  await initializePi();
  const Pi = window.Pi;
  if (!Pi) {
    errLog("Pi SDK missing after init");
    throw new Error("SDK_UNAVAILABLE");
  }

  let result: PiAuthResult;
  try {
    log("Calling Pi.authenticate() with scopes:", DEFAULT_SCOPES);
    result = await withTimeout(
      Pi.authenticate(DEFAULT_SCOPES, onIncompletePaymentFound),
      AUTH_TIMEOUT_MS,
      "AUTH_TIMEOUT",
    );
    log("Pi.authenticate completed", { uid: result?.user?.uid });
  } catch (err) {
    const raw = (err as Error)?.message ?? "";
    const message = raw.toLowerCase();
    errLog("Pi.authenticate error:", raw);
    if (raw === "AUTH_TIMEOUT") throw new Error("AUTH_TIMEOUT");
    if (message.includes("cancel")) throw new Error("AUTH_CANCELLED");
    if (message.includes("network")) throw new Error("NETWORK_ERROR");
    throw new Error("AUTH_FAILED");
  }

  if (!result?.user?.uid) {
    errLog("Pi.authenticate returned no user");
    throw new Error("AUTH_FAILED");
  }

  const user: PiUser = {
    uid: result.user.uid,
    username: result.user.username,
    accessToken: result.accessToken,
    authenticatedAt: new Date().toISOString(),
  };

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
