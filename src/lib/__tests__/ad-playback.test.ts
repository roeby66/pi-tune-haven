import { describe, expect, it } from "vitest";
import { AD_VIDEO_CLASS, classifyPlayRejection, nextAdPlaybackPhase } from "../ad-playback";
import { resolveAdvance } from "../player-transition";

describe("ad playback media state", () => {
  it("autoplay succeeds only when the playing event occurs", () => {
    expect(nextAdPlaybackPhase("loading", "play")).toBe("loading");
    expect(nextAdPlaybackPhase("loading", "playing")).toBe("playing");
    expect(nextAdPlaybackPhase("waiting", "playing")).toBe("playing");
  });

  it("shows loading while buffering, never a time-based state", () => {
    expect(nextAdPlaybackPhase("playing", "waiting")).toBe("waiting");
    expect(nextAdPlaybackPhase("waiting", "stalled")).toBe("waiting");
  });

  it("keeps the Play fallback visible until real playback starts", () => {
    expect(nextAdPlaybackPhase("blocked", "loadstart")).toBe("blocked");
    expect(nextAdPlaybackPhase("blocked", "waiting")).toBe("blocked");
    expect(nextAdPlaybackPhase("blocked", "playing")).toBe("playing");
  });

  it("autoplay rejection: retries muted, then falls back to Play button", () => {
    const notAllowed = { name: "NotAllowedError" };
    expect(classifyPlayRejection(notAllowed, false)).toBe("retry-muted");
    expect(classifyPlayRejection(notAllowed, true)).toBe("blocked");
    expect(classifyPlayRejection({ name: "AbortError" }, false)).toBe("wait-ready");
  });

  it("ended transitions to the next song", () => {
    expect(resolveAdvance(0, 3, false, "off")).toEqual({ play: true, index: 1 });
  });

  it("ad media is letterboxed, not cropped or oversized", () => {
    expect(AD_VIDEO_CLASS).toContain("object-contain");
    expect(AD_VIDEO_CLASS).not.toContain("object-cover");
    expect(AD_VIDEO_CLASS).toContain("max-h-full");
    expect(AD_VIDEO_CLASS).toContain("max-w-full");
  });
});
