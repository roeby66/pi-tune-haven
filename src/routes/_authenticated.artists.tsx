import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, BarChart3, Upload } from "lucide-react";
import { artists, songsByArtist } from "@/lib/mock-data";
import { SongRow } from "@/components/SongCard";

export const Route = createFileRoute("/_authenticated/artists")({
  head: () => ({ meta: [{ title: "Artists — MyPiMusic" }] }),
  component: ArtistsPage,
});

function ArtistsPage() {
  const [tab, setTab] = useState<"browse" | "studio">("browse");
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Artists</h1>
        <div className="rounded-full border border-white/10 bg-card/60 p-1 text-xs">
          <button
            onClick={() => setTab("browse")}
            className={`rounded-full px-3 py-1.5 ${tab === "browse" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Browse
          </button>
          <button
            onClick={() => setTab("studio")}
            className={`rounded-full px-3 py-1.5 ${tab === "studio" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Artist Studio
          </button>
        </div>
      </div>

      {tab === "browse" ? <BrowseArtists /> : <ArtistStudio />}
    </div>
  );
}

function BrowseArtists() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {artists.map((a) => (
        <div key={a.id} className="rounded-xl border border-white/10 bg-card/60 p-3">
          <img src={a.cover} alt={a.name} className="aspect-square w-full rounded-lg object-cover" />
          <div className="mt-2 flex items-center gap-1">
            <p className="truncate text-sm font-semibold">{a.name}</p>
            {a.verified && <BadgeCheck className="h-3.5 w-3.5 text-primary" />}
          </div>
          <p className="truncate text-xs text-muted-foreground">{a.genre}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {a.followers.toLocaleString()} followers
          </p>
        </div>
      ))}
    </div>
  );
}

function ArtistStudio() {
  const myArtistId = "a1";
  const mySongs = songsByArtist(myArtistId);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-card/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Profile</p>
        <h2 className="mt-1 text-lg font-bold">Set up your artist profile</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Promote your music to Pi Pioneers. Pi-powered monetization coming soon.
        </p>
        <div className="mt-4 grid gap-3">
          <input
            placeholder="Artist name"
            aria-label="Artist name"
            className="rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm focus:border-primary/40 focus:outline-none"
          />
          <input
            placeholder="Genre (e.g. Synthwave)"
            aria-label="Genre"
            className="rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm focus:border-primary/40 focus:outline-none"
          />
          <textarea
            placeholder="Short bio"
            aria-label="Short bio"
            rows={3}
            className="rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm focus:border-primary/40 focus:outline-none"
          />
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-gold">
            Save profile
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-card/60 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Upload music</h3>
          <Upload className="h-4 w-4 text-primary" />
        </div>
        <div className="mt-3 grid gap-2">
          <input
            placeholder="Song title"
            aria-label="Song title"
            className="rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm"
          />
          <input
            placeholder="Album"
            aria-label="Album"
            className="rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm"
          />
          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-white/15 bg-background/40 px-3 py-6 text-xs text-muted-foreground">
            <input type="file" accept="image/*" className="hidden" />
            Upload cover image
          </label>
          <button className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
            Submit for review
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-card/60 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Your songs</h3>
          <BarChart3 className="h-4 w-4 text-purple" />
        </div>
        <div className="mt-3 space-y-1">
          {mySongs.map((s, i) => (
            <SongRow key={s.id} song={s} index={i} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { l: "Plays", v: "1.5M" },
            { l: "Listeners", v: "184K" },
            { l: "Saves", v: "42K" },
          ].map((s) => (
            <div key={s.l} className="rounded-lg bg-background/60 p-3">
              <p className="text-sm font-bold text-primary">{s.v}</p>
              <p className="text-[10px] uppercase text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
