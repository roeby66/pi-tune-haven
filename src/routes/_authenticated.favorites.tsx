import { createFileRoute } from "@tanstack/react-router";
import { SongRow } from "@/components/SongCard";
import { usePlayer } from "@/contexts/PlayerContext";
import { getSong } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/favorites")({
  head: () => ({ meta: [{ title: "Favorites — MyPiMusic" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { favorites } = usePlayer();
  const songs = Array.from(favorites).map(getSong).filter(Boolean);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Favorites</h1>
      {songs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-muted-foreground">
          Songs you favorite will appear here.
        </p>
      ) : (
        <div className="space-y-1">
          {songs.map((s, i) => s && <SongRow key={s.id} song={s} index={i} />)}
        </div>
      )}
    </div>
  );
}
