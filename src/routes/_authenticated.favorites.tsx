import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SongRow } from "@/components/SongCard";
import { listFavoriteSongs } from "@/lib/music.functions";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({ meta: [{ title: "Favorites — MyPiMusic" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const q = useQuery({ queryKey: ["favorites", "songs"], queryFn: () => listFavoriteSongs() });
  const songs = q.data ?? [];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Favorites</h1>
      {q.isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-card/40" />
          ))}
        </div>
      ) : songs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-muted-foreground">
          Songs you favorite will appear here.
        </p>
      ) : (
        <div className="space-y-1">
          {songs.map((s, i) => (
            <SongRow key={s.id} song={s} index={i} queue={songs} />
          ))}
        </div>
      )}
    </div>
  );
}
