export const MEMBERSHIP_CHANGED_EVENT = "mypimusic:membership-changed";

export function notifyMembershipChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MEMBERSHIP_CHANGED_EVENT));
}