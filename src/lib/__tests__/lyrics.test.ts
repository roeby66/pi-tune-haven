import { describe, it, expect } from "vitest";
import { parseSyncedLyrics, validateSyncedLyrics, activeLyricIndex } from "../lyrics";
describe("lyrics", () => {
  it("parses MM:SS and MM:SS.xx", () => {
    const l = parseSyncedLyrics("[00:12.50] a\n[01:05] b");
    expect(l.map((x) => [x.time, x.text, x.index])).toEqual([[12.5, "a", 0], [65, "b", 1]]);
  });
  it("empty is valid", () => expect(validateSyncedLyrics("  ").ok).toBe(true));
  it("rejects bad timestamps", () => expect(validateSyncedLyrics("hello").ok).toBe(false));
  it("finds active line", () => {
    const l = parseSyncedLyrics("[00:10] a\n[00:20] b");
    expect(activeLyricIndex(l, 5)).toBe(-1);
    expect(activeLyricIndex(l, 15)).toBe(0);
    expect(activeLyricIndex(l, 25)).toBe(1);
  });
});
