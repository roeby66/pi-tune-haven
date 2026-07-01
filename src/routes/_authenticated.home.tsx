import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { SongCard } from "@/components/SongCard";
import { listSongs, listArtists } from "@/lib/music.functions";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — MyPiMusic" }] }),
  component: HomePage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-muted-foreground">
      {label}
    </p>
  );
}

function HomePage() {
  const { user, isAdmin } = useAuth();
  const trending = useQuery({
    queryKey: ["songs", "trending"],
    queryFn: () => listSongs({ data: { sort: "trending", limit: 8 } }),
  });
  const newReleases = useQuery({
    queryKey: ["songs", "new"],
    queryFn: () => listSongs({ data: { sort: "new", limit: 8 } }),
  });
  const artists = useQuery({ queryKey: ["artists"], queryFn: () => listArtists() });

  const featured = (trending.data ?? []).slice(0, 3);
  const emptyCatalog =
    !trending.isLoading &&
    !newReleases.isLoading &&
    (trending.data?.length ?? 0) === 0 &&
    (newReleases.data?.length ?? 0) === 0;

  return (
    <div>
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-hero p-5 text-primary-foreground shadow-purple">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Welcome back</p>
        <h1 className="mt-1 text-2xl font-extrabold">
          Hello, @{user?.username ?? "pioneer"}
        </h1>
        <p className="mt-1 text-sm opacity-90">
          Discover what the Pi community is listening to right now.
        </p>
        {isAdmin && (
          <Link
            to="/admin"
            className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary-foreground/20 px-3 py-1 text-xs font-semibold"
          >
            Admin panel →
          </Link>
        )}
      </div>

      {emptyCatalog && (
        <div className="mb-6 rounded-2xl border border-dashed border-primary/30 bg-card/40 p-5 text-center">
          <p className="text-sm font-semibold">The catalog is empty</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isAdmin
              ? "Head to the admin panel to upload your first song."
              : "Songs will appear here as soon as the MyPiMusic team uploads them."}
          </p>
          {isAdmin && (
            <Link
              to="/admin"
              className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-gold"
            >
              Upload a song
            </Link>
          )}
        </div>
      )}

      {featured.length > 0 && (
        <Section title="Featured">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {featured.map((s) => (
              <SongCard key={s.id} song={s} queue={trending.data ?? undefined} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Trending">
        {trending.isLoading ? (
          <SkeletonGrid />
        ) : (trending.data?.length ?? 0) === 0 ? (
          <EmptyState label="No trending tracks yet." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {trending.data!.map((s) => (
              <SongCard key={s.id} song={s} queue={trending.data ?? undefined} />
            ))}
          </div>
        )}
      </Section>

      <Section title="New Releases">
        {newReleases.isLoading ? (
          <SkeletonGrid />
        ) : (newReleases.data?.length ?? 0) === 0 ? (
          <EmptyState label="No new releases yet." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {newReleases.data!.map((s) => (
              <SongCard key={s.id} song={s} queue={newReleases.data ?? undefined} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Featured Artists">
        {artists.isLoading ? (
          <SkeletonGrid />
        ) : (artists.data?.length ?? 0) === 0 ? (
          <EmptyState label="No artists yet." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {artists.data!.slice(0, 4).map((a) => (
              <Link
                key={a.id}
                to="/artists"
                className="rounded-xl border border-white/10 bg-card/60 p-3 text-center transition-colors hover:border-primary/40"
              >
                <img src={a.cover} alt={a.name} className="mx-auto h-20 w-20 rounded-full object-cover" />
                <p className="mt-2 truncate text-sm font-semibold">{a.name}</p>
                <p className="truncate text-xs text-muted-foreground">{a.genre ?? "Artist"}</p>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="aspect-square animate-pulse rounded-xl bg-card/60" />
      ))}
    </div>
  );
}
