// App controller: owns the game state, routes screens, dispatches actions to the
// engine, persists after every change and keeps the 3D scene in sync.

import { PATHS } from "../config/paths";
import { PRODUCT_TYPES } from "../config/products";
import { applyAction } from "../engine/actions";
import { refPrice } from "../engine/economy";
import { randomSeed } from "../engine/rng";
import { computeScore } from "../engine/scoring";
import { cloneState, createNewGame } from "../engine/state";
import type { Action, GameState, InboxItem, PathId } from "../engine/types";
import { clearSave, loadGame, loadSettings, saveGame, saveSettings, type Settings } from "../persistence/save";
import { createPlatform, type PlatformAdapter, type ScoreEntry } from "../platform/platform";
import type { GameScene } from "../render/scene";
import type { InteractId } from "../render/studio";
import { Audio } from "./audio";
import { esc } from "./format";
import {
  adBudgetSteps,
  confirmModal,
  defaultWizard,
  dock,
  eventModal,
  helpPanel,
  hud,
  inboxModal,
  panel,
  priceSteps,
  reportModal,
  resultsScreen,
  setupScreen,
  titleScreen,
  tutorialCard,
  type PanelId,
  type SetupDraft,
  type WizardDraft,
} from "./views";

type Screen = "title" | "setup" | "game" | "results";

interface ModalEntry {
  html: () => string;
  blocking?: boolean; // event decisions can't be dismissed
  onDismiss?: () => void;
}

const INTERACT_PANEL: Record<InteractId, PanelId> = {
  laptop: "products",
  board: "goals",
  camera: "content",
  upgrades: "upgrades",
  phone: "marketing",
};
const PANEL_SPOT: Partial<Record<PanelId, "desk" | "board" | "camera" | "upgrades" | "phone">> = {
  products: "desk",
  newProduct: "desk",
  dashboard: "desk",
  goals: "board",
  stories: "board",
  content: "camera",
  upgrades: "upgrades",
  marketing: "phone",
};

const TUTORIAL = [
  { id: "welcome", title: "Welcome to your studio 👋", body: "", canNext: true, target: "" },
  {
    id: "product",
    title: "Create your first product",
    body: "Tap the 💻 laptop or <b>📦 Products</b>, then <b>Create a new product</b>. An ebook or template is a cheap, fast start.",
    canNext: false,
    target: "dock-products",
  },
  {
    id: "plan",
    title: "Plan your day",
    body: "Tap the 🎥 tripod or <b>Create</b>. Posts grow a relevant audience. Hours you don't use build your product.",
    canNext: true,
    target: "dock-content",
  },
  {
    id: "end",
    title: "End the day",
    body: "When you're happy with your plan, press <b>End day</b>. The simulation runs and you'll get a report.",
    canNext: false,
    target: "end-day-btn",
  },
  {
    id: "done",
    title: "You're on your way 🚀",
    body: "Keep launching, marketing and reinvesting. Check <b>📋 Goals</b> for objectives and win conditions, and <b>📊 Stats</b> for your numbers. Good luck!",
    canNext: true,
    target: "",
  },
];

export class App {
  private state: GameState | null = null;
  private screen: Screen = "title";
  private panelId: PanelId | null = null;
  private modals: ModalEntry[] = [];
  private settings: Settings = loadSettings();
  private platform: PlatformAdapter = createPlatform();
  private audio = new Audio();
  private scene: GameScene | null = null;
  private busy = false;
  private wizard: WizardDraft = { type: null, topic: "", price: 0, effort: "standard", name: "" };
  private setup: SetupDraft = { step: 0, path: "knowledge", niche: "career", name: "", skin: 2, outfit: 0, hair: 0 };
  private saveMsg: string | null = null;
  private tutStep = -1;
  private board: ScoreEntry[] = [];
  private toastTimer = 0;
  private pinEls = new Map<InteractId, HTMLButtonElement>();

  private el = {
    root: document.getElementById("app")!,
    scene: document.getElementById("scene")!,
    pins: document.getElementById("pins")!,
    hud: document.getElementById("hud")!,
    dock: document.getElementById("dock")!,
    panel: document.getElementById("panel")!,
    modal: document.getElementById("modal")!,
    screen: document.getElementById("screen")!,
    toast: document.getElementById("toast")!,
    tutorial: document.getElementById("tutorial")!,
    loader: document.getElementById("loader"),
  };

  async start(): Promise<void> {
    this.audio.enabled = this.settings.sound;
    document.addEventListener("click", (e) => this.onClick(e));
    document.addEventListener("input", (e) => this.onInput(e));
    document.addEventListener("change", (e) => this.onChange(e));
    document.addEventListener("keydown", (e) => this.onKey(e));
    document.addEventListener("pointerdown", () => this.audio.unlock(), { once: true });
    this.platform.onPause(() => {
      this.audio.pause();
      this.scene?.setPaused(true);
    });
    this.platform.onResume(() => {
      this.audio.resume();
      this.scene?.setPaused(false);
    });
    await this.platform.init().catch(() => ({ playerName: null }));
    this.board = await this.platform.leaderboard().catch(() => []);

    // The 3D scene is loaded lazily so the title screen appears immediately.
    try {
      const { GameScene } = await import("../render/scene");
      this.scene = new GameScene(this.el.scene);
      this.scene.setQuality(this.settings.quality);
      this.scene.setReducedMotion(this.settings.reducedMotion);
      this.scene.onInteract = (id) => this.interact(id);
      this.scene.onFrame = () => this.updatePins();
      this.scene.setState(createNewGame({ seed: 1, path: "knowledge" }));
      this.scene.start();
    } catch (err) {
      console.error(err);
      this.toast("3D graphics are unavailable on this device. The game still works in simplified mode.");
      this.settings.simplified = true;
    }
    this.el.loader?.remove();

    const saved = loadGame();
    if (saved.status === "invalid" || saved.status === "outdated") {
      this.saveMsg = `${saved.message} A new campaign is needed.`;
      clearSave();
    }
    if (saved.state && saved.state.phase === "ended") {
      // Finished campaigns aren't resumable; show the title screen.
      clearSave();
    }
    this.render();
  }

  // ------------------------------------------------------------------ helpers

  private get s(): GameState {
    return this.state!;
  }

  private hasResumable(): boolean {
    const r = loadGame();
    return r.status === "ok" && !!r.state && r.state.phase === "planning";
  }

  private dispatch(action: Action, quiet = false): boolean {
    if (!this.state) return false;
    const r = applyAction(this.state, action);
    if (!r.ok) {
      if (!quiet) {
        this.toast(r.error ?? "That didn't work.");
        this.audio.play("error");
      }
      return false;
    }
    this.state = r.state;
    saveGame(this.state);
    this.scene?.setState(this.state);
    return true;
  }

  private toast(msg: string): void {
    this.el.toast.innerHTML = esc(msg);
    this.el.toast.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.el.toast.classList.remove("show"), 2600);
  }

  // ------------------------------------------------------------------ rendering

  private render(): void {
    const root = this.el.root;
    root.dataset.screen = this.screen;
    root.classList.toggle("simplified", this.settings.simplified);
    root.classList.toggle("panel-open", !!this.panelId && this.screen === "game");
    root.classList.toggle("modal-open", this.modals.length > 0);

    if (this.screen === "title") {
      this.el.screen.innerHTML = titleScreen(this.hasResumable(), this.saveMsg, this.board);
      this.el.hud.innerHTML = "";
      this.el.dock.innerHTML = "";
      this.el.panel.innerHTML = this.panelId === "help" ? helpPanel() : "";
      this.el.panel.classList.toggle("open", this.panelId === "help");
    } else if (this.screen === "setup") {
      this.el.screen.innerHTML = setupScreen(this.setup);
      this.el.hud.innerHTML = "";
      this.el.dock.innerHTML = "";
      this.el.panel.innerHTML = "";
      this.el.panel.classList.remove("open");
    } else if (this.screen === "results") {
      const sc = computeScore(this.s);
      this.el.screen.innerHTML = resultsScreen(this.s, sc, this.board, this.platform.label);
      this.el.hud.innerHTML = "";
      this.el.dock.innerHTML = "";
      this.el.panel.innerHTML = "";
      this.el.panel.classList.remove("open");
    } else {
      this.el.screen.innerHTML = "";
      this.el.hud.innerHTML = hud(this.s);
      this.el.dock.innerHTML = dock(this.s, this.panelId);
      this.renderPanel();
    }
    this.renderModal();
    this.renderTutorial();
  }

  private renderPanel(): void {
    const body = this.el.panel.querySelector(".panel-body");
    const keepScroll = body && this.el.panel.dataset.panel === this.panelId;
    const scroll = keepScroll ? body.scrollTop : 0;
    if (this.panelId && this.state) {
      this.el.panel.innerHTML = panel(this.panelId, this.s, { wizard: this.wizard, settings: this.settings, productTab: "" });
      this.el.panel.classList.add("open");
      this.el.panel.dataset.panel = this.panelId;
      const nb = this.el.panel.querySelector(".panel-body");
      if (nb) nb.scrollTop = scroll;
    } else {
      this.el.panel.classList.remove("open");
      this.el.panel.dataset.panel = "";
      this.el.panel.innerHTML = "";
    }
  }

  private renderModal(): void {
    const top = this.modals[0];
    if (top) {
      this.el.modal.innerHTML = `<div class="modal-backdrop">${top.html()}</div>`;
      this.el.modal.classList.add("open");
      const focusable = this.el.modal.querySelector<HTMLElement>("button:not([disabled])");
      focusable?.focus({ preventScroll: true });
    } else {
      this.el.modal.innerHTML = "";
      this.el.modal.classList.remove("open");
    }
    this.el.root.classList.toggle("modal-open", this.modals.length > 0);
  }

  private renderTutorial(): void {
    document.querySelectorAll(".tut-target").forEach((e) => e.classList.remove("tut-target"));
    if (this.screen !== "game" || this.tutStep < 0 || !this.state || this.modals.length) {
      this.el.tutorial.innerHTML = "";
      return;
    }
    const step = TUTORIAL[this.tutStep]!;
    const body = step.id === "welcome" ? PATHS[this.s.path].startTip : step.body;
    this.el.tutorial.innerHTML = tutorialCard({ ...step, body }, this.tutStep, TUTORIAL.length);
    if (step.target) document.getElementById(step.target)?.classList.add("tut-target");
  }

  private advanceTutorial(): void {
    if (this.tutStep < 0 || !this.state) return;
    const step = TUTORIAL[this.tutStep]!;
    if (step.id === "product" && this.s.products.length > 0) this.tutStep++;
    else if (step.id === "end" && this.s.day > 1) this.tutStep++;
  }

  private finishTutorial(): void {
    this.tutStep = -1;
    if (this.state && !this.state.tutorialDone) this.dispatch({ type: "completeTutorial" }, true);
  }

  private updatePins(): void {
    if (!this.scene || this.screen !== "game" || this.settings.simplified) {
      if (this.el.pins.childElementCount) this.el.pins.innerHTML = "";
      this.pinEls.clear();
      return;
    }
    for (const p of this.scene.pinPositions()) {
      let el = this.pinEls.get(p.id);
      if (!el) {
        el = document.createElement("button");
        el.className = "pin";
        el.dataset.act = "interact";
        el.dataset.id = p.id;
        el.innerHTML = `<span class="pin-ico">${p.icon}</span><span class="pin-lbl">${p.label}</span>`;
        el.setAttribute("aria-label", p.label);
        this.el.pins.appendChild(el);
        this.pinEls.set(p.id, el);
      }
      el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%)`;
      el.style.display = p.visible ? "" : "none";
    }
  }

  // ------------------------------------------------------------------ flows

  private openPanel(id: PanelId | null): void {
    if (id === "newProduct" && this.panelId !== "newProduct" && this.state) this.wizard = defaultWizard(this.s);
    this.panelId = id;
    this.audio.play(id ? "open" : "click");
    const spot = id ? PANEL_SPOT[id] : undefined;
    if (spot && this.scene) this.scene.goTo(spot);
    this.render();
  }

  private interact(id: InteractId): void {
    if (this.screen !== "game" || this.modals.length) return;
    this.openPanel(INTERACT_PANEL[id]);
  }

  private newCampaign(): void {
    const p = this.setup.path as PathId;
    this.state = createNewGame({
      seed: randomSeed(),
      path: p,
      niche: this.setup.niche,
      creatorName: this.setup.name,
      avatar: { skin: this.setup.skin, outfit: this.setup.outfit, hair: this.setup.hair },
    });
    saveGame(this.state);
    this.scene?.setState(this.state);
    this.scene?.goTo("desk");
    this.screen = "game";
    this.panelId = null;
    this.modals = [];
    this.tutStep = 0;
    this.saveMsg = null;
    this.render();
  }

  private resume(): void {
    const r = loadGame();
    if (r.status !== "ok" || !r.state) {
      this.saveMsg = r.message ?? "No saved campaign found.";
      this.render();
      return;
    }
    this.state = r.state;
    this.screen = "game";
    this.panelId = null;
    this.modals = [];
    this.tutStep = this.state.tutorialDone || this.state.day > 1 ? -1 : 0;
    this.scene?.setState(this.state);
    this.queueInbox();
    if (this.state.pendingEvent) this.queueEvent();
    this.render();
  }

  private async endDay(): Promise<void> {
    if (!this.state || this.busy || this.modals.length) return;
    if (this.s.pendingEvent) {
      this.queueEvent();
      this.render();
      return;
    }
    this.busy = true;
    const day = this.s.day;
    this.audio.play("day");
    this.panelId = null;
    this.render();
    const prev = this.s;
    const doResolve = () => {
      const ok = this.dispatch({ type: "endDay", expectedDay: day });
      if (!ok) return;
      this.render();
    };
    if (this.scene) await this.scene.dayTransition(doResolve);
    else doResolve();
    this.busy = false;
    if (this.s === prev) return;

    const report = this.s.history[this.s.history.length - 1]!;
    const paidSales = Object.entries(report.salesByProduct).reduce((a, [id, n]) => a + (this.s.products.find((p) => p.id === id)?.price ? n : 0), 0);
    if (paidSales > 0) {
      this.scene?.coinBurst(paidSales);
      this.audio.play("coin");
    }
    this.modals.push({ html: () => reportModal(report, this.s) });
    this.queueInbox();
    if (this.s.phase === "ended") {
      this.modals.push({ html: () => "", onDismiss: () => void this.finishCampaign() });
    } else if (this.s.pendingEvent) this.queueEvent();
    this.advanceTutorial();
    this.render();
  }

  private queueInbox(): void {
    if (!this.state || !this.s.inbox.length) return;
    const items: InboxItem[] = [...this.s.inbox];
    this.dispatch({ type: "clearInbox" }, true);
    for (const item of items) {
      this.modals.push({
        html: () => inboxModal(item),
        onDismiss: undefined,
      });
      if (item.kind === "rank") {
        // Celebrate when this modal is shown (handled in showNext).
        (this.modals[this.modals.length - 1] as ModalEntry & { celebrate?: boolean }).celebrate = true;
      }
    }
  }

  private queueEvent(): void {
    if (this.modals.some((m) => m.blocking)) return;
    this.modals.push({ html: () => eventModal(this.s), blocking: true });
  }

  private dismissModal(): void {
    const top = this.modals.shift();
    top?.onDismiss?.();
    // Skip empty placeholder modals (used to chain callbacks).
    while (this.modals[0] && this.modals[0].html() === "") {
      const m = this.modals.shift();
      m?.onDismiss?.();
    }
    const next = this.modals[0] as (ModalEntry & { celebrate?: boolean }) | undefined;
    if (next?.celebrate) {
      this.scene?.celebrate();
      this.audio.play("rank");
    } else if (next?.blocking) this.audio.play("event");
    this.render();
  }

  private async finishCampaign(): Promise<void> {
    if (!this.state) return;
    const sc = computeScore(this.s);
    if (!this.s.dayFlags.includes("score-submitted")) {
      const entry: ScoreEntry = {
        name: this.s.creatorName,
        score: sc.total,
        grade: sc.grade,
        path: PATHS[this.s.path].short,
        day: new Date().toISOString().slice(0, 10),
      };
      await this.platform.submitScore(entry).catch(() => null);
      const s2 = cloneState(this.s);
      s2.dayFlags.push("score-submitted");
      this.state = s2;
      this.board = await this.platform.leaderboard().catch(() => []);
    }
    clearSave();
    this.screen = "results";
    this.panelId = null;
    if (this.s.outcome === "win") {
      this.scene?.celebrate();
      this.audio.play("rank");
    }
    this.render();
  }

  // ------------------------------------------------------------------ input

  private onKey(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      if (this.modals.length && !this.modals[0]!.blocking && this.screen === "game") this.dismissModal();
      else if (this.panelId) this.openPanel(null);
      else if (this.screen === "game") this.openPanel("menu");
    }
  }

  private onClick(e: MouseEvent): void {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!t || (t as HTMLButtonElement).disabled) return;
    const act = t.dataset.act!;
    const id = t.dataset.id ?? "";
    if (t.tagName === "INPUT") return; // handled by input/change
    this.audio.unlock();
    switch (act) {
      case "new-game":
        this.setup = { ...this.setup, step: 0 };
        this.screen = "setup";
        this.audio.play("click");
        this.render();
        break;
      case "resume":
        this.audio.play("click");
        this.resume();
        break;
      case "open-help-title":
        this.panelId = "help";
        this.render();
        break;
      case "to-title":
        this.screen = "title";
        this.panelId = null;
        this.modals = [];
        this.render();
        break;
      case "setup-path": {
        const p = PATHS[id as PathId];
        if (p) this.setup = { ...this.setup, path: id, niche: p.topics[0]! };
        this.audio.play("click");
        this.render();
        break;
      }
      case "setup-next":
        this.setup.step = 1;
        this.render();
        break;
      case "setup-back":
        this.setup.step = 0;
        this.render();
        break;
      case "setup-niche":
        this.setup.niche = id;
        this.render();
        break;
      case "setup-avatar": {
        const key = t.dataset.key as "skin" | "outfit" | "hair";
        this.setup[key] = Number(t.dataset.val);
        this.scene?.setState({ ...createNewGame({ seed: 1, path: this.setup.path as PathId }), avatar: { skin: this.setup.skin, outfit: this.setup.outfit, hair: this.setup.hair } });
        this.render();
        break;
      }
      case "setup-start":
        this.audio.play("rank");
        this.newCampaign();
        break;
      case "open":
        if (this.screen === "game") this.openPanel(t.dataset.panel as PanelId);
        else if (t.dataset.panel === "help") {
          this.panelId = "help";
          this.render();
        }
        break;
      case "close":
        if (this.screen !== "game") {
          this.panelId = null;
          this.render();
        } else this.openPanel(null);
        break;
      case "interact":
        this.interact(id as InteractId);
        break;
      case "end-day":
        void this.endDay();
        break;
      case "dismiss-modal":
        this.audio.play("click");
        this.dismissModal();
        break;
      case "event-choice":
        if (this.dispatch({ type: "resolveEvent", choiceId: id })) {
          this.modals = this.modals.filter((m) => !m.blocking);
          const note = this.s.dayLedger.notes[this.s.dayLedger.notes.length - 1];
          if (note) this.toast(note);
          this.audio.play("click");
          this.render();
        }
        break;
      case "feature":
        if (this.dispatch({ type: "setPlan", plan: { featuredProductId: id } })) this.render();
        break;
      case "price-step": {
        const p = this.s.products.find((x) => x.id === id);
        if (!p) break;
        const steps = priceSteps(p.type);
        let idx = steps.findIndex((x) => x >= p.price);
        if (idx < 0) idx = steps.length - 1;
        idx = Math.max(0, Math.min(steps.length - 1, idx + Number(t.dataset.dir)));
        if (this.dispatch({ type: "setPrice", productId: id, price: steps[idx]! })) this.render();
        break;
      }
      case "improve":
        if (this.dispatch({ type: "improveProduct", productId: id })) {
          this.toast("Product improved: higher quality and a fresh ad creative.");
          this.audio.play("coin");
          this.render();
        }
        break;
      case "retire": {
        const p = this.s.products.find((x) => x.id === id);
        this.modals.unshift({ html: () => confirmModal(`Retire "${p?.name ?? "this product"}"? It will stop selling${p?.type === "membership" ? " and members will leave" : ""}.`, "retire-confirm", id) });
        this.render();
        break;
      }
      case "retire-confirm":
        this.modals.shift();
        this.dispatch({ type: "retireProduct", productId: id });
        this.render();
        break;
      case "buy":
        if (this.dispatch({ type: "buyUpgrade", upgradeId: id })) {
          this.audio.play("coin");
          this.scene?.celebrate();
          this.toast("Upgrade installed in your studio!");
          this.render();
        }
        break;
      case "wiz-type": {
        const type = t.dataset.type as keyof typeof PRODUCT_TYPES;
        const ref = refPrice(this.s, type, this.wizard.topic || this.s.niche);
        const steps = priceSteps(type);
        const price = steps.find((x) => x >= ref * 0.95 && x > 0) ?? steps[steps.length - 1]!;
        this.wizard = { ...this.wizard, type, topic: this.wizard.topic || this.s.niche, price };
        this.render();
        break;
      }
      case "wiz-topic":
        this.wizard.topic = id;
        this.render();
        break;
      case "wiz-effort":
        this.wizard.effort = id as "standard" | "premium";
        this.render();
        break;
      case "wiz-create": {
        const w = this.wizard;
        if (!w.type) break;
        const ok = this.dispatch({ type: "createProduct", productType: w.type, topic: w.topic, price: w.price, effort: w.effort, name: w.name });
        if (ok) {
          this.audio.play("coin");
          this.toast("Building started! Free hours each day go into it.");
          this.advanceTutorial();
          this.openPanel("products");
        }
        break;
      }
      case "plan-set":
        if (this.dispatch({ type: "setPlan", plan: { [t.dataset.key!]: Number(t.dataset.val) } })) this.render();
        break;
      case "plan-step": {
        const key = t.dataset.key as "coachingSlots";
        if (this.dispatch({ type: "setPlan", plan: { [key]: (this.s.plan[key] as number) + Number(t.dataset.dir) } })) this.render();
        break;
      }
      case "save-quit":
        if (this.state) saveGame(this.state);
        this.screen = "title";
        this.panelId = null;
        this.modals = [];
        this.tutStep = -1;
        this.render();
        break;
      case "restart":
        this.modals.unshift({ html: () => confirmModal("Abandon this campaign? Your progress will be lost.", "restart-confirm") });
        this.render();
        break;
      case "restart-confirm":
        clearSave();
        this.state = null;
        this.modals = [];
        this.panelId = null;
        this.setup.step = 0;
        this.screen = "setup";
        this.render();
        break;
      case "replay":
        this.setup.step = 0;
        this.screen = "setup";
        this.state = null;
        this.render();
        break;
      case "tut-next":
        if (this.tutStep >= TUTORIAL.length - 1) this.finishTutorial();
        else this.tutStep++;
        this.render();
        break;
      case "tut-skip":
        this.finishTutorial();
        this.render();
        break;
    }
  }

  private onInput(e: Event): void {
    const t = e.target as HTMLInputElement;
    const act = t.dataset?.act;
    if (!act) return;
    if (act === "setup-name") this.setup.name = t.value;
    else if (act === "wiz-name") this.wizard.name = t.value;
    else if (act === "wiz-price" && this.wizard.type) {
      this.wizard.price = priceSteps(this.wizard.type)[Number(t.value)] ?? this.wizard.price;
      const out = this.el.panel.querySelector(".price-val");
      if (out) out.textContent = this.wizard.price === 0 ? "Free" : `₦${this.wizard.price.toLocaleString("en-NG")}${PRODUCT_TYPES[this.wizard.type].priceUnit}`;
    }
  }

  private onChange(e: Event): void {
    const t = e.target as HTMLInputElement;
    const act = t.dataset?.act;
    if (!act || !this.state && act !== "setting") return;
    switch (act) {
      case "wiz-price":
        this.render();
        break;
      case "plan-ad": {
        const maxAd = Math.max(0, Math.floor((this.s.cash - 250) / 500) * 500);
        const budget = adBudgetSteps(maxAd)[Number(t.value)] ?? 0;
        this.dispatch({ type: "setPlan", plan: { adBudget: budget } });
        this.render();
        break;
      }
      case "plan-commission":
        this.dispatch({ type: "setPlan", plan: { affiliateCommission: Number(t.value) / 100 } });
        this.render();
        break;
      case "plan-toggle": {
        const key = t.dataset.key as "email" | "affiliateOn" | "hustle" | "sideGig" | "rest";
        this.dispatch({ type: "setPlan", plan: { [key]: t.checked } });
        this.render();
        break;
      }
      case "setting": {
        const key = t.dataset.key as keyof Settings;
        if (key === "quality") this.settings.quality = t.checked ? "high" : "low";
        else (this.settings[key] as boolean) = t.checked;
        saveSettings(this.settings);
        this.audio.enabled = this.settings.sound;
        this.scene?.setQuality(this.settings.quality);
        this.scene?.setReducedMotion(this.settings.reducedMotion);
        this.render();
        break;
      }
    }
  }
}

