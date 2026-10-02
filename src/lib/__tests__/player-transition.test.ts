import { describe, expect, it } from "vitest";
import { createTransitionGuard, resolveAdvance } from "../player-transition";

describe("resolveAdvance", () => {
  it("advances to the next track and keeps playing", () => {
    expect(resolveAdvance(0, 3, false, "off")).toEqual({ index: 1, play: true });
  });
  it("stops at the last track when repeat is off", () => {
    expect(resolveAdvance(2, 3, false, "off")).toEqual({ index: 2, play: false });
  });
  it("wraps to the first track with repeat all", () => {
    expect(resolveAdvance(2, 3, false, "all")).toEqual({ index: 0, play: true });
  });
  it("repeat all on a single-track queue replays it", () => {
    expect(resolveAdvance(0, 1, false, "all")).toEqual({ index: 0, play: true });
  });
  it("shuffle never picks the same track", () => {
    expect(resolveAdvance(1, 3, true, "off", () => 0.4)).toEqual({ index: 2, play: true });
  });
  it("empty queue does not play", () => {
    expect(resolveAdvance(0, 0, false, "all").play).toBe(false);
  });
});

describe("createTransitionGuard", () => {
  it("allows exactly one transition per track generation", () => {
    const g = createTransitionGuard();
    g.nextGeneration();
    expect(g.claim()).toBe(true); // audio ended
    expect(g.claim()).toBe(false); // audio error / ad timeout afterwards
    g.nextGeneration();
    expect(g.claim()).toBe(true);
  });
});
