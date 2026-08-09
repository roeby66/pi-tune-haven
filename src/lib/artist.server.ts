// Server-only helpers for the Artist Application & Verification system.
// Authorization always happens here (never trusted from the client).

export interface PremiumCheck {
  uid: string;
  username: string;
  isPremium: boolean;
  membershipLevel: string | null;
  membershipStatus: string | null;
}

/** Reads the Pi session and resolves the caller's premium membership state. */
export async function getMembershipState(): Promise<PremiumCheck | null> {
  const { readPiSession } = await import("@/lib/pi-session.server");
  const s = readPiSession();
  if (!s) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_memberships")
    .select("membership_level,membership_status,expires_at,membership_plans(name)")
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
  const isPremium = !!data && notExpired && /premium/i.test(planName ?? "");

  return {
    uid: s.uid,
    username: s.username,
    isPremium,
    membershipLevel: planName,
    membershipStatus: data?.membership_status ?? null,
  };
}

export async function requirePremiumMember(): Promise<PremiumCheck> {
  const state = await getMembershipState();
  if (!state) throw new Error("UNAUTHORIZED: sign in with Pi first");
  if (!state.isPremium) throw new Error("PREMIUM_REQUIRED");
  return state;
}

export interface ArtistProfileRow {
  id: string;
  user_id: string;
  artist_id: string | null;
  artist_name: string;
  bio: string | null;
  avatar_url: string | null;
  genre: string | null;
  location: string | null;
  social_links: Record<string, string>;
  status: "active" | "suspended";
  pioneer_artist: boolean;
  created_at: string;
}

/** Requires the caller to be an approved, non-suspended artist. */
export async function requireApprovedArtist(): Promise<{
  uid: string;
  username: string;
  profile: ArtistProfileRow;
}> {
  const { requirePiSession } = await import("@/lib/pi-session.server");
  const s = requirePiSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("artist_profiles")
    .select("*")
    .eq("user_id", s.uid)
    .maybeSingle();
  if (!data) throw new Error("NOT_AN_ARTIST");
  if (data.status === "suspended") throw new Error("ARTIST_SUSPENDED");
  return {
    uid: s.uid,
    username: s.username,
    profile: data as unknown as ArtistProfileRow,
  };
}

export function normalizeUrl(value: unknown, max = 300): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.length > max) throw new Error("URL_TOO_LONG");
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("INVALID_URL");
    return u.toString();
  } catch {
    throw new Error(`INVALID_URL: ${raw}`);
  }
}

export function requiredText(value: unknown, field: string, max: number): string {
  const v = String(value ?? "").trim();
  if (!v) throw new Error(`MISSING_${field.toUpperCase()}`);
  if (v.length > max) throw new Error(`${field.toUpperCase()}_TOO_LONG`);
  return v;
}

export function optionalText(value: unknown, field: string, max: number): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  if (v.length > max) throw new Error(`${field.toUpperCase()}_TOO_LONG`);
  return v;
}
