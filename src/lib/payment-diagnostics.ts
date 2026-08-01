// PaymentDiagnosticLogger — observability only.
// Mirrors auth-diagnostic-logger but for the Pi payment lifecycle.
// Log format:  [PAY#12345][+120ms][Δ40ms] CREATE_PAYMENT_CALLED

export type PaymentStage =
  | "PAYMENT_BUTTON_CLICKED"
  | "PAYMENT_REQUEST_CREATED"
  | "CREATE_PAYMENT_CALLED"
  | "CREATE_PAYMENT_RETURNED"
  | "ON_READY_FOR_SERVER_APPROVAL"
  | "ON_READY_FOR_SERVER_APPROVAL_COMPLETED"
  | "ON_READY_FOR_SERVER_COMPLETION"
  | "ON_READY_FOR_SERVER_COMPLETION_COMPLETED"
  | "ON_CANCEL"
  | "ON_ERROR"
  | "PAYMENT_COMPLETED";

const WARN_MS = 5000;
const ERROR_MS = 15000;

interface StageRecord {
  stage: string;
  atMs: number;
  deltaMs: number;
  meta?: Record<string, unknown>;
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

class PaymentDiagnosticSession {
  readonly id: string;
  readonly startedAt: number;
  readonly startedIso: string;
  private lastAt: number;
  private lastStage = "SESSION_START";
  private finished = false;
  private watchWarn: ReturnType<typeof setTimeout> | null = null;
  private watchErr: ReturnType<typeof setTimeout> | null = null;
  stages: StageRecord[] = [];
  errors: { stage: string; message: string; stack?: string }[] = [];
  facts: Record<string, unknown> = {};
  result: "SUCCESS" | "CANCELLED" | "FAILED" | "TIMEOUT" | "PENDING" = "PENDING";

  constructor() {
    this.id = String(Math.floor(10000 + Math.random() * 89999));
    this.startedAt = now();
    this.startedIso = new Date().toISOString();
    this.lastAt = this.startedAt;
  }

  private prefix(delta: number) {
    return `[PAY#${this.id}][+${Math.round(now() - this.startedAt)}ms][Δ${Math.round(delta)}ms]`;
  }

  private armWatchdogs(stage: string) {
    this.clearWatchdogs();
    this.watchWarn = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn(`[PAY WARNING][PAY#${this.id}] stage "${stage}" pending ${WARN_MS}ms`);
    }, WARN_MS);
    this.watchErr = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.error(`[PAY ERROR][PAY#${this.id}] stage "${stage}" pending ${ERROR_MS}ms`);
    }, ERROR_MS);
  }

  clearWatchdogs() {
    if (this.watchWarn) clearTimeout(this.watchWarn);
    if (this.watchErr) clearTimeout(this.watchErr);
    this.watchWarn = null;
    this.watchErr = null;
  }

  stage(stage: PaymentStage | string, meta?: Record<string, unknown>) {
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
    console.log(`[PAY#${this.id}] fact ${key}=${safeJson(value)}`);
  }

  error(stage: string, err: unknown) {
    const e = err as Error;
    this.errors.push({ stage, message: e?.message ?? String(err), stack: e?.stack });
    // eslint-disable-next-line no-console
    console.error(`[PAY ERROR][PAY#${this.id}] ${stage}: ${e?.message ?? String(err)}`, e?.stack);
  }

  get currentStage() {
    return this.lastStage;
  }

  finish(result: "SUCCESS" | "CANCELLED" | "FAILED" | "TIMEOUT") {
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
    const lines = [
      "======= PAYMENT DIAGNOSTIC REPORT =======",
      `Session ID:          PAY#${this.id}`,
      `Start Time:          ${this.startedIso}`,
      `Total Duration:      ${total}ms`,
      `Pi Browser:          ${this.facts["isPiBrowser"] ?? "unknown"}`,
      `window.Pi:           ${this.facts["hasPi"] ?? "unknown"}`,
      `createPayment():     ${this.facts["hasCreatePayment"] ?? "unknown"}`,
      `Plan:                ${this.facts["planName"] ?? "n/a"} (${this.facts["amount"] ?? "?"} π)`,
      `Payment ID:          ${this.facts["paymentId"] ?? "n/a"}`,
      `Txid:                ${this.facts["txid"] ?? "n/a"}`,
      `Slowest Stage:       ${slowest ? `${slowest.stage} (${slowest.deltaMs}ms)` : "n/a"}`,
      `Last Stage:          ${this.lastStage}`,
      `Errors:              ${this.errors.length}`,
      ...this.errors.map((e) => `  - [${e.stage}] ${e.message}`),
      "Stage timeline:",
      ...this.stages.map((s) => `  +${s.atMs}ms Δ${s.deltaMs}ms ${s.stage}`),
      `Result:              ${this.result}`,
      "=========================================",
    ];
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
  }
}

let active: PaymentDiagnosticSession | null = null;

export function payDiagStart(meta?: Record<string, unknown>) {
  if (active) active.finish("FAILED"); // previous attempt never completed
  active = new PaymentDiagnosticSession();
  active.stage("PAYMENT_BUTTON_CLICKED", meta);
  if (typeof window !== "undefined") {
    const w = window as unknown as { Pi?: { createPayment?: unknown } };
    active.fact("hasPi", !!w.Pi);
    active.fact("hasCreatePayment", typeof w.Pi?.createPayment === "function");
    active.fact("userAgent", navigator.userAgent);
  }
  return active;
}

export function payDiagStage(stage: PaymentStage | string, meta?: Record<string, unknown>) {
  active?.stage(stage, meta);
}

export function payDiagFact(key: string, value: unknown) {
  active?.fact(key, value);
}

export function payDiagError(stage: string, err: unknown) {
  active?.error(stage, err);
}

export function payDiagFinish(result: "SUCCESS" | "CANCELLED" | "FAILED" | "TIMEOUT") {
  active?.finish(result);
  active = null;
}

export function payDiagSession() {
  return active;
}
