import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import { listArtists } from "@/lib/music.functions";

export const Route = createFileRoute("/_authenticated/artists")({
  head: () => ({ meta: [{ title: "Artists — MyPiMusic" }] }),
  component: ArtistsPage,
});

function ArtistsPage() {
  const q = useQuery({ queryKey: ["artists"], queryFn: () => listArtists() });
  const artists = q.data ?? [];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Artists</h1>
      {q.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-card/40" />
          ))}
        </div>
      ) : artists.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-muted-foreground">
          No artists yet. Admins can add artists via the upload flow.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {artists.map((a) => (
            <div key={a.id} className="rounded-xl border border-white/10 bg-card/60 p-3">
              <img src={a.cover} alt={a.name} className="aspect-square w-full rounded-lg object-cover" />
              <div className="mt-2 flex items-center gap-1">
                <p className="truncate text-sm font-semibold">{a.name}</p>
                {a.verified && <BadgeCheck className="h-3.5 w-3.5 text-primary" />}
              </div>
              <p className="truncate text-xs text-muted-foreground">{a.genre ?? "Artist"}</p>
              {a.bio && (
                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{a.bio}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
