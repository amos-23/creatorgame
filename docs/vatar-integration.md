# Vatar / Lagos Life integration: deferred

Vatar platform integration is **out of scope for this release** (deferred at the product owner's request). The game runs fully standalone, with a local-only platform adapter (`src/platform/platform.ts`). It does not load any Vatar script, call any Vatar API or claim official scores.

These notes record what was verified on 13 October 2026, so integration can resume later without repeating the research.

## Verified from the public developer docs

Source: https://lagoslife.app/developers/docs ("Vatar Games SDK · v1"), plus the sample at /developers/sample and the agreement at /developers/agreement.

- Games are hosted on the developer's own HTTPS site and shown in a sandboxed frame inside a Vatar world (Lagos Life first).
- The SDK is one script, `https://lagoslife.app/sdk/vatar-games-v1.js`, which must be loaded from Vatar (never self-hosted).
- Documented calls, all Promise-based: `Vatar.init()` (player id/name/avatar, session, mode), `Vatar.session()`, `Vatar.purchase(productId)`, `Vatar.onPurchase`, `Vatar.purchases()`, `Vatar.submitScore(n)` (best whole number; at most one every 20 s), `Vatar.leaderboard()` (top 50 plus the player's own place), `Vatar.onPause` / `Vatar.onResume`, and multiplayer `Vatar.match.*`.
- Outside the frame, calls fail with `not_framed`, so a local fallback is required.
- Frame restrictions: no popups or alerts, no fullscreen, cookies may be blocked (use `player.id`, not cookies). The page must send `Content-Security-Policy: frame-ancestors` for the Vatar origins.
- Review checklist: playable at 375×812 portrait by touch, handles pause/resume (stop timers and sound), and sound starts only after the first tap.

## How this release already prepares for it

- `PlatformAdapter` interface (`init`, `submitScore`, `leaderboard`, `onPause`, `onResume`, `official` flag). A `VatarPlatform` could implement it using only the calls listed above, falling back to `LocalPlatform` on `not_framed`.
- The final score is a whole number.
- Sound starts only after the first interaction and pauses on visibility change.
- The layout is tested at a 390×844 portrait touch viewport.
- No purchases or real-money features exist in the game.

## Not done

No SDK script, no keys, no server, no submission. Nothing has been deployed, submitted or approved.
