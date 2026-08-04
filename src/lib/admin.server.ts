// Server-only helpers for the admin panel.
export async function requireAdmin() {
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

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}
