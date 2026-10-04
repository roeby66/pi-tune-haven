// Pure player capability rules per membership tier. The tier itself always
// comes from the server (see getPlayerEntitlements); never from client state.
import type { ViewerTier } from "@/lib/ads-core";

export interface PlayerEntitlements {
  tier: ViewerTier;
  /** Rewind / Forward (manual skip) allowed. */
  canSkip: boolean;
  /** User may switch shuffle on/off. */
  canToggleShuffle: boolean;
  /** Shuffle is forced on (Free design). */
  forceShuffle: boolean;
  /** Create/edit/manage playlists. */
  canManagePlaylists: boolean;
}

export function entitlementsFor(tier: ViewerTier | null | undefined): PlayerEntitlements {
  const paid = tier === "STANDARD" || tier === "PREMIUM";
  return {
    tier: paid ? (tier as ViewerTier) : "FREE",
    canSkip: paid,
    canToggleShuffle: paid,
    forceShuffle: !paid,
    canManagePlaylists: paid,
  };
}

/** Safe default before the server answers / when signed out. */
export const FREE_ENTITLEMENTS = entitlementsFor("FREE");
