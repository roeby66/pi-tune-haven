import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { songs as allSongs, type Song } from "@/lib/mock-data";

interface PlayerContextValue {
  current: Song | null;
  queue: Song[];
  isPlaying: boolean;
  progress: number; // 0..1 (simulated)
  volume: number; // 0..1
  favorites: Set<string>;
  playSong: (id: string) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  setProgress: (v: number) => void;
  setVolume: (v: number) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [queue] = useState<Song[]>(allSongs);
  const [index, setIndex] = useState<number | null>(null);
  const [isPlaying, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0.3);
  const [volume, setVolume] = useState(0.75);
  const [favorites, setFavorites] = useState<Set<string>>(new Set(["s1", "s5"]));

  const current = index === null ? null : queue[index] ?? null;

  const playSong = useCallback(
    (id: string) => {
      const i = queue.findIndex((s) => s.id === id);
      if (i === -1) return;
      setIndex(i);
      setPlaying(true);
      setProgress(0);
    },
    [queue],
  );

  const togglePlay = useCallback(() => {
    if (index === null) {
      setIndex(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  }, [index]);

  const next = useCallback(() => {
    setIndex((i) => (i === null ? 0 : (i + 1) % queue.length));
    setProgress(0);
    setPlaying(true);
  }, [queue.length]);

  const previous = useCallback(() => {
    setIndex((i) => (i === null ? 0 : (i - 1 + queue.length) % queue.length));
    setProgress(0);
    setPlaying(true);
  }, [queue.length]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      current,
      queue,
      isPlaying,
      progress,
      volume,
      favorites,
      playSong,
      togglePlay,
      next,
      previous,
      setProgress,
      setVolume,
      toggleFavorite,
      isFavorite,
    }),
    [current, queue, isPlaying, progress, volume, favorites, playSong, togglePlay, next, previous, toggleFavorite, isFavorite],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}
