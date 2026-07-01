import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SongRow } from "@/components/SongCard";
import { listSongs } from "@/lib/music.functions";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({ meta: [{ title: "Discover — MyPiMusic" }] }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState<string>("All");

  const songsQuery = useQuery({
    queryKey: ["songs", "all"],
    queryFn: () => listSongs({ data: { limit: 100 } }),
  });

  const genres = useMemo(() => {
    const set = new Set<string>();
    (songsQuery.data ?? []).forEach((s) => s.genre && set.add(s.genre));
    return ["All", ...Array.from(set).sort()];
  }, [songsQuery.data]);

  const filtered = useMemo(() => {
    return (songsQuery.data ?? []).filter((s) => {
      const matchQ =
        !q ||
        s.title.toLowerCase().includes(q.toLowerCase()) ||
        s.artist.toLowerCase().includes(q.toLowerCase());
      const matchG = genre === "All" || s.genre === genre;
      return matchQ && matchG;
    });
  }, [songsQuery.data, q, genre]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Discover Music</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search songs, artists…"
          aria-label="Search songs and artists"
          className="w-full rounded-xl border border-white/10 bg-card/60 py-3 pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
        />
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {genres.map((g) => (
          <button
            key={g}
            onClick={() => setGenre(g)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors ${
              genre === g
                ? "border-primary bg-primary text-primary-foreground"
                : "border-white/10 bg-card/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {songsQuery.isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-card/40" />
          ))
        ) : (
          filtered.map((s, i) => <SongRow key={s.id} song={s} index={i} queue={filtered} />)
        )}
        {!songsQuery.isLoading && filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">No tracks found.</p>
        )}
      </div>
    </div>
  );
}
