// Pi Network authentication wrapper.
// Uses the official Pi SDK loaded via <script> in __root.tsx.
// Docs: https://github.com/pi-apps/pi-platform-docs

export interface PiUser {
  uid: string;
  username: string;
  accessToken: string;
  authenticatedAt: string;
}

export type PiAuthScope = "username" | "payments" | "wallet_address";

// Keep scopes minimal — payments will be added later with the reward system.
const DEFAULT_SCOPES: PiAuthScope[] = ["username"];

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

const STORAGE_KEY = "mypimusic.pi_user";

let initPromise: Promise<void> | null = null;

export function isPiBrowser(): boolean {
  if (typeof window === "undefined") return false;
  // Pi Browser does not always expose "PiBrowser" in the UA string.
  // Treat the presence of window.Pi as the authoritative signal, and
  // fall back to UA hints for older builds.
  if (typeof window.Pi !== "undefined") return true;
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  return /PiBrowser|Pi Network|minepi/i.test(ua);
}

const SDK_URL = "https://sdk.minepi.com/pi-sdk.js";

function injectPiSdkScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("SDK_UNAVAILABLE"));
      return;
    }
    if (window.Pi) return resolve();
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
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("SDK_LOAD_FAILED"));
    document.head.appendChild(script);
  });
}

function waitForPiSdk(timeoutMs = 10000): Promise<PiSDK> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("SDK_UNAVAILABLE"));
      return;
    }
    if (window.Pi) {
      resolve(window.Pi);
      return;
    }
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
      // Inject the SDK ourselves to get reliable load/error signals
      // even if TanStack's <Scripts /> placement is delayed.
      await injectPiSdkScript().catch(() => {
        /* may already exist — fall through to polling */
      });
      const Pi = await waitForPiSdk();
      // Sandbox enabled outside Pi Browser so preview/dev does not crash.
      await Promise.resolve(
        Pi.init({ version: "2.0", sandbox: !isPiBrowser() }),
      );
    } catch (err) {
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
  // Reserved for future Pi payments handling (subscriptions, song purchases, ads).
  console.info("[Pi] Incomplete payment found:", payment);
}

export async function authenticatePi(): Promise<PiUser> {
  await initializePi();
  const Pi = window.Pi;
  if (!Pi) throw new Error("SDK_UNAVAILABLE");

  let result: PiAuthResult;
  try {
    result = await Pi.authenticate(DEFAULT_SCOPES, onIncompletePaymentFound);
  } catch (err) {
    const message = (err as Error)?.message?.toLowerCase() ?? "";
    if (message.includes("cancel")) throw new Error("AUTH_CANCELLED");
    if (message.includes("network")) throw new Error("NETWORK_ERROR");
    throw new Error("AUTH_FAILED");
  }

  if (!result?.user?.uid) throw new Error("AUTH_FAILED");

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
      return "Pi Network SDK is not available. Please open this app inside the Pi Browser and try again.";
    case "AUTH_CANCELLED":
      return "Sign-in was cancelled. Tap the button again to continue.";
    case "NETWORK_ERROR":
      return "Network issue while signing in. Check your connection and try again.";
    case "AUTH_FAILED":
    default:
      return "Authentication failed. Please try again.";
  }
}
