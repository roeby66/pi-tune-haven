// Pure, dependency-free ad selection logic (shared by server + tests).

export type AdTier = "FREE" | "STANDARD" | "PREMIUM" | "ALL";
export type AdStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED";
export type AdFrequency = "EVERY_SONG" | "EVERY_N_SONGS" | "TIME_INTERVAL" | "ONCE_PER_SESSION";
export type AdType =
  | "HOUSE_PROMOTION"
  | "ARTIST_PROMOTION"
  | "NEW_MUSIC"
  | "PREMIUM_PROMOTION"
  | "ANNOUNCEMENT";

export interface AdRow {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  video_path: string | null;
  thumbnail_url: string | null;
  thumbnail_path: string | null;
  duration_seconds: number | null;
  ad_type: AdType;
  target_tier: AdTier;
  priority: number;
  frequency_type: AdFrequency;
  frequency_value: number | null;
  start_at: string | null;
  end_at: string | null;
  max_impressions: number | null;
  click_url: string | null;
  status: AdStatus;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

/** Membership tier of the current listener, derived server-side only. */
export type ViewerTier = "FREE" | "STANDARD" | "PREMIUM";

/** Maps whatever the membership system stores onto a canonical tier. */
export function normalizeTier(planName: string | null | undefined): ViewerTier {
  const v = (planName ?? "").toLowerCase();
  if (/premium/.test(v)) return "PREMIUM";
  if (/standard/.test(v)) return "STANDARD";
  return "FREE";
}

export function tierMatches(adTier: AdTier, viewer: ViewerTier): boolean {
  if (adTier === "ALL") return true;
  return adTier === viewer;
}

export function isWithinWindow(ad: AdRow, now: Date = new Date()): boolean {
  const t = now.getTime();
  if (ad.start_at && new Date(ad.start_at).getTime() > t) return false;
  if (ad.end_at && new Date(ad.end_at).getTime() < t) return false;
  return true;
}

export interface AdStatsSlice {
  /** Total IMPRESSION events recorded for this ad, all users. */
  impressions: number;
  /** Songs the viewer finished since this ad was last shown to them. */
  songsSinceLastImpression: number;
  /** Minutes since the ad was last shown to this viewer (null = never). */
  minutesSinceLastImpression: number | null;
  /** Was this ad already shown in the current playback session? */
  shownThisSession: boolean;
}

export function frequencyAllows(ad: AdRow, s: AdStatsSlice): boolean {
  switch (ad.frequency_type) {
    case "EVERY_SONG":
      return true;
    case "EVERY_N_SONGS": {
      const n = Math.max(1, ad.frequency_value ?? 1);
      if (s.minutesSinceLastImpression === null) return true;
      return s.songsSinceLastImpression >= n;
    }
    case "TIME_INTERVAL": {
      const mins = Math.max(1, ad.frequency_value ?? 15);
      if (s.minutesSinceLastImpression === null) return true;
      return s.minutesSinceLastImpression >= mins;
    }
    case "ONCE_PER_SESSION":
      return !s.shownThisSession;
    default:
      return false;
  }
}

export function isEligible(
  ad: AdRow,
  viewer: ViewerTier,
  s: AdStatsSlice,
  now: Date = new Date(),
): boolean {
  if (ad.status !== "ACTIVE") return false;
  if (!ad.video_url) return false;
  if (!isWithinWindow(ad, now)) return false;
  if (!tierMatches(ad.target_tier, viewer)) return false;
  if (ad.max_impressions !== null && s.impressions >= ad.max_impressions) return false;
  if (!frequencyAllows(ad, s)) return false;
  return true;
}

/**
 * Picks the best eligible ad: highest priority first, then admin sort_order,
 * while rotating away from the ads most recently shown to this viewer.
 */
export function selectAd(
  ads: AdRow[],
  viewer: ViewerTier,
  stats: Record<string, AdStatsSlice>,
  recentAdIds: string[] = [],
  now: Date = new Date(),
): AdRow | null {
  const fallback: AdStatsSlice = {
    impressions: 0,
    songsSinceLastImpression: Number.MAX_SAFE_INTEGER,
    minutesSinceLastImpression: null,
    shownThisSession: false,
  };
  const eligible = ads.filter((a) => isEligible(a, viewer, stats[a.id] ?? fallback, now));
  if (eligible.length === 0) return null;

  const recency = (id: string) => {
    const i = recentAdIds.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : recentAdIds.length - i;
  };

  const sorted = [...eligible].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    // Rotate: prefer the ad least recently shown before honouring sort_order.
    const ra = recency(a.id);
    const rb = recency(b.id);
    if (ra !== rb) return rb - ra;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.created_at && b.created_at ? a.created_at.localeCompare(b.created_at) : 0;
  });
  return sorted[0] ?? null;
}
