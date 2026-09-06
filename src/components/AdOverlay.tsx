import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { trackAdClick, trackAdEvent } from "@/lib/ads.functions";
import { getAdSessionId } from "@/lib/ad-session";

/**
 * House-ad playback overlay. Any failure here immediately hands control back
 * to the music player — ads must never block playback.
 */
export function AdOverlay() {
  const { currentAd, finishAd } = usePlayer();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const doneRef = useRef(false);

  const ad = currentAd;

  useEffect(() => {
    doneRef.current = false;
    setRemaining(ad?.durationSeconds ?? null);
    if (!ad) return;
    const sessionId = getAdSessionId();
    void trackAdEvent({ data: { adId: ad.id, eventType: "IMPRESSION", sessionId } });
    // Hard safety net: never hold the queue longer than the ad length + 5s.
    const cap = Math.min(Math.max((ad.durationSeconds ?? 30) + 5, 10), 120) * 1000;
    const timer = window.setTimeout(() => finish("COMPLETE"), cap);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad?.id]);

  if (!ad) return null;

  function finish(event: "COMPLETE" | "ERROR" | "SKIP") {
    if (doneRef.current) return;
    doneRef.current = true;
    const el = videoRef.current;
    void trackAdEvent({
      data: {
        adId: ad!.id,
        eventType: event,
        playedSeconds: el ? Math.round(el.currentTime) : undefined,
        sessionId: getAdSessionId(),
      },
    });
    finishAd();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 p-4 backdrop-blur">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-card shadow-purple">
        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            src={ad.videoUrl}
            poster={ad.thumbnailUrl ?? undefined}
            autoPlay
            playsInline
            className="h-full w-full object-contain"
            onPlay={() =>
              void trackAdEvent({
                data: { adId: ad.id, eventType: "START", sessionId: getAdSessionId() },
              })
            }
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setRemaining(Math.max(0, Math.ceil(v.duration - v.currentTime)));
            }}
            onEnded={() => finish("COMPLETE")}
            onError={() => finish("ERROR")}
          />
          <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
            Ad{remaining !== null ? ` · ${remaining}s` : ""}
          </span>
        </div>
        <div className="space-y-2 p-4">
          <p className="text-sm font-bold">{ad.title}</p>
          {ad.description && (
            <p className="text-xs text-muted-foreground">{ad.description}</p>
          )}
          <div className="flex items-center justify-between gap-2 pt-1">
            {ad.clickUrl ? (
              <a
                href={ad.clickUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  void trackAdClick({ data: { adId: ad.id, sessionId: getAdSessionId() } })
                }
                className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                Learn more <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span />
            )}
            {ad.skippable ? (
              <button
                onClick={() => finish("SKIP")}
                className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-muted-foreground"
              >
                Skip ad
              </button>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                Music continues after this ad
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
