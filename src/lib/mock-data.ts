export interface Song {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  album: string;
  duration: number; // seconds
  cover: string;
  plays: number;
  releasedAt: string;
}

export interface Artist {
  id: string;
  name: string;
  followers: number;
  cover: string;
  genre: string;
  verified: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  cover: string;
  songIds: string[];
}

const cover = (seed: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/600`;

export const artists: Artist[] = [
  { id: "a1", name: "Lunaire", followers: 184_220, cover: cover("lunaire"), genre: "Synthwave", verified: true },
  { id: "a2", name: "Pi Phonics", followers: 92_410, cover: cover("piphonics"), genre: "Electronic", verified: true },
  { id: "a3", name: "Aurora Sky", followers: 67_980, cover: cover("aurora"), genre: "Indie Pop", verified: false },
  { id: "a4", name: "Mountain & Sea", followers: 51_300, cover: cover("mountain"), genre: "Folk", verified: false },
  { id: "a5", name: "Kairo Beats", followers: 211_500, cover: cover("kairo"), genre: "Hip-Hop", verified: true },
  { id: "a6", name: "Nova Drift", followers: 38_750, cover: cover("nova"), genre: "Ambient", verified: false },
];

export const songs: Song[] = [
  { id: "s1", title: "Golden Hour", artist: "Lunaire", artistId: "a1", album: "Neon Dreams", duration: 214, cover: cover("golden-hour"), plays: 1_204_320, releasedAt: "2026-05-12" },
  { id: "s2", title: "Pi Anthem", artist: "Pi Phonics", artistId: "a2", album: "Pioneer", duration: 188, cover: cover("pi-anthem"), plays: 982_111, releasedAt: "2026-06-01" },
  { id: "s3", title: "Aurora Lights", artist: "Aurora Sky", artistId: "a3", album: "Northern", duration: 232, cover: cover("aurora-lights"), plays: 412_900, releasedAt: "2026-04-22" },
  { id: "s4", title: "Mountain Air", artist: "Mountain & Sea", artistId: "a4", album: "Quiet", duration: 256, cover: cover("mountain-air"), plays: 188_044, releasedAt: "2026-03-10" },
  { id: "s5", title: "Skyline", artist: "Kairo Beats", artistId: "a5", album: "Uptown", duration: 198, cover: cover("skyline"), plays: 2_100_445, releasedAt: "2026-06-15" },
  { id: "s6", title: "Drift Away", artist: "Nova Drift", artistId: "a6", album: "Orbit", duration: 271, cover: cover("drift"), plays: 76_980, releasedAt: "2026-05-30" },
  { id: "s7", title: "Midnight Pi", artist: "Pi Phonics", artistId: "a2", album: "Pioneer", duration: 205, cover: cover("midnight-pi"), plays: 540_222, releasedAt: "2026-02-18" },
  { id: "s8", title: "Velvet", artist: "Lunaire", artistId: "a1", album: "Neon Dreams", duration: 224, cover: cover("velvet"), plays: 318_770, releasedAt: "2026-01-09" },
];

export const playlists: Playlist[] = [
  { id: "p1", name: "Pioneer Picks", description: "Hand-curated favorites for Pi Pioneers.", cover: cover("pioneer-picks"), songIds: ["s1", "s2", "s5", "s7"] },
  { id: "p2", name: "Late Night Pi", description: "Soft beats for late coding sessions.", cover: cover("late-night"), songIds: ["s3", "s6", "s8"] },
  { id: "p3", name: "Workout Boost", description: "Energy for the daily mining streak.", cover: cover("workout"), songIds: ["s5", "s2", "s1"] },
];

export const featuredSongIds = ["s1", "s2", "s5"];
export const trendingSongIds = ["s5", "s2", "s7", "s1"];
export const newReleaseIds = ["s5", "s2", "s6", "s4"];

export function getSong(id: string): Song | undefined {
  return songs.find((s) => s.id === id);
}
export function getArtist(id: string): Artist | undefined {
  return artists.find((a) => a.id === id);
}
export function songsByArtist(artistId: string): Song[] {
  return songs.filter((s) => s.artistId === artistId);
}
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
