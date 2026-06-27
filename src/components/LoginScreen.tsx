import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import logoAsset from "@/assets/mypimusic-logo.jpg.asset.json";
import { Loader2, ShieldCheck, Sparkles, Music2 } from "lucide-react";
import { subscribePiDebug, getPiDebug, type PiAuthDebug } from "@/lib/pi-auth";

export function LoginScreen() {
  const { signIn, status, error, isPiBrowser, isSdkReady } = useAuth();
  const loading = status === "loading";
  const [mounted, setMounted] = useState(false);
  const [debug, setDebug] = useState<PiAuthDebug>(() => getPiDebug());
  useEffect(() => {
    setMounted(true);
    return subscribePiDebug(setDebug);
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-purple/30 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-purple/20 blur-3xl" />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-6 rounded-3xl border border-white/10 bg-card/60 p-3 shadow-gold backdrop-blur">
              <img
                src={logoAsset.url}
                alt="MyPiMusic"
                className="h-28 w-28 rounded-2xl object-cover"
              />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome to <span className="text-gradient-gold">MyPiMusic</span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The music streaming &amp; promotion platform built exclusively for Pi Network
              Pioneers.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-card/70 p-5 backdrop-blur">
            <ul className="mb-5 space-y-3 text-sm">
              <li className="flex items-center gap-3 text-foreground/90">
                <Music2 className="h-4 w-4 text-primary" />
                Stream Pioneer-made music
              </li>
              <li className="flex items-center gap-3 text-foreground/90">
                <Sparkles className="h-4 w-4 text-purple" />
                Promote your songs to the Pi community
              </li>
              <li className="flex items-center gap-3 text-foreground/90">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Secure sign-in with your Pi identity
              </li>
            </ul>

            <button
              type="button"
              onClick={() => void signIn()}
              disabled={loading}
              className="group relative inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[oklch(0.86_0.17_90)] to-[oklch(0.72_0.18_60)] px-5 py-3.5 text-base font-semibold text-primary-foreground shadow-gold transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-foreground/15 text-sm font-black">
                  π
                </span>
              )}
              Sign in with Pi Network
            </button>

            {mounted && error && (
              <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-xs text-destructive-foreground">
                {error}
              </p>
            )}

            {mounted && !isPiBrowser && (
              <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
                For full features, open this app inside the{" "}
                <span className="font-semibold text-foreground">Pi Browser</span>.
              </p>
            )}

            {mounted && (
              <div className="mt-4 rounded-lg border border-white/10 bg-background/60 p-3 text-left text-[11px] font-mono leading-relaxed text-muted-foreground">
                <div className="mb-1 font-semibold text-foreground">Pi Auth Debug</div>
                <div>
                  Pi SDK loaded:{" "}
                  <span className={debug.sdkLoaded ? "text-primary" : "text-destructive"}>
                    {String(debug.sdkLoaded)}
                  </span>
                </div>
                <div>
                  Pi.init completed:{" "}
                  <span className={debug.initCompleted ? "text-primary" : "text-destructive"}>
                    {String(debug.initCompleted)}
                  </span>
                </div>
                <div>
                  Pi.authenticate started:{" "}
                  <span className={debug.authStarted ? "text-primary" : "text-destructive"}>
                    {String(debug.authStarted)}
                  </span>
                </div>
                <div>
                  Pi.authenticate started:{" "}
                  <span className={debug.authStarted ? "text-primary" : "text-destructive"}>
                    {String(debug.authStarted)}
                  </span>
                </div>
                <div>
                  Pi.authenticate completed:{" "}
                  <span className={debug.authCompleted ? "text-primary" : "text-destructive"}>
                    {String(debug.authCompleted)}
                  </span>
                </div>
                <div>
                  Authentication returned user:{" "}
                  <span className={debug.userReturned ? "text-primary" : "text-destructive"}>
                    {String(debug.userReturned)}
                  </span>
                </div>
                {debug.initSkipped && (
                  <div className="text-amber-400">
                    Init soft-timeout: continued without init completion
                  </div>
                )}
                <div>
                  Current stage: <span className="text-foreground">{debug.lastStep}</span>
                </div>
                {debug.username && (
                  <div>
                    Username: <span className="text-foreground">{debug.username}</span>
                  </div>
                )}
                {debug.uid && (
                  <div>
                    UID: <span className="text-foreground">{debug.uid}</span>
                  </div>
                )}
                {debug.lastError && (
                  <div>
                    SDK error: <span className="text-destructive">{debug.lastError}</span>
                  </div>
                )}
                <div>
                  isPiBrowser: {String(isPiBrowser)} · isSdkReady: {String(isSdkReady)}
                </div>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            By signing in you agree to MyPiMusic's{" "}
            <a href="/terms" className="underline underline-offset-2 hover:text-foreground">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
