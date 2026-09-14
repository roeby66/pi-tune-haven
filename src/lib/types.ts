// Canonical shared types for MyPiMusic.

export interface Song {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  album: string | null;
  genre: string | null;
  duration: number; // seconds
  cover: string; // signed URL or placeholder
  audio: string; // signed URL
  plays: number;
  releasedAt: string;
  /** LRC-style synchronized lyrics, or null when unavailable. */
  syncedLyrics?: string | null;
}

export interface Artist {
  id: string;
  name: string;
  slug: string;
  genre: string | null;
  bio: string | null;
  cover: string;
  verified: boolean;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function placeholderCover(seed: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/600`;
}
