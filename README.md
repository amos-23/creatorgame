# Creator Hustle

**A 3D isometric tycoon game about building a Nigerian digital creator business.**

Start with ₦5,000, a borrowed corner and a small audience. Choose a creator path, make products, set prices, market through organic content, ads, email and affiliates, then survive power cuts, payout delays and copycats. Reinvest in a studio that visibly evolves. In 30 days, can you build a creator business that is **profitable**, growing and loved by its customers?

> *Start with what you know. Build an audience. Turn your creativity into a business.*

All money is simulated. The game does not use a real checkout, real transactions or customer data. The in-game Creator Stories are **original, fictional composites** inspired by research into published accounts of Nigerian creators (see [`research/`](research/)). They are not about real people.

---

## Features

- **Five creator paths** (Knowledge, Video & Media, Writer & Storyteller, Coach & Service, Community & Events). Each has its own starting audience, audience fit, skills, early products, time costs and strengths.
- **Six product types:** ebooks, template packs, online courses, memberships (weekly renewals and churn), event tickets (capacity, fixed date, venue costs) and coaching sessions (time-limited service). Each has setup costs, build hours, price limits, demand response, refunds and fulfilment needs.
- **Four marketing channels:** organic content (free, builds a relevant audience), paid ads (cost per 1,000 impressions, diminishing returns, creative fatigue), email (highest trust, list fatigue) and affiliates (recruitment, commission, social proof).
- **Business simulation:** cash vs. revenue (payouts settle later), gross and net profit, refunds, satisfaction, reputation, audience size and **fit**, product performance, recurring revenue and churn, hours and wellbeing. A large audience does not automatically make money.
- **17 random events** (power cuts, network outages, payout delays, viral posts, ad price swings, affiliate offers, complaints, copycats, reviews, seasonal demand, brand deals, piracy, account flags, collaborations, burnout). Every event has a no-cost option.
- **15 functional upgrades** across workspace, productivity, quality, marketing and support. Each changes the simulation and appears in the 3D studio.
- **Six ranks** (Beginner → Digital Mogul), 12 objectives, 14 unlockable Creator Story cards, a first-sale milestone, rank-up celebrations, a tutorial, a results screen with a score breakdown, and replay.
- **3D studio** built in Three.js from original low-poly models: a character with sit, type, walk, record, think, celebrate and tired animations; interactable laptop, planning board, tripod, upgrade shelf and phone; day/night transitions, coin bursts, confetti and power-cut flicker.
- **Save/resume** (validated, versioned), pause menu, settings (sound, graphics quality, simplified mode, reduced motion), and touch-friendly responsive UI.

## Tech stack

| Concern | Choice |
|---|---|
| Language | TypeScript (strict) |
| Build/dev | Vite 7 |
| 3D | Three.js 0.180 (procedural models; no external assets) |
| UI | Framework-free DOM rendering with delegated events |
| Tests | Vitest (engine), Playwright-core + Chromium (end-to-end playthrough) |
| Persistence | `localStorage` (guarded; the game runs without it) |

Three.js was chosen for a small bundle and full control over a stylised, low-poly scene. The game is a static site, so it can be hosted on any HTTPS host.

## Project structure

```
src/
  config/        Balance and content: paths, products, upgrades, events, ranks, objectives, stories
  engine/        Pure simulation: types, state, actions (reducer), simulate (day resolution),
                 economy (derived values), forecast, progression, scoring, seeded RNG
  sim/           Scripted strategies used by tests and the balance report
  persistence/   Save/load with validation; settings
  platform/      Platform adapter (local-only implementation; local scores clearly labelled)
  render/        Three.js: scene (renderer, camera, picking, effects), studio, character, kit
  ui/            App controller, views (HTML builders), styles, audio, formatting
tests/           Vitest suites for the engine and systems
e2e/             Full browser playthrough (desktop + mobile) with screenshots
scripts/         Balance report, research JSON validator
research/        Creator-economy research pack (see below)
docs/            Platform notes (Vatar integration deferred)
```

The engine has no DOM or Three.js dependencies. Every player decision goes through `applyAction(state, action)`, which validates it (cash, hours, rank, duplicates, stale days) and returns a new state. Day resolution (`resolveDay`) uses a random stream seeded by `(seed, day)`, so the same decisions always produce the same campaign.

## Local development

Requires Node.js 20+ (tested on Node 22).

```bash
npm install
npm run dev          # http://localhost:5173
```

No accounts, keys or credentials are needed.

## Testing

```bash
npm test                     # Vitest: 67 engine/system tests
npm run typecheck            # TypeScript, strict
npm run validate:research    # Validates research/creator-stories.json
npm run balance              # Balance report: every strategy × path × 20 seeds (SEEDS=n to change)
```

End-to-end playthrough (plays a full 30-day campaign through the UI on desktop 1366×820 and mobile 390×844, including save/reload/resume, results and replay, and writes screenshots to `e2e/screenshots/`):

```bash
npm run build
npx vite preview --port 4173 &
npm run e2e                  # ONLY=desktop or ONLY=mobile to run one viewport
```

The script uses `playwright-core` with a system Chromium (`CHROMIUM=/path/to/chromium`, default `/opt/pw-browsers/chromium` if present).

## Build & deployment

```bash
npm run build        # type-checks, then outputs a static site to dist/
npm run preview      # serve dist/ locally
```

`dist/` is a fully static site with relative asset paths (`base: "./"`), so it works at a domain root or in a sub-folder. To deploy:

1. Upload `dist/` to any static HTTPS host (Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3 + CloudFront, or nginx).
2. No server, database or environment variables are needed.
3. Optional: serve with long-lived caching for `dist/assets/*` (filenames are content-hashed) and no-cache for `index.html`.
4. If the game will be embedded in another site's frame, send an appropriate `Content-Security-Policy: frame-ancestors …` header from your host (see `docs/vatar-integration.md`).

Fonts load from Google Fonts. If they're unavailable, the game falls back to system fonts.

**Status:** this repository has **not** been deployed or submitted anywhere.

## Research pack

| File | Contents |
|---|---|
| [`research/creator-economy-research.md`](research/creator-economy-research.md) | Findings, recurring patterns (P1–P16), answers to the research questions, design implications |
| [`research/sources.md`](research/sources.md) | Titles, publishers, dates, URLs, access dates and access status |
| [`research/creator-stories.json`](research/creator-stories.json) | 24 structured, attributed story records (validated by `npm run validate:research`) |
| [`research/design-mapping.md`](research/design-mapping.md) | Each pattern → mechanic → code/config location; path rationale; story-card mapping |
| [`research/research-limitations.md`](research/research-limitations.md) | Source bias, self-reported figures, gaps and open questions |

Research was conducted with live web access on 13 October 2026. Reported figures are attributed and marked as self-reported. **No research figure is used as a game balance value.**

## Balancing

All tunables live in `src/config/` (mostly `balance.ts`). `npm run balance` plays ten scripted strategies (organic-first, paid ads, affiliates, email, high-volume low-price, premium pricing, diversification, conservative, aggressive, idle) on all five paths across many seeds. It prints win rate, insolvency rate, median revenue and profit, and median rank. Design goals, which the Vitest suites also guard:

- several different strategies win on every path;
- doing nothing never wins, and aggressive over-expansion earns thin margins;
- luck matters but doesn't decide outcomes;
- revenue at a loss never wins.

The rank thresholds follow the PRD (₦50k, ₦250k, ₦1M, ₦5M, ₦20M). In the current balance, strong play typically reaches Digital Entrepreneur (₦1M) and excellent play reaches Creator Boss (₦5M). **Digital Mogul (₦20M) is effectively aspirational within 30 days**, and the threshold can be tuned in `config/ranks.ts`.

## Platform integration

Vatar/Lagos Life integration is **deferred**. The game uses a local-only platform adapter: the player's typed name, and a top-10 of local scores on this device, labelled as local and never presented as official. Verified SDK notes for future work are in [`docs/vatar-integration.md`](docs/vatar-integration.md).

## Accessibility & usability

- All management is available from on-screen buttons. The 3D scene is never required (simplified mode hides the floating labels).
- Touch targets are at least about 40px; there are no hover-only controls; keyboard focus is visible; Escape closes panels.
- A reduced-motion setting is provided, and the OS preference is respected.
- A low graphics setting disables shadows and high-DPI rendering for slower devices.
- Sound starts only after the first tap and pauses when the tab is hidden.

## Known issues

- Rendering in headless/software WebGL is slow; real devices with GPU acceleration render smoothly. Performance has been checked visually, not profiled on a range of low-end phones.
- Digital Mogul is very hard to reach in 30 days (see Balancing).
- Story-card unlocks and objectives are linear; there is no free-play mode after day 30.
- Fonts depend on Google Fonts (with system fallbacks).
