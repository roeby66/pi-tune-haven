import { describe, expect, it } from "vitest";
import { nextAdPlaybackPhase } from "../ad-playback";

describe("ad playback media state", () => {
  it("shows loading while the media is waiting, never a time-based completion state", () => {
    expect(nextAdPlaybackPhase("playing", "waiting")).toBe("waiting");
    expect(nextAdPlaybackPhase("waiting", "stalled")).toBe("waiting");
  });

  it("returns to playing only from real play/playing media events", () => {
    expect(nextAdPlaybackPhase("waiting", "playing")).toBe("playing");
    expect(nextAdPlaybackPhase("loading", "play")).toBe("playing");
  });

  it("keeps the user-gesture fallback visible across a new load signal", () => {
    expect(nextAdPlaybackPhase("blocked", "blocked")).toBe("blocked");
    expect(nextAdPlaybackPhase("blocked", "loadstart")).toBe("blocked");
  });
});