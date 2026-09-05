// Player-facing ad server functions. Every failure is non-blocking: the
// player must keep playing music no matter what happens here.
import { createServerFn } from "@tanstack/react-start";

export interface PlayerAd {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  clickUrl: string | null;
  skippable: boolean;
}

export const getNextAd = createServerFn({ method: "GET" })
  .inputValidator((data?: { sessionId?: string | null }) => data ?? {})
  .handler(async ({ data }): Promise<{ ad: PlayerAd | null }> => {
    try {
      const { pickNextAd } = await import("@/lib/ads.server");
      const ad = await pickNextAd(data.sessionId ?? null);
      if (!ad) return { ad: null };
      return {
        ad: {
          id: ad.id,
          title: ad.title,
          description: ad.description,
          videoUrl: ad.video_url,
          thumbnailUrl: ad.thumbnail_url,
          durationSeconds: ad.duration_seconds,
          clickUrl: ad.click_url,
          // House ads are non-skippable; a countdown is shown instead.
          skippable: false,
        },
      };
    } catch (err) {
      console.error("[ads] getNextAd failed", err);
      return { ad: null };
    }
  });

export const trackAdEvent = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      adId: string;
      eventType: "IMPRESSION" | "START" | "COMPLETE" | "SKIP" | "ERROR";
      playedSeconds?: number;
      sessionId?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const { recordAdEvent } = await import("@/lib/ads.server");
      await recordAdEvent({
        adId: data.adId,
        eventType: data.eventType,
        playedSeconds: data.playedSeconds ?? null,
        sessionId: data.sessionId ?? null,
      });
    } catch (err) {
      console.error("[ads] trackAdEvent failed", err);
    }
    return { ok: true };
  });

export const trackAdClick = createServerFn({ method: "POST" })
  .inputValidator((data: { adId: string; sessionId?: string | null }) => data)
  .handler(async ({ data }) => {
    try {
      const { recordAdClick } = await import("@/lib/ads.server");
      await recordAdClick(data.adId, data.sessionId ?? null);
    } catch (err) {
      console.error("[ads] trackAdClick failed", err);
    }
    return { ok: true };
  });
