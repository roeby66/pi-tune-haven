import { useEffect, useMemo, useRef, useState } from "react";
import { X, ListMusic } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { activeLyricIndex, parseSyncedLyrics } from "@/lib/lyrics";

export function LyricsPanel({ onClose }: { onClose: () => void }) {
  const { current, progress, duration } = usePlayer();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const [following, setFollowing] = useState(true);
  const autoScrollRef = useRef(false);

  const lines = useMemo(() => parseSyncedLyrics(current?.syncedLyrics ?? null), [current?.syncedLyrics]);
  const currentTime = (duration || current?.duration || 0) * progress;
  const active = activeLyricIndex(lines, currentTime);

  // Reset when the song changes.
  useEffect(() => {
    setFollowing(true);
    lineRefs.current = [];
    containerRef.current?.scrollTo({ top: 0 });
  }, [current?.id]);

  // Keep the active line centred while following.
  useEffect(() => {
    if (!following || active < 0) return;
    const el = lineRefs.current[active];
    const box = containerRef.current;
    if (!el || !box) return;
    autoScrollRef.current = true;
    box.scrollTo({
      top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2,
      behavior: "smooth",
    });
    const t = window.setTimeout(() => (autoScrollRef.current = false), 600);
    return () => window.clearTimeout(t);
  }, [active, following]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <ListMusic className="h-4 w-4 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{current?.title ?? "Lyrics"}</p>
          <p className="truncate text-xs text-muted-foreground">{current?.artist}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-muted-foreground hover:text-foreground"
          aria-label="Close lyrics"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {lines.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          Lyrics not available
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={() => {
            if (autoScrollRef.current) return;
            setFollowing(false);
          }}
          className="flex-1 overflow-y-auto px-6 py-[35vh]"
        >
          {lines.map((l, i) => (
            <p
              key={l.index}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              className={`py-2 text-center text-base leading-relaxed transition-all duration-300 ${
                i === active
                  ? "scale-[1.03] font-bold text-primary"
                  : "text-muted-foreground/70"
              }`}
            >
              {l.text || "♪"}
            </p>
          ))}
        </div>
      )}

      {!following && lines.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <button
            onClick={() => setFollowing(true)}
            className="pointer-events-auto rounded-full border border-white/10 bg-card/95 px-4 py-2 text-xs font-semibold text-primary shadow-purple"
          >
            Follow lyrics
          </button>
        </div>
      )}
    </div>
  );
}
