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
import { createTransitionGuard, resolveAdvance } from "@/lib/player-transition";
import { FREE_ENTITLEMENTS, type PlayerEntitlements } from "@/lib/player-entitlements";
import { getPlayerEntitlements } from "@/lib/player-entitlements.functions";
import { MEMBERSHIP_CHANGED_EVENT } from "@/lib/membership-events";


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
  entitlements: PlayerEntitlements;
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
  const [loadNonce, setLoadNonce] = useState(0);
  const guardRef = useRef(createTransitionGuard());
  const [entitlements, setEntitlements] = useState<PlayerEntitlements>(FREE_ENTITLEMENTS);
  // Server decides; re-resolved on sign-in/out and whenever membership changes.
  useEffect(() => {
    setEntitlements(FREE_ENTITLEMENTS);
    if (!user) return;
    let alive = true;
    const refresh = () => {
      getPlayerEntitlements()
        .then((e) => { if (alive) setEntitlements(e); })
        .catch((err) => console.warn("[player] entitlement refresh failed", err));
    };
    refresh();
    window.addEventListener(MEMBERSHIP_CHANGED_EVENT, refresh);
    return () => {
      alive = false;
      window.removeEventListener(MEMBERSHIP_CHANGED_EVENT, refresh);
    };
  }, [user]);
  const effectiveShuffle = entitlements.forceShuffle || (entitlements.canToggleShuffle && shuffle);


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
    const onPause = () => {
      if (!el.ended) setPlaying(false);
    };
    const onEnded = () => handleEndedRef.current();
    const onError = () => handleErrorRef.current();
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Sync volume.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Keep latest index/queue in refs so transition handlers never read stale state.
  const indexRef = useRef<number | null>(index);
  const queueRef = useRef<Song[]>(queue);
  indexRef.current = index;
  queueRef.current = queue;

  /**
   * Attempt playback. If the media is not ready yet, retry once on `canplay`
   * (single listener, replaced on each call). If the retry also fails, hand
   * over to the playback-error recovery so the queue keeps moving.
   */
  const retryCleanupRef = useRef<(() => void) | null>(null);
  const playWithRetry = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    retryCleanupRef.current?.();
    retryCleanupRef.current = null;
    el.play().catch((err: unknown) => {
      const name = (err as { name?: string } | null)?.name;
      if (name === "NotAllowedError") {
        // Browser blocked autoplay — needs a user gesture; reflect paused state.
        console.warn("[player] autoplay blocked", err);
        setPlaying(false);
        return;
      }
      if (name === "AbortError") return; // superseded by a newer load/pause
      console.warn("[player] play rejected, retrying when ready", err);
      const gen = guardRef.current.current();
      const onReady = () => {
        retryCleanupRef.current = null;
        if (guardRef.current.current() !== gen) return;
        el.play().catch((err2: unknown) => {
          const n2 = (err2 as { name?: string } | null)?.name;
          console.warn("[player] retry failed", err2);
          if (n2 === "NotAllowedError") setPlaying(false);
          else if (n2 !== "AbortError") handleErrorRef.current();
        });
      };
      el.addEventListener("canplay", onReady, { once: true });
      retryCleanupRef.current = () => el.removeEventListener("canplay", onReady);
    });
  }, []);

  // Load new track when current changes (or an auto-advance forces a reload).
  const loadedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!current || !audioRef.current) return;
    const el = audioRef.current;
    const key = `${current.id}:${loadNonce}`;
    if (loadedKeyRef.current !== key) {
      loadedKeyRef.current = key;
      guardRef.current.nextGeneration();
      if (el.src !== current.audio) el.src = current.audio;
      el.currentTime = 0;
      setProgress(0);
    }
    if (isPlaying && el.paused) playWithRetry();
    // Record play once per song load.
    if (!recordedRef.current.has(current.id)) {
      recordedRef.current.add(current.id);
      recordPlay({ data: { songId: current.id } }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, loadNonce, isPlaying]);

  const advance = useCallback(() => {
    const i = indexRef.current;
    if (i === null) return;
    const res = resolveAdvance(i, queueRef.current.length, effectiveShuffle, repeat);
    if (!res.play) {
      setPlaying(false);
      return;
    }
    setIndex(res.index);
    setLoadNonce((n) => n + 1); // forces load + play even for the same track
    setPlaying(true);
  }, [repeat, effectiveShuffle]);

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
    if (!guardRef.current.claim()) return; // already transitioning
    if (repeat === "one") {
      guardRef.current.nextGeneration();
      el.currentTime = 0;
      playWithRetry();
      return;
    }
    const gen = guardRef.current.current();
    // Ask the backend whether an ad slot applies. Any failure or timeout is
    // non-blocking: music simply continues to the next song.
    let settled = false;
    const proceed = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      // User picked another song meanwhile — don't advance on top of it.
      if (guardRef.current.current() !== gen) return;
      advance();
    };
    console.info("[player] song ended, looking up ad");
    const timer = window.setTimeout(() => { console.warn("[player] ad lookup timed out, continuing"); proceed(); }, 4000);
    getNextAd({ data: { sessionId: getAdSessionId() } })
      .then((res) => {
        if (settled) return;
        if (!res?.ad) console.info("[player] no eligible ad, continuing");
        if (res?.ad && guardRef.current.current() === gen) {
          settled = true;
          window.clearTimeout(timer);
          pendingAdvanceRef.current = true;
          setCurrentAd(res.ad);
          return;
        }
        proceed();
      })
      .catch((err) => {
        console.warn("[player] ad lookup failed, continuing", err);
        proceed();
      });
  }, [repeat, advance, playWithRetry]);

  // Playback errors must never strand the queue: skip to the next track.
  const handleError = useCallback(() => {
    if (!guardRef.current.claim()) return;
    advance();
  }, [advance]);

  const handleEndedRef = useRef(handleEnded);
  const handleErrorRef = useRef(handleError);
  useEffect(() => {
    handleEndedRef.current = handleEnded;
    handleErrorRef.current = handleError;
  }, [handleEnded, handleError]);



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
    if (!entitlements.canSkip) return;
    setIndex((i) => {
      if (i === null || queue.length === 0) return i;
      if (effectiveShuffle) {
        let n = Math.floor(Math.random() * queue.length);
        if (n === i && queue.length > 1) n = (n + 1) % queue.length;
        return n;
      }
      return (i + 1) % queue.length;
    });
    setPlaying(true);
  }, [queue.length, effectiveShuffle, entitlements.canSkip]);

  const previous = useCallback(() => {
    if (!entitlements.canSkip) return;
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
  }, [queue.length, entitlements.canSkip]);

  const seek = useCallback((fraction: number) => {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    el.currentTime = Math.max(0, Math.min(1, fraction)) * el.duration;
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.max(0, Math.min(1, v)));
  }, []);

  const toggleShuffle = useCallback(() => {
    if (!entitlements.canToggleShuffle) return;
    setShuffle((s) => !s);
  }, [entitlements.canToggleShuffle]);
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
      shuffle: effectiveShuffle,
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
      entitlements,
    }),
    [
      current,
      queue,
      isPlaying,
      progress,
      duration,
      volume,
      effectiveShuffle,
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
      currentAd,
      finishAd,
      entitlements,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}
