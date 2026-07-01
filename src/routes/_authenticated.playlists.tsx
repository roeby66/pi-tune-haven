import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/playlists")({
  head: () => ({ meta: [{ title: "Playlists — MyPiMusic" }] }),
  component: PlaylistsPage,
});

function PlaylistsPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Playlists</h1>
      <div className="rounded-2xl border border-dashed border-white/10 bg-card/40 p-8 text-center">
        <p className="text-sm font-semibold">Playlists coming soon</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Curate your own Pi-powered playlists. This feature is in active development.
        </p>
      </div>
    </div>
  );
}
