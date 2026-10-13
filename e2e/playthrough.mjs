// End-to-end playthrough in a real browser (Chromium via playwright-core).
// Plays a full 30-day campaign through the UI on desktop and mobile viewports:
// title → setup → tutorial → products → marketing → events → reports → results → replay.
// Also checks save/resume by reloading mid-campaign.
//
// Usage: npm run build && npx vite preview --port 4173 &  then  npm run e2e
// Env: BASE_URL (default http://localhost:4173), CHROMIUM (path to chromium binary)

import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:4173/";
const OUT = path.resolve("e2e/screenshots");
fs.mkdirSync(OUT, { recursive: true });
const executablePath = process.env.CHROMIUM ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

const VIEWPORTS = [
  { name: "desktop", viewport: { width: 1366, height: 820 }, isMobile: false, hasTouch: false },
  { name: "mobile", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];

const errors = [];
const log = (...a) => console.log(...a);

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

async function clickAct(page, selector) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible", timeout: 8000 });
  await el.click();
}

const shotOnce = new Set();
async function clearModals(page, vpName = "") {
  for (let i = 0; i < 12; i++) {
    const modal = page.locator("#modal.open .modal");
    if (!(await modal.count())) return;
    for (const [sel, name] of [[".event-modal", "10-event"], [".rank-modal", "15-rankup"], [".inbox-modal .story-card", "18-story"]]) {
      const key = `${vpName}-${name}`;
      if (!shotOnce.has(key) && (await page.locator(`#modal.open ${sel}`).count())) {
        shotOnce.add(key);
        await page.waitForTimeout(250);
        await shot(page, key);
      }
    }
    const choice = page.locator("#modal.open [data-act=event-choice]:not([disabled])");
    if (await choice.count()) {
      await choice.first().click();
    } else {
      const dismiss = page.locator("#modal.open [data-act=dismiss-modal]");
      if (await dismiss.count()) await dismiss.first().click();
      else return;
    }
    await page.waitForTimeout(120);
    if (await page.locator(".results-screen").count()) return;
  }
}

async function openPanel(page, id) {
  await page.evaluate((pid) => document.querySelector(`[data-act=open][data-panel=${pid}]`)?.click(), id);
  await page.locator("#panel.open").waitFor({ timeout: 4000 });
}

async function closePanel(page) {
  const close = page.locator("#panel.open [data-act=close]");
  if (await close.count()) await close.first().click();
}

async function run(vp) {
  const browser = await chromium.launch({ executablePath, args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const context = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor ?? 1 });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`[${vp.name}] pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !m.text().includes("fonts.g") && errors.push(`[${vp.name}] console: ${m.text()}`));

  await page.goto(BASE);
  await page.waitForSelector(".title-screen", { timeout: 15000 });
  await page.waitForTimeout(800);
  await shot(page, `${vp.name}-01-title`);

  // Setup
  await clickAct(page, "[data-act=new-game]");
  await page.waitForSelector(".setup-screen");
  await clickAct(page, "[data-act=setup-path][data-id=writer]");
  await shot(page, `${vp.name}-02-paths`);
  await clickAct(page, "[data-act=setup-next]");
  await page.fill("#setup-name", vp.name === "mobile" ? "Ada Writes" : "Tolu Creates");
  await clickAct(page, "[data-act=setup-avatar][data-key=outfit][data-val='2']");
  await shot(page, `${vp.name}-03-setup`);
  await clickAct(page, "[data-act=setup-start]");
  await page.waitForSelector("#hud .hud-bar");
  await page.waitForTimeout(600);
  await shot(page, `${vp.name}-04-studio-tutorial`);

  // Tutorial: next → create product via the laptop pin (desktop) or dock (mobile)
  await clickAct(page, "[data-act=tut-next]");
  if (vp.name === "desktop") {
    const pin = page.locator(".pin[data-id=laptop]");
    await pin.waitFor();
    await pin.click({ force: true });
  } else {
    await clickAct(page, "#dock-products");
  }
  await page.locator("#panel.open").waitFor();
  await clickAct(page, "#new-product-btn");
  await clickAct(page, "[data-act=wiz-type][data-type=ebook]");
  await shot(page, `${vp.name}-05-new-product`);
  await clickAct(page, "#wiz-create");
  await page.waitForTimeout(300);
  await shot(page, `${vp.name}-06-products`);
  await closePanel(page);

  // Plan the day: 1 post (leaves hours to build)
  await openPanel(page, "content");
  await clickAct(page, "[data-act=plan-set][data-key=posts][data-val='1']");
  await shot(page, `${vp.name}-07-content`);
  await closePanel(page);

  const tutNext = page.locator("[data-act=tut-next]");
  if (await tutNext.count()) await tutNext.click();

  let resumed = false;
  let marketingShot = false;
  let upgradesShot = false;
  let eventShot = false;
  for (let day = 1; day <= 32; day++) {
    if (await page.locator(".results-screen").count()) break;
    // An event may be waiting at the start of the day
    if (!eventShot && (await page.locator("#modal.open .event-modal").count())) {
      await shot(page, `${vp.name}-10-event`);
      eventShot = true;
    }
    await clearModals(page, vp.name);
    if (await page.locator(".results-screen").count()) break;

    const dayNum = await page.evaluate(() => Number(document.querySelector(".hud-day-num b")?.textContent ?? "0"));
    // Strategy via UI: once product is live, turn on email & affiliates, run some ads, more posts
    if (dayNum >= 4 && dayNum % 3 === 1) {
      await openPanel(page, "marketing");
      const aff = page.locator("#panel [data-act=plan-toggle][data-key=affiliateOn]");
      if (!(await aff.isChecked())) await aff.check({ force: true });
      const email = page.locator("#panel [data-act=plan-toggle][data-key=email]");
      if ((await email.isEnabled()) && !(await email.isChecked())) await email.check({ force: true });
      if (!marketingShot) {
        await shot(page, `${vp.name}-08-marketing`);
        marketingShot = true;
      }
      await closePanel(page);
    }
    if (dayNum === 3 || dayNum === 8) {
      await openPanel(page, "content");
      await clickAct(page, "[data-act=plan-set][data-key=posts][data-val='2']");
      await closePanel(page);
    }
    if (dayNum >= 6) {
      await openPanel(page, "upgrades");
      const buy = page.locator("#panel [data-act=buy]:not([disabled])");
      if (await buy.count()) await buy.first().click();
      if (!upgradesShot) {
        await page.waitForTimeout(400);
        await shot(page, `${vp.name}-09-upgrades`);
        upgradesShot = true;
      }
      await closePanel(page);
    }
    if (dayNum === 10) {
      // Launch a second product on the same topic
      await openPanel(page, "products");
      const btn = page.locator("#new-product-btn:not([disabled])");
      if (await btn.count()) {
        await btn.click();
        const tpl = page.locator("[data-act=wiz-type][data-type=template]:not([disabled])");
        if (await tpl.count()) {
          await tpl.click();
          const create = page.locator("#wiz-create:not([disabled])");
          if (await create.count()) await create.click();
        }
      }
      await closePanel(page);
      await openPanel(page, "dashboard");
      await shot(page, `${vp.name}-11-dashboard`);
      await closePanel(page);
    }
    if (dayNum === 12 && !resumed) {
      // Save/resume: reload the page and continue
      await page.reload();
      await page.waitForSelector(".title-screen");
      await clickAct(page, "[data-act=resume]");
      await page.waitForSelector("#hud .hud-bar");
      const after = await page.evaluate(() => Number(document.querySelector(".hud-day-num b")?.textContent ?? "0"));
      if (after !== 12) errors.push(`[${vp.name}] resume landed on day ${after}, expected 12`);
      resumed = true;
      await clearModals(page, vp.name);
    }
    if (dayNum === 15) {
      await openPanel(page, "goals");
      await shot(page, `${vp.name}-12-goals`);
      await closePanel(page);
      await openPanel(page, "menu");
      await shot(page, `${vp.name}-13-pause`);
      await closePanel(page);
    }

    await clickAct(page, "#end-day-btn");
    // day transition + report
    await page.waitForSelector("#modal.open .modal, .results-screen", { timeout: 10000 });
    if (day === 1) {
      await page.waitForTimeout(300);
      await shot(page, `${vp.name}-14-report`);
    }
    if (await page.locator("#modal.open .rank-modal").count()) await shot(page, `${vp.name}-15-rankup`);
    await clearModals(page, vp.name);
  }

  await page.waitForSelector(".results-screen", { timeout: 15000 });
  await page.waitForTimeout(500);
  await shot(page, `${vp.name}-16-results`);
  const outcome = await page.evaluate(() => document.querySelector(".results-card h1")?.textContent);
  const score = await page.evaluate(() => document.querySelector(".results-card h3")?.textContent);
  log(`[${vp.name}] outcome: ${outcome} | ${score}`);

  // Replay
  await clickAct(page, "[data-act=replay]");
  await page.waitForSelector(".setup-screen");
  log(`[${vp.name}] replay → setup screen OK`);
  // Back to title shows the local leaderboard
  await clickAct(page, "[data-act=to-title]");
  await page.waitForSelector(".title-screen .mini-board");
  await shot(page, `${vp.name}-17-title-after`);

  // Horizontal overflow check
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) errors.push(`[${vp.name}] horizontal overflow`);
  await browser.close();
}

for (const vp of VIEWPORTS) {
  if (process.env.ONLY && process.env.ONLY !== vp.name) continue;
  log(`--- ${vp.name} ---`);
  await run(vp);
}
if (errors.length) {
  console.error("Errors:\n" + errors.join("\n"));
  process.exit(1);
}
log("E2E playthrough passed.");
