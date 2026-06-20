import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { type Song, formatDuration } from "@/lib/mock-data";

export function SongCard({ song }: { song: Song }) {
  const { playSong } = usePlayer();
  return (
    <div className="group flex flex-col">
      <Link
        to="/music/$id"
        params={{ id: song.id }}
        className="relative block aspect-square overflow-hidden rounded-xl border border-white/10"
      >
        <img
          src={song.cover}
          alt={song.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <button
          onClick={(e) => {
            e.preventDefault();
            playSong(song.id);
          }}
          aria-label={`Play ${song.title}`}
          className="absolute bottom-2 right-2 flex h-10 w-10 translate-y-1 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-gold transition-all group-hover:translate-y-0 group-hover:opacity-100"
        >
          <Play className="ml-0.5 h-4 w-4" />
        </button>
      </Link>
      <div className="mt-2">
        <p className="truncate text-sm font-semibold">{song.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {song.artist} · {formatDuration(song.duration)}
        </p>
      </div>
    </div>
  );
}

export function SongRow({ song, index }: { song: Song; index?: number }) {
  const { playSong, current, isPlaying } = usePlayer();
  const active = current?.id === song.id && isPlaying;
  return (
    <button
      onClick={() => playSong(song.id)}
      className="flex w-full items-center gap-3 rounded-xl border border-transparent p-2 text-left transition-colors hover:border-white/10 hover:bg-card/60"
    >
      {typeof index === "number" && (
        <span className="w-5 text-center text-xs text-muted-foreground tabular-nums">{index + 1}</span>
      )}
      <img src={song.cover} alt={song.title} className="h-11 w-11 rounded-md object-cover" loading="lazy" />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${active ? "text-primary" : ""}`}>{song.title}</p>
        <p className="truncate text-xs text-muted-foreground">{song.artist}</p>
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(song.duration)}</span>
    </button>
  );
}
