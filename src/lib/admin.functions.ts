// Server functions: admin-only catalog management.
import { createServerFn } from "@tanstack/react-start";

export const uploadSong = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("EXPECTED_FORM_DATA");
    return data;
  })
  .handler(async ({ data }) => {
    const { requireAdmin, slugify } = await import("@/lib/admin.server");
    const { uid } = await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const title = String(data.get("title") ?? "").trim();
    const artistName = String(data.get("artist") ?? "").trim();
    const album = String(data.get("album") ?? "").trim() || null;
    const genre = String(data.get("genre") ?? "").trim() || null;
    const audio = data.get("audio");
    const cover = data.get("cover");

    if (!title || title.length > 200) throw new Error("INVALID_TITLE");
    if (!artistName || artistName.length > 120) throw new Error("INVALID_ARTIST");
    if (!(audio instanceof File)) throw new Error("MISSING_AUDIO");
    if (audio.size > 30 * 1024 * 1024) throw new Error("AUDIO_TOO_LARGE_30MB");
    if (!audio.type.startsWith("audio/")) throw new Error("INVALID_AUDIO_TYPE");
    if (cover && cover instanceof File) {
      if (cover.size > 5 * 1024 * 1024) throw new Error("COVER_TOO_LARGE_5MB");
      if (!cover.type.startsWith("image/")) throw new Error("INVALID_COVER_TYPE");
    }

    // Upsert artist by slug.
    const slug = slugify(artistName);
    let artistId: string;
    const { data: existingArtist } = await supabaseAdmin
      .from("artists")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (existingArtist) {
      artistId = existingArtist.id;
    } else {
      const { data: newArtist, error } = await supabaseAdmin
        .from("artists")
        .insert({ name: artistName, slug, genre })
        .select("id")
        .single();
      if (error || !newArtist) throw new Error(`ARTIST_CREATE_FAILED: ${error?.message}`);
      artistId = newArtist.id;
    }

    // Upload audio.
    const audioExt = audio.name.split(".").pop()?.toLowerCase() || "mp3";
    const audioPath = `${artistId}/${crypto.randomUUID()}.${audioExt}`;
    const audioBuf = new Uint8Array(await audio.arrayBuffer());
    const { error: audioErr } = await supabaseAdmin.storage
      .from("songs")
      .upload(audioPath, audioBuf, { contentType: audio.type, upsert: false });
    if (audioErr) throw new Error(`AUDIO_UPLOAD_FAILED: ${audioErr.message}`);

    // Upload cover (optional).
    let coverPath: string | null = null;
    if (cover instanceof File && cover.size > 0) {
      const coverExt = cover.name.split(".").pop()?.toLowerCase() || "jpg";
      coverPath = `${artistId}/${crypto.randomUUID()}.${coverExt}`;
      const coverBuf = new Uint8Array(await cover.arrayBuffer());
      const { error: coverErr } = await supabaseAdmin.storage
        .from("covers")
        .upload(coverPath, coverBuf, { contentType: cover.type, upsert: false });
      if (coverErr) throw new Error(`COVER_UPLOAD_FAILED: ${coverErr.message}`);
    }

    const duration = Number(data.get("duration") ?? 0) || 0;

    const { data: song, error: insertErr } = await supabaseAdmin
      .from("songs")
      .insert({
        title,
        artist_id: artistId,
        album,
        genre,
        duration_seconds: Math.round(duration),
        cover_url: coverPath,
        audio_path: audioPath,
        audio_url: "", // filled in by signed-url flow at read time
        uploaded_by: uid,
      })
      .select("id")
      .single();
    if (insertErr || !song) throw new Error(`SONG_INSERT_FAILED: ${insertErr?.message}`);

    return { id: song.id };
  });

export const deleteSong = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: song } = await supabaseAdmin
      .from("songs")
      .select("audio_path, cover_url")
      .eq("id", data.id)
      .maybeSingle();
    if (song?.audio_path) {
      await supabaseAdmin.storage.from("songs").remove([song.audio_path]);
    }
    if (song?.cover_url && !song.cover_url.startsWith("http")) {
      await supabaseAdmin.storage.from("covers").remove([song.cover_url]);
    }
    await supabaseAdmin.from("songs").delete().eq("id", data.id);
    return { ok: true };
  });

export const listAllSongsAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/lib/admin.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("songs")
    .select("id,title,album,genre,plays_count,created_at,artists(name)")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    album: r.album,
    genre: r.genre,
    plays: Number(r.plays_count),
    createdAt: r.created_at,
    artist: (r as { artists: { name: string } | null }).artists?.name ?? "Unknown",
  }));
});

export const listArtistsAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/lib/admin.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("artists")
    .select("id,name,slug,genre,verified,created_at,songs(id)")
    .order("created_at", { ascending: false });
  return (data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    genre: a.genre,
    verified: a.verified,
    createdAt: a.created_at,
    songCount: ((a as { songs: unknown[] | null }).songs ?? []).length,
  }));
});

export const setArtistVerified = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; verified: boolean }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("artists")
      .update({ verified: data.verified })
      .eq("id", data.id);
    if (error) throw new Error(`ARTIST_UPDATE_FAILED: ${error.message}`);
    return { ok: true };
  });

export const listUsersAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/lib/admin.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: users }, { data: roles }] = await Promise.all([
    supabaseAdmin
      .from("pi_users")
      .select("uid,username,joined_at,last_seen_at")
      .order("joined_at", { ascending: false })
      .limit(200),
    supabaseAdmin.from("user_roles").select("user_id,role"),
  ]);
  const roleMap = new Map<string, string[]>();
  (roles ?? []).forEach((r) => {
    roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role as string]);
  });
  return (users ?? []).map((u) => ({
    uid: u.uid,
    username: u.username,
    joinedAt: u.joined_at,
    lastSeenAt: u.last_seen_at,
    roles: roleMap.get(u.uid) ?? ["user"],
  }));
});

export const setUserAdminRole = createServerFn({ method: "POST" })
  .inputValidator((data: { uid: string; makeAdmin: boolean }) => data)
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin.server");
    const me = await requireAdmin();
    if (me.uid === data.uid && !data.makeAdmin) {
      throw new Error("CANNOT_REMOVE_OWN_ADMIN_ROLE");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.makeAdmin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.uid, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(`ROLE_GRANT_FAILED: ${error.message}`);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.uid)
        .eq("role", "admin");
      if (error) throw new Error(`ROLE_REVOKE_FAILED: ${error.message}`);
    }
    return { ok: true };
  });

export const listMembershipsAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/lib/admin.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: memberships }, { data: payments }, { data: plans }] = await Promise.all([
    supabaseAdmin
      .from("user_memberships")
      .select("id,user_uid,membership_level,membership_status,started_at,expires_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseAdmin
      .from("membership_payments")
      .select("id,payment_id,user_uid,amount,currency,payment_status,created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("membership_plans")
      .select("id,name,display_name,price,currency,billing_cycle,is_active")
      .order("sort_order"),
  ]);
  return {
    memberships: memberships ?? [],
    payments: payments ?? [],
    plans: plans ?? [],
  };
});

export const getAdminStats = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/lib/admin.server");
  await requireAdmin();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const count = (q: { count: number | null }) => q.count ?? 0;
  const [songs, artists, users, favorites, plays, activeMembers, topSongs, revenue] =
    await Promise.all([
      supabaseAdmin.from("songs").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("artists").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("pi_users").select("uid", { count: "exact", head: true }),
      supabaseAdmin.from("favorites").select("song_id", { count: "exact", head: true }),
      supabaseAdmin.from("plays").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("user_memberships")
        .select("id", { count: "exact", head: true })
        .eq("membership_status", "active"),
      supabaseAdmin
        .from("songs")
        .select("id,title,plays_count,artists(name)")
        .order("plays_count", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("membership_payments")
        .select("amount")
        .eq("payment_status", "completed"),
    ]);

  return {
    songs: count(songs),
    artists: count(artists),
    users: count(users),
    favorites: count(favorites),
    plays: count(plays),
    activeMembers: count(activeMembers),
    revenue: (revenue.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0),
    topSongs: (topSongs.data ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      plays: Number(s.plays_count),
      artist: (s as { artists: { name: string } | null }).artists?.name ?? "Unknown",
    })),
  };
});
