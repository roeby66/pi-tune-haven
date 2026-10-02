export type RepeatMode = "off" | "all" | "one";

export interface AdvanceResult {
  /** Index to play next. */
  index: number;
  /** Whether playback should continue. */
  play: boolean;
}

/**
 * Pure next-track resolution used for automatic transitions (song ended,
 * ad finished, playback error). Repeat "one" is handled by the caller.
 */
export function resolveAdvance(
  current: number,
  length: number,
  shuffle: boolean,
  repeat: RepeatMode,
  rand: () => number = Math.random,
): AdvanceResult {
  if (length <= 0) return { index: current, play: false };
  if (shuffle && length > 1) {
    let n = Math.floor(rand() * length);
    if (n === current) n = (n + 1) % length;
    return { index: n, play: true };
  }
  const next = current + 1;
  if (next >= length) {
    if (repeat === "all") return { index: 0, play: true };
    return { index: current, play: false };
  }
  return { index: next, play: true };
}

/**
 * Exactly-once guard: each loaded track gets a generation number; the first
 * transition claim for a generation wins, later claims (ended + error,
 * ad error + ad timeout, ...) are ignored.
 */
export function createTransitionGuard() {
  let generation = 0;
  let claimed = -1;
  return {
    /** Call whenever a track (re)starts loading. */
    nextGeneration() {
      generation += 1;
      return generation;
    },
    /** Returns true only for the first claim of the current generation. */
    claim() {
      if (claimed === generation) return false;
      claimed = generation;
      return true;
    },
  };
}
