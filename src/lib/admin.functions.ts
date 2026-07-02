// Server functions: admin-only catalog management.
import { createServerFn } from "@tanstack/react-start";

async function requireAdmin() {
  const { requirePiSession } = await import("@/lib/pi-session.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const s = requirePiSession();
  console.log("[requireAdmin] session ok", { uid: s.uid, username: s.username });
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", s.uid)
    .eq("role", "admin")
    .maybeSingle();
  if (error) {
    console.error("[requireAdmin] role lookup error", error);
    throw new Error(`ROLE_LOOKUP_FAILED: ${error.message}`);
  }
  if (!data) {
    console.warn("[requireAdmin] user has no admin role", { uid: s.uid });
    throw new Error(`FORBIDDEN: user ${s.username} (${s.uid}) is not an admin`);
  }
  return { uid: s.uid, username: s.username };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

export const uploadSong = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("EXPECTED_FORM_DATA");
    return data;
  })
  .handler(async ({ data }) => {
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

    // Compute duration client-side would be ideal — accept 0 and let player update later.
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
