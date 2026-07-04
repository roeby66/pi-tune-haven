// Lightweight timestamped diagnostics for the Pi authentication flow.
// Adds ONLY logging — no behavior changes. Times are elapsed ms since the
// most recent authStart() call (i.e. the moment the user pressed "Login").
//
// Usage:
//   authStart();               // once, when the login button is pressed
//   authLog("stage-name", {...});
//   authWarn(...); authError(...);
//   const stop = stageTimer("Pi.authenticate");
//   ...await something...
//   stop();                    // logs duration + WARNING/ERROR if slow

const WARN_MS = 5000;
const ERROR_MS = 10000;

let flowStart = 0;
let lastStageLabel: string | null = null;
let lastStageAt = 0;

function now(): number {
  if (typeof performance !== "undefined" && performance.now) return performance.now();
  return Date.now();
}

function elapsed(): number {
  return Math.round(now() - flowStart);
}

export function authStart(reason = "login-button") {
  flowStart = now();
  lastStageLabel = null;
  lastStageAt = flowStart;
  // eslint-disable-next-line no-console
  console.log(`[AUTH][0ms] flow-start (${reason})`);
  logEnvironmentSnapshot();
}

export function authLog(stage: string, extra?: Record<string, unknown>) {
  const t = elapsed();
  const sinceLast = lastStageAt ? Math.round(now() - lastStageAt) : 0;
  lastStageLabel = stage;
  lastStageAt = now();
  const suffix = extra ? " " + safeJson(extra) : "";
  // eslint-disable-next-line no-console
  console.log(`[AUTH][${t}ms] ${stage} (+${sinceLast}ms)${suffix}`);
}

export function authWarn(stage: string, extra?: Record<string, unknown>) {
  const t = elapsed();
  // eslint-disable-next-line no-console
  console.warn(`[AUTH WARNING][${t}ms] ${stage}${extra ? " " + safeJson(extra) : ""}`);
}

export function authError(stage: string, err: unknown, extra?: Record<string, unknown>) {
  const t = elapsed();
  const e = err as Error;
  // eslint-disable-next-line no-console
  console.error(`[AUTH ERROR][${t}ms] ${stage}: ${e?.message ?? String(err)}`, {
    stack: e?.stack,
    ...(extra ?? {}),
  });
}

/** Start a per-stage timer. Call the returned fn when the stage finishes. */
export function stageTimer(stage: string, meta?: Record<string, unknown>) {
  const started = now();
  const startedAtFlow = elapsed();
  // eslint-disable-next-line no-console
  console.log(`[AUTH][${startedAtFlow}ms] ${stage}:start${meta ? " " + safeJson(meta) : ""}`);

  // Watchdog: emit warning/error if the stage runs too long.
  const warnTimer = setTimeout(() => {
    // eslint-disable-next-line no-console
    console.warn(`[AUTH WARNING] ${stage} waiting for ${WARN_MS / 1000} seconds...`);
  }, WARN_MS);
  const errTimer = setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error(`[AUTH ERROR] ${stage} still pending after ${ERROR_MS / 1000} seconds`);
  }, ERROR_MS);

  return function stop(result?: Record<string, unknown>) {
    clearTimeout(warnTimer);
    clearTimeout(errTimer);
    const dur = Math.round(now() - started);
    const t = elapsed();
    // eslint-disable-next-line no-console
    console.log(
      `[AUTH][${t}ms] ${stage}:end duration=${dur}ms${result ? " " + safeJson(result) : ""}`,
    );
    if (dur >= ERROR_MS) {
      // eslint-disable-next-line no-console
      console.error(`[AUTH ERROR] ${stage} took ${dur}ms (>${ERROR_MS}ms)`);
    } else if (dur >= WARN_MS) {
      // eslint-disable-next-line no-console
      console.warn(`[AUTH WARNING] ${stage} took ${dur}ms (>${WARN_MS}ms)`);
    }
    return dur;
  };
}

/** Log the current Pi SDK / browser / network state. Safe to call multiple times. */
export function logEnvironmentSnapshot() {
  if (typeof window === "undefined") return;
  const nav = typeof navigator !== "undefined" ? navigator : ({} as Navigator);
  const w = window as unknown as {
    Pi?: { init?: unknown; authenticate?: unknown; createPayment?: unknown };
  };
  const pi = w.Pi;
  const conn = (nav as unknown as { connection?: { effectiveType?: string; type?: string } })
    .connection;
  const ua = nav.userAgent ?? "";
  const snap = {
    userAgent: ua,
    isPiBrowserUA: /PiBrowser|Pi Network|minepi/i.test(ua),
    hasPi: !!pi,
    hasInit: !!pi && typeof pi.init === "function",
    hasAuthenticate: !!pi && typeof pi.authenticate === "function",
    hasCreatePayment: !!pi && typeof pi.createPayment === "function",
    online: typeof nav.onLine === "boolean" ? nav.onLine : "unknown",
    networkType: conn?.effectiveType ?? conn?.type ?? "unknown",
  };
  // eslint-disable-next-line no-console
  console.log(`[AUTH][${elapsed()}ms] env-snapshot`, snap);
  installFetchProbeOnce();
}

/** Instrument window.fetch once so every request during auth is timed. */
let fetchPatched = false;
function installFetchProbeOnce() {
  if (fetchPatched || typeof window === "undefined" || !window.fetch) return;
  fetchPatched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    // Only trace auth-relevant traffic to avoid log spam.
    const relevant = /minepi\.com|_serverFn|supabase|pi\.functions|verifyPiAuth|getPiSession/i.test(
      url,
    );
    if (!relevant) return original(input as RequestInfo, init);
    const started = now();
    const t0 = elapsed();
    // eslint-disable-next-line no-console
    console.log(`[AUTH][${t0}ms] fetch:start ${init?.method ?? "GET"} ${redact(url)}`);
    try {
      const res = await original(input as RequestInfo, init);
      const dur = Math.round(now() - started);
      // eslint-disable-next-line no-console
      console.log(
        `[AUTH][${elapsed()}ms] fetch:end   ${res.status} ${redact(url)} duration=${dur}ms`,
      );
      return res;
    } catch (err) {
      const dur = Math.round(now() - started);
      // eslint-disable-next-line no-console
      console.error(
        `[AUTH][${elapsed()}ms] fetch:error ${redact(url)} duration=${dur}ms`,
        (err as Error)?.message,
      );
      throw err;
    }
  };
}

function redact(url: string): string {
  // Strip query strings that may include tokens.
  return url.replace(/([?&](access_token|token|key|apikey)=)[^&]+/gi, "$1<redacted>");
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function lastStage() {
  return { label: lastStageLabel, atMs: lastStageAt ? Math.round(lastStageAt - flowStart) : 0 };
}
