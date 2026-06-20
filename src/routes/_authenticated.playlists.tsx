import { createFileRoute } from "@tanstack/react-router";
import { playlists } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/playlists")({
  head: () => ({ meta: [{ title: "Playlists — MyPiMusic" }] }),
  component: PlaylistsPage,
});

function PlaylistsPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Playlists</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {playlists.map((p) => (
          <div
            key={p.id}
            className="flex gap-3 rounded-xl border border-white/10 bg-card/60 p-3 transition-colors hover:border-primary/40"
          >
            <img src={p.cover} alt={p.name} className="h-20 w-20 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.name}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
              <p className="mt-1 text-[11px] text-primary">{p.songIds.length} songs</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
