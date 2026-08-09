// Server functions: member artist applications + approved-artist dashboard.
import { createServerFn } from "@tanstack/react-start";

export interface ArtistApplicationView {
  id: string;
  artist_name: string;
  full_name: string;
  genre: string | null;
  location: string | null;
  bio: string | null;
  description: string | null;
  avatar_url: string | null;
  social_links: Record<string, string>;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface ArtistStatusPayload {
  signedIn: boolean;
  isPremium: boolean;
  membershipLevel: string | null;
  application: ArtistApplicationView | null;
  profile: {
    id: string;
    artist_name: string;
    artist_id: string | null;
    status: "active" | "suspended";
    pioneer_artist: boolean;
    bio: string | null;
    genre: string | null;
    location: string | null;
    avatar_url: string | null;
    social_links: Record<string, string>;
  } | null;
}

// -------- Status of the caller in the artist program --------
export const getArtistStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<ArtistStatusPayload> => {
    const { getMembershipState } = await import("@/lib/artist.server");
    const state = await getMembershipState();
    if (!state) {
      return { signedIn: false, isPremium: false, membershipLevel: null, application: null, profile: null };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: app }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("artist_applications")
        .select(
          "id,artist_name,full_name,genre,location,bio,description,avatar_url,social_links,status,rejection_reason,created_at,reviewed_at",
        )
        .eq("user_id", state.uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("artist_profiles")
        .select("id,artist_name,artist_id,status,pioneer_artist,bio,genre,location,avatar_url,social_links")
        .eq("user_id", state.uid)
        .maybeSingle(),
    ]);

    return {
      signedIn: true,
      isPremium: state.isPremium,
      membershipLevel: state.membershipLevel,
      application: (app as ArtistApplicationView | null) ?? null,
      profile: (profile as ArtistStatusPayload["profile"]) ?? null,
    };
  },
);

// -------- Submit an artist application (premium members only) --------
export const submitArtistApplication = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("EXPECTED_FORM_DATA");
    return data;
  })
  .handler(async ({ data }) => {
    const { requirePremiumMember, requiredText, optionalText, normalizeUrl } = await import(
      "@/lib/artist.server"
    );
    const { uid } = await requirePremiumMember();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Already an artist, or already has a pending application?
    const [{ data: existingProfile }, { data: pending }] = await Promise.all([
      supabaseAdmin.from("artist_profiles").select("id").eq("user_id", uid).maybeSingle(),
      supabaseAdmin
        .from("artist_applications")
        .select("id")
        .eq("user_id", uid)
        .eq("status", "pending")
        .maybeSingle(),
    ]);
    if (existingProfile) throw new Error("ALREADY_AN_ARTIST");
    if (pending) throw new Error("APPLICATION_ALREADY_PENDING");

    const artistName = requiredText(data.get("artistName"), "artist_name", 120);
    const fullName = requiredText(data.get("fullName"), "full_name", 120);
    const bio = requiredText(data.get("bio"), "bio", 2000);
    const genre = requiredText(data.get("genre"), "genre", 60);
    const location = requiredText(data.get("location"), "location", 120);
    const description = optionalText(data.get("description"), "description", 500);
    const social = {
      youtube: normalizeUrl(data.get("youtube")),
      instagram: normalizeUrl(data.get("instagram")),
      tiktok: normalizeUrl(data.get("tiktok")),
      music: normalizeUrl(data.get("musicPlatform")),
    };
    const guidelines = String(data.get("guidelinesAccepted")) === "true";
    const copyright = String(data.get("copyrightAccepted")) === "true";
    if (!guidelines) throw new Error("GUIDELINES_NOT_ACCEPTED");
    if (!copyright) throw new Error("COPYRIGHT_DECLARATION_NOT_ACCEPTED");

    const avatar = data.get("avatar");
    const demo = data.get("demo");
    if (!(demo instanceof File) || demo.size === 0) throw new Error("MISSING_DEMO");
    if (!demo.type.startsWith("audio/")) throw new Error("INVALID_DEMO_TYPE");
    if (demo.size > 30 * 1024 * 1024) throw new Error("DEMO_TOO_LARGE_30MB");

    let avatarPath: string | null = null;
    if (avatar instanceof File && avatar.size > 0) {
      if (!avatar.type.startsWith("image/")) throw new Error("INVALID_AVATAR_TYPE");
      if (avatar.size > 5 * 1024 * 1024) throw new Error("AVATAR_TOO_LARGE_5MB");
      const ext = avatar.name.split(".").pop()?.toLowerCase() || "jpg";
      avatarPath = `applications/${uid}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabaseAdmin.storage
        .from("covers")
        .upload(avatarPath, new Uint8Array(await avatar.arrayBuffer()), {
          contentType: avatar.type,
          upsert: false,
        });
      if (error) throw new Error(`AVATAR_UPLOAD_FAILED: ${error.message}`);
    }

    const demoExt = demo.name.split(".").pop()?.toLowerCase() || "mp3";
    const demoPath = `applications/${uid}/${crypto.randomUUID()}.${demoExt}`;
    const { error: demoErr } = await supabaseAdmin.storage
      .from("songs")
      .upload(demoPath, new Uint8Array(await demo.arrayBuffer()), {
        contentType: demo.type,
        upsert: false,
      });
    if (demoErr) throw new Error(`DEMO_UPLOAD_FAILED: ${demoErr.message}`);

    const { data: inserted, error } = await supabaseAdmin
      .from("artist_applications")
      .insert({
        user_id: uid,
        artist_name: artistName,
        full_name: fullName,
        avatar_url: avatarPath,
        bio,
        genre,
        location,
        description,
        social_links: social as never,
        demo_url: demoPath,
        guidelines_accepted: true,
        copyright_declaration_accepted: true,
        copyright_declaration_accepted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(`APPLICATION_FAILED: ${error?.message}`);
    return { id: inserted.id };
  });

// -------- Approved artist: songs --------
export interface ArtistSongRow {
  id: string;
  title: string;
  album: string | null;
  genre: string | null;
  plays: number;
  createdAt: string;
  verificationStatus: string;
  published: boolean;
}

export const listMyArtistSongs = createServerFn({ method: "GET" }).handler(
  async (): Promise<ArtistSongRow[]> => {
    const { requireApprovedArtist } = await import("@/lib/artist.server");
    const { profile } = await requireApprovedArtist();
    if (!profile.artist_id) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("songs")
      .select("id,title,album,genre,plays_count,created_at,song_verifications(status)")
      .eq("artist_id", profile.artist_id)
      .order("created_at", { ascending: false });
    return (data ?? []).map((s) => {
      const v =
        (s as unknown as { song_verifications: { status: string }[] | { status: string } | null })
          .song_verifications;
      const status = Array.isArray(v) ? v[0]?.status : v?.status;
      return {
        id: s.id,
        title: s.title,
        album: s.album,
        genre: s.genre,
        plays: Number(s.plays_count),
        createdAt: s.created_at,
        verificationStatus: status ?? "pending_verification",
        published: status === "verified",
      };
    });
  },
);

export const uploadArtistSong = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("EXPECTED_FORM_DATA");
    return data;
  })
  .handler(async ({ data }) => {
    const { requireApprovedArtist, requiredText, optionalText } = await import(
      "@/lib/artist.server"
    );
    const { uid, profile } = await requireApprovedArtist();
    if (!profile.artist_id) throw new Error("ARTIST_RECORD_MISSING");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const title = requiredText(data.get("title"), "title", 200);
    const album = optionalText(data.get("album"), "album", 200);
    const genre = optionalText(data.get("genre"), "genre", 60) ?? profile.genre;
    const audio = data.get("audio");
    const cover = data.get("cover");
    const copyright = String(data.get("copyrightAccepted")) === "true";
    if (!copyright) throw new Error("COPYRIGHT_DECLARATION_NOT_ACCEPTED");
    if (!(audio instanceof File) || audio.size === 0) throw new Error("MISSING_AUDIO");
    if (!audio.type.startsWith("audio/")) throw new Error("INVALID_AUDIO_TYPE");
    if (audio.size > 30 * 1024 * 1024) throw new Error("AUDIO_TOO_LARGE_30MB");

    const audioExt = audio.name.split(".").pop()?.toLowerCase() || "mp3";
    const audioPath = `${profile.artist_id}/${crypto.randomUUID()}.${audioExt}`;
    const { error: audioErr } = await supabaseAdmin.storage
      .from("songs")
      .upload(audioPath, new Uint8Array(await audio.arrayBuffer()), {
        contentType: audio.type,
        upsert: false,
      });
    if (audioErr) throw new Error(`AUDIO_UPLOAD_FAILED: ${audioErr.message}`);

    let coverPath: string | null = null;
    if (cover instanceof File && cover.size > 0) {
      if (!cover.type.startsWith("image/")) throw new Error("INVALID_COVER_TYPE");
      if (cover.size > 5 * 1024 * 1024) throw new Error("COVER_TOO_LARGE_5MB");
      const ext = cover.name.split(".").pop()?.toLowerCase() || "jpg";
      coverPath = `${profile.artist_id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabaseAdmin.storage
        .from("covers")
        .upload(coverPath, new Uint8Array(await cover.arrayBuffer()), {
          contentType: cover.type,
          upsert: false,
        });
      if (error) throw new Error(`COVER_UPLOAD_FAILED: ${error.message}`);
    }

    const duration = Number(data.get("duration") ?? 0) || 0;
    const { data: song, error } = await supabaseAdmin
      .from("songs")
      .insert({
        title,
        artist_id: profile.artist_id,
        album,
        genre,
        duration_seconds: Math.round(duration),
        cover_url: coverPath,
        audio_path: audioPath,
        audio_url: "",
        uploaded_by: uid,
      })
      .select("id")
      .single();
    if (error || !song) throw new Error(`SONG_INSERT_FAILED: ${error?.message}`);
    // Artist uploads always start in the verification queue.
    await supabaseAdmin
      .from("song_verifications")
      .upsert(
        { song_id: song.id, artist_id: profile.artist_id, status: "pending_verification" },
        { onConflict: "song_id" },
      );
    return { id: song.id };
  });

export const updateMyArtistProfile = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      bio?: string;
      genre?: string;
      location?: string;
      youtube?: string;
      instagram?: string;
      tiktok?: string;
      music?: string;
    }) => data ?? {},
  )
  .handler(async ({ data }) => {
    const { requireApprovedArtist, optionalText, normalizeUrl } = await import(
      "@/lib/artist.server"
    );
    const { uid, profile } = await requireApprovedArtist();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const social = {
      youtube: normalizeUrl(data.youtube),
      instagram: normalizeUrl(data.instagram),
      tiktok: normalizeUrl(data.tiktok),
      music: normalizeUrl(data.music),
    };
    const bio = optionalText(data.bio, "bio", 2000);
    const { error } = await supabaseAdmin
      .from("artist_profiles")
      .update({
        bio,
        genre: optionalText(data.genre, "genre", 60),
        location: optionalText(data.location, "location", 120),
        social_links: social as never,
      })
      .eq("user_id", uid);
    if (error) throw new Error(`PROFILE_UPDATE_FAILED: ${error.message}`);
    if (profile.artist_id) {
      await supabaseAdmin.from("artists").update({ bio }).eq("id", profile.artist_id);
    }
    return { ok: true };
  });

export interface ArtistAnalytics {
  totalSongs: number;
  publishedSongs: number;
  pendingSongs: number;
  totalPlays: number;
  albums: { name: string; songs: number; plays: number }[];
  topSongs: { id: string; title: string; plays: number }[];
}

export const getMyArtistAnalytics = createServerFn({ method: "GET" }).handler(
  async (): Promise<ArtistAnalytics> => {
    const { requireApprovedArtist } = await import("@/lib/artist.server");
    const { profile } = await requireApprovedArtist();
    const empty: ArtistAnalytics = {
      totalSongs: 0,
      publishedSongs: 0,
      pendingSongs: 0,
      totalPlays: 0,
      albums: [],
      topSongs: [],
    };
    if (!profile.artist_id) return empty;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("songs")
      .select("id,title,album,plays_count,song_verifications(status)")
      .eq("artist_id", profile.artist_id);
    const rows = data ?? [];
    const albums = new Map<string, { songs: number; plays: number }>();
    let published = 0;
    let pending = 0;
    let totalPlays = 0;
    for (const r of rows) {
      const v = (r as unknown as { song_verifications: { status: string }[] | { status: string } | null })
        .song_verifications;
      const status = Array.isArray(v) ? v[0]?.status : v?.status;
      if (status === "verified") published += 1;
      else if (status !== "rejected") pending += 1;
      const plays = Number(r.plays_count);
      totalPlays += plays;
      const key = r.album || "Singles";
      const prev = albums.get(key) ?? { songs: 0, plays: 0 };
      albums.set(key, { songs: prev.songs + 1, plays: prev.plays + plays });
    }
    return {
      totalSongs: rows.length,
      publishedSongs: published,
      pendingSongs: pending,
      totalPlays,
      albums: [...albums.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.plays - a.plays),
      topSongs: rows
        .map((r) => ({ id: r.id, title: r.title, plays: Number(r.plays_count) }))
        .sort((a, b) => b.plays - a.plays)
        .slice(0, 5),
    };
  },
);
