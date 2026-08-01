// AuthDiagnosticLogger — observability only.
// This module MUST NOT change any authentication behavior. It only records
// timings, SDK state, network calls, session facts and errors, then prints a
// report at the end of each login attempt.
//
// Log format:  [AUTH#12345][+120ms][Δ40ms] INITIALIZE_PI

export type AuthStage =
  | "LOGIN_BUTTON_CLICKED"
  | "INITIALIZE_PI"
  | "SDK_DETECTED"
  | "PI_INIT_COMPLETED"
  | "AUTHENTICATE_CALLED"
  | "USER_APPROVED"
  | "AUTH_CALLBACK_RECEIVED"
  | "ACCESS_TOKEN_RECEIVED"
  | "COOKIE_WRITE_STARTED"
  | "COOKIE_WRITE_COMPLETED"
  | "COOKIE_READ_VERIFIED"
  | "BACKEND_AUTH_REQUEST_STARTED"
  | "BACKEND_AUTH_RESPONSE"
  | "SUPABASE_SESSION_STARTED"
  | "SUPABASE_SESSION_COMPLETED"
  | "USER_PROFILE_LOADING"
  | "USER_PROFILE_LOADED"
  | "REDIRECT_STARTED"
  | "REDIRECT_COMPLETED"
  | "AUTH_SUCCESS";

const WARN_MS = 5000;
const ERROR_MS = 10000;

interface StageRecord {
  stage: string;
  atMs: number;
  deltaMs: number;
  meta?: Record<string, unknown>;
}

interface NetworkRecord {
  url: string;
  method: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  status: number | null;
  body?: string;
  error?: string;
}

export interface SdkSnapshot {
  hasWindowPi: boolean;
  sdkLoaded: boolean;
  piBrowserDetected: boolean;
  sdkVersion: string;
  hasAuthenticate: boolean;
  hasCreatePayment: boolean;
  userAgent: string;
  mode: "sandbox" | "mainnet" | "unknown";
}

function now(): number {
  if (typeof performance !== "undefined" && performance.now) return performance.now();
  return Date.now();
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function redact(url: string): string {
  return url.replace(/([?&](access_token|token|key|apikey)=)[^&]+/gi, "$1<redacted>");
}

class AuthDiagnosticSession {
  readonly id: string;
  readonly startedAt: number;
  readonly startedIso: string;
  private lastAt: number;
  private lastStage = "SESSION_START";
  stages: StageRecord[] = [];
  network: NetworkRecord[] = [];
  errors: { stage: string; message: string; stack?: string }[] = [];
  facts: Record<string, unknown> = {};
  result: "SUCCESS" | "FAILED" | "TIMEOUT" | "PENDING" = "PENDING";
  private watchWarn: ReturnType<typeof setTimeout> | null = null;
  private watchErr: ReturnType<typeof setTimeout> | null = null;
  private finished = false;

  constructor() {
    this.id = String(Math.floor(10000 + Math.random() * 89999));
    this.startedAt = now();
    this.startedIso = new Date().toISOString();
    this.lastAt = this.startedAt;
  }

  private prefix(delta: number): string {
    return `[AUTH#${this.id}][+${Math.round(now() - this.startedAt)}ms][Δ${Math.round(delta)}ms]`;
  }

  private armWatchdogs(stage: string) {
    this.clearWatchdogs();
    this.watchWarn = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn(
        `[AUTH WARNING][AUTH#${this.id}] stage "${stage}" pending ${WARN_MS}ms (elapsed ${Math.round(
          now() - this.startedAt,
        )}ms)`,
      );
    }, WARN_MS);
    this.watchErr = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.error(
        `[AUTH ERROR][AUTH#${this.id}] stage "${stage}" pending ${ERROR_MS}ms (elapsed ${Math.round(
          now() - this.startedAt,
        )}ms)`,
      );
    }, ERROR_MS);
  }

  clearWatchdogs() {
    if (this.watchWarn) clearTimeout(this.watchWarn);
    if (this.watchErr) clearTimeout(this.watchErr);
    this.watchWarn = null;
    this.watchErr = null;
  }

  stage(stage: AuthStage | string, meta?: Record<string, unknown>) {
    const t = now();
    const delta = t - this.lastAt;
    this.lastAt = t;
    this.lastStage = stage;
    this.stages.push({ stage, atMs: Math.round(t - this.startedAt), deltaMs: Math.round(delta), meta });
    // eslint-disable-next-line no-console
    console.log(`${this.prefix(delta)} ${stage}${meta ? " " + safeJson(meta) : ""}`);
    this.armWatchdogs(stage);
  }

  fact(key: string, value: unknown) {
    this.facts[key] = value;
    // eslint-disable-next-line no-console
    console.log(`[AUTH#${this.id}] fact ${key}=${safeJson(value)}`);
  }

  error(stage: string, err: unknown) {
    const e = err as Error;
    this.errors.push({ stage, message: e?.message ?? String(err), stack: e?.stack });
    // eslint-disable-next-line no-console
    console.error(`[AUTH ERROR][AUTH#${this.id}] ${stage}: ${e?.message ?? String(err)}`, e?.stack);
  }

  recordNetwork(rec: NetworkRecord) {
    this.network.push(rec);
  }

  get currentStage() {
    return this.lastStage;
  }

  finish(result: "SUCCESS" | "FAILED" | "TIMEOUT") {
    if (this.finished) return;
    this.finished = true;
    this.result = result;
    this.clearWatchdogs();
    this.printReport();
  }

  printReport() {
    const total = Math.round(now() - this.startedAt);
    const slowest = this.stages.reduce<StageRecord | null>(
      (acc, s) => (!acc || s.deltaMs > acc.deltaMs ? s : acc),
      null,
    );
    const sdk = (this.facts["sdk"] as SdkSnapshot | undefined) ?? null;
    const lines = [
      "======== AUTH DIAGNOSTIC REPORT ========",
      `Session ID:          AUTH#${this.id}`,
      `Start Time:          ${this.startedIso}`,
      `Total Duration:      ${total}ms`,
      `SDK Loaded:          ${sdk?.sdkLoaded ?? "unknown"}`,
      `Pi Browser:          ${sdk?.piBrowserDetected ?? "unknown"}`,
      `SDK Version:         ${sdk?.sdkVersion ?? "unknown"}`,
      `Mode:                ${sdk?.mode ?? "unknown"}`,
      `authenticate():      ${sdk?.hasAuthenticate ?? "unknown"}`,
      `createPayment():     ${sdk?.hasCreatePayment ?? "unknown"}`,
      `Slowest Stage:       ${slowest ? `${slowest.stage} (${slowest.deltaMs}ms)` : "n/a"}`,
      `Network Calls:       ${this.network.length}`,
      ...this.network.map(
        (n) =>
          `  - ${n.method} ${redact(n.url)} → ${n.status ?? "ERR"} in ${n.durationMs}ms${
            n.error ? ` error=${n.error}` : ""
          }`,
      ),
      `Access Token:        ${this.facts["accessTokenReceived"] ? "yes" : "no"} (len=${
        this.facts["accessTokenLength"] ?? 0
      })`,
      `Session Created:     ${this.facts["sessionCreated"] ?? false}`,
      `Cookie Verified:     ${this.facts["cookieVerified"] ?? false}`,
      `User ID:             ${this.facts["userId"] ?? "n/a"}`,
      `Username:            ${this.facts["username"] ?? "n/a"}`,
      `Route:               ${this.facts["currentRoute"] ?? "n/a"} → ${this.facts["targetRoute"] ?? "n/a"}`,
      `Redirect Completed:  ${this.facts["redirectCompleted"] ?? false}`,
      `Last Stage:          ${this.lastStage}`,
      `Errors:              ${this.errors.length}`,
      ...this.errors.map((e) => `  - [${e.stage}] ${e.message}`),
      "Stage timeline:",
      ...this.stages.map((s) => `  +${s.atMs}ms Δ${s.deltaMs}ms ${s.stage}`),
      `Result:              ${this.result}`,
      "=======================================",
    ];
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
  }
}

let active: AuthDiagnosticSession | null = null;
let globalHooksInstalled = false;

/** Start a new diagnostic session for one login attempt. */
export function authDiagStart(reason = "login-button"): AuthDiagnosticSession {
  if (active) active.finish("FAILED"); // previous attempt never completed
  active = new AuthDiagnosticSession();
  installGlobalHooks();
  active.stage("LOGIN_BUTTON_CLICKED", { reason });
  active.fact("sdk", captureSdkSnapshot());
  if (typeof window !== "undefined") {
    active.fact("currentRoute", window.location.pathname);
  }
  return active;
}

export function authDiagSession(): AuthDiagnosticSession | null {
  return active;
}

/** Record a stage on the active session (no-op when no login attempt is running). */
export function authDiagStage(stage: AuthStage | string, meta?: Record<string, unknown>) {
  active?.stage(stage, meta);
}

export function authDiagFact(key: string, value: unknown) {
  active?.fact(key, value);
}

export function authDiagError(stage: string, err: unknown) {
  active?.error(stage, err);
}

export function authDiagFinish(result: "SUCCESS" | "FAILED" | "TIMEOUT") {
  active?.finish(result);
  active = null;
}

/** Snapshot of the Pi SDK / browser environment. */
export function captureSdkSnapshot(): SdkSnapshot {
  if (typeof window === "undefined") {
    return {
      hasWindowPi: false,
      sdkLoaded: false,
      piBrowserDetected: false,
      sdkVersion: "unknown",
      hasAuthenticate: false,
      hasCreatePayment: false,
      userAgent: "ssr",
      mode: "unknown",
    };
  }
  const w = window as unknown as {
    Pi?: {
      init?: unknown;
      authenticate?: unknown;
      createPayment?: unknown;
      version?: string;
      _version?: string;
      sandbox?: boolean;
    };
  };
  const pi = w.Pi;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const snap: SdkSnapshot = {
    hasWindowPi: !!pi,
    sdkLoaded: !!pi && typeof pi.authenticate === "function",
    piBrowserDetected: !!pi || /PiBrowser|Pi Network|minepi/i.test(ua),
    sdkVersion: pi?.version ?? pi?._version ?? "2.0 (assumed)",
    hasAuthenticate: !!pi && typeof pi.authenticate === "function",
    hasCreatePayment: !!pi && typeof pi.createPayment === "function",
    userAgent: ua,
    mode: pi?.sandbox === true ? "sandbox" : pi ? "mainnet" : "unknown",
  };
  // eslint-disable-next-line no-console
  console.log(`[AUTH#${active?.id ?? "----"}] sdk-snapshot`, snap);
  return snap;
}

/** Install fetch timing + global error capture exactly once. */
function installGlobalHooks() {
  if (globalHooksInstalled || typeof window === "undefined") return;
  globalHooksInstalled = true;

  if (window.fetch) {
    const original = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
      if (!active) return original(input as RequestInfo, init);
      const startMs = now();
      // eslint-disable-next-line no-console
      console.log(`[AUTH#${active.id}] fetch:start ${method} ${redact(url)}`);
      try {
        const res = await original(input as RequestInfo, init);
        const endMs = now();
        let body: string | undefined;
        try {
          body = (await res.clone().text()).slice(0, 500);
        } catch {
          body = undefined;
        }
        active?.recordNetwork({
          url,
          method: method || "GET",
          startMs: Math.round(startMs),
          endMs: Math.round(endMs),
          durationMs: Math.round(endMs - startMs),
          status: res.status,
          body,
        });
        // eslint-disable-next-line no-console
        console.log(
          `[AUTH#${active?.id}] fetch:end ${res.status} ${redact(url)} duration=${Math.round(
            endMs - startMs,
          )}ms body=${body ?? ""}`,
        );
        return res;
      } catch (err) {
        const endMs = now();
        active?.recordNetwork({
          url,
          method: method || "GET",
          startMs: Math.round(startMs),
          endMs: Math.round(endMs),
          durationMs: Math.round(endMs - startMs),
          status: null,
          error: (err as Error)?.message,
        });
        active?.error("fetch", err);
        throw err;
      }
    };
  }

  window.addEventListener("unhandledrejection", (e) => {
    if (!active) return;
    active.error("unhandledrejection", e.reason);
  });
  window.addEventListener("error", (e) => {
    if (!active) return;
    active.error("window.error", e.error ?? new Error(e.message));
  });
}

/** Read back the document cookie state (httpOnly cookies are intentionally invisible). */
export function authDiagVerifyCookie(name = "pi_session") {
  if (typeof document === "undefined") return false;
  const visible = document.cookie.split(";").some((c) => c.trim().startsWith(`${name}=`));
  authDiagFact("cookieVerified", visible ? "visible" : "httpOnly-or-missing");
  return visible;
}
