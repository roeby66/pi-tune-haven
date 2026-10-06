import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { trackAdClick, trackAdEvent } from "@/lib/ads.functions";
import { getAdSessionId } from "@/lib/ad-session";
import { nextAdPlaybackPhase, type AdPlaybackPhase } from "@/lib/ad-playback";
import { Button } from "@/components/ui/button";

/**
 * House-ad playback overlay. Any failure here immediately hands control back
 * to the music player — ads must never block playback.
 */
export function AdOverlay() {
  const { currentAd, finishAd } = usePlayer();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [phase, setPhase] = useState<AdPlaybackPhase>("loading");
  const doneRef = useRef(false);
  const startedRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  const ad = currentAd;

  const finish = useCallback((event: "COMPLETE" | "ERROR") => {
    if (doneRef.current) return;
    doneRef.current = true;
    const el = videoRef.current;
    void trackAdEvent({
      data: {
        adId: ad?.id ?? "",
        eventType: event,
        playedSeconds: el ? Math.round(el.currentTime) : undefined,
        sessionId: getAdSessionId(),
      },
    });
    window.clearTimeout(timerRef.current);
    finishAd();
  }, [ad?.id, finishAd]);

  const armStallWatchdog = useCallback((ms = 30_000) => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      console.warn("[ads] skipped: safety timeout without video progress", ad?.id);
      finish("ERROR");
    }, ms);
  }, [ad?.id, finish]);

  const tryPlayback = useCallback(async () => {
    const el = videoRef.current;
    if (!el) return;
    setPhase("loading");
    armStallWatchdog();
    try {
      await el.play();
    } catch (err) {
      console.warn("[ads] audible autoplay blocked, retrying muted", err);
      el.muted = true;
      try {
        await el.play();
      } catch (mutedError) {
        console.warn("[ads] video playback blocked; waiting for user gesture", mutedError);
        window.clearTimeout(timerRef.current);
        setPhase("blocked");
      }
    }
  }, [armStallWatchdog]);

  useEffect(() => {
    doneRef.current = false;
    startedRef.current = false;
    setPhase("loading");
    if (!ad) return;
    const sessionId = getAdSessionId();
    void trackAdEvent({ data: { adId: ad.id, eventType: "IMPRESSION", sessionId } });
    console.info("[ads] showing ad", ad.id, ad.videoUrl.slice(0, 80));
    void tryPlayback();
    return () => window.clearTimeout(timerRef.current);
    // The ad identity owns this lifecycle. Context updates must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad?.id]);

  if (!ad) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-hidden bg-background" role="dialog" aria-label="Video advertisement">
      <video
        ref={videoRef}
        src={ad.videoUrl}
        poster={ad.thumbnailUrl ?? undefined}
        autoPlay
        playsInline
        preload="auto"
        className="h-full w-full object-cover"
        onClick={() => {
          if (!ad.clickUrl || phase === "blocked") return;
          void trackAdClick({ data: { adId: ad.id, sessionId: getAdSessionId() } });
          window.open(ad.clickUrl, "_blank", "noopener,noreferrer");
        }}
        onLoadStart={() => setPhase((current) => nextAdPlaybackPhase(current, "loadstart"))}
        onPlay={() => {
          setPhase((current) => nextAdPlaybackPhase(current, "play"));
          if (startedRef.current) return;
          startedRef.current = true;
          void trackAdEvent({
            data: { adId: ad.id, eventType: "START", sessionId: getAdSessionId() },
          });
        }}
        onPlaying={() => {
          setPhase((current) => nextAdPlaybackPhase(current, "playing"));
          armStallWatchdog();
        }}
        onWaiting={() => {
          console.info("[ads] video buffering", ad.id);
          setPhase((current) => nextAdPlaybackPhase(current, "waiting"));
          armStallWatchdog();
        }}
        onStalled={() => {
          console.warn("[ads] video stalled", ad.id);
          setPhase((current) => nextAdPlaybackPhase(current, "stalled"));
          armStallWatchdog();
        }}
        onTimeUpdate={() => armStallWatchdog()}
        onEnded={() => {
          console.info("[ads] video ended", ad.id);
          finish("COMPLETE");
        }}
        onError={(e) => {
          console.warn("[ads] skipped: playback error", ad.id, e.currentTarget.error?.code, e.currentTarget.error?.message);
          finish("ERROR");
        }}
      />
      {(phase === "loading" || phase === "waiting") && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/20" aria-label="Loading video">
          <Loader2 className="h-9 w-9 animate-spin text-foreground drop-shadow-lg" />
        </div>
      )}
      {phase === "blocked" && (
        <div className="absolute inset-0 grid place-items-center bg-background/50 p-6 backdrop-blur-sm">
          <Button
            onClick={() => {
              const el = videoRef.current;
              if (el) el.muted = false;
              void tryPlayback();
            }}
            size="lg"
            className="rounded-full"
            aria-label="Play video"
          >
            <Play className="h-5 w-5" /> Play
          </Button>
        </div>
      )}
    </div>
  );
}
