// Server functions: admin review of artist applications, artists and song verification.
import { createServerFn } from "@tanstack/react-start";

const SIGNED_TTL = 60 * 10; // 10 minutes for internal review links

export interface AdminApplicationRow {
  id: string;
  user_id: string;
  username: string;
  artist_name: string;
  full_name: string;
  genre: string | null;
  location: string | null;
  bio: string | null;
  description: string | null;
  social_links: Record<string, string>;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  membership: string | null;
  avatarUrl: string | null;
  demoUrl: string | null;
  copyright_declaration_accepted: boolean;
  copyright_declaration_accepted_at: string | null;
}

export const listArtistApplications = createServerFn({ method: "GET" })
  .inputValidator((data?: { status?: "pending" | "approved" | "rejected" | "all" }) => data ?? {})
  .handler(async ({ data }): Promise<AdminApplicationRow[]> => {
    const { requireAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("artist_applications")
      .select("*, pi_users(username)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const uids = [...new Set((rows ?? []).map((r) => r.user_id))];
    const { data: memberships } = uids.length
      ? await supabaseAdmin
          .from("user_memberships")
          .select("user_uid,membership_level,membership_status")
          .in("user_uid", uids)
          .eq("membership_status", "active")
      : { data: [] as { user_uid: string; membership_level: string }[] };
    const memberMap = new Map((memberships ?? []).map((m) => [m.user_uid, m.membership_level]));

    return Promise.all(
      (rows ?? []).map(async (r) => {
        let avatarUrl: string | null = null;
        let demoUrl: string | null = null;
        if (r.avatar_url) {
          const { data: s } = await supabaseAdmin.storage
            .from("covers")
            .createSignedUrl(r.avatar_url, SIGNED_TTL);
          avatarUrl = s?.signedUrl ?? null;
        }
        if (r.demo_url) {
          const { data: s } = await supabaseAdmin.storage
            .from("songs")
            .createSignedUrl(r.demo_url, SIGNED_TTL);
          demoUrl = s?.signedUrl ?? null;
        }
        return {
          id: r.id,
          user_id: r.user_id,
          username: (r as unknown as { pi_users: { username: string } | null }).pi_users?.username ?? r.user_id,
          artist_name: r.artist_name,
          full_name: r.full_name,
          genre: r.genre,
          location: r.location,
          bio: r.bio,
          description: r.description,
          social_links: (r.social_links ?? {}) as Record<string, string>,
          status: r.status as AdminApplicationRow["status"],
          rejection_reason: r.rejection_reason,
          created_at: r.created_at,
          reviewed_at: r.reviewed_at,
          membership: memberMap.get(r.user_id) ?? null,
          avatarUrl,
          demoUrl,
          copyright_declaration_accepted: r.copyright_declaration_accepted,
          copyright_declaration_accepted_at: r.copyright_declaration_accepted_at,
        };
      }),
    );
  });

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

export const reviewArtistApplication = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; approve: boolean; reason?: string }) => {
    if (!data?.id) throw new Error("INVALID_INPUT");
    if (!data.approve && !String(data.reason ?? "").trim()) throw new Error("REJECTION_REASON_REQUIRED");
    return data;
  })
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const admin = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: app } = await supabaseAdmin
      .from("artist_applications")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!app) throw new Error("APPLICATION_NOT_FOUND");
    if (app.status !== "pending") throw new Error("APPLICATION_ALREADY_REVIEWED");

    if (!data.approve) {
      const { error } = await supabaseAdmin
        .from("artist_applications")
        .update({
          status: "rejected",
          rejection_reason: String(data.reason).trim().slice(0, 1000),
          reviewed_by: admin.uid,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", data.id);
      if (error) throw new Error(`REJECT_FAILED: ${error.message}`);
      return { ok: true, status: "rejected" as const };
    }

    // Approve: create/reuse the public artists row, then the artist profile.
    let artistId: string;
    const slug = slugify(app.artist_name);
    const { data: existingArtist } = await supabaseAdmin
      .from("artists")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (existingArtist) {
      artistId = existingArtist.id;
      await supabaseAdmin
        .from("artists")
        .update({ bio: app.bio, genre: app.genre, verified: true })
        .eq("id", artistId);
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("artists")
        .insert({ name: app.artist_name, slug, genre: app.genre, bio: app.bio, verified: true })
        .select("id")
        .single();
      if (error || !created) throw new Error(`ARTIST_CREATE_FAILED: ${error?.message}`);
      artistId = created.id;
    }

    const { error: profileErr } = await supabaseAdmin.from("artist_profiles").upsert(
      {
        user_id: app.user_id,
        application_id: app.id,
        artist_id: artistId,
        artist_name: app.artist_name,
        bio: app.bio,
        avatar_url: app.avatar_url,
        genre: app.genre,
        location: app.location,
        social_links: app.social_links as never,
        status: "active",
      },
      { onConflict: "user_id" },
    );
    if (profileErr) throw new Error(`PROFILE_CREATE_FAILED: ${profileErr.message}`);

    const { error: updErr } = await supabaseAdmin
      .from("artist_applications")
      .update({
        status: "approved",
        reviewed_by: admin.uid,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq("id", data.id);
    if (updErr) throw new Error(`APPROVE_FAILED: ${updErr.message}`);
    return { ok: true, status: "approved" as const, artistId };
  });

export interface AdminArtistRow {
  profileId: string;
  userId: string;
  username: string;
  artistId: string | null;
  artistName: string;
  genre: string | null;
  location: string | null;
  status: "active" | "suspended";
  pioneerArtist: boolean;
  createdAt: string;
  songCount: number;
  totalPlays: number;
}

export const listApprovedArtists = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminArtistRow[]> => {
    const { requireAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("artist_profiles")
      .select("*, pi_users(username)")
      .order("created_at", { ascending: false });
    const artistIds = (profiles ?? []).map((p) => p.artist_id).filter((v): v is string => !!v);
    const { data: songs } = artistIds.length
      ? await supabaseAdmin.from("songs").select("artist_id,plays_count").in("artist_id", artistIds)
      : { data: [] as { artist_id: string; plays_count: number }[] };
    const agg = new Map<string, { songs: number; plays: number }>();
    (songs ?? []).forEach((s) => {
      const prev = agg.get(s.artist_id) ?? { songs: 0, plays: 0 };
      agg.set(s.artist_id, { songs: prev.songs + 1, plays: prev.plays + Number(s.plays_count) });
    });
    return (profiles ?? []).map((p) => ({
      profileId: p.id,
      userId: p.user_id,
      username: (p as unknown as { pi_users: { username: string } | null }).pi_users?.username ?? p.user_id,
      artistId: p.artist_id,
      artistName: p.artist_name,
      genre: p.genre,
      location: p.location,
      status: p.status as "active" | "suspended",
      pioneerArtist: p.pioneer_artist,
      createdAt: p.created_at,
      songCount: p.artist_id ? (agg.get(p.artist_id)?.songs ?? 0) : 0,
      totalPlays: p.artist_id ? (agg.get(p.artist_id)?.plays ?? 0) : 0,
    }));
  },
);

export const setArtistProfileStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { profileId: string; status: "active" | "suspended" }) => {
    if (!data?.profileId || !["active", "suspended"].includes(data.status)) {
      throw new Error("INVALID_INPUT");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("artist_profiles")
      .update({ status: data.status })
      .eq("id", data.profileId);
    if (error) throw new Error(`STATUS_UPDATE_FAILED: ${error.message}`);
    return { ok: true };
  });

export const updateArtistProfileAdmin = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { profileId: string; artistName: string; genre?: string; bio?: string; location?: string }) => {
      if (!data?.profileId || !String(data.artistName ?? "").trim()) throw new Error("INVALID_INPUT");
      return data;
    },
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch = {
      artist_name: data.artistName.trim().slice(0, 120),
      genre: data.genre?.trim().slice(0, 60) || null,
      bio: data.bio?.trim().slice(0, 2000) || null,
      location: data.location?.trim().slice(0, 120) || null,
    };
    const { data: updated, error } = await supabaseAdmin
      .from("artist_profiles")
      .update(patch)
      .eq("id", data.profileId)
      .select("artist_id")
      .maybeSingle();
    if (error) throw new Error(`PROFILE_UPDATE_FAILED: ${error.message}`);
    if (updated?.artist_id) {
      await supabaseAdmin
        .from("artists")
        .update({ name: patch.artist_name, genre: patch.genre, bio: patch.bio })
        .eq("id", updated.artist_id);
    }
    return { ok: true };
  });

export interface AdminSongVerificationRow {
  songId: string;
  title: string;
  album: string | null;
  genre: string | null;
  plays: number;
  createdAt: string;
  artistId: string | null;
  artistName: string;
  status: "pending_verification" | "verified" | "needs_review" | "rejected";
  notes: string | null;
  reviewedAt: string | null;
  downloadCount: number;
}

export const listSongVerifications = createServerFn({ method: "GET" })
  .inputValidator((data?: { artistId?: string; status?: string }) => data ?? {})
  .handler(async ({ data }): Promise<AdminSongVerificationRow[]> => {
    const { requireAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("songs")
      .select(
        "id,title,album,genre,plays_count,created_at,artist_id,artists(name),song_verifications(status,verification_notes,reviewed_at)",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.artistId) q = q.eq("artist_id", data.artistId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const { data: logs } = await supabaseAdmin
      .from("verification_download_logs")
      .select("song_id");
    const counts = new Map<string, number>();
    (logs ?? []).forEach((l) => {
      if (l.song_id) counts.set(l.song_id, (counts.get(l.song_id) ?? 0) + 1);
    });

    const mapped = (rows ?? []).map((r) => {
      const raw = (r as unknown as {
        song_verifications: { status: string; verification_notes: string | null; reviewed_at: string | null }[] | null;
      }).song_verifications;
      const v = Array.isArray(raw) ? raw[0] : raw;
      return {
        songId: r.id,
        title: r.title,
        album: r.album,
        genre: r.genre,
        plays: Number(r.plays_count),
        createdAt: r.created_at,
        artistId: r.artist_id,
        artistName: (r as unknown as { artists: { name: string } | null }).artists?.name ?? "Unknown",
        status: (v?.status ?? "pending_verification") as AdminSongVerificationRow["status"],
        notes: v?.verification_notes ?? null,
        reviewedAt: v?.reviewed_at ?? null,
        downloadCount: counts.get(r.id) ?? 0,
      };
    });
    return data.status && data.status !== "all"
      ? mapped.filter((m) => m.status === data.status)
      : mapped;
  });

export const setSongVerification = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      songId: string;
      status: "pending_verification" | "verified" | "needs_review" | "rejected";
      notes?: string;
    }) => {
      if (!data?.songId) throw new Error("INVALID_INPUT");
      if (!["pending_verification", "verified", "needs_review", "rejected"].includes(data.status)) {
        throw new Error("INVALID_STATUS");
      }
      return data;
    },
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const admin = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: song } = await supabaseAdmin
      .from("songs")
      .select("artist_id")
      .eq("id", data.songId)
      .maybeSingle();
    if (!song) throw new Error("SONG_NOT_FOUND");
    const { error } = await supabaseAdmin.from("song_verifications").upsert(
      {
        song_id: data.songId,
        artist_id: song.artist_id,
        status: data.status,
        verification_notes: data.notes?.trim().slice(0, 4000) || null,
        reviewed_by: admin.uid,
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: "song_id" },
    );
    if (error) throw new Error(`VERIFICATION_UPDATE_FAILED: ${error.message}`);
    return { ok: true };
  });

/**
 * Admin-only, short-lived signed URL for internal copyright verification.
 * Every call is written to the audit log.
 */
export const getVerificationDownloadUrl = createServerFn({ method: "POST" })
  .inputValidator((data: { songId: string }) => {
    if (!data?.songId) throw new Error("INVALID_INPUT");
    return data;
  })
  .handler(async ({ data }): Promise<{ url: string; filename: string }> => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const admin = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: song } = await supabaseAdmin
      .from("songs")
      .select("id,title,audio_path,artist_id")
      .eq("id", data.songId)
      .maybeSingle();
    if (!song?.audio_path) throw new Error("AUDIO_FILE_NOT_FOUND");
    const ext = song.audio_path.split(".").pop() || "mp3";
    const filename = `${song.title.replace(/[^\w\- ]+/g, "").trim() || "song"}.${ext}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("songs")
      .createSignedUrl(song.audio_path, 300, { download: filename });
    if (error || !signed?.signedUrl) throw new Error(`SIGN_FAILED: ${error?.message}`);

    await supabaseAdmin.from("verification_download_logs").insert({
      admin_user_id: admin.uid,
      song_id: song.id,
      artist_id: song.artist_id,
      action: "verification_download",
    });
    return { url: signed.signedUrl, filename };
  });

export const listVerificationDownloadLogs = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/lib/admin.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("verification_download_logs")
    .select("id,admin_user_id,song_id,artist_id,action,downloaded_at, songs(title), artists(name)")
    .order("downloaded_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((l) => ({
    id: l.id,
    adminUserId: l.admin_user_id,
    action: l.action,
    downloadedAt: l.downloaded_at,
    songTitle: (l as unknown as { songs: { title: string } | null }).songs?.title ?? "(deleted)",
    artistName: (l as unknown as { artists: { name: string } | null }).artists?.name ?? "—",
  }));
});
