import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, LogOut, Mic2, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SongRow } from "@/components/SongCard";
import { listFavoriteSongs, listRecentPlays } from "@/lib/music.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — MyPiMusic" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, signOut, isAdmin } = useAuth();
  const favs = useQuery({ queryKey: ["favorites", "songs"], queryFn: () => listFavoriteSongs() });
  const recent = useQuery({ queryKey: ["plays", "recent"], queryFn: () => listRecentPlays({ data: { limit: 10 } }) });

  if (!user) return null;

  const favoriteSongs = favs.data ?? [];
  const recentSongs = recent.data ?? [];

  return (
    <div>
      <h1 className="sr-only">Your Profile</h1>
      <div className="rounded-2xl bg-gradient-hero p-5 text-primary-foreground shadow-purple">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-foreground/15 text-2xl font-extrabold ring-2 ring-primary-foreground/30">
            {user.username.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="truncate text-lg font-extrabold">@{user.username}</p>
              <BadgeCheck className="h-4 w-4" />
            </div>
            <p className="text-xs opacity-80">Pi Pioneer</p>
            <p className="mt-1 text-[10px] font-mono opacity-70">UID: {user.uid}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-primary-foreground/15 px-3 py-1 font-semibold">● Authenticated</span>
          <span className="rounded-full bg-primary-foreground/15 px-3 py-1">
            Joined {new Date(user.joinedAt).toLocaleDateString()}
          </span>
          {isAdmin && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-foreground/25 px-3 py-1 font-semibold">
              <Shield className="h-3 w-3" /> Admin
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Link
          to="/become-artist"
          className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary"
        >
          <Mic2 className="h-4 w-4" /> 🎤 Menjadi Artis
        </Link>
        <Link
          to="/artist-dashboard"
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-card/60 px-4 py-3 text-sm font-semibold"
        >
          <Mic2 className="h-4 w-4 text-primary" /> Artist Dashboard
        </Link>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">Recently Played</h2>
        {recentSongs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
            Nothing played yet.
          </p>
        ) : (
          <div className="space-y-1">
            {recentSongs.map((s, i) => (
              <SongRow key={`${s.id}-${i}`} song={s} index={i} queue={recentSongs} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">Favorite Songs</h2>
        {favoriteSongs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
            No favorite songs yet.
          </p>
        ) : (
          <div className="space-y-1">
            {favoriteSongs.map((s, i) => (
              <SongRow key={s.id} song={s} index={i} queue={favoriteSongs} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-card/60 p-4">
        <h3 className="text-sm font-bold">Coming soon</h3>
        <ul className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <li className="rounded-lg bg-background/60 p-2">π Pay with Pi</li>
          <li className="rounded-lg bg-background/60 p-2">π Artist subscriptions</li>
          <li className="rounded-lg bg-background/60 p-2">π Song purchases</li>
          <li className="rounded-lg bg-background/60 p-2">π Reward campaigns</li>
        </ul>
      </section>

      <button
        onClick={() => void signOut()}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive-foreground"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}
