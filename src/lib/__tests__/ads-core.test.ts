import { describe, it, expect } from "vitest";
import { isEligible, ineligibleReason, type AdRow } from "../ads-core";
const base: AdRow = { id: "a", title: "t", description: null, video_url: "", video_path: "videos/x.mp4", thumbnail_url: null, thumbnail_path: null, duration_seconds: null, ad_type: "HOUSE_PROMOTION", target_tier: "ALL", priority: 0, frequency_type: "EVERY_SONG", frequency_value: null, start_at: null, end_at: null, max_impressions: null, click_url: null, status: "ACTIVE", sort_order: 0 };
const s = { impressions: 0, songsSinceLastImpression: 0, minutesSinceLastImpression: null, shownThisSession: false };
describe("ad eligibility", () => {
  it("accepts uploaded ads with only a stored file", () => expect(isEligible(base, "FREE", s)).toBe(true));
  it("rejects ads with no video at all", () => expect(ineligibleReason({ ...base, video_path: null }, "FREE", s)).toBe("no_video"));
  it("keeps premium exclusion for FREE-targeted ads", () => expect(ineligibleReason({ ...base, target_tier: "FREE" }, "PREMIUM", s)).toBe("tier_mismatch"));
});
