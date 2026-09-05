// Server-only ad manager: tier resolution, media signing, selection + tracking.
import {
  selectAd,
  normalizeTier,
  type AdRow,
  type AdStatsSlice,
  type ViewerTier,
} from "@/lib/ads-core";

const SIGNED_TTL = 60 * 60 * 6; // 6h

export interface Viewer {
  uid: string | null;
  tier: ViewerTier;
}

/** Resolves the caller's membership tier from the server session only. */
export async function resolveViewer(): Promise<Viewer> {
  const { readPiSession } = await import("@/lib/pi-session.server");
  const s = readPiSession();
  if (!s) return { uid: null, tier: "FREE" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_memberships")
    .select("membership_level,expires_at,membership_status,membership_plans(name)")
    .eq("user_uid", s.uid)
    .eq("membership_status", "active")
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const planName =
    (data as unknown as { membership_plans?: { name?: string } } | null)?.membership_plans?.name ??
    data?.membership_level ??
    null;
  const notExpired = !data?.expires_at || new Date(data.expires_at).getTime() > Date.now();
  return { uid: s.uid, tier: notExpired ? normalizeTier(planName) : "FREE" };
}

export async function signAdMedia(ad: AdRow): Promise<AdRow> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out = { ...ad };
  if (ad.video_path) {
    const { data } = await supabaseAdmin.storage
      .from("ads")
      .createSignedUrl(ad.video_path, SIGNED_TTL);
    if (data?.signedUrl) out.video_url = data.signedUrl;
  }
  if (ad.thumbnail_path) {
    const { data } = await supabaseAdmin.storage
      .from("ads")
      .createSignedUrl(ad.thumbnail_path, SIGNED_TTL);
    if (data?.signedUrl) out.thumbnail_url = data.signedUrl;
  }
  return out;
}

/** Gathers per-ad frequency/cap stats for one viewer + session. */
async function loadStats(
  ads: AdRow[],
  viewer: Viewer,
  sessionId: string | null,
): Promise<{ stats: Record<string, AdStatsSlice>; recent: string[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ids = ads.map((a) => a.id);
  const stats: Record<string, AdStatsSlice> = {};
  const recent: string[] = [];
  if (ids.length === 0) return { stats, recent };

  // Global impression counts (for max_impressions).
  const totals = new Map<string, number>();
  await Promise.all(
    ids.map(async (id) => {
      const { count } = await supabaseAdmin
        .from("ad_impressions")
        .select("id", { count: "exact", head: true })
        .eq("ad_id", id)
        .eq("event_type", "IMPRESSION");
      totals.set(id, count ?? 0);
    }),
  );

  // Recent impressions for this viewer/session (oldest → newest).
  let history: { ad_id: string; created_at: string; session_id: string | null }[] = [];
  if (viewer.uid || sessionId) {
    let q = supabaseAdmin
      .from("ad_impressions")
      .select("ad_id,created_at,session_id")
      .eq("event_type", "IMPRESSION")
      .order("created_at", { ascending: false })
      .limit(50);
    q = viewer.uid ? q.eq("user_id", viewer.uid) : q.eq("session_id", sessionId!);
    const { data } = await q;
    history = (data ?? []) as typeof history;
  }
  for (const h of [...history].reverse()) recent.push(h.ad_id);

  const now = Date.now();
  for (const ad of ads) {
    const last = history.find((h) => h.ad_id === ad.id);
    const minutesSince = last ? (now - new Date(last.created_at).getTime()) / 60000 : null;
    let songsSince = Number.MAX_SAFE_INTEGER;
    if (last && viewer.uid) {
      const { count } = await supabaseAdmin
        .from("plays")
        .select("id", { count: "exact", head: true })
        .eq("user_id", viewer.uid)
        .gt("played_at", last.created_at);
      songsSince = count ?? 0;
    } else if (last) {
      songsSince = 0;
    }
    stats[ad.id] = {
      impressions: totals.get(ad.id) ?? 0,
      songsSinceLastImpression: songsSince,
      minutesSinceLastImpression: minutesSince,
      shownThisSession: sessionId
        ? history.some((h) => h.ad_id === ad.id && h.session_id === sessionId)
        : false,
    };
  }
  return { stats, recent };
}

/** Full pipeline: eligible ads → frequency/cap filtering → rotation → signed media. */
export async function pickNextAd(sessionId: string | null): Promise<AdRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const viewer = await resolveViewer();
  const { data } = await supabaseAdmin
    .from("ads")
    .select("*")
    .eq("status", "ACTIVE")
    .in("target_tier", [viewer.tier, "ALL"])
    .order("priority", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(50);
  const ads = (data ?? []) as unknown as AdRow[];
  if (ads.length === 0) return null;
  const { stats, recent } = await loadStats(ads, viewer, sessionId);
  const chosen = selectAd(ads, viewer.tier, stats, recent);
  if (!chosen) return null;
  return signAdMedia(chosen);
}

export async function recordAdEvent(input: {
  adId: string;
  eventType: "IMPRESSION" | "START" | "COMPLETE" | "SKIP" | "ERROR";
  playedSeconds?: number | null;
  sessionId?: string | null;
}): Promise<void> {
  const { readPiSession } = await import("@/lib/pi-session.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const s = readPiSession();
  await supabaseAdmin.from("ad_impressions").insert({
    ad_id: input.adId,
    user_id: s?.uid ?? null,
    session_id: input.sessionId ?? null,
    event_type: input.eventType,
    played_seconds: input.playedSeconds ?? null,
  });
}

export async function recordAdClick(adId: string, sessionId: string | null): Promise<void> {
  const { readPiSession } = await import("@/lib/pi-session.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const s = readPiSession();
  await supabaseAdmin
    .from("ad_clicks")
    .insert({ ad_id: adId, user_id: s?.uid ?? null, session_id: sessionId });
}

const URL_RE = /^https?:\/\/[^\s]+$/i;
export function validateOptionalUrl(value: string | null, label: string): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (!URL_RE.test(v)) throw new Error(`INVALID_URL: ${label}`);
  return v;
}

export function sanitizeText(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);
}
