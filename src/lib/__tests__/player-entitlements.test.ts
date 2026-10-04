import { describe, it, expect } from "vitest";
import { entitlementsFor, FREE_ENTITLEMENTS } from "@/lib/player-entitlements";
import { resolveAdvance } from "@/lib/player-transition";
import { normalizeTier } from "@/lib/ads-core";

describe("player entitlements", () => {
  it("Free: no skip, forced shuffle, no playlist management", () => {
    const e = entitlementsFor("FREE");
    expect(e).toMatchObject({ canSkip: false, canToggleShuffle: false, forceShuffle: true, canManagePlaylists: false });
  });
  it.each(["STANDARD", "PREMIUM"] as const)("%s: full controls + playlists", (t) => {
    expect(entitlementsFor(t)).toMatchObject({ tier: t, canSkip: true, canToggleShuffle: true, forceShuffle: false, canManagePlaylists: true });
  });
  it("signed out / unknown tier falls back to Free", () => {
    expect(entitlementsFor(null)).toEqual(FREE_ENTITLEMENTS);
    expect(entitlementsFor("HACKED" as never)).toEqual(FREE_ENTITLEMENTS);
  });
  it("maps stored plan names to tiers (expired/missing -> Free)", () => {
    expect(normalizeTier("premium")).toBe("PREMIUM");
    expect(normalizeTier("Standard Monthly")).toBe("STANDARD");
    expect(normalizeTier(null)).toBe("FREE");
  });
  it("Free forced shuffle still auto-advances to a different track", () => {
    const r = resolveAdvance(0, 3, FREE_ENTITLEMENTS.forceShuffle, "off", () => 0);
    expect(r.play).toBe(true);
    expect(r.index).not.toBe(0);
  });
});
