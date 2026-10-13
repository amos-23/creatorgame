// Renderer, fixed isometric camera, lighting, input picking and lightweight effects.
import * as THREE from "three";
import type { GameState } from "../engine/types";
import { Character } from "./character";
import { canvasTexture } from "./kit";
import { SPOTS, Studio, type InteractId } from "./studio";

export interface PinPosition {
  id: InteractId;
  x: number;
  y: number;
  label: string;
  icon: string;
  visible: boolean;
}

export type Quality = "high" | "low";

interface Particle {
  obj: THREE.Sprite | THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  max: number;
  spin?: number;
}

export class GameScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private studio = new Studio();
  private character = new Character();
  private hemi = new THREE.HemisphereLight(0xfff1dd, 0x4b3d66, 1.1);
  private sun = new THREE.DirectionalLight(0xffe2b8, 2.0);
  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private particles: Particle[] = [];
  private coinTex = canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(28, 26, 4, 32, 32, 30);
    g.addColorStop(0, "#fff6b0");
    g.addColorStop(1, "#f2a516");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(32, 32, 29, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#b86e00";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "#8a4b00";
    ctx.font = "bold 34px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("₦", 32, 34);
  });
  private hovered: InteractId | null = null;
  private running = false;
  private paused = false;
  private powerCut = false;
  private night = 0; // 0 = day, 1 = night
  private nightTarget = 0;
  private quality: Quality = "high";
  private reducedMotion = false;
  private viewW = 1;
  private viewH = 1;
  private zoom = 1;
  private idleTimer = 0;
  private currentSpot: keyof typeof SPOTS = "desk";
  private tired = false;
  onInteract: ((id: InteractId) => void) | null = null;
  onFrame: (() => void) | null = null;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute("aria-label", "Your creator studio. Use the buttons to manage your business.");

    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    this.camera.position.set(11, 10.5, 11);
    this.camera.lookAt(0, 0.9, 0);

    this.scene.add(this.hemi);
    this.sun.position.set(4, 9, -2);
    this.sun.target.position.set(-0.5, 0, 0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -7;
    sc.right = 7;
    sc.top = 7;
    sc.bottom = -7;
    sc.near = 1;
    sc.far = 30;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight(0xc9d7ff, 0.5);
    fill.position.set(8, 6, 8);
    this.scene.add(fill);

    this.scene.add(this.studio.root);
    this.scene.add(this.character.root);
    const d = SPOTS.desk;
    this.character.placeAt(d.pos, d.facing, d.pose);
    this.character.setFacing(d.facing);

    const el = this.renderer.domElement;
    el.addEventListener("pointermove", (e) => this.onPointerMove(e));
    el.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    el.addEventListener("pointerleave", () => this.setHover(null));
    window.addEventListener("resize", () => this.resize());
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.clock.getDelta();
    });
    this.resize();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      if (this.paused || document.hidden) return;
      this.frame();
    };
    requestAnimationFrame(loop);
  }

  setPaused(p: boolean): void {
    this.paused = p;
    if (!p) this.clock.getDelta();
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.renderer.shadowMap.enabled = q === "high";
    this.sun.castShadow = q === "high";
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) m.needsUpdate = true;
    });
    this.resize();
  }

  setReducedMotion(r: boolean): void {
    this.reducedMotion = r;
  }

  resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.viewW = w;
    this.viewH = h;
    const dpr = this.quality === "high" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    const aspect = w / h;
    // Fit the room: needs ~12.5 units across and ~10 units tall.
    const portrait = aspect < 0.9;
    const frustumH = Math.max(10.5, (portrait ? 11.6 : 13) / aspect) / this.zoom;
    const frustumW = frustumH * aspect;
    this.camera.left = -frustumW / 2;
    this.camera.right = frustumW / 2;
    this.camera.top = frustumH / 2;
    this.camera.bottom = -frustumH / 2;
    // Shift view so the room sits between the HUD (top) and the dock (bottom).
    this.camera.position.set(11, 10.5, 11);
    this.camera.lookAt(0, portrait ? 0.4 : 0.9, 0);
    this.camera.updateProjectionMatrix();
  }

  /** Zoom in or out a little (clamped). */
  zoomBy(f: number): void {
    this.zoom = Math.min(1.8, Math.max(0.8, this.zoom * f));
    this.resize();
  }

  setState(s: GameState): void {
    this.studio.update(s);
    this.character.setAvatar(s.avatar);
    this.powerCut = s.modifiers.some((m) => m.label.startsWith("Power cut"));
    this.tired = s.wellbeing < 35;
    this.character.tired = this.tired;
  }

  goTo(spot: keyof typeof SPOTS): void {
    this.currentSpot = spot;
    this.idleTimer = 0;
    const sp = SPOTS[spot];
    this.character.walkTo(sp.pos, sp.facing, sp.pose);
    this.character.setFacing(sp.facing);
  }

  celebrate(): void {
    this.character.celebrate();
    this.confetti();
  }

  coinBurst(count: number): void {
    const n = Math.min(24, Math.max(3, count));
    const origin = new THREE.Vector3(-1.2, 1.3, -3.2);
    for (let i = 0; i < n; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.coinTex, transparent: true, depthWrite: false }));
      sprite.scale.setScalar(0.32);
      sprite.position.copy(origin);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 2.4, 3 + Math.random() * 2.5, (Math.random() - 0.2) * 2.2);
      this.scene.add(sprite);
      this.particles.push({ obj: sprite, vel, life: 0, max: 1.4 + Math.random() * 0.4 });
    }
  }

  confetti(): void {
    const colors = [0xff8a3d, 0xff5d8f, 0x2ec4b6, 0xffd23f, 0x7b5cff, 0x2ec27e];
    const geo = new THREE.PlaneGeometry(0.12, 0.07);
    const n = this.reducedMotion ? 30 : 110;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide, transparent: true }));
      m.position.set((Math.random() - 0.5) * 7, 4 + Math.random() * 2.5, (Math.random() - 0.5) * 7);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      this.scene.add(m);
      this.particles.push({ obj: m, vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, -1.2 - Math.random(), (Math.random() - 0.5) * 0.8), life: 0, max: 3.5, spin: 3 + Math.random() * 5 });
    }
  }

  /** Night falls then morning comes. Resolves at the darkest point and again at dawn. */
  async dayTransition(midpoint: () => void): Promise<void> {
    const dur = this.reducedMotion ? 150 : 700;
    this.nightTarget = 1;
    await wait(dur);
    this.studio.setNight(true);
    midpoint();
    await wait(this.reducedMotion ? 100 : 450);
    this.studio.setNight(false);
    this.nightTarget = 0;
  }

  /** Screen-space positions for floating labels. */
  pinPositions(): PinPosition[] {
    const out: PinPosition[] = [];
    const v = new THREE.Vector3();
    for (const it of this.studio.interactables) {
      v.copy(it.anchor).project(this.camera);
      out.push({
        id: it.id,
        x: ((v.x + 1) / 2) * this.viewW,
        y: ((1 - v.y) / 2) * this.viewH,
        label: it.label,
        icon: it.icon,
        visible: v.z < 1 && v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1,
      });
    }
    return out;
  }

  private frame(): void {
    const dt = Math.min(0.05, this.clock.getDelta());
    // Day/night lighting blend
    const speed = this.reducedMotion ? 10 : 2.2;
    this.night += (this.nightTarget - this.night) * Math.min(1, dt * speed);
    const n = this.night;
    const cut = this.powerCut ? 0.55 : 1;
    this.sun.intensity = (2.0 * (1 - n) + 0.15 * n) * (this.powerCut ? 0.9 : 1);
    this.hemi.intensity = (1.1 * (1 - n) + 0.35 * n) * cut;
    this.studio.bulbLight.intensity = (0.8 + n * 1.6) * (this.powerCut ? 0.1 : 1);

    this.character.update(this.reducedMotion ? dt * 0.6 : dt);
    this.studio.tick(dt, this.powerCut);

    // Idle wandering: occasionally go back to the desk.
    this.idleTimer += dt;
    if (this.idleTimer > 14 && this.currentSpot !== "desk" && !this.character.isBusy) this.goTo("desk");

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dt;
      if (p.spin) {
        p.obj.rotation.x += p.spin * dt;
        p.obj.rotation.y += p.spin * 0.7 * dt;
        p.obj.position.addScaledVector(p.vel, dt);
        p.obj.position.x += Math.sin(p.life * 4 + i) * 0.01;
      } else {
        p.vel.y -= 9 * dt;
        p.obj.position.addScaledVector(p.vel, dt);
      }
      const fade = 1 - Math.max(0, (p.life - p.max * 0.6) / (p.max * 0.4));
      const material = (p.obj as THREE.Mesh).material as THREE.Material & { opacity: number };
      material.opacity = fade;
      if (p.life >= p.max) {
        this.scene.remove(p.obj);
        material.dispose();
        this.particles.splice(i, 1);
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.onFrame?.();
  }

  private pick(e: PointerEvent): InteractId | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const objs = this.studio.interactables.map((i) => i.object);
    const hits = this.raycaster.intersectObjects(objs, true);
    for (const h of hits) {
      if (!h.object.visible) continue;
      const id = h.object.userData.interact as InteractId | undefined;
      if (id) return id;
    }
    return null;
  }

  private onPointerMove(e: PointerEvent): void {
    if (e.pointerType !== "mouse") return;
    this.setHover(this.pick(e));
  }

  private setHover(id: InteractId | null): void {
    if (id === this.hovered) return;
    const prev = this.studio.interactables.find((i) => i.id === this.hovered);
    if (prev) prev.object.scale.setScalar(1);
    this.hovered = id;
    const cur = this.studio.interactables.find((i) => i.id === id);
    if (cur) cur.object.scale.setScalar(1.06);
    this.renderer.domElement.style.cursor = id ? "pointer" : "default";
  }

  private onPointerDown(e: PointerEvent): void {
    const id = this.pick(e);
    if (id) this.onInteract?.(id);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
