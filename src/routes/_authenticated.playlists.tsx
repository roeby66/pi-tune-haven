import { createFileRoute, Link } from "@tanstack/react-router";
import { usePlayer } from "@/contexts/PlayerContext";

export const Route = createFileRoute("/_authenticated/playlists")({
  head: () => ({ meta: [{ title: "Playlists — MyPiMusic" }] }),
  component: PlaylistsPage,
});

function PlaylistsPage() {
  const { entitlements } = usePlayer();
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Playlists</h1>
      <div className="rounded-2xl border border-dashed border-white/10 bg-card/40 p-8 text-center">
        {entitlements.canManagePlaylists ? (
          <>
            <p className="text-sm font-semibold">Playlists coming soon</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Curate your own Pi-powered playlists. This feature is in active development.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold">Playlists are for Standard and Premium members</p>
            <Link to="/membership" className="mt-2 inline-block text-xs font-semibold text-primary">
              View membership plans
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
