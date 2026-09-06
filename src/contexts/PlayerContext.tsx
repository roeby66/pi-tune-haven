import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Song } from "@/lib/types";
import { toggleFavorite as toggleFavoriteFn, recordPlay, listFavorites } from "@/lib/music.functions";
import { getNextAd, type PlayerAd } from "@/lib/ads.functions";
import { getAdSessionId } from "@/lib/ad-session";
import { useAuth } from "@/contexts/AuthContext";


type RepeatMode = "off" | "all" | "one";

interface PlayerContextValue {
  current: Song | null;
  queue: Song[];
  isPlaying: boolean;
  progress: number; // 0..1
  duration: number; // seconds (from audio element)
  volume: number; // 0..1
  shuffle: boolean;
  repeat: RepeatMode;
  favorites: Set<string>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  playSong: (song: Song, queue?: Song[]) => void;
  playSongList: (songs: Song[], startId?: string) => void;
  togglePlay: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
  seek: (fraction: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleFavorite: (id: string) => Promise<void>;
  isFavorite: (id: string) => boolean;
  currentAd: PlayerAd | null;
  finishAd: () => void;

}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [index, setIndex] = useState<number | null>(null);
  const [isPlaying, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const recordedRef = useRef<Set<string>>(new Set());
  const [currentAd, setCurrentAd] = useState<PlayerAd | null>(null);
  const pendingAdvanceRef = useRef(false);


  const current = index === null ? null : (queue[index] ?? null);

  // Load favorites once signed in.
  useEffect(() => {
    if (!user) {
      setFavorites(new Set());
      return;
    }
    listFavorites().then((ids) => setFavorites(new Set(ids))).catch(() => {});
  }, [user]);

  // Ensure a single <audio> element on the client.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!audioRef.current) {
      const el = new Audio();
      el.preload = "metadata";
      el.crossOrigin = "anonymous";
      audioRef.current = el;
    }
    const el = audioRef.current;
    const onTime = () => {
      if (!el.duration) return;
      setProgress(el.currentTime / el.duration);
    };
    const onLoaded = () => setDuration(el.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => handleEnded();
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync volume.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Load new track when current changes.
  useEffect(() => {
    if (!current || !audioRef.current) return;
    const el = audioRef.current;
    if (el.src !== current.audio) {
      el.src = current.audio;
      el.currentTime = 0;
      setProgress(0);
    }
    if (isPlaying) {
      el.play().catch(() => setPlaying(false));
    }
    // Record play once per song load.
    if (!recordedRef.current.has(current.id)) {
      recordedRef.current.add(current.id);
      recordPlay({ data: { songId: current.id } }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const advance = useCallback(() => {
    setIndex((i) => {
      if (i === null) return null;
      if (shuffle && queue.length > 1) {
        let n = Math.floor(Math.random() * queue.length);
        if (n === i) n = (n + 1) % queue.length;
        return n;
      }
      const next = i + 1;
      if (next >= queue.length) {
        if (repeat === "all") return 0;
        setPlaying(false);
        return i;
      }
      return next;
    });
  }, [repeat, shuffle, queue.length]);

  const finishAd = useCallback(() => {
    setCurrentAd(null);
    if (pendingAdvanceRef.current) {
      pendingAdvanceRef.current = false;
      advance();
    }
  }, [advance]);

  const handleEnded = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (repeat === "one") {
      el.currentTime = 0;
      el.play().catch(() => {});
      return;
    }
    // Ask the backend whether an ad slot applies. Any failure or timeout is
    // non-blocking: music simply continues to the next song.
    let settled = false;
    const proceed = () => {
      if (settled) return;
      settled = true;
      advance();
    };
    const timer = window.setTimeout(proceed, 4000);
    getNextAd({ data: { sessionId: getAdSessionId() } })
      .then((res) => {
        if (settled) return;
        if (res?.ad) {
          window.clearTimeout(timer);
          settled = true;
          pendingAdvanceRef.current = true;
          setCurrentAd(res.ad);
          return;
        }
        window.clearTimeout(timer);
        proceed();
      })
      .catch(() => {
        window.clearTimeout(timer);
        proceed();
      });
  }, [repeat, advance]);


  const playSong = useCallback((song: Song, newQueue?: Song[]) => {
    const q = newQueue && newQueue.length ? newQueue : [song];
    const i = q.findIndex((s) => s.id === song.id);
    setQueue(q);
    setIndex(i >= 0 ? i : 0);
    setPlaying(true);
  }, []);

  const playSongList = useCallback((songs: Song[], startId?: string) => {
    if (!songs.length) return;
    const i = startId ? songs.findIndex((s) => s.id === startId) : 0;
    setQueue(songs);
    setIndex(i >= 0 ? i : 0);
    setPlaying(true);
  }, []);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el || !current) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, [current]);

  const stop = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setProgress(0);
  }, []);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i === null || queue.length === 0) return i;
      if (shuffle) {
        let n = Math.floor(Math.random() * queue.length);
        if (n === i && queue.length > 1) n = (n + 1) % queue.length;
        return n;
      }
      return (i + 1) % queue.length;
    });
    setPlaying(true);
  }, [queue.length, shuffle]);

  const previous = useCallback(() => {
    const el = audioRef.current;
    if (el && el.currentTime > 3) {
      el.currentTime = 0;
      return;
    }
    setIndex((i) => {
      if (i === null || queue.length === 0) return i;
      return (i - 1 + queue.length) % queue.length;
    });
    setPlaying(true);
  }, [queue.length]);

  const seek = useCallback((fraction: number) => {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    el.currentTime = Math.max(0, Math.min(1, fraction)) * el.duration;
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.max(0, Math.min(1, v)));
  }, []);

  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);
  const cycleRepeat = useCallback(
    () => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off")),
    [],
  );

  const toggleFavorite = useCallback(async (id: string) => {
    // Optimistic update.
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    try {
      const { favorited } = await toggleFavoriteFn({ data: { songId: id } });
      setFavorites((prev) => {
        const next = new Set(prev);
        if (favorited) next.add(id);
        else next.delete(id);
        return next;
      });
    } catch {
      // revert
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  }, []);

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      current,
      queue,
      isPlaying,
      progress,
      duration,
      volume,
      shuffle,
      repeat,
      favorites,
      audioRef,
      playSong,
      playSongList,
      togglePlay,
      stop,
      next,
      previous,
      seek,
      setVolume,
      toggleShuffle,
      cycleRepeat,
      toggleFavorite,
      isFavorite,
      currentAd,
      finishAd,

    }),
    [
      current,
      queue,
      isPlaying,
      progress,
      duration,
      volume,
      shuffle,
      repeat,
      favorites,
      playSong,
      playSongList,
      togglePlay,
      stop,
      next,
      previous,
      seek,
      setVolume,
      toggleShuffle,
      cycleRepeat,
      toggleFavorite,
      isFavorite,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}
