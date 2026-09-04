import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Compass, Crown, Heart, Home, Mic2, Shield, User } from "lucide-react";
import { MusicPlayer } from "./MusicPlayer";
import logoAsset from "@/assets/mypimusic-logo.jpg.asset.json";
import { useAuth } from "@/contexts/AuthContext";

const NAV = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/artists", label: "Artists", icon: Mic2 },
  { to: "/favorites", label: "Favorites", icon: Heart },
  { to: "/become-artist", label: "Artist", icon: Mic2 },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell() {
  const { user, isAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navItems = isAdmin
    ? [...NAV, { to: "/admin", label: "Admin", icon: Shield } as const]
    : NAV;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-40">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/home" className="flex items-center gap-2">
            <img src={logoAsset.url} alt="MyPiMusic" className="h-9 w-9 rounded-lg object-cover" />
            <div className="leading-tight">
              <p className="text-sm font-bold">
                My<span className="text-primary">Pi</span>Music
              </p>
              <p className="text-[10px] text-muted-foreground">Music · Community · Pi</p>
            </div>
          </Link>
          {user && (
            <div className="flex items-center gap-2">
              <Link
                to="/membership"
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                aria-label="Membership plans"
              >
                <Crown className="h-3 w-3" /> Membership
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                  aria-label="Admin panel"
                >
                  <Shield className="h-3 w-3" /> Admin
                </Link>
              )}
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-full border border-white/10 bg-card/70 px-3 py-1.5 text-xs"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                  {user.username.slice(0, 1).toUpperCase()}
                </span>
                <span className="font-medium">@{user.username}</span>
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-background/80 pb-28 pt-6 text-center md:pb-6">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>MyPiMusic &copy; {new Date().getFullYear()}</span>
            <span className="hidden sm:inline">·</span>
            <a href="/terms" className="hover:text-foreground hover:underline underline-offset-2">Terms of Service</a>
            <span className="hidden sm:inline">·</span>
            <a href="/privacy" className="hover:text-foreground hover:underline underline-offset-2">Privacy Policy</a>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground/60">
            Independent third-party app. Not affiliated with Pi Network or Pi Core Team.
          </p>
        </div>
      </footer>

      <MusicPlayer />

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-background/95 backdrop-blur md:hidden">
        <div
          className={`mx-auto grid max-w-5xl ${isAdmin ? "grid-cols-7" : "grid-cols-6"}`}
        >
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || (to !== "/home" && pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
