export type AdPlaybackPhase = "loading" | "playing" | "waiting" | "blocked";

export type AdPlaybackSignal = "loadstart" | "play" | "playing" | "waiting" | "stalled" | "blocked";

/** Keeps the overlay state driven by the media element instead of elapsed time. */
export function nextAdPlaybackPhase(
  current: AdPlaybackPhase,
  signal: AdPlaybackSignal,
): AdPlaybackPhase {
  if (signal === "playing" || signal === "play") return "playing";
  if (signal === "waiting" || signal === "stalled") return "waiting";
  if (signal === "blocked") return "blocked";
  return current === "blocked" ? "blocked" : "loading";
}