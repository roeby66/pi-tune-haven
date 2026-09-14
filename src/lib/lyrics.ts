// Reusable LRC-style synchronized lyrics parser (line-level, V1).
// Future versions can extend LyricLine with word-level timings.

export interface LyricLine {
  /** Start time in seconds. */
  time: number;
  text: string;
  index: number;
}

const TIMESTAMP_RE = /\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/g;

/** Parse LRC-style lyrics. Unknown/metadata lines are ignored. */
export function parseSyncedLyrics(raw: string | null | undefined): LyricLine[] {
  if (!raw) return [];
  const out: { time: number; text: string }[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    TIMESTAMP_RE.lastIndex = 0;
    const stamps: number[] = [];
    let m: RegExpExecArray | null;
    let lastEnd = 0;
    while ((m = TIMESTAMP_RE.exec(line))) {
      if (m.index !== lastEnd) break; // timestamps must be leading
      lastEnd = m.index + m[0].length;
      const min = Number(m[1]);
      const sec = Number(m[2]);
      const fracRaw = m[3] ?? "";
      const frac = fracRaw ? Number(fracRaw) / 10 ** fracRaw.length : 0;
      stamps.push(min * 60 + sec + frac);
    }
    if (!stamps.length) continue;
    const text = line.slice(lastEnd).trim();
    for (const t of stamps) out.push({ time: t, text });
  }
  out.sort((a, b) => a.time - b.time);
  return out.map((l, index) => ({ ...l, index }));
}

export interface LyricsValidation {
  ok: boolean;
  error?: string;
  lineCount: number;
}

/** Validate admin input before saving. Empty input is allowed. */
export function validateSyncedLyrics(raw: string): LyricsValidation {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, lineCount: 0 };
  const lines = trimmed.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    if (!/^(\[\d{1,3}:[0-5]\d(?:[.:]\d{1,3})?\])+/.test(line)) {
      return {
        ok: false,
        lineCount: 0,
        error: `Line ${i + 1} is missing a valid timestamp. Use [MM:SS] or [MM:SS.xx].`,
      };
    }
  }
  const parsed = parseSyncedLyrics(trimmed);
  if (!parsed.length) {
    return { ok: false, lineCount: 0, error: "No valid timestamped lyric lines were found." };
  }
  return { ok: true, lineCount: parsed.length };
}

/** Index of the active line for a playback position, or -1 before the first line. */
export function activeLyricIndex(lines: LyricLine[], currentTime: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid]!.time <= currentTime + 0.05) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}
