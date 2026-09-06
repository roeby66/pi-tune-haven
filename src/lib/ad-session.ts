// Stable per-playback-session id used for ad frequency capping.
let cached: string | null = null;

export function getAdSessionId(): string {
  if (cached) return cached;
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = window.sessionStorage.getItem("mpm_ad_session");
    if (existing) {
      cached = existing;
      return existing;
    }
    const id = crypto.randomUUID();
    window.sessionStorage.setItem("mpm_ad_session", id);
    cached = id;
    return id;
  } catch {
    cached = crypto.randomUUID();
    return cached;
  }
}
