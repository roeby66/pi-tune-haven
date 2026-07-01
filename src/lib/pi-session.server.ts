// Server-only: signed httpOnly session cookie for verified Pi users.
// Cookie format: base64url(uid|username|expiresAt).base64url(hmacSha256)
import { createHmac, timingSafeEqual } from "crypto";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

const COOKIE_NAME = "mpm_pi_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

function secret(): string {
  const s = process.env.PI_SESSION_SECRET;
  if (!s) throw new Error("PI_SESSION_SECRET is not configured");
  return s;
}

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export interface PiSessionPayload {
  uid: string;
  username: string;
  expiresAt: number; // epoch ms
}

export function signPiSession(uid: string, username: string): string {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${uid}|${username}|${expiresAt}`;
  const sig = createHmac("sha256", secret()).update(payload).digest();
  return `${b64url(payload)}.${b64url(sig)}`;
}

export function verifyPiSessionToken(token: string): PiSessionPayload | null {
  try {
    const [encodedPayload, encodedSig] = token.split(".");
    if (!encodedPayload || !encodedSig) return null;
    const payload = b64urlDecode(encodedPayload).toString("utf8");
    const expected = createHmac("sha256", secret()).update(payload).digest();
    const given = b64urlDecode(encodedSig);
    if (expected.length !== given.length) return null;
    if (!timingSafeEqual(expected, given)) return null;
    const [uid, username, expiresAtStr] = payload.split("|");
    const expiresAt = Number(expiresAtStr);
    if (!uid || !username || !Number.isFinite(expiresAt)) return null;
    if (Date.now() > expiresAt) return null;
    return { uid, username, expiresAt };
  } catch {
    return null;
  }
}

export function setPiSessionCookie(uid: string, username: string): void {
  const token = signPiSession(uid, username);
  setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearPiSessionCookie(): void {
  deleteCookie(COOKIE_NAME, { path: "/" });
}

export function readPiSession(): PiSessionPayload | null {
  const token = getCookie(COOKIE_NAME);
  if (!token) return null;
  return verifyPiSessionToken(token);
}

export function requirePiSession(): PiSessionPayload {
  const s = readPiSession();
  if (!s) throw new Error("UNAUTHORIZED");
  return s;
}
