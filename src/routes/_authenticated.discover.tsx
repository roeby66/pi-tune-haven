import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { SongRow } from "@/components/SongCard";
import { songs } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({ meta: [{ title: "Discover — MyPiMusic" }] }),
  component: DiscoverPage,
});

const GENRES = ["All", "Synthwave", "Electronic", "Indie Pop", "Folk", "Hip-Hop", "Ambient"];

function DiscoverPage() {
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("All");

  const filtered = songs.filter((s) => {
    const matchQ =
      !q ||
      s.title.toLowerCase().includes(q.toLowerCase()) ||
      s.artist.toLowerCase().includes(q.toLowerCase());
    return matchQ;
  });

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
        {GENRES.map((g) => (
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
        {filtered.map((s, i) => (
          <SongRow key={s.id} song={s} index={i} />
        ))}
        {filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">No tracks found.</p>
        )}
      </div>
    </div>
  );
}
