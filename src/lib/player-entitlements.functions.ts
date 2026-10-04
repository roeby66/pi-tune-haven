import { createServerFn } from "@tanstack/react-start";
import { entitlementsFor, type PlayerEntitlements } from "@/lib/player-entitlements";

/** Player capabilities derived from the server-side Pi session + active membership. */
export const getPlayerEntitlements = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlayerEntitlements> => {
    try {
      const { resolveViewer } = await import("@/lib/ads.server");
      const viewer = await resolveViewer();
      return entitlementsFor(viewer.uid ? viewer.tier : "FREE");
    } catch (err) {
      console.error("[player] entitlement lookup failed, defaulting to FREE", err);
      return entitlementsFor("FREE");
    }
  },
);
