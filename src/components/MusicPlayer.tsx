import { useState } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { formatDuration } from "@/lib/types";
import { LyricsPanel } from "@/components/LyricsPanel";
import logoAsset from "@/assets/mypimusic-logo.jpg.asset.json";
import {
  Heart,
  Mic2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  Square,
  Volume2,
} from "lucide-react";

export function MusicPlayer() {
  const {
    current,
    isPlaying,
    togglePlay,
    stop,
    progress,
    duration,
    seek,
    volume,
    setVolume,
    toggleFavorite,
    isFavorite,
    shuffle,
    repeat,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer();

  if (!current) return null;

  const elapsed = Math.floor((duration || current.duration) * progress);
  const total = Math.floor(duration || current.duration);

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-3 md:bottom-0 md:px-4">
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-card/95 p-3 shadow-purple backdrop-blur">
        <div className="flex items-center gap-3">
          <img
            src={current.cover || logoAsset.url}
            alt={current.title}
            className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{current.title}</p>
            <p className="truncate text-xs text-muted-foreground">{current.artist}</p>
          </div>
          <button
            onClick={() => void toggleFavorite(current.id)}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:text-primary"
            aria-label="Favorite"
          >
            <Heart className={`h-4 w-4 ${isFavorite(current.id) ? "fill-primary text-primary" : ""}`} />
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleShuffle}
              className={`hidden rounded-full p-2 sm:block ${shuffle ? "text-primary" : "text-muted-foreground"}`}
              aria-label="Shuffle"
            >
              <Shuffle className="h-4 w-4" />
            </button>
            <button
              onClick={togglePlay}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-gold"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
            </button>

            <button
              onClick={stop}
              className="hidden rounded-full p-2 text-muted-foreground hover:text-foreground sm:block"
              aria-label="Stop"
            >
              <Square className="h-4 w-4" />
            </button>
            <button
              onClick={cycleRepeat}
              className={`hidden rounded-full p-2 sm:block ${repeat !== "off" ? "text-primary" : "text-muted-foreground"}`}
              aria-label="Repeat"
            >
              {repeat === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="tabular-nums">{formatDuration(elapsed)}</span>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(progress * 1000)}
            onChange={(e) => seek(Number(e.target.value) / 1000)}
            className="h-1 flex-1 cursor-pointer accent-[oklch(0.82_0.16_86)]"
            aria-label="Progress"
          />
          <span className="tabular-nums">{formatDuration(total)}</span>
        </div>

        <div className="mt-1 hidden items-center gap-2 md:flex">
          <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            className="h-1 w-32 cursor-pointer accent-[oklch(0.55_0.22_305)]"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}
