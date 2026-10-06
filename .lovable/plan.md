# Full-screen ad playback and live membership refresh

## What will change
- Replace the framed ad card with a clean, full-viewport video layer that adapts to portrait and landscape screens.
- Remove every visible ad-duration label and countdown. Keep only a small loading indicator while the video is genuinely waiting for data.
- Drive ad state from real media events: autoplay attempt, play/playing, waiting/stalled, error, and ended.
- Treat only `ended` as successful completion. Playback errors and the hidden safety watchdog will record `ERROR`, close the ad, and continue the queue without freezing.
- Keep required ads non-skippable. If audible autoplay is blocked, retry muted and show one simple play control only when browser policy still requires a user gesture.
- Ensure ad completion/failure hands control back exactly once and starts the next queued song automatically.
- Refresh server-derived player entitlements immediately after membership payment completion, and also when membership data is invalidated/refetched, so controls and playlist access update without a page reload.

## Validation
- Add focused tests for ad media-state transitions and membership refresh signaling.
- Run the related tests and TypeScript checks, then inspect the generated preview build status.
- Exercise the full-screen ad in a mobile-sized browser when available, including loading, playback, completion/failure fallback, and return to the music UI.

## Technical details
- Keep the existing player, queue, ad selection/frequency/tier rules, payment flow, and tracking endpoints unchanged.
- Use one hidden watchdog that is reset by actual playback progress; buffering does not count as completion.
- Use a browser event to notify the existing PlayerProvider after membership activation, avoiding duplicated membership state or client-trusted package data.
