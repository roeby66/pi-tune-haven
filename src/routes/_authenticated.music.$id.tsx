import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Heart, Play } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { formatDuration } from "@/lib/types";
import { getSong, listSongs } from "@/lib/music.functions";
import { SongRow } from "@/components/SongCard";

export const Route = createFileRoute("/_authenticated/music/$id")({
  head: () => ({ meta: [{ title: "Now playing — MyPiMusic" }] }),
  component: MusicDetailsPage,
});

function MusicDetailsPage() {
  const { id } = Route.useParams();
  const { playSong, toggleFavorite, isFavorite } = usePlayer();

  const songQ = useQuery({ queryKey: ["song", id], queryFn: () => getSong({ data: { id } }) });
  const song = songQ.data ?? null;
  const moreQ = useQuery({
    queryKey: ["songs", "more", song?.artistId],
    queryFn: () => listSongs({ data: { limit: 20 } }),
    enabled: !!song,
  });

  if (songQ.isLoading) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!song) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">Track not found.</p>
        <Link to="/home" className="mt-4 inline-block text-sm text-primary underline">
          Back to home
        </Link>
      </div>
    );
  }

  const more = (moreQ.data ?? []).filter((s) => s.artistId === song.artistId && s.id !== song.id);
  const fav = isFavorite(song.id);

  return (
    <div>
      <Link to="/discover" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/60">
        <img src={song.cover} alt={song.title} className="aspect-square w-full object-cover" />
        <div className="p-4">
          {song.album && (
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">{song.album}</p>
          )}
          <h1 className="mt-1 text-2xl font-extrabold">{song.title}</h1>
          <p className="text-sm text-muted-foreground">{song.artist}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {song.duration > 0 && <span>{formatDuration(song.duration)}</span>}
            <span>·</span>
            <span>{song.plays.toLocaleString()} plays</span>
            <span>·</span>
            <span>Released {new Date(song.releasedAt).toLocaleDateString()}</span>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => playSong(song, more.length ? [song, ...more] : [song])}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-gold"
            >
              <Play className="h-4 w-4" /> Play
            </button>
            <button
              onClick={() => void toggleFavorite(song.id)}
              className={`flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 ${
                fav ? "bg-primary/10 text-primary" : "bg-card/60 text-muted-foreground"
              }`}
              aria-label="Favorite"
            >
              <Heart className={`h-5 w-5 ${fav ? "fill-primary" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {more.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold">More from {song.artist}</h2>
          <div className="space-y-1">
            {more.map((s, i) => (
              <SongRow key={s.id} song={s} index={i} queue={more} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
