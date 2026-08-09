// Server functions: public catalog reads + user-scoped favorites/plays.
import { createServerFn } from "@tanstack/react-start";
import type { Song, Artist } from "@/lib/types";
import { placeholderCover } from "@/lib/types";

const SIGNED_URL_TTL = 60 * 60 * 24; // 24h

type DbSong = {
  id: string;
  title: string;
  album: string | null;
  genre: string | null;
  duration_seconds: number;
  cover_url: string | null;
  audio_url: string;
  audio_path: string;
  plays_count: number;
  released_at: string;
  artists: { id: string; name: string } | null;
};

async function toSong(row: DbSong): Promise<Song> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let audio = row.audio_url;
  let cover = row.cover_url ?? placeholderCover(row.title);
  // If the stored audio_url is a storage path (no protocol), sign it.
  if (row.audio_path) {
    const { data } = await supabaseAdmin.storage
      .from("songs")
      .createSignedUrl(row.audio_path, SIGNED_URL_TTL);
    if (data?.signedUrl) audio = data.signedUrl;
  }
  if (row.cover_url && !row.cover_url.startsWith("http")) {
    const { data } = await supabaseAdmin.storage
      .from("covers")
      .createSignedUrl(row.cover_url, SIGNED_URL_TTL);
    if (data?.signedUrl) cover = data.signedUrl;
  }
  return {
    id: row.id,
    title: row.title,
    artist: row.artists?.name ?? "Unknown",
    artistId: row.artists?.id ?? "",
    album: row.album,
    genre: row.genre,
    duration: row.duration_seconds,
    cover,
    audio,
    plays: Number(row.plays_count),
    releasedAt: row.released_at,
  };
}

async function toSongs(rows: DbSong[]): Promise<Song[]> {
  return Promise.all(rows.map(toSong));
}

/** Songs rejected or still awaiting admin verification are never published. */
async function filterPublished(rows: DbSong[]): Promise<DbSong[]> {
  if (rows.length === 0) return rows;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("song_verifications")
    .select("song_id,status")
    .in("song_id", rows.map((r) => r.id));
  const blocked = new Set(
    (data ?? []).filter((v) => v.status !== "verified").map((v) => v.song_id),
  );
  return rows.filter((r) => !blocked.has(r.id));
}

export const listSongs = createServerFn({ method: "GET" })
  .inputValidator(
    (data?: { sort?: "trending" | "new" | "featured"; limit?: number; search?: string }) =>
      data ?? {},
  )
  .handler(async ({ data }): Promise<Song[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("songs")
      .select(
        "id,title,album,genre,duration_seconds,cover_url,audio_url,audio_path,plays_count,released_at,artists(id,name)",
      );
    if (data.search) {
      q = q.ilike("title", `%${data.search}%`);
    }
    switch (data.sort) {
      case "trending":
        q = q.order("plays_count", { ascending: false });
        break;
      case "new":
      case "featured":
      default:
        q = q.order("released_at", { ascending: false });
    }
    q = q.limit(Math.min(Math.max(data.limit ?? 20, 1), 100));
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return toSongs(await filterPublished((rows ?? []) as unknown as DbSong[]));
  });

export const getSong = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<Song | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("songs")
      .select(
        "id,title,album,genre,duration_seconds,cover_url,audio_url,audio_path,plays_count,released_at,artists(id,name)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return null;
    const allowed = await filterPublished([row as unknown as DbSong]);
    if (allowed.length === 0) return null;
    return toSong(allowed[0]!);
  });

export const listArtists = createServerFn({ method: "GET" }).handler(
  async (): Promise<Artist[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("artists")
      .select("id,name,slug,genre,bio,cover_url,verified")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      genre: r.genre,
      bio: r.bio,
      cover: r.cover_url ?? placeholderCover(r.name),
      verified: r.verified,
    }));
  },
);

export const listFavorites = createServerFn({ method: "GET" }).handler(
  async (): Promise<string[]> => {
    const { readPiSession } = await import("@/lib/pi-session.server");
    const s = readPiSession();
    if (!s) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("favorites")
      .select("song_id")
      .eq("user_id", s.uid);
    return (data ?? []).map((r) => r.song_id);
  },
);

export const toggleFavorite = createServerFn({ method: "POST" })
  .inputValidator((data: { songId: string }) => data)
  .handler(async ({ data }): Promise<{ favorited: boolean }> => {
    const { requirePiSession } = await import("@/lib/pi-session.server");
    const s = requirePiSession();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("favorites")
      .select("song_id")
      .eq("user_id", s.uid)
      .eq("song_id", data.songId)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin
        .from("favorites")
        .delete()
        .eq("user_id", s.uid)
        .eq("song_id", data.songId);
      return { favorited: false };
    }
    await supabaseAdmin.from("favorites").insert({ user_id: s.uid, song_id: data.songId });
    return { favorited: true };
  });

export const recordPlay = createServerFn({ method: "POST" })
  .inputValidator((data: { songId: string }) => data)
  .handler(async ({ data }) => {
    const { readPiSession } = await import("@/lib/pi-session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = readPiSession();
    await supabaseAdmin.from("plays").insert({ user_id: s?.uid ?? null, song_id: data.songId });
    await supabaseAdmin.rpc("increment_song_plays", { _song_id: data.songId });
    return { ok: true };
  });

export const listRecentPlays = createServerFn({ method: "GET" })
  .inputValidator((data?: { limit?: number }) => data ?? {})
  .handler(async ({ data }): Promise<Song[]> => {
    const { readPiSession } = await import("@/lib/pi-session.server");
    const s = readPiSession();
    if (!s) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("plays")
      .select(
        "song_id, played_at, songs(id,title,album,genre,duration_seconds,cover_url,audio_url,audio_path,plays_count,released_at,artists(id,name))",
      )
      .eq("user_id", s.uid)
      .order("played_at", { ascending: false })
      .limit(Math.min(Math.max(data.limit ?? 10, 1), 50));
    const songRows = (rows ?? [])
      .map((r) => (r as { songs: DbSong | null }).songs)
      .filter((s): s is DbSong => !!s);
    return toSongs(songRows);
  });

export const listFavoriteSongs = createServerFn({ method: "GET" }).handler(
  async (): Promise<Song[]> => {
    const { readPiSession } = await import("@/lib/pi-session.server");
    const s = readPiSession();
    if (!s) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("favorites")
      .select(
        "song_id, songs(id,title,album,genre,duration_seconds,cover_url,audio_url,audio_path,plays_count,released_at,artists(id,name))",
      )
      .eq("user_id", s.uid)
      .order("created_at", { ascending: false });
    const songRows = (rows ?? [])
      .map((r) => (r as { songs: DbSong | null }).songs)
      .filter((s): s is DbSong => !!s);
    return toSongs(songRows);
  },
);
