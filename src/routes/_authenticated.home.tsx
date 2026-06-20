import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { SongCard } from "@/components/SongCard";
import {
  artists,
  featuredSongIds,
  getSong,
  newReleaseIds,
  trendingSongIds,
} from "@/lib/mock-data";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [{ title: "Home — MyPiMusic" }],
  }),
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

function HomePage() {
  const { user } = useAuth();
  const featured = featuredSongIds.map(getSong).filter(Boolean);
  const trending = trendingSongIds.map(getSong).filter(Boolean);
  const newReleases = newReleaseIds.map(getSong).filter(Boolean);
  const recommendedArtists = artists.slice(0, 4);

  return (
    <div>
      <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-hero p-5 text-primary-foreground shadow-purple">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
          Welcome back
        </p>
        <h1 className="mt-1 text-2xl font-extrabold">
          Hello, @{user?.username ?? "pioneer"}
        </h1>
        <p className="mt-1 text-sm opacity-90">
          Discover what the Pi community is listening to right now.
        </p>
      </div>

      <Section title="Featured">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {featured.map((s) => s && <SongCard key={s.id} song={s} />)}
        </div>
      </Section>

      <Section title="Trending">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {trending.map((s) => s && <SongCard key={s.id} song={s} />)}
        </div>
      </Section>

      <Section title="New Releases">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {newReleases.map((s) => s && <SongCard key={s.id} song={s} />)}
        </div>
      </Section>

      <Section title="Recommended Artists">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {recommendedArtists.map((a) => (
            <Link
              key={a.id}
              to="/artists"
              className="rounded-xl border border-white/10 bg-card/60 p-3 text-center transition-colors hover:border-primary/40"
            >
              <img
                src={a.cover}
                alt={a.name}
                className="mx-auto h-20 w-20 rounded-full object-cover"
              />
              <p className="mt-2 truncate text-sm font-semibold">{a.name}</p>
              <p className="truncate text-xs text-muted-foreground">{a.genre}</p>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
