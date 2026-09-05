// Admin-only Ads Manager server functions. Every handler is gated by the
// existing requireAdmin() (Pi session cookie + admin role lookup).
import { createServerFn } from "@tanstack/react-start";
import type { AdRow } from "@/lib/ads-core";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface AdListItem extends AdRow {
  impressions: number;
  starts: number;
  completes: number;
  skips: number;
  clicks: number;
  completionRate: number;
  ctr: number;
}

async function loadCounts() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: events }, { data: clicks }] = await Promise.all([
    supabaseAdmin.from("ad_impressions").select("ad_id,event_type"),
    supabaseAdmin.from("ad_clicks").select("ad_id"),
  ]);
  const map = new Map<
    string,
    { impressions: number; starts: number; completes: number; skips: number; clicks: number }
  >();
  const get = (id: string) => {
    let e = map.get(id);
    if (!e) {
      e = { impressions: 0, starts: 0, completes: 0, skips: 0, clicks: 0 };
      map.set(id, e);
    }
    return e;
  };
  for (const ev of events ?? []) {
    const e = get(ev.ad_id);
    if (ev.event_type === "IMPRESSION") e.impressions += 1;
    else if (ev.event_type === "START") e.starts += 1;
    else if (ev.event_type === "COMPLETE") e.completes += 1;
    else if (ev.event_type === "SKIP") e.skips += 1;
  }
  for (const c of clicks ?? []) get(c.ad_id).clicks += 1;
  return map;
}

export const listAdsAdmin = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdListItem[]> => {
    const { requireAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signAdMedia } = await import("@/lib/ads.server");
    const { data, error } = await supabaseAdmin
      .from("ads")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const counts = await loadCounts();
    const rows = (data ?? []) as unknown as AdRow[];
    return Promise.all(
      rows.map(async (r) => {
        const signed = await signAdMedia(r);
        const c = counts.get(r.id) ?? {
          impressions: 0,
          starts: 0,
          completes: 0,
          skips: 0,
          clicks: 0,
        };
        return {
          ...signed,
          ...c,
          completionRate: c.starts ? Math.round((c.completes / c.starts) * 100) : 0,
          ctr: c.impressions ? Math.round((c.clicks / c.impressions) * 1000) / 10 : 0,
        };
      }),
    );
  },
);

function parseAdForm(form: FormData) {
  const num = (k: string): number | null => {
    const raw = String(form.get(k) ?? "").trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  const str = (k: string): string => String(form.get(k) ?? "").trim();
  return { num, str };
}

async function buildPayload(form: FormData, adminUid: string, existing?: AdRow) {
  const { validateOptionalUrl, sanitizeText } = await import("@/lib/ads.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { num, str } = parseAdForm(form);

  const title = sanitizeText(form.get("title"), 200);
  if (!title) throw new Error("INVALID_TITLE");

  const adType = str("ad_type") || "HOUSE_PROMOTION";
  const targetTier = str("target_tier") || "ALL";
  const frequencyType = str("frequency_type") || "EVERY_N_SONGS";
  const status = str("status") || "DRAFT";
  if (!["FREE", "STANDARD", "PREMIUM", "ALL"].includes(targetTier)) throw new Error("INVALID_TIER");
  if (!["DRAFT", "ACTIVE", "PAUSED", "EXPIRED"].includes(status)) throw new Error("INVALID_STATUS");
  if (!["EVERY_SONG", "EVERY_N_SONGS", "TIME_INTERVAL", "ONCE_PER_SESSION"].includes(frequencyType))
    throw new Error("INVALID_FREQUENCY");
  if (
    !["HOUSE_PROMOTION", "ARTIST_PROMOTION", "NEW_MUSIC", "PREMIUM_PROMOTION", "ANNOUNCEMENT"].includes(
      adType,
    )
  )
    throw new Error("INVALID_AD_TYPE");

  const frequencyValue = num("frequency_value");
  if (
    (frequencyType === "EVERY_N_SONGS" || frequencyType === "TIME_INTERVAL") &&
    (frequencyValue === null || frequencyValue < 1)
  ) {
    throw new Error("FREQUENCY_VALUE_REQUIRED");
  }

  // Media uploads (optional on update).
  let videoPath = existing?.video_path ?? null;
  let thumbPath = existing?.thumbnail_path ?? null;
  const video = form.get("video");
  if (video instanceof File && video.size > 0) {
    if (!video.type.startsWith("video/")) throw new Error("INVALID_VIDEO_TYPE");
    if (video.size > MAX_VIDEO_BYTES) throw new Error("VIDEO_TOO_LARGE_100MB");
    const ext = video.name.split(".").pop()?.toLowerCase() || "mp4";
    const path = `videos/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("ads")
      .upload(path, new Uint8Array(await video.arrayBuffer()), {
        contentType: video.type,
        upsert: false,
      });
    if (error) throw new Error(`VIDEO_UPLOAD_FAILED: ${error.message}`);
    if (videoPath) await supabaseAdmin.storage.from("ads").remove([videoPath]);
    videoPath = path;
  }
  const thumb = form.get("thumbnail");
  if (thumb instanceof File && thumb.size > 0) {
    if (!thumb.type.startsWith("image/")) throw new Error("INVALID_IMAGE_TYPE");
    if (thumb.size > MAX_IMAGE_BYTES) throw new Error("IMAGE_TOO_LARGE_5MB");
    const ext = thumb.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `thumbnails/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("ads")
      .upload(path, new Uint8Array(await thumb.arrayBuffer()), {
        contentType: thumb.type,
        upsert: false,
      });
    if (error) throw new Error(`IMAGE_UPLOAD_FAILED: ${error.message}`);
    if (thumbPath) await supabaseAdmin.storage.from("ads").remove([thumbPath]);
    thumbPath = path;
  }

  const externalVideo = validateOptionalUrl(str("video_url") || null, "video_url");
  if (!videoPath && !externalVideo) throw new Error("VIDEO_REQUIRED");

  return {
    title,
    description: sanitizeText(form.get("description"), 1000) || null,
    ad_type: adType,
    target_tier: targetTier,
    priority: num("priority") ?? 0,
    frequency_type: frequencyType,
    frequency_value: frequencyValue,
    start_at: str("start_at") ? new Date(str("start_at")).toISOString() : null,
    end_at: str("end_at") ? new Date(str("end_at")).toISOString() : null,
    max_impressions: num("max_impressions"),
    click_url: validateOptionalUrl(str("click_url") || null, "click_url"),
    duration_seconds: num("duration_seconds"),
    status,
    sort_order: num("sort_order") ?? 0,
    video_path: videoPath,
    video_url: videoPath ? "" : externalVideo!,
    thumbnail_path: thumbPath,
    thumbnail_url: thumbPath ? null : validateOptionalUrl(str("thumbnail_url") || null, "thumbnail_url"),
    created_by: existing ? undefined : adminUid,
  };
}

export const createAd = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("EXPECTED_FORM_DATA");
    return data;
  })
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { uid } = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = await buildPayload(data, uid);
    const { data: row, error } = await supabaseAdmin.from("ads").insert(payload).select("id").single();
    if (error) throw new Error(`AD_CREATE_FAILED: ${error.message}`);
    return { id: row.id };
  });

export const updateAd = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("EXPECTED_FORM_DATA");
    if (!String(data.get("id") ?? "")) throw new Error("MISSING_ID");
    return data;
  })
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const { uid } = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = String(data.get("id"));
    const { data: existing } = await supabaseAdmin.from("ads").select("*").eq("id", id).maybeSingle();
    if (!existing) throw new Error("AD_NOT_FOUND");
    const payload = await buildPayload(data, uid, existing as unknown as AdRow);
    delete (payload as { created_by?: string }).created_by;
    const { error } = await supabaseAdmin.from("ads").update(payload).eq("id", id);
    if (error) throw new Error(`AD_UPDATE_FAILED: ${error.message}`);
    return { ok: true };
  });

export const setAdStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; status: "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED" }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    if (!["DRAFT", "ACTIVE", "PAUSED", "EXPIRED"].includes(data.status))
      throw new Error("INVALID_STATUS");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ads").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAdSortOrder = createServerFn({ method: "POST" })
  .inputValidator((data: { order: { id: string; sort_order: number }[] }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const item of data.order) {
      await supabaseAdmin
        .from("ads")
        .update({ sort_order: Math.round(item.sort_order) })
        .eq("id", item.id);
    }
    return { ok: true };
  });

export const duplicateAd = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("ads").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("AD_NOT_FOUND");
    const clone = { ...(row as Record<string, unknown>) };
    delete clone.id;
    delete clone.created_at;
    delete clone.updated_at;
    clone.title = `${String(clone.title)} (copy)`;
    clone.status = "DRAFT";
    const { data: created, error } = await supabaseAdmin.from("ads").insert(clone).select("id").single();
    if (error) throw new Error(`AD_DUPLICATE_FAILED: ${error.message}`);
    return { id: created.id };
  });

export const deleteAd = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("ads")
      .select("video_path,thumbnail_path")
      .eq("id", data.id)
      .maybeSingle();
    const paths = [row?.video_path, row?.thumbnail_path].filter(Boolean) as string[];
    if (paths.length) await supabaseAdmin.storage.from("ads").remove(paths);
    const { error } = await supabaseAdmin.from("ads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdAnalytics = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    const counts = await loadCounts();
    const c = counts.get(data.id) ?? {
      impressions: 0,
      starts: 0,
      completes: 0,
      skips: 0,
      clicks: 0,
    };
    return {
      ...c,
      completionRate: c.starts ? Math.round((c.completes / c.starts) * 100) : 0,
      ctr: c.impressions ? Math.round((c.clicks / c.impressions) * 1000) / 10 : 0,
    };
  });
