// HTML view builders. Every interactive element carries data-act attributes that
// the App controller handles through a single delegated listener.

import { BALANCE } from "../config/balance";
import { OBJECTIVE_BY_ID } from "../config/objectives";
import { PATHS, PATH_ORDER, TOPICS } from "../config/paths";
import { EVENT_SALES_DAYS, PRODUCT_ORDER, PRODUCT_TYPES } from "../config/products";
import { RANKS } from "../config/ranks";
import { STORIES, STORY_BY_ID } from "../config/stories";
import { UPGRADES } from "../config/upgrades";
import {
  MAX_ACTIVE_PRODUCTS,
  activeProductCount,
  adFit,
  contentQuality,
  cpm,
  devHoursFor,
  emailSendCost,
  eventCapacity,
  expectedQuality,
  grossProfit,
  hoursBreakdown,
  isProductTypeUnlocked,
  isProvenTopic,
  membersOf,
  netProfit,
  netRevenue,
  pendingCash,
  postHours,
  refPrice,
  setupCostFor,
  sideGigPay,
} from "../engine/economy";
import { forecastDay } from "../engine/forecast";
import { activeObjectives, winCheck } from "../engine/progression";
import type { ScoreBreakdown } from "../engine/scoring";
import type { Channel, DayReport, Effort, GameState, Product, ProductType } from "../engine/types";
import type { ScoreEntry } from "../platform/platform";
import type { Settings } from "../persistence/save";
import { esc, naira, num, pct, qualityLabel, stars } from "./format";

export type PanelId = "dashboard" | "products" | "newProduct" | "marketing" | "content" | "upgrades" | "goals" | "stories" | "menu" | "help";

export interface WizardDraft {
  type: ProductType | null;
  topic: string;
  price: number;
  effort: Effort;
  name: string;
}

const CHANNEL_LABEL: Record<Channel, string> = {
  organic: "Organic content",
  ads: "Paid ads",
  email: "Email",
  affiliate: "Affiliates",
  bonus: "Viral / bonus",
};

const bar = (v: number, cls = "") => `<div class="bar ${cls}"><span style="width:${Math.max(0, Math.min(100, v * 100)).toFixed(1)}%"></span></div>`;

const stat = (label: string, value: string, sub = "", cls = "") =>
  `<div class="stat ${cls}"><div class="stat-label">${label}</div><div class="stat-value">${value}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ""}</div>`;

// ---------------------------------------------------------------- Title & setup

export function titleScreen(hasSave: boolean, saveMsg: string | null, best: ScoreEntry[]): string {
  return `
  <div class="screen title-screen">
    <div class="title-card pop-in">
      <div class="logo"><span class="logo-a">Creator</span><span class="logo-b">Hustle</span></div>
      <p class="tagline">Start with what you know. Build an audience.<br/>Turn your creativity into a business.</p>
      <div class="title-buttons">
        ${hasSave ? `<button class="btn primary big" data-act="resume">▶ Continue campaign</button>` : ""}
        <button class="btn ${hasSave ? "" : "primary"} big" data-act="new-game">${hasSave ? "New campaign" : "▶ Start your hustle"}</button>
        <button class="btn ghost" data-act="open-help-title">How to play</button>
      </div>
      ${saveMsg ? `<p class="notice">${esc(saveMsg)}</p>` : ""}
      ${
        best.length
          ? `<div class="mini-board"><h4>🏆 Local best scores <small>(this device only, not an official leaderboard)</small></h4>${best
              .slice(0, 3)
              .map((b, i) => `<div class="row"><span>${i + 1}. ${esc(b.name)} · ${esc(b.path)}</span><b>${num(b.score)} (${esc(b.grade)})</b></div>`)
              .join("")}</div>`
          : ""
      }
      <p class="fine">A single-player simulation. All money is simulated, and creator stories in the game are fictional composites inspired by research.</p>
    </div>
  </div>`;
}

export interface SetupDraft {
  step: number;
  path: string;
  niche: string;
  name: string;
  skin: number;
  outfit: number;
  hair: number;
}

export function setupScreen(d: SetupDraft): string {
  const p = PATHS[d.path as keyof typeof PATHS];
  const pathCards = PATH_ORDER.map((id) => {
    const c = PATHS[id];
    return `<button class="path-card ${id === d.path ? "selected" : ""}" data-act="setup-path" data-id="${id}" aria-pressed="${id === d.path}">
      <div class="path-icon">${c.icon}</div>
      <div class="path-name">${c.label}</div>
      <div class="path-pitch">${c.pitch}</div>
      <div class="path-adv">✅ ${c.advantage}</div>
      <div class="path-chal">⚠️ ${c.challenge}</div>
    </button>`;
  }).join("");
  const skins = ["#f1c27d", "#c68642", "#8d5524", "#6b3e1f", "#4a2a14"];
  const outfits = ["#ff8a3d", "#2ec4b6", "#7b5cff", "#ff5d8f", "#2ec27e", "#ffd23f"];
  const hairs = ["#1b1b1f", "#3b2416", "#5a3a22"];
  const swatches = (key: string, list: string[], cur: number) =>
    list.map((c, i) => `<button class="swatch ${i === cur ? "selected" : ""}" style="background:${c}" data-act="setup-avatar" data-key="${key}" data-val="${i}" aria-label="${key} ${i + 1}"></button>`).join("");

  return `
  <div class="screen setup-screen">
    <div class="setup-card pop-in">
      <div class="setup-head">
        <button class="btn ghost small" data-act="${d.step === 0 ? "to-title" : "setup-back"}">← Back</button>
        <div class="steps">${[0, 1].map((i) => `<span class="dot ${i <= d.step ? "on" : ""}"></span>`).join("")}</div>
      </div>
      ${
        d.step === 0
          ? `<h2>Choose your creator path</h2>
             <p class="muted">Each path changes your starting audience, skills and early products. You can still make any product later.</p>
             <div class="path-grid">${pathCards}</div>
             <div class="setup-foot"><button class="btn primary big" data-act="setup-next">Continue →</button></div>`
          : `<h2>${p.icon} ${p.label}</h2>
             <p class="muted">${p.startTip}</p>
             <h3>Pick your niche</h3>
             <div class="chip-row">${p.topics
               .map((t) => `<button class="chip ${t === d.niche ? "selected" : ""}" data-act="setup-niche" data-id="${t}">${TOPICS[t]!.label}</button>`)
               .join("")}</div>
             <p class="fine">Products on your niche convert best with your audience. Niches differ in demand and how much buyers will pay.</p>
             <h3>Your creator name</h3>
             <input class="text-input" id="setup-name" maxlength="24" placeholder="e.g. Tolu Creates" value="${esc(d.name)}" data-act="setup-name" />
             <h3>Your look</h3>
             <div class="swatch-row"><span>Skin</span>${swatches("skin", skins, d.skin)}</div>
             <div class="swatch-row"><span>Outfit</span>${swatches("outfit", outfits, d.outfit)}</div>
             <div class="swatch-row"><span>Hair</span>${swatches("hair", hairs, d.hair)}</div>
             <div class="start-summary">
               <div>💰 Start: <b>${naira(BALANCE.startingCash)}</b></div>
               <div>👥 Audience: <b>${num(p.startAudience)}</b></div>
               <div>📅 Campaign: <b>${BALANCE.campaignDays} days</b></div>
             </div>
             <div class="setup-foot"><button class="btn primary big" data-act="setup-start">Open my studio 🚀</button></div>`
      }
    </div>
  </div>`;
}

// ---------------------------------------------------------------- HUD & dock

export function hud(s: GameState): string {
  const rank = RANKS[s.rank]!;
  const next = RANKS[s.rank + 1];
  const rev = netRevenue(s);
  const progress = next ? (rev - rank.threshold) / (next.threshold - rank.threshold) : 1;
  const pending = pendingCash(s);
  return `
  <div class="hud-bar">
    <div class="hud-day" title="Campaign day">
      <div class="hud-day-num">Day <b>${s.day}</b><span>/${s.campaignDays}</span></div>
      ${bar((s.day - 1) / s.campaignDays, "thin")}
    </div>
    <div class="hud-chip cash ${s.cash < 0 ? "neg" : ""}" title="Cash on hand${pending ? ` (+${naira(pending)} arriving soon)` : ""}">
      <span class="ico">💰</span><b>${naira(s.cash, { compact: true })}</b>${pending ? `<small>+${naira(pending, { compact: true })}</small>` : ""}
    </div>
    <div class="hud-chip" title="Audience (followers)"><span class="ico">👥</span><b>${num(s.audience)}</b></div>
    <div class="hud-chip hide-xs" title="Reputation"><span class="ico">⭐</span><b>${Math.round(s.reputation)}</b></div>
    <div class="hud-chip hide-xs" title="Customer satisfaction"><span class="ico">😊</span><b>${Math.round(s.satisfaction)}</b></div>
    <div class="hud-chip ${s.wellbeing < 35 ? "warn" : ""}" title="Wellbeing (energy)"><span class="ico">⚡</span><b>${s.wellbeing}</b></div>
    <button class="hud-rank" data-act="open" data-panel="goals" title="Rank progress">
      <span class="ico">${rank.icon}</span>
      <span class="rank-text"><b>${rank.name}</b>${next ? `<small>${naira(rev, { compact: true })} / ${naira(next.threshold, { compact: true })}</small>` : "<small>Max rank</small>"}</span>
      ${bar(progress, "thin gold")}
    </button>
    <button class="hud-menu" data-act="open" data-panel="menu" aria-label="Pause menu">☰</button>
  </div>`;
}

export function dock(s: GameState, open: PanelId | null): string {
  const items: [PanelId, string, string][] = [
    ["products", "📦", "Products"],
    ["marketing", "📣", "Marketing"],
    ["content", "🎥", "Create"],
    ["upgrades", "🛠️", "Upgrades"],
    ["goals", "📋", "Goals"],
    ["dashboard", "📊", "Stats"],
  ];
  const hb = hoursBreakdown(s);
  const developing = s.products.some((p) => p.status === "developing");
  const noProducts = s.products.length === 0;
  return `
  <nav class="dock" aria-label="Management">
    <div class="dock-items">
      ${items
        .map(
          ([id, ico, label]) =>
            `<button class="dock-btn ${open === id ? "active" : ""} ${id === "products" && noProducts ? "attention" : ""}" data-act="open" data-panel="${id}" id="dock-${id}"><span class="ico">${ico}</span><span class="lbl">${label}</span></button>`,
        )
        .join("")}
    </div>
    <div class="dock-end">
      <div class="hours-pill" title="Hours planned today">⏱ ${hb.planned.toFixed(1)}/${hb.available}h${developing && hb.free > 0 ? ` · ${hb.free.toFixed(1)}h → build` : ""}</div>
      <button class="btn end-day" data-act="end-day" id="end-day-btn">${s.day >= s.campaignDays ? "Finish campaign 🏁" : "End day ▶"}</button>
    </div>
  </nav>`;
}

// ---------------------------------------------------------------- Panels

export function panel(id: PanelId, s: GameState, ctx: { wizard: WizardDraft; settings: Settings; productTab: string }): string {
  switch (id) {
    case "dashboard":
      return dashboardPanel(s);
    case "products":
      return productsPanel(s);
    case "newProduct":
      return newProductPanel(s, ctx.wizard);
    case "marketing":
      return marketingPanel(s);
    case "content":
      return contentPanel(s);
    case "upgrades":
      return upgradesPanel(s);
    case "goals":
      return goalsPanel(s);
    case "stories":
      return storiesPanel(s);
    case "menu":
      return menuPanel(ctx.settings);
    case "help":
      return helpPanel();
  }
}

const head = (title: string, sub = "", back?: PanelId) => `
  <div class="panel-head">
    ${back ? `<button class="icon-btn" data-act="open" data-panel="${back}" aria-label="Back">←</button>` : ""}
    <div><h2>${title}</h2>${sub ? `<div class="panel-sub">${sub}</div>` : ""}</div>
    <button class="icon-btn close" data-act="close" aria-label="Close">✕</button>
  </div>`;

function dashboardPanel(s: GameState): string {
  const t = s.totals;
  const last = s.history[s.history.length - 1];
  const hist = s.history.slice(-14);
  const max = Math.max(1, ...hist.map((d) => Math.max(d.grossRevenue, Math.abs(d.netProfit))));
  const chart = hist.length
    ? `<div class="chart" role="img" aria-label="Daily revenue and profit">${hist
        .map(
          (d) => `<div class="chart-col" title="Day ${d.day}: revenue ${naira(d.grossRevenue)}, profit ${naira(d.netProfit)}">
            <div class="chart-bar rev" style="height:${(d.grossRevenue / max) * 100}%"></div>
            <div class="chart-bar ${d.netProfit >= 0 ? "pos" : "neg"}" style="height:${(Math.abs(d.netProfit) / max) * 100}%"></div>
            <span>${d.day}</span></div>`,
        )
        .join("")}</div><div class="legend"><span class="lg rev"></span>Revenue <span class="lg pos"></span>Profit <span class="lg neg"></span>Loss</div>`
    : `<p class="muted">Your daily results will chart here after your first day.</p>`;
  const channelRows = last
    ? (Object.keys(last.channelStats) as Channel[])
        .filter((c) => last.channelStats[c].visitors > 0 || last.channelStats[c].sales > 0)
        .map((c) => {
          const cs = last.channelStats[c];
          const roas = c === "ads" && last.adSpend > 0 ? ` · return ${(cs.revenue / last.adSpend).toFixed(1)}×` : "";
          return `<tr><td>${CHANNEL_LABEL[c]}</td><td>${num(cs.visitors)}</td><td>${cs.sales}</td><td>${naira(cs.revenue, { compact: true })}${roas}</td></tr>`;
        })
        .join("")
    : "";
  return `${head("📊 Business dashboard", `Day ${s.day} of ${s.campaignDays}`)}
  <div class="panel-body">
    <div class="stat-grid">
      ${stat("Cash", naira(s.cash), pendingCash(s) ? `+${naira(pendingCash(s))} settling` : "on hand", s.cash < 0 ? "neg" : "")}
      ${stat("Revenue", naira(netRevenue(s), { compact: true }), `${t.sales} sales`)}
      ${stat("Gross profit", naira(grossProfit(s), { compact: true }), "after refunds, fees, commissions")}
      ${stat("Net profit", naira(netProfit(s), { compact: true }), "after all running costs", netProfit(s) < 0 ? "neg" : "pos")}
    </div>
    <h3>Daily performance</h3>
    ${chart}
    <h3>Where the money went</h3>
    <table class="tbl">
      <tr><td>Gross revenue</td><td class="r">${naira(t.grossRevenue)}</td></tr>
      <tr><td>Refunds</td><td class="r neg">${naira(-t.refunds)}</td></tr>
      <tr><td>Payment fees (${pct(BALANCE.paymentFeeRate)})</td><td class="r neg">${naira(-t.paymentFees)}</td></tr>
      <tr><td>Affiliate commissions</td><td class="r neg">${naira(-t.affiliateCommissions)}</td></tr>
      <tr><td>Event venue costs</td><td class="r neg">${naira(-t.directCosts)}</td></tr>
      <tr><td>Running costs (ads ${naira(t.adSpend, { compact: true })}, data, tools, setup)</td><td class="r neg">${naira(-t.operatingCosts)}</td></tr>
      <tr><td>Other income (gigs, deals, bonuses)</td><td class="r pos">${naira(t.otherIncome)}</td></tr>
      <tr class="total"><td>Net profit</td><td class="r">${naira(netProfit(s))}</td></tr>
      <tr><td>Invested in studio upgrades</td><td class="r">${naira(t.investments)}</td></tr>
    </table>
    ${
      last
        ? `<h3>Yesterday by channel</h3><table class="tbl"><tr class="th"><td>Channel</td><td>Visitors</td><td>Sales</td><td>Revenue</td></tr>${channelRows || `<tr><td colspan="4" class="muted">No traffic yesterday.</td></tr>`}</table>`
        : ""
    }
    ${modifiersBlock(s)}
  </div>`;
}

function modifiersBlock(s: GameState): string {
  if (!s.modifiers.length) return "";
  return `<h3>Active effects</h3><div class="chip-row">${s.modifiers
    .map((m) => `<span class="chip ${m.positive ? "good" : "bad"}">${esc(m.label)} · ${m.daysLeft}d</span>`)
    .join("")}</div>`;
}

function productCard(s: GameState, p: Product): string {
  const cfg = PRODUCT_TYPES[p.type];
  const featured = s.plan.featuredProductId === p.id;
  const unit = cfg.priceUnit;
  let status = "";
  if (p.status === "developing") {
    status = `<div class="dev">🔨 Building · ${Math.round(p.devHoursDone)}/${p.devHoursTotal}h ${bar(p.devHoursDone / p.devHoursTotal)}</div><p class="fine">Free hours each day go into building. Fewer posts or a hustle day = faster launch.</p>`;
  } else if (p.status === "retired") status = `<span class="tag">Retired</span>`;
  else if (p.status === "completed") status = `<span class="tag good">Event hosted ✓</span>`;
  const extra =
    p.type === "membership" && p.status === "live"
      ? `<div class="kv"><span>Members</span><b>${membersOf(p)}</b></div>`
      : p.type === "event" && p.eventDay
        ? `<div class="kv"><span>Tickets</span><b>${p.ticketsSold}/${p.capacity}</b></div><div class="kv"><span>Event day</span><b>Day ${p.eventDay}${p.eventDay === s.day ? " (today!)" : ""}</b></div>`
        : "";
  const live = p.status === "live";
  const canPrice = live && !(p.type === "event" && p.ticketsSold > 0);
  return `<div class="product-card ${featured ? "featured" : ""} ${p.status}">
    <div class="pc-head">
      <div class="pc-icon">${cfg.icon}</div>
      <div class="pc-title"><b>${esc(p.name)}</b><small>${cfg.label} · ${TOPICS[p.topic]?.label ?? p.topic}${p.topic === s.niche ? " · niche ✓" : ""}</small></div>
      ${featured && live ? `<span class="tag hot">Featured</span>` : ""}
    </div>
    ${status}
    <div class="pc-grid">
      <div class="kv"><span>Price</span><b>${p.price === 0 ? "Free (lead magnet)" : naira(p.price) + unit}</b></div>
      <div class="kv"><span>Quality</span><b title="${p.quality.toFixed(2)}">${stars(p.quality)} ${qualityLabel(p.quality)}</b></div>
      <div class="kv"><span>${p.price === 0 ? "Downloads" : "Sales"}</span><b>${num(p.sales)}</b></div>
      <div class="kv"><span>Revenue</span><b>${naira(p.revenue, { compact: true })}</b></div>
      ${p.refunds ? `<div class="kv"><span>Refunds</span><b class="neg">${p.refunds}</b></div>` : ""}
      ${p.adFatigue > 0.2 ? `<div class="kv"><span>Ad fatigue</span><b class="neg">${pct(p.adFatigue)}</b></div>` : ""}
      ${extra}
    </div>
    ${
      live
        ? `<div class="pc-actions">
        ${canPrice ? `<div class="stepper"><button class="btn small" data-act="price-step" data-id="${p.id}" data-dir="-1" aria-label="Lower price">−</button><span>${p.price === 0 ? "Free" : naira(p.price)}</span><button class="btn small" data-act="price-step" data-id="${p.id}" data-dir="1" aria-label="Raise price">+</button></div>` : ""}
        ${!featured ? `<button class="btn small" data-act="feature" data-id="${p.id}">⭐ Feature</button>` : ""}
        ${p.improvements < BALANCE.maxImprovements ? `<button class="btn small" data-act="improve" data-id="${p.id}" title="${BALANCE.improveHours} hours + ${naira(BALANCE.improveCost)}">🔧 Improve</button>` : ""}
        <button class="btn small ghost" data-act="retire" data-id="${p.id}">Retire</button>
      </div>`
        : ""
    }
  </div>`;
}

function productsPanel(s: GameState): string {
  const active = s.products.filter((p) => p.status === "live" || p.status === "developing");
  const past = s.products.filter((p) => p.status === "retired" || p.status === "completed");
  const canAdd = activeProductCount(s) < MAX_ACTIVE_PRODUCTS;
  return `${head("📦 Products", `${active.length}/${MAX_ACTIVE_PRODUCTS} active`)}
  <div class="panel-body">
    <button class="btn primary wide" data-act="open" data-panel="newProduct" ${canAdd ? "" : "disabled"} id="new-product-btn">＋ Create a new product</button>
    ${!s.products.length ? `<div class="empty"><div class="big-ico">💡</div><p>You have nothing to sell yet. ${PATHS[s.path].firstObjective}</p></div>` : ""}
    ${active.map((p) => productCard(s, p)).join("")}
    ${past.length ? `<details class="past"><summary>Past products (${past.length})</summary>${past.map((p) => productCard(s, p)).join("")}</details>` : ""}
  </div>`;
}

export function defaultWizard(s: GameState): WizardDraft {
  const type = PRODUCT_ORDER.find((t) => PATHS[s.path].earlyProducts.includes(t) && isProductTypeUnlocked(s, t)) ?? "ebook";
  return { type: null, topic: s.niche, price: Math.round(refPrice(s, type, s.niche) / 100) * 100, effort: "standard", name: "" };
}

export function priceSteps(type: ProductType): number[] {
  const cfg = PRODUCT_TYPES[type];
  const steps: number[] = cfg.allowFree ? [0] : [];
  let v = cfg.minPrice;
  while (v <= cfg.maxPrice) {
    steps.push(v);
    const inc = v < 2_000 ? 250 : v < 5_000 ? 500 : v < 20_000 ? 1_000 : v < 50_000 ? 2_500 : 5_000;
    v += inc;
  }
  return steps;
}

function newProductPanel(s: GameState, w: WizardDraft): string {
  const typeCards = PRODUCT_ORDER.map((t) => {
    const cfg = PRODUCT_TYPES[t];
    const unlocked = isProductTypeUnlocked(s, t);
    const busyEvent = t === "event" && s.products.some((p) => p.type === "event" && (p.status === "live" || p.status === "developing"));
    return `<button class="type-card ${w.type === t ? "selected" : ""}" data-act="wiz-type" data-type="${t}" ${unlocked && !busyEvent ? "" : "disabled"}>
      <span class="tc-ico">${cfg.icon}</span><b>${cfg.label}</b>
      <small>${unlocked ? (busyEvent ? "One event at a time" : cfg.description) : `🔒 Unlocks at ${RANKS[cfg.unlockRank]!.name}`}</small>
    </button>`;
  }).join("");
  let details = `<p class="muted">Choose a product type to see costs, time and pricing.</p>`;
  if (w.type) {
    const cfg = PRODUCT_TYPES[w.type];
    const ref = refPrice(s, w.type, w.topic);
    const hours = devHoursFor(s, w.type, w.effort, w.topic);
    const cost = setupCostFor(s, w.type, w.topic);
    const q = expectedQuality(s, w.type, w.effort);
    const proven = isProvenTopic(s, w.topic);
    const hb = hoursBreakdown(s);
    const perDay = Math.max(1, hb.available - hb.planned + (s.plan.posts * postHours(s)) / 2);
    const days = Math.max(1, Math.ceil(hours / perDay));
    const steps = priceSteps(w.type);
    const idx = Math.max(0, steps.findIndex((x) => x >= w.price));
    const priceRatio = w.price === 0 ? 0 : w.price / ref;
    const priceHint =
      w.price === 0
        ? "Free: grows your email list fast, no revenue."
        : priceRatio < 0.6
          ? "Very cheap: more buyers, thin margins."
          : priceRatio < 0.9
            ? "Below market: easy to buy."
            : priceRatio <= 1.2
              ? "Market rate for this niche."
              : priceRatio <= 1.8
                ? "Premium: fewer buyers, needs trust and quality."
                : "Very expensive: few will buy.";
    details = `
      <h3>Topic</h3>
      <div class="chip-row">${Object.values(TOPICS)
        .filter((t) => PATHS[s.path].topics.includes(t.id) || s.products.some((p) => p.topic === t.id))
        .map((t) => `<button class="chip ${w.topic === t.id ? "selected" : ""}" data-act="wiz-topic" data-id="${t.id}">${t.label}${t.id === s.niche ? " ★" : ""}${isProvenTopic(s, t.id) ? " ✓" : ""}</button>`)
        .join("")}</div>
      ${proven ? `<p class="good-note">✓ Proven topic: 30% cheaper and faster to build, with extra demand.</p>` : w.topic !== s.niche ? `<p class="warn-note">Off-niche: your audience is less interested in this topic.</p>` : ""}
      <h3>Price <small class="muted">market rate ≈ ${naira(ref)}${cfg.priceUnit}</small></h3>
      <div class="price-row">
        <input type="range" min="0" max="${steps.length - 1}" step="1" value="${idx}" data-act="wiz-price" aria-label="Price" />
        <b class="price-val">${w.price === 0 ? "Free" : naira(w.price) + cfg.priceUnit}</b>
      </div>
      <p class="fine">${priceHint}</p>
      <h3>Effort</h3>
      <div class="seg">
        <button class="${w.effort === "standard" ? "selected" : ""}" data-act="wiz-effort" data-id="standard">Standard</button>
        <button class="${w.effort === "premium" ? "selected" : ""}" data-act="wiz-effort" data-id="premium">Premium (+50% time, higher quality)</button>
      </div>
      <div class="summary-grid">
        ${stat("Setup cost", naira(cost), s.cash < cost ? "not enough cash" : "paid now", s.cash < cost ? "neg" : "")}
        ${stat("Build time", `${hours}h`, `≈ ${days} day${days > 1 ? "s" : ""}`)}
        ${stat("Expected quality", qualityLabel(q), stars(q))}
        ${stat("Fulfilment", cfg.label, cfg.fulfilment)}
      </div>
      <p class="fine">⚖️ ${cfg.tradeoff}${w.type === "event" ? ` Seats: ${eventCapacity(s)}. Sales open for ${EVENT_SALES_DAYS} days after launch.` : ""}</p>
      <h3>Name <small class="muted">(optional)</small></h3>
      <input class="text-input" id="wiz-name" maxlength="40" placeholder="Auto-named if empty" value="${esc(w.name)}" data-act="wiz-name" />
      <button class="btn primary wide big" data-act="wiz-create" ${s.cash < cost ? "disabled" : ""} id="wiz-create">Start building · ${naira(cost)}</button>`;
  }
  return `${head("New product", "Turn what you know into something people can buy", "products")}
  <div class="panel-body">
    <div class="type-grid">${typeCards}</div>
    ${details}
  </div>`;
}

function marketingPanel(s: GameState): string {
  const f = forecastDay(s);
  const live = s.products.filter((p) => p.status === "live");
  const paidLive = live.filter((p) => p.price > 0);
  const maxAd = Math.max(0, Math.floor((s.cash - BALANCE.dailyDataCost) / 500) * 500);
  const adSteps = adBudgetSteps(maxAd);
  const adIdx = Math.max(0, adSteps.findIndex((x) => x >= s.plan.adBudget));
  const coaching = live.some((p) => p.type === "coaching");
  const hb = hoursBreakdown(s);
  return `${head("📣 Marketing", "Bring the right people to your store")}
  <div class="panel-body">
    <div class="forecast">
      <div><small>Forecast today</small><b>${num(f.totalVisitors)} visitors</b></div>
      <div><small>Expected sales</small><b>${Object.values(f.sales).reduce((a, b) => a + b, 0).toFixed(1)}</b></div>
      <div><small>Expected revenue</small><b>${naira(f.revenue, { compact: true })}</b></div>
    </div>
    ${!paidLive.length ? `<p class="warn-note">You have no paid products on sale yet. Marketing will grow your audience but won't make sales.</p>` : ""}

    <h3>⭐ Featured product</h3>
    <div class="chip-row">${live.length ? live.map((p) => `<button class="chip ${s.plan.featuredProductId === p.id ? "selected" : ""}" data-act="feature" data-id="${p.id}">${PRODUCT_TYPES[p.type].icon} ${esc(p.name)}</button>`).join("") : `<span class="muted">Launch a product first.</span>`}</div>
    <p class="fine">Your featured product gets full attention from posts and ads; others get about a third.</p>

    <div class="channel">
      <div class="ch-head"><b>🎯 Paid ads</b><span class="muted">${naira(s.plan.adBudget)} today</span></div>
      <input type="range" min="0" max="${adSteps.length - 1}" step="1" value="${adIdx}" data-act="plan-ad" aria-label="Ad budget" ${maxAd <= 0 ? "disabled" : ""} />
      <div class="ch-meta"><span>Cost per 1,000 views: ${naira(cpm(s))}</span><span>Visitor fit: ${pct(adFit(s))}</span><span>≈ ${num(f.visitors.ads)} visitors · ≈ ${naira(f.adRevenue, { compact: true })} sales</span></div>
      <p class="fine">Fast and scalable, but cold traffic converts poorly and ads tire. Returns fall as budgets grow.</p>
    </div>

    <div class="channel">
      <div class="ch-head"><b>📧 Email</b><label class="switch"><input type="checkbox" data-act="plan-toggle" data-key="email" ${s.plan.email ? "checked" : ""} ${s.emailList <= 0 ? "disabled" : ""}/><span></span></label></div>
      <div class="ch-meta"><span>${num(s.emailList)} subscribers</span><span>Freshness ${pct(s.emailFreshness)}</span><span>${emailSendCost(s) ? `${naira(emailSendCost(s))} per send` : "Free under 500 subs"}</span><span>${BALANCE.emailHours}h</span></div>
      ${bar(s.emailFreshness, "fresh")}
      <p class="fine">Your most loyal traffic. Sending every day tires readers. Free products and buyers grow the list.</p>
    </div>

    <div class="channel">
      <div class="ch-head"><b>🤝 Affiliates</b><label class="switch"><input type="checkbox" data-act="plan-toggle" data-key="affiliateOn" ${s.plan.affiliateOn ? "checked" : ""}/><span></span></label></div>
      <div class="ch-meta"><span>${s.affiliates} active promoters</span><span>Commission ${pct(s.plan.affiliateCommission)}</span><span>≈ ${num(f.visitors.affiliate)} visitors</span></div>
      <input type="range" min="10" max="60" step="5" value="${Math.round(s.plan.affiliateCommission * 100)}" data-act="plan-commission" aria-label="Affiliate commission" />
      <p class="fine">Promoters share your products for a cut of each sale. Higher commission recruits faster; reputation and proven sales attract more.</p>
    </div>

    ${
      coaching
        ? `<div class="channel">
      <div class="ch-head"><b>🤝 Coaching slots today</b><span class="muted">${s.plan.coachingSlots} × 2h</span></div>
      <div class="stepper"><button class="btn small" data-act="plan-step" data-key="coachingSlots" data-dir="-1">−</button><span>${s.plan.coachingSlots}</span><button class="btn small" data-act="plan-step" data-key="coachingSlots" data-dir="1">+</button></div>
      <p class="fine">Sessions you can sell today. Unbooked slots still block your time. ${hb.free.toFixed(1)}h free.</p>
    </div>`
        : ""
    }
    <h3>Audience</h3>
    <div class="stat-grid">
      ${stat("Followers", num(s.audience), `+${num(f.followers)} today (est.)`)}
      ${stat("Audience fit", pct(s.audienceFit), "how relevant they are")}
      ${stat("Reputation", `${Math.round(s.reputation)}/100`)}
      ${stat("Satisfaction", `${Math.round(s.satisfaction)}/100`)}
    </div>
    ${bar(s.audienceFit, "fit")}
    <p class="fine">A small, relevant audience can out-earn a big, random one. Organic posts and email raise fit; broad ads and viral spikes dilute it.</p>
  </div>`;
}

export function adBudgetSteps(max: number): number[] {
  const steps = [0];
  let v = 500;
  while (v <= max) {
    steps.push(v);
    v += v < 5_000 ? 500 : v < 20_000 ? 1_000 : v < 100_000 ? 5_000 : 25_000;
  }
  return steps;
}

function contentPanel(s: GameState): string {
  const hb = hoursBreakdown(s);
  const f = forecastDay(s);
  const seg = (h: number, cls: string, label: string) => (h > 0 ? `<span class="${cls}" style="flex:${h}" title="${label}: ${h.toFixed(1)}h"></span>` : "");
  const eventToday = s.products.some((p) => p.type === "event" && p.status === "live" && p.eventDay === s.day);
  return `${head("🎥 Create & plan your day", `${hb.available}h available today`)}
  <div class="panel-body">
    <div class="hours-bar">
      ${seg(hb.upkeep, "h-up", "Upkeep & support")}${seg(hb.content, "h-ct", "Content")}${seg(hb.email + hb.coaching, "h-mk", "Email & coaching")}${seg(hb.sideGig, "h-sg", "Side gig")}${seg(hb.committed, "h-cm", "Committed")}${seg(hb.free, "h-free", "Free → building products")}
    </div>
    <div class="legend"><span class="lg h-up"></span>Upkeep <span class="lg h-ct"></span>Content <span class="lg h-mk"></span>Email/coaching <span class="lg h-sg"></span>Gig <span class="lg h-free"></span>Free (builds products)</div>

    <div class="channel">
      <div class="ch-head"><b>📱 Organic posts today</b><span class="muted">${postHours(s)}h each · ${naira(BALANCE.postDataCost)} data</span></div>
      <div class="post-picker">${[0, 1, 2, 3].map((n) => `<button class="${s.plan.posts === n ? "selected" : ""}" data-act="plan-set" data-key="posts" data-val="${n}" ${s.plan.rest ? "disabled" : ""}>${n}</button>`).join("")}</div>
      <div class="ch-meta"><span>Content quality ${pct(contentQuality(s))}</span><span>≈ ${num(f.visitors.organic)} visitors</span><span>≈ +${num(f.followers)} followers</span></div>
      <p class="fine">Free reach that builds a relevant audience. Better gear improves quality and reach.</p>
    </div>

    <div class="toggle-list">
      <label class="toggle-row"><div><b>💪 Hustle mode</b><small>+${BALANCE.hustleHours} hours today, −${BALANCE.hustleWellbeingCost} wellbeing</small></div><span class="switch"><input type="checkbox" data-act="plan-toggle" data-key="hustle" ${s.plan.hustle ? "checked" : ""} ${s.plan.rest ? "disabled" : ""}/><span></span></span></label>
      <label class="toggle-row"><div><b>🧰 Side gig</b><small>${BALANCE.sideGigHours}h of freelance work for ${naira(sideGigPay(s))} cash today</small></div><span class="switch"><input type="checkbox" data-act="plan-toggle" data-key="sideGig" ${s.plan.sideGig ? "checked" : ""} ${s.plan.rest ? "disabled" : ""}/><span></span></span></label>
      <label class="toggle-row"><div><b>😴 Rest day</b><small>No work today, +${BALANCE.restWellbeingGain} wellbeing. Ads and affiliates keep running.</small></div><span class="switch"><input type="checkbox" data-act="plan-toggle" data-key="rest" ${s.plan.rest ? "checked" : ""} ${eventToday ? "disabled" : ""}/><span></span></span></label>
    </div>
    <div class="wellbeing">⚡ Wellbeing ${s.wellbeing}/100 ${bar(s.wellbeing / 100, s.wellbeing < 35 ? "low" : "ok")}<p class="fine">Below 35 you lose hours and quality. Rest and the planning board help you recover.</p></div>
  </div>`;
}

function upgradesPanel(s: GameState): string {
  const cats: [string, string][] = [
    ["workspace", "🏠 Workspace"],
    ["productivity", "⏱ Productivity"],
    ["quality", "🎬 Product & content quality"],
    ["marketing", "📣 Marketing"],
    ["support", "🎧 Customer support"],
  ];
  return `${head("🛠️ Studio upgrades", "Invest in your setup. Every upgrade changes the simulation and your studio.")}
  <div class="panel-body">
    ${cats
      .map(([cat, label]) => {
        const list = UPGRADES.filter((u) => u.category === cat);
        return `<h3>${label}</h3>${list
          .map((u) => {
            const owned = s.upgrades.includes(u.id);
            const locked = s.rank < u.minRank;
            const afford = s.cash >= u.cost;
            return `<div class="upgrade ${owned ? "owned" : ""} ${locked ? "locked" : ""}">
              <div class="up-ico">${u.icon}</div>
              <div class="up-body"><b>${u.name}</b><small>${u.description}</small><div class="up-eff">${u.effectText}</div></div>
              <div class="up-buy">${
                owned
                  ? `<span class="tag good">Owned ✓</span>`
                  : locked
                    ? `<span class="tag">🔒 ${RANKS[u.minRank]!.name}</span>`
                    : `<button class="btn small ${afford ? "primary" : ""}" data-act="buy" data-id="${u.id}" ${afford ? "" : "disabled"}>${naira(u.cost, { compact: true })}</button>`
              }</div>
            </div>`;
          })
          .join("")}`;
      })
      .join("")}
  </div>`;
}

function goalsPanel(s: GameState): string {
  const active = activeObjectives(s);
  const done = s.objectives.filter((o) => o.done);
  const w = winCheck(s);
  const rev = netRevenue(s);
  return `${head("📋 Plans & goals", `${s.campaignDays - s.day + 1} days left`)}
  <div class="panel-body">
    <h3>🏁 To win the campaign by day ${s.campaignDays}</h3>
    <div class="checklist">
      <div class="${w.rankOk ? "ok" : ""}">${w.rankOk ? "✅" : "⬜"} Reach <b>${RANKS[BALANCE.winMinRank]!.name}</b> (${naira(RANKS[BALANCE.winMinRank]!.threshold)} revenue)</div>
      <div class="${w.profitOk ? "ok" : ""}">${w.profitOk ? "✅" : "⬜"} Finish with a <b>net profit</b> (now ${naira(netProfit(s))})</div>
      <div class="${w.satisfactionOk ? "ok" : ""}">${w.satisfactionOk ? "✅" : "⬜"} Customer satisfaction of <b>${BALANCE.winMinSatisfaction}+</b> (now ${Math.round(s.satisfaction)})</div>
      <div>⚠️ Don't let cash stay negative for ${BALANCE.insolvencyDays} days in a row.</div>
    </div>
    <h3>🎯 Current objectives</h3>
    ${active.length ? active.map((o) => { const d = OBJECTIVE_BY_ID[o.id]!; return `<div class="objective"><b>${d.title}</b><small>${d.description}</small><span class="reward">🎁 ${d.rewardText}</span></div>`; }).join("") : `<p class="muted">All objectives complete. Impressive!</p>`}
    <h3>🪜 Creator ranks</h3>
    <div class="ranks">${RANKS.map(
      (r, i) => `<div class="rank-row ${i === s.rank ? "current" : i < s.rank ? "done" : ""}"><span>${r.icon} ${r.name}</span><small>${i === 0 ? "Start" : naira(r.threshold, { compact: true })}</small></div>`,
    ).join("")}</div>
    <p class="fine">Revenue so far: ${naira(rev)}. Ranks unlock products and upgrades and change your studio.</p>
    ${done.length ? `<details class="past"><summary>Completed objectives (${done.length})</summary>${done.map((o) => `<div class="objective done"><b>✅ ${OBJECTIVE_BY_ID[o.id]!.title}</b><small>Day ${o.doneDay}</small></div>`).join("")}</details>` : ""}
    <button class="btn wide" data-act="open" data-panel="stories">📖 Creator Stories (${s.storiesUnlocked.length}/${STORIES.length})</button>
  </div>`;
}

export function storyCard(id: string): string {
  const st = STORY_BY_ID[id]!;
  return `<div class="story-card">
    <div class="story-label">Fictional creator story</div>
    <h3>${st.title}</h3>
    <div class="story-char">${st.character}</div>
    <p>${st.story}</p>
    <div class="story-lesson">💡 ${st.lesson}</div>
    <div class="story-tip">🎮 ${st.tip}</div>
  </div>`;
}

function storiesPanel(s: GameState): string {
  return `${head("📖 Creator Stories", "Short lessons that unlock as you play", "goals")}
  <div class="panel-body">
    <p class="fine">These are original, fictional composite stories inspired by patterns in published accounts of Nigerian creators. They are not about real people. Sources are documented in the project's research folder.</p>
    ${STORIES.map((st) => (s.storiesUnlocked.includes(st.id) ? storyCard(st.id) : `<div class="story-card locked"><div class="story-label">Locked</div><h3>🔒 ${st.title}</h3><p class="muted">Keep playing to unlock this story.</p></div>`)).join("")}
  </div>`;
}

function menuPanel(st: Settings): string {
  return `${head("⏸ Paused")}
  <div class="panel-body">
    <button class="btn primary wide big" data-act="close">▶ Resume</button>
    <h3>Settings</h3>
    <div class="toggle-list">
      <label class="toggle-row"><div><b>🔊 Sound effects</b></div><span class="switch"><input type="checkbox" data-act="setting" data-key="sound" ${st.sound ? "checked" : ""}/><span></span></span></label>
      <label class="toggle-row"><div><b>✨ High graphics quality</b><small>Shadows and sharper rendering. Turn off on slower phones.</small></div><span class="switch"><input type="checkbox" data-act="setting" data-key="quality" ${st.quality === "high" ? "checked" : ""}/><span></span></span></label>
      <label class="toggle-row"><div><b>👆 Simplified mode</b><small>Hides the floating studio labels; manage everything from the buttons.</small></div><span class="switch"><input type="checkbox" data-act="setting" data-key="simplified" ${st.simplified ? "checked" : ""}/><span></span></span></label>
      <label class="toggle-row"><div><b>🐢 Reduced motion</b><small>Fewer particles and shorter transitions.</small></div><span class="switch"><input type="checkbox" data-act="setting" data-key="reducedMotion" ${st.reducedMotion ? "checked" : ""}/><span></span></span></label>
    </div>
    <h3>Game</h3>
    <button class="btn wide" data-act="open" data-panel="help">❓ How to play</button>
    <button class="btn wide" data-act="open" data-panel="stories">📖 Creator Stories</button>
    <button class="btn wide" data-act="save-quit">💾 Save & return to title</button>
    <button class="btn wide danger" data-act="restart">↺ Abandon & start a new campaign</button>
    <p class="fine">Your progress saves automatically on this device after every action.</p>
  </div>`;
}

export function helpPanel(): string {
  return `${head("❓ How to play")}
  <div class="panel-body help">
    <p><b>Goal:</b> in ${BALANCE.campaignDays} days, grow from ${naira(BALANCE.startingCash)} into a profitable creator business. Revenue alone isn't enough: you need profit and happy customers.</p>
    <ol>
      <li><b>Create a product</b> (📦 or tap the laptop). Pick a type, topic and price. Products take hours to build.</li>
      <li><b>Plan your day</b> (🎥 or tap the tripod). Posts grow a relevant audience. Leftover hours build your products.</li>
      <li><b>Market</b> (📣 or tap the phone). Ads buy traffic, email converts best, affiliates promote for a commission.</li>
      <li><b>End the day</b>. Read the report: visitors, sales, refunds, costs and cash.</li>
      <li><b>Reinvest</b> (🛠️ or tap the shelf) in upgrades that improve quality, hours and marketing, and change your studio.</li>
      <li><b>Handle events</b>: power cuts, viral posts, refunds, competitors. Every event has an option that costs no cash.</li>
    </ol>
    <h3>Key ideas</h3>
    <ul>
      <li>💸 <b>Revenue isn't cash.</b> Sales settle into cash the next day (sometimes later). Plan spending around it.</li>
      <li>🎯 <b>Fit beats size.</b> A relevant audience converts far better than a big random one.</li>
      <li>⏱ <b>Time is your scarcest resource.</b> Coaching, communities and events all need hours.</li>
      <li>🔁 <b>Diversify on a proven topic.</b> Once a product sells 10 times, related products are cheaper, faster and in more demand.</li>
      <li>😊 <b>Quality and care</b> lower refunds and raise reputation, which lifts every future sale.</li>
      <li>⚡ <b>Rest.</b> Low wellbeing quietly costs hours and quality.</li>
    </ul>
    <h3>Ranks</h3>
    <p>${RANKS.map((r) => `${r.icon} ${r.name}${r.threshold ? ` (${naira(r.threshold, { compact: true })})` : ""}`).join(" → ")}</p>
  </div>`;
}

// ---------------------------------------------------------------- Modals

export function eventModal(s: GameState): string {
  const ev = s.pendingEvent!;
  const hb = hoursBreakdown(s);
  return `<div class="modal event-modal pop-in" role="dialog" aria-modal="true" aria-labelledby="ev-title">
    <div class="modal-kicker">Day ${s.day} · Something happened</div>
    <h2 id="ev-title">${ev.title}</h2>
    <p>${esc(ev.description)}</p>
    <div class="choices">${ev.choices
      .map((c) => {
        const tooPoor = c.cost > 0 && c.cost > s.cash;
        const noTime = (c.hoursCost ?? 0) > hb.free;
        return `<button class="choice" data-act="event-choice" data-id="${c.id}" ${tooPoor || noTime ? "disabled" : ""}>
          <b>${c.label}</b><small>${c.description}</small>
          <span class="choice-cost">${c.cost ? naira(c.cost) : "No cost"}${c.hoursCost ? ` · ${c.hoursCost}h` : ""}${tooPoor ? " · can't afford" : noTime ? " · not enough free hours" : ""}</span>
        </button>`;
      })
      .join("")}</div>
  </div>`;
}

export function reportModal(r: DayReport, s: GameState): string {
  const sales = Object.entries(r.salesByProduct);
  const productName = (id: string) => s.products.find((p) => p.id === id)?.name ?? id;
  const totalSales = sales.reduce((a, [id, n]) => a + (s.products.find((p) => p.id === id)?.price ? n : 0), 0);
  const visitors = Object.values(r.visitors).reduce((a, b) => a + b, 0);
  return `<div class="modal report-modal pop-in" role="dialog" aria-modal="true" aria-labelledby="rep-title">
    <div class="modal-kicker">End of day ${r.day}</div>
    <h2 id="rep-title">${r.netProfit >= 0 ? "📈" : "📉"} ${r.netProfit >= 0 ? "Profitable day" : "Loss-making day"}: ${naira(r.netProfit, { sign: true })}</h2>
    <div class="stat-grid">
      ${stat("Revenue", naira(r.grossRevenue), `${totalSales} sale${totalSales === 1 ? "" : "s"}`)}
      ${stat("Costs", naira(r.operatingCosts + r.directCosts + r.paymentFees + r.affiliateCommissions), r.adSpend ? `ads ${naira(r.adSpend, { compact: true })}` : "")}
      ${stat("Cash", naira(r.cashEnd), r.payoutsReleased ? `+${naira(r.payoutsReleased, { compact: true })} paid out` : "", r.cashEnd < 0 ? "neg" : "")}
      ${stat("Visitors", num(visitors), `+${num(r.newFollowers)} followers`)}
    </div>
    ${
      sales.length
        ? `<h3>Sales</h3><table class="tbl">${sales
            .map(([id, n]) => `<tr><td>${esc(productName(id))}</td><td class="r">${n}${s.products.find((p) => p.id === id)?.price === 0 ? " downloads" : ""}</td><td class="r">${naira(r.revenueByProduct[id] ?? 0, { compact: true })}</td></tr>`)
            .join("")}</table>`
        : `<p class="muted">No sales today.${s.products.some((p) => p.status === "live" && p.price > 0) ? " Try more posts, email, or a better-fitting price." : ""}</p>`
    }
    <div class="report-lines">
      ${r.refunds ? `<div class="neg">↩️ Refunds: ${naira(-r.refunds)}</div>` : ""}
      ${r.otherIncome ? `<div class="pos">💼 Other income: ${naira(r.otherIncome)}</div>` : ""}
      ${r.investments ? `<div>🛠️ Invested: ${naira(r.investments)}</div>` : ""}
      ${r.newSubscribers ? `<div>📧 +${r.newSubscribers} subscribers (${num(r.emailListEnd)})</div>` : ""}
      ${r.missedCoachingDemand ? `<div class="warn">🤝 ${r.missedCoachingDemand} coaching request(s) missed: no free slots.</div>` : ""}
      ${r.notes.map((n) => `<div>• ${esc(n)}</div>`).join("")}
    </div>
    <button class="btn primary wide big" data-act="dismiss-modal">${s.phase === "ended" ? "See results →" : `Start day ${s.day} ☀️`}</button>
  </div>`;
}

export function inboxModal(item: { kind: string; title: string; body: string; id: string }): string {
  const isRank = item.kind === "rank";
  const isStory = item.kind === "story";
  return `<div class="modal inbox-modal ${isRank ? "rank-modal" : ""} pop-in" role="dialog" aria-modal="true">
    ${isRank ? `<div class="rank-burst">${RANKS.find((r) => r.id === item.id)?.icon ?? "🏆"}</div>` : ""}
    <div class="modal-kicker">${isRank ? "Rank up!" : item.kind === "objective" ? "Objective complete" : item.kind === "milestone" ? "Milestone" : isStory ? "New Creator Story" : "Update"}</div>
    ${isStory ? storyCard(item.id) : `<h2>${esc(item.title)}</h2><p>${esc(item.body)}</p>`}
    <button class="btn primary wide" data-act="dismiss-modal">${isRank ? "Let's go! 🚀" : "Nice"}</button>
  </div>`;
}

export function confirmModal(text: string, act: string, id = ""): string {
  return `<div class="modal pop-in" role="dialog" aria-modal="true"><h2>Are you sure?</h2><p>${esc(text)}</p>
    <div class="btn-row"><button class="btn" data-act="dismiss-modal">Cancel</button><button class="btn danger" data-act="${act}" data-id="${id}">Yes</button></div></div>`;
}

// ---------------------------------------------------------------- Results

export function resultsScreen(s: GameState, sc: ScoreBreakdown, board: ScoreEntry[], boardLabel: string): string {
  const w = winCheck(s);
  const title =
    s.outcome === "win" ? "You built a real creator business! 🎉" : s.outcome === "insolvent" ? "The business ran out of cash" : "You survived the 30 days";
  const sub =
    s.outcome === "win"
      ? "Profitable, growing and loved by customers."
      : s.outcome === "insolvent"
        ? `Cash stayed negative for ${BALANCE.insolvencyDays} days. Every creator story has setbacks. Try a leaner start.`
        : "Close! Check which win conditions you missed below and try a different strategy.";
  const rows: [string, number][] = [
    ["Profit", sc.profit],
    ["Revenue", sc.revenue],
    ["Audience growth", sc.audience],
    ["Reputation", sc.reputation],
    ["Satisfaction", sc.satisfaction],
    ["Objectives", sc.objectives],
    ["Rank", sc.rank],
    ["Outcome", sc.outcomeBonus],
  ];
  const best = [...s.products].sort((a, b) => b.revenue - a.revenue)[0];
  return `<div class="screen results-screen">
    <div class="results-card pop-in">
      <div class="grade grade-${sc.grade}">${sc.grade}</div>
      <h1>${title}</h1>
      <p class="muted">${sub}</p>
      <div class="checklist">
        <div class="${w.rankOk ? "ok" : ""}">${w.rankOk ? "✅" : "❌"} Rank: ${RANKS[s.rank]!.icon} ${RANKS[s.rank]!.name}</div>
        <div class="${w.profitOk ? "ok" : ""}">${w.profitOk ? "✅" : "❌"} Net profit: ${naira(netProfit(s))}</div>
        <div class="${w.satisfactionOk ? "ok" : ""}">${w.satisfactionOk ? "✅" : "❌"} Satisfaction: ${Math.round(s.satisfaction)}</div>
      </div>
      <div class="stat-grid">
        ${stat("Revenue", naira(netRevenue(s), { compact: true }), `${s.totals.sales} sales`)}
        ${stat("Final cash", naira(s.cash, { compact: true }))}
        ${stat("Audience", num(s.audience), `fit ${pct(s.audienceFit)}`)}
        ${stat("Email list", num(s.emailList))}
        ${stat("Reputation", `${Math.round(s.reputation)}`)}
        ${stat("Best product", best ? esc(best.name) : "—", best ? naira(best.revenue, { compact: true }) : "")}
      </div>
      <h3>Score: ${num(sc.total)}</h3>
      <table class="tbl">${rows.map(([k, v]) => `<tr><td>${k}</td><td class="r ${v < 0 ? "neg" : ""}">${v >= 0 ? "+" : ""}${num(v)}</td></tr>`).join("")}</table>
      <h3>🏆 ${esc(boardLabel)}</h3>
      <p class="fine">Scores are saved on this device only. They are not an official platform leaderboard.</p>
      <table class="tbl">${board.map((b, i) => `<tr><td>${i + 1}. ${esc(b.name)} <small class="muted">${esc(b.path)}</small></td><td class="r">${num(b.score)} (${esc(b.grade)})</td></tr>`).join("")}</table>
      <div class="btn-row">
        <button class="btn primary big" data-act="replay">↺ Play again</button>
        <button class="btn" data-act="to-title">Title screen</button>
      </div>
    </div>
  </div>`;
}

export function tutorialCard(step: { title: string; body: string; target?: string; canNext: boolean }, index: number, total: number): string {
  return `<div class="tutorial pop-in" role="status">
    <div class="tut-step">Tutorial ${index + 1}/${total}</div>
    <b>${step.title}</b>
    <p>${step.body}</p>
    <div class="btn-row">
      <button class="btn small ghost" data-act="tut-skip">Skip tutorial</button>
      ${step.canNext ? `<button class="btn small primary" data-act="tut-next">${index + 1 === total ? "Let's go!" : "Next"}</button>` : ""}
    </div>
  </div>`;
}
