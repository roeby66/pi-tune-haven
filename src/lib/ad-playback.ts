export type AdPlaybackPhase = "loading" | "playing" | "waiting" | "blocked";

export type AdPlaybackSignal = "loadstart" | "play" | "playing" | "waiting" | "stalled" | "blocked";

/**
 * Keeps the overlay state driven by the media element instead of elapsed time.
 * Only the real `playing` event confirms autoplay; `play` alone (promise or
 * event) never clears the loading/blocked state.
 */
export function nextAdPlaybackPhase(
  current: AdPlaybackPhase,
  signal: AdPlaybackSignal,
): AdPlaybackPhase {
  if (signal === "playing") return "playing";
  if (signal === "play") return current === "playing" ? "playing" : current === "blocked" ? "blocked" : "loading";
  if (signal === "waiting" || signal === "stalled") return current === "blocked" ? "blocked" : "waiting";
  if (signal === "blocked") return "blocked";
  return current === "blocked" ? "blocked" : "loading";
}

/** What to do after video.play() rejects. */
export type PlayRejectionAction = "retry-muted" | "wait-ready" | "blocked";

export function classifyPlayRejection(err: unknown, alreadyMuted: boolean): PlayRejectionAction {
  const name = (err as { name?: string } | null)?.name;
  // Superseded by a load or not ready yet: try again on the next canplay.
  if (name === "AbortError") return "wait-ready";
  if (name === "NotAllowedError") return alreadyMuted ? "blocked" : "retry-muted";
  return alreadyMuted ? "blocked" : "retry-muted";
}

/** Media classes for the full-screen ad: whole video visible, never cropped. */
export const AD_VIDEO_CLASS = "block h-full w-full max-h-full max-w-full object-contain";
