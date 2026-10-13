// The creator studio: room, furniture, interactable objects and every visual
// upgrade. Studio.update(state) toggles visuals so the space visibly evolves
// with upgrades and rank.
import * as THREE from "three";
import type { GameState } from "../engine/types";
import { makeAssistant } from "./character";
import { PALETTE as C, at, box, boxOn, canvasTexture, cyl, group, mat, plane, sphere, uniqueMat } from "./kit";

export type InteractId = "laptop" | "board" | "camera" | "upgrades" | "phone";

export interface Interactable {
  id: InteractId;
  object: THREE.Object3D;
  anchor: THREE.Vector3; // world position for the floating label
  label: string;
  icon: string;
}

export const SPOTS = {
  desk: { pos: new THREE.Vector3(-1.2, 0, -2.35), facing: Math.PI, pose: "sit" as const },
  camera: { pos: new THREE.Vector3(2.75, 0, -1.6), facing: -Math.PI / 2, pose: "record" as const },
  board: { pos: new THREE.Vector3(-2.9, 0, -0.6), facing: -Math.PI / 2, pose: "think" as const },
  upgrades: { pos: new THREE.Vector3(-2.4, 0, 2.3), facing: -Math.PI / 2, pose: "stand" as const },
  phone: { pos: new THREE.Vector3(1.2, 0, 1.75), facing: 0, pose: "stand" as const },
};

const ROOM = 4; // half-size

export class Studio {
  readonly root = new THREE.Group();
  readonly interactables: Interactable[] = [];
  private visuals = new Map<string, THREE.Object3D>();
  private wallMat = uniqueMat(C.wallBare);
  private wallMatLeft = uniqueMat(C.wallBare);
  private floorMat = uniqueMat(C.floorConcrete);
  private laptopScreenTex: THREE.CanvasTexture;
  private laptopScreenCtx: CanvasRenderingContext2D;
  private monitorTex: THREE.CanvasTexture | null = null;
  private skyDay: THREE.CanvasTexture;
  private skyNight: THREE.CanvasTexture;
  private skyMat: THREE.MeshBasicMaterial;
  readonly ringLight = new THREE.PointLight(0xfff4e0, 0, 4, 1.5);
  readonly bulbLight = new THREE.PointLight(0xffd59e, 0.9, 9, 1.4);
  readonly neonLight = new THREE.PointLight(0xff5d8f, 0, 6, 1.5);
  private blinkers: THREE.Mesh[] = [];
  private neonMat = uniqueMat(0xff5d8f, { emissive: 0xff5d8f, emissiveIntensity: 1.6 });
  private bulbMat = uniqueMat(0xfff2c0, { emissive: 0xffe08a, emissiveIntensity: 1.4 });
  private plantSway: THREE.Object3D[] = [];
  private t = 0;
  private lastSig = "";

  constructor() {
    // Laptop screen canvas
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 160;
    this.laptopScreenCtx = c.getContext("2d")!;
    this.laptopScreenTex = new THREE.CanvasTexture(c);
    this.laptopScreenTex.colorSpace = THREE.SRGBColorSpace;

    this.skyDay = canvasTexture(512, 320, (ctx, w, h) => drawSky(ctx, w, h, false));
    this.skyNight = canvasTexture(512, 320, (ctx, w, h) => drawSky(ctx, w, h, true));
    this.skyMat = new THREE.MeshBasicMaterial({ map: this.skyDay });

    this.buildRoom();
    this.buildBase();
    this.buildUpgrades();
    this.buildRankDecor();
  }

  private add(id: string, o: THREE.Object3D, visible = false): THREE.Object3D {
    o.visible = visible;
    this.visuals.set(id, o);
    this.root.add(o);
    return o;
  }

  private show(id: string, v: boolean): void {
    const o = this.visuals.get(id);
    if (o) o.visible = v;
  }

  private buildRoom(): void {
    const floor = boxOn(ROOM * 2, 0.2, ROOM * 2, this.floorMat, 0, -0.2, 0);
    floor.castShadow = false;
    this.root.add(floor);
    // Floor tiles/planks pattern via thin strips
    const stripMat = mat(0x000000, { transparent: 0.06 });
    for (let i = -ROOM + 1; i < ROOM; i++) {
      const s = box(0.02, 0.005, ROOM * 2, stripMat, i, 0.003, 0);
      s.castShadow = false;
      this.root.add(s);
    }
    // Back wall (z = -ROOM) with a window cut-out (built as 4 pieces)
    const wallH = 3.6;
    const t = 0.2;
    const winX = 1.6;
    const winW = 2.2;
    const winY = 1.25;
    const winH = 1.6;
    const back = new THREE.Group();
    const leftW = winX - winW / 2 + ROOM;
    back.add(boxOn(leftW, wallH, t, this.wallMat, -ROOM + leftW / 2, 0, -ROOM - t / 2));
    const rightW = ROOM - (winX + winW / 2);
    back.add(boxOn(rightW, wallH, t, this.wallMat, ROOM - rightW / 2, 0, -ROOM - t / 2));
    back.add(boxOn(winW, winY, t, this.wallMat, winX, 0, -ROOM - t / 2));
    back.add(boxOn(winW, wallH - winY - winH, t, this.wallMat, winX, winY + winH, -ROOM - t / 2));
    this.root.add(back);
    // Window frame and sky
    const frameMat = mat(C.white);
    this.root.add(boxOn(winW + 0.16, 0.08, 0.3, frameMat, winX, winY - 0.08, -ROOM + 0.02));
    this.root.add(boxOn(winW + 0.16, 0.08, 0.24, frameMat, winX, winY + winH, -ROOM));
    this.root.add(boxOn(0.08, winH, 0.24, frameMat, winX - winW / 2 - 0.04, winY, -ROOM));
    this.root.add(boxOn(0.08, winH, 0.24, frameMat, winX + winW / 2 + 0.04, winY, -ROOM));
    this.root.add(boxOn(0.05, winH, 0.1, frameMat, winX, winY, -ROOM));
    const sky = plane(winW + 1.2, winH + 0.8, this.skyMat);
    sky.position.set(winX, winY + winH / 2, -ROOM - 0.6);
    this.root.add(sky);
    // Left wall (x = -ROOM)
    this.root.add(boxOn(t, wallH, ROOM * 2 + t, this.wallMatLeft, -ROOM - t / 2, 0, -t / 2));
    // Skirting boards
    const skirt = mat(0xffffff);
    this.root.add(boxOn(ROOM * 2, 0.12, 0.04, skirt, 0, 0, -ROOM + 0.02));
    this.root.add(boxOn(0.04, 0.12, ROOM * 2, skirt, -ROOM + 0.02, 0, 0));

    // Ceiling bulb
    const cord = cyl(0.01, 0.01, 1.0, mat(C.black), 4, -0.6, 3.1, -1.0);
    const bulb = sphere(0.12, this.bulbMat, -0.6, 2.55, -1.0, 1);
    cord.castShadow = false;
    bulb.castShadow = false;
    this.root.add(cord, bulb);
    this.bulbLight.position.set(-0.6, 2.4, -1.0);
    this.root.add(this.bulbLight);
  }

  private buildBase(): void {
    // --- Basic desk (tier 0) ---
    const desk0 = group(
      boxOn(1.6, 0.06, 0.8, mat(C.woodLight), 0, 0.74, 0),
      ...[-0.72, 0.72].flatMap((x) => [-0.32, 0.32].map((z) => boxOn(0.06, 0.74, 0.06, mat(C.metal), x, 0, z))),
    );
    this.add("desk0", at(desk0, -1.2, 0, -3.35), true);
    // --- Pro desk (rank 3+) ---
    const desk1 = group(
      boxOn(2.4, 0.08, 0.9, mat(C.dark), 0, 0.74, 0),
      boxOn(0.08, 0.74, 0.85, mat(C.dark), -1.1, 0, 0),
      boxOn(0.08, 0.74, 0.85, mat(C.dark), 1.1, 0, 0),
      boxOn(2.3, 0.03, 0.04, uniqueMat(C.orange, { emissive: C.orange, emissiveIntensity: 1.2 }), 0, 0.7, 0.44),
    );
    this.add("desk1", at(desk1, -1.2, 0, -3.3));

    // --- Laptop (interactable) ---
    const laptop = new THREE.Group();
    laptop.add(boxOn(0.62, 0.03, 0.42, mat(0xb8bcc6, { metal: 0.4, rough: 0.4 }), 0, 0, 0));
    laptop.add(boxOn(0.56, 0.005, 0.3, mat(0x2a2d36), 0, 0.03, 0.03));
    const lid = new THREE.Group();
    lid.position.set(0, 0.03, -0.2);
    lid.rotation.x = -0.25;
    lid.add(boxOn(0.62, 0.4, 0.02, mat(0xb8bcc6, { metal: 0.4, rough: 0.4 }), 0, 0, 0));
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.35),
      new THREE.MeshBasicMaterial({ map: this.laptopScreenTex }),
    );
    screen.position.set(0, 0.2, 0.012);
    lid.add(screen);
    laptop.add(lid);
    at(laptop, -1.2, 0.8, -3.3);
    this.root.add(laptop);
    this.registerInteractable("laptop", laptop, new THREE.Vector3(-1.2, 1.6, -3.3), "Laptop", "💻");

    // --- Chairs ---
    const plastic = group(
      boxOn(0.5, 0.05, 0.5, mat(0xe8e2d5), 0, 0.45, 0),
      boxOn(0.5, 0.5, 0.05, mat(0xe8e2d5), 0, 0.5, 0.24),
      ...[-0.22, 0.22].flatMap((x) => [-0.22, 0.22].map((z) => boxOn(0.04, 0.45, 0.04, mat(0xd8d2c5), x, 0, z))),
    );
    this.add("chair0", at(plastic, -1.2, 0, -2.4), true);
    const gaming = group(
      cyl(0.04, 0.04, 0.35, mat(C.metal), 6, 0, 0.2, 0),
      cyl(0.3, 0.3, 0.04, mat(C.black), 5, 0, 0.04, 0),
      boxOn(0.56, 0.1, 0.55, mat(C.black), 0, 0.4, 0),
      boxOn(0.56, 0.85, 0.1, mat(C.black), 0, 0.48, 0.26),
      boxOn(0.3, 0.6, 0.11, mat(C.orange), 0, 0.6, 0.27),
      boxOn(0.06, 0.25, 0.4, mat(C.black), -0.3, 0.5, 0.02),
      boxOn(0.06, 0.25, 0.4, mat(C.black), 0.3, 0.5, 0.02),
    );
    this.add("chair1", at(gaming, -1.2, 0, -2.4));

    // --- Planning board (interactable; corkboard -> whiteboard with planner upgrade) ---
    const cork = group(
      boxOn(1.4, 0.95, 0.05, mat(0xc4935a), 0, 0, 0),
      boxOn(1.5, 0.05, 0.07, mat(C.wood), 0, -0.02, 0),
      boxOn(1.5, 0.05, 0.07, mat(C.wood), 0, 0.95, 0),
      ...[0xffd23f, 0xff8a3d, 0x2ec4b6, 0xff5d8f].map((c, i) => boxOn(0.22, 0.22, 0.01, mat(c), -0.45 + i * 0.3, 0.45 + (i % 2) * 0.2, 0.035)),
    );
    const boardHolder = new THREE.Group();
    boardHolder.add(at(cork, 0, 1.4, 0));
    const whiteboard = group(
      boxOn(1.9, 1.15, 0.05, mat(0xfafafa, { rough: 0.3 }), 0, 0, 0),
      boxOn(2.0, 0.06, 0.08, mat(C.metal), 0, -0.04, 0.02),
      ...[0xffd23f, 0xff8a3d, 0x2ec4b6, 0xff5d8f, 0x7b5cff, 0x2ec27e].map((c, i) =>
        boxOn(0.2, 0.2, 0.01, mat(c), -0.7 + (i % 3) * 0.32, 0.65 - Math.floor(i / 3) * 0.32, 0.035),
      ),
      boxOn(0.6, 0.03, 0.01, mat(0x2a6fdb), 0.45, 0.85, 0.035),
      boxOn(0.5, 0.03, 0.01, mat(0x2a6fdb), 0.4, 0.7, 0.035),
      boxOn(0.55, 0.03, 0.01, mat(0xe03e3e), 0.42, 0.55, 0.035),
    );
    this.visuals.set("board0", cork);
    this.visuals.set("board1", at(whiteboard, 0, 1.3, 0));
    whiteboard.visible = false;
    boardHolder.add(whiteboard);
    at(boardHolder, -ROOM + 0.05, 0, -0.6, Math.PI / 2);
    this.root.add(boardHolder);
    this.registerInteractable("board", boardHolder, new THREE.Vector3(-ROOM + 0.1, 2.7, -0.6), "Plans", "📋");

    // --- Content corner: phone tripod (interactable). Camera upgrade replaces it. ---
    const tripod = new THREE.Group();
    const legM = mat(C.black);
    for (let i = 0; i < 3; i++) {
      const leg = box(0.03, 1.25, 0.03, legM, 0, 0.6, 0);
      leg.rotation.z = 0.18;
      const holder = new THREE.Group();
      holder.rotation.y = (i / 3) * Math.PI * 2;
      leg.position.x = 0.1;
      holder.add(leg);
      tripod.add(holder);
    }
    tripod.add(cyl(0.02, 0.02, 0.3, legM, 5, 0, 1.3, 0));
    const phoneCam = boxOn(0.1, 0.2, 0.02, mat(0x222831), 0, 1.4, 0);
    this.visuals.set("phonecam", phoneCam);
    tripod.add(phoneCam);
    const cam = group(
      boxOn(0.32, 0.22, 0.18, mat(C.black, { rough: 0.4 }), 0, 1.4, 0),
      cyl(0.08, 0.09, 0.16, mat(0x333333, { rough: 0.3 }), 10, 0, 1.51, -0.16),
      boxOn(0.08, 0.06, 0.08, mat(C.pink), 0.1, 1.62, 0.04),
    );
    (cam.children[1] as THREE.Mesh).rotation.x = Math.PI / 2;
    cam.visible = false;
    this.visuals.set("camera", cam);
    tripod.add(cam);
    at(tripod, 1.3, 0, -1.25, -Math.PI / 2);
    this.root.add(tripod);
    this.registerInteractable("camera", tripod, new THREE.Vector3(1.3, 2.2, -1.25), "Create", "🎥");

    // Backdrop for filming
    const backdrop = group(
      boxOn(1.8, 1.9, 0.04, uniqueMat(0xffb26b), 0, 0.3, 0),
      cyl(0.02, 0.02, 2.0, mat(C.metal), 5, 0, 2.22, 0),
    );
    (backdrop.children[1] as THREE.Mesh).rotation.z = Math.PI / 2;
    this.add("backdrop", at(backdrop, 3.4, 0, -1.6, -Math.PI / 2), true);

    // --- Upgrade station: a shelf + toolbox (interactable) ---
    const shelf = group(
      boxOn(0.5, 1.6, 1.4, mat(C.wood), 0, 0, 0),
      boxOn(0.46, 0.04, 1.3, mat(C.woodLight), 0.03, 0.5, 0),
      boxOn(0.46, 0.04, 1.3, mat(C.woodLight), 0.03, 1.05, 0),
      boxOn(0.36, 0.22, 0.5, mat(0xe03e3e), 0.05, 1.6, 0.2),
      boxOn(0.2, 0.05, 0.12, mat(C.black), 0.05, 1.82, 0.2),
      ...[0, 1, 2, 3, 4].map((i) => boxOn(0.28, 0.32, 0.08, mat([C.teal, C.orange, C.purple, C.yellow, C.pink][i]!), 0.06, 0.55, -0.5 + i * 0.12)),
    );
    at(shelf, -ROOM + 0.3, 0, 2.3);
    this.root.add(shelf);
    this.registerInteractable("upgrades", shelf, new THREE.Vector3(-ROOM + 0.3, 2.3, 2.3), "Upgrades", "🛠️");

    // --- Phone on a side table (interactable) ---
    const side = group(
      cyl(0.32, 0.32, 0.05, mat(C.woodLight), 12, 0, 0.6, 0),
      cyl(0.04, 0.04, 0.58, mat(C.metal), 6, 0, 0.3, 0),
      cyl(0.2, 0.2, 0.03, mat(C.metal), 10, 0, 0.015, 0),
    );
    const phone = boxOn(0.16, 0.02, 0.3, mat(0x222831, { rough: 0.3 }), 0.02, 0.63, 0);
    const phoneScreen = boxOn(0.14, 0.005, 0.27, uniqueMat(0x8fe3ff, { emissive: 0x6ad1ff, emissiveIntensity: 0.9 }), 0.02, 0.65, 0);
    side.add(phone, phoneScreen);
    this.blinkers.push(phoneScreen);
    at(side, 1.2, 0, 2.4);
    this.root.add(side);
    this.registerInteractable("phone", side, new THREE.Vector3(1.2, 1.5, 2.4), "Audience", "📱");

    // Starter mattress / floor cushion in the corner (tier 0 vibe)
    this.add("cushion", group(boxOn(1.1, 0.18, 0.7, mat(0x6c7a89), 2.9, 0, 3.0), boxOn(0.4, 0.12, 0.3, mat(0xe6e0d3), 2.65, 0.18, 3.0)), true);

    // A small plant from the start
    this.add("plant0", makePlant(0.6, this.plantSway), true).position.set(0.75, 0, -3.6);
  }

  private registerInteractable(id: InteractId, object: THREE.Object3D, anchor: THREE.Vector3, label: string, icon: string): void {
    object.traverse((o) => (o.userData.interact = id));
    this.interactables.push({ id, object, anchor, label, icon });
  }

  private buildUpgrades(): void {
    // Ring light
    const ring = new THREE.Group();
    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.04, 8, 28),
      uniqueMat(0xffffff, { emissive: 0xfff4e0, emissiveIntensity: 2 }),
    );
    ringMesh.position.y = 1.65;
    ring.add(ringMesh, cyl(0.02, 0.02, 1.6, mat(C.black), 5, 0, 0.8, 0), cyl(0.18, 0.2, 0.04, mat(C.black), 8, 0, 0.02, 0));
    this.ringLight.position.set(0, 1.65, 0.3);
    ring.add(this.ringLight);
    this.add("ringlight", at(ring, 1.7, 0, -2.4, Math.PI / 2));

    // Planner -> handled by board swap.

    // Design suite: drawing tablet + big monitor
    const monitorTex = canvasTexture(256, 160, (ctx, w, h) => {
      ctx.fillStyle = "#1e1b2e";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#ff8a3d";
      ctx.fillRect(14, 18, 90, 120);
      ctx.fillStyle = "#2ec4b6";
      ctx.fillRect(116, 18, 124, 56);
      ctx.fillStyle = "#ffd23f";
      ctx.fillRect(116, 82, 60, 56);
      ctx.fillStyle = "#ff5d8f";
      ctx.fillRect(184, 82, 56, 56);
    });
    this.monitorTex = monitorTex;
    const monitor = group(
      boxOn(0.9, 0.55, 0.04, mat(C.black), 0, 0.22, 0),
      cyl(0.03, 0.03, 0.22, mat(C.metal), 6, 0, 0.11, 0),
      boxOn(0.3, 0.02, 0.2, mat(C.metal), 0, 0, 0),
      boxOn(0.4, 0.015, 0.28, mat(0x333344), 0.75, 0, 0.25),
    );
    const mscreen = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.5), new THREE.MeshBasicMaterial({ map: monitorTex }));
    mscreen.position.set(0, 0.495, 0.025);
    monitor.add(mscreen);
    this.add("design", at(monitor, -2.05, 0.8, -3.5, 0.25));

    // Router with blinking LEDs
    const router = group(boxOn(0.3, 0.06, 0.2, mat(0xfafafa), 0, 0, 0), boxOn(0.02, 0.25, 0.02, mat(0xfafafa), -0.1, 0.06, -0.06), boxOn(0.02, 0.25, 0.02, mat(0xfafafa), 0.1, 0.06, -0.06));
    for (let i = 0; i < 3; i++) {
      const led = boxOn(0.03, 0.02, 0.01, uniqueMat(0x2ec27e, { emissive: 0x2ec27e, emissiveIntensity: 2 }), -0.08 + i * 0.08, 0.02, 0.1);
      router.add(led);
      this.blinkers.push(led);
    }
    this.add("router", at(router, -0.35, 0.8, -3.55));

    // Inverter & battery + solar panel outside the window
    const inverter = group(
      boxOn(0.5, 0.7, 0.3, mat(0xeeeeee), 0, 0, 0),
      boxOn(0.3, 0.12, 0.01, uniqueMat(0x2ec27e, { emissive: 0x2ec27e, emissiveIntensity: 1.5 }), 0, 0.45, 0.155),
      boxOn(0.55, 0.35, 0.35, mat(0x30343f), 0.6, 0, 0),
    );
    this.blinkers.push(inverter.children[1] as THREE.Mesh);
    const solar = group(boxOn(1.4, 0.04, 0.8, mat(0x1d3b6e, { rough: 0.2, metal: 0.4 }), 0, 0, 0));
    solar.rotation.x = -0.6;
    solar.position.set(1.6, 2.6, -4.5);
    this.add("inverter", group(at(inverter, 0.2, 0, -3.65), solar));

    // Mic & acoustic panels
    const micArm = group(
      cyl(0.015, 0.015, 0.5, mat(C.black), 5, 0, 0.25, 0),
      cyl(0.05, 0.05, 0.16, mat(0x444444, { metal: 0.6, rough: 0.3 }), 8, 0.0, 0.55, 0.05),
    );
    const panels = new THREE.Group();
    const foamColors = [0x3d2c6b, 0xff8a3d, 0x3d2c6b, 0x2ec4b6, 0x3d2c6b, 0xff8a3d];
    foamColors.forEach((c, i) => {
      const p = boxOn(0.5, 0.5, 0.08, mat(c), (i % 3) * 0.55, Math.floor(i / 3) * 0.55, 0);
      panels.add(p);
    });
    at(panels, -3.55, 1.25, -ROOM + 0.05);
    this.add("mic", group(at(micArm, -0.85, 0.8, -3.45), panels));

    // Email automation: second monitor with envelopes
    const mailTex = canvasTexture(200, 128, (ctx, w, h) => {
      ctx.fillStyle = "#13233a";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = ["#ffd23f", "#2ec4b6", "#ff8a3d", "#ff5d8f"][i]!;
        ctx.fillRect(14, 12 + i * 28, 30, 20);
        ctx.fillStyle = "#cfd8e3";
        ctx.fillRect(54, 16 + i * 28, 120 - i * 15, 6);
        ctx.fillRect(54, 26 + i * 28, 90 - i * 10, 4);
      }
    });
    const mailMon = group(boxOn(0.6, 0.4, 0.04, mat(C.black), 0, 0.2, 0), cyl(0.03, 0.03, 0.2, mat(C.metal), 6, 0, 0.1, 0));
    const mailScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.35), new THREE.MeshBasicMaterial({ map: mailTex }));
    mailScreen.position.set(0, 0.4, 0.025);
    mailMon.add(mailScreen);
    this.add("emailsuite", at(mailMon, -0.45, 0.8, -3.45, -0.35));

    // Ad skills: bookshelf on the wall
    const books = new THREE.Group();
    books.add(boxOn(1.2, 0.05, 0.25, mat(C.wood), 0, 0, 0));
    for (let i = 0; i < 9; i++) {
      const h = 0.22 + ((i * 37) % 10) / 60;
      books.add(boxOn(0.09, h, 0.2, mat([C.orange, C.teal, C.purple, C.yellow, C.pink, C.green][i % 6]!), -0.5 + i * 0.12, 0.05, 0));
    }
    this.add("adskills", at(books, -0.1, 2.45, -ROOM + 0.15));

    // Helpdesk: headset on a stand + phone dock on the side table
    const headset = group(
      cyl(0.03, 0.05, 0.3, mat(C.metal), 6, 0, 0.15, 0),
      new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 16, Math.PI), mat(C.black)),
    );
    headset.children[1]!.position.y = 0.3;
    this.add("helpdesk", at(headset, -1.85, 0.8, -3.1));

    // Secure hosting: a small safe on the shelf
    const safe = group(boxOn(0.3, 0.3, 0.3, mat(0x5b6270, { metal: 0.6, rough: 0.4 }), 0, 0, 0), cyl(0.05, 0.05, 0.02, mat(C.yellow), 10, 0, 0.15, 0.16));
    (safe.children[1] as THREE.Mesh).rotation.x = Math.PI / 2;
    this.add("secure", at(safe, -ROOM + 0.35, 1.09, 2.75));

    // Assistant desk + NPC
    const aDesk = group(
      boxOn(1.3, 0.06, 0.7, mat(C.woodLight), 0, 0.72, 0),
      ...[-0.6, 0.6].flatMap((x) => [-0.28, 0.28].map((z) => boxOn(0.05, 0.72, 0.05, mat(C.metal), x, 0, z))),
      boxOn(0.5, 0.03, 0.34, mat(0xb8bcc6), 0, 0.78, -0.05),
      boxOn(0.5, 0.32, 0.02, mat(0xb8bcc6), 0, 0.81, -0.22),
    );
    const npc = makeAssistant();
    npc.position.set(0, 0, 0.55);
    npc.rotation.y = Math.PI;
    aDesk.add(npc, boxOn(0.45, 0.06, 0.45, mat(C.black), 0, 0.42, 0.6));
    this.add("assistant", at(aDesk, 3.1, 0, 0.9, -Math.PI / 2));

    // Venue partnership: event banner on the left wall
    const bannerTex = canvasTexture(256, 360, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#7b5cff");
      g.addColorStop(1, "#ff5d8f");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 44px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LIVE", w / 2, 120);
      ctx.fillText("EVENT", w / 2, 170);
      ctx.font = "bold 26px sans-serif";
      ctx.fillText("Sold out soon", w / 2, 260);
    });
    const banner = plane(0.8, 1.15, new THREE.MeshStandardMaterial({ map: bannerTex }));
    banner.rotation.y = Math.PI / 2;
    banner.position.set(-ROOM + 0.03, 1.7, 1.0);
    this.add("venue", banner);

    // Studio makeover: neon sign, rug, extra plants, LED strip
    const neonTex = canvasTexture(512, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.shadowColor = "#ff5d8f";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ffd6e6";
      ctx.font = "bold 70px 'Fredoka', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Creator Hustle", w / 2, h / 2);
    });
    const neon = plane(2.2, 0.55, new THREE.MeshBasicMaterial({ map: neonTex, transparent: true }));
    neon.position.set(-1.4, 3.05, -ROOM + 0.03);
    this.neonLight.position.set(-1.6, 2.6, -3.3);
    const rug = cyl(1.5, 1.5, 0.02, mat(0x7b5cff), 24, 0.6, 0.01, 0.5);
    rug.scale.z = 0.7;
    const rugInner = cyl(1.1, 1.1, 0.025, mat(0xffb26b), 24, 0.6, 0.012, 0.5);
    rugInner.scale.z = 0.7;
    const sofa = group(
      boxOn(1.8, 0.4, 0.8, mat(0x2ec4b6), 0, 0, 0),
      boxOn(1.8, 0.5, 0.2, mat(0x25a89c), 0, 0.35, 0.3),
      boxOn(0.2, 0.3, 0.8, mat(0x25a89c), -0.9, 0.35, 0),
      boxOn(0.2, 0.3, 0.8, mat(0x25a89c), 0.9, 0.35, 0),
      boxOn(0.4, 0.3, 0.12, mat(C.yellow), -0.4, 0.42, 0.15),
    );
    const makeover = group(neon, this.neonLight, rug, rugInner, at(sofa, 2.6, 0, 3.0, Math.PI), at(makePlant(1.0, this.plantSway), 3.0, 0, -3.55), at(makePlant(0.8, this.plantSway), -3.5, 0, -3.5));
    this.add("makeover", makeover);
  }

  private buildRankDecor(): void {
    // Rank 1: posters
    const poster = (colorA: string, colorB: string, text: string) =>
      canvasTexture(200, 280, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, colorA);
        g.addColorStop(1, colorB);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "bold 30px sans-serif";
        ctx.textAlign = "center";
        text.split("\n").forEach((line, i) => ctx.fillText(line, w / 2, 110 + i * 36));
      });
    const p1 = plane(0.6, 0.84, new THREE.MeshStandardMaterial({ map: poster("#ff8a3d", "#ff5d8f", "START\nWHERE\nYOU ARE") }));
    p1.rotation.y = Math.PI / 2;
    p1.position.set(-ROOM + 0.03, 1.8, -2.4);
    const p2 = plane(0.5, 0.7, new THREE.MeshStandardMaterial({ map: poster("#2ec4b6", "#7b5cff", "SHIP\nIT") }));
    p2.position.set(3.2, 1.9, -ROOM + 0.03);
    this.add("rank1", group(p1, p2));

    // Rank 2: framed plaque + floor lamp
    const plaqueTex = canvasTexture(256, 200, (ctx, w, h) => {
      ctx.fillStyle = "#2a2633";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#ffd23f";
      ctx.lineWidth = 10;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = "#ffd23f";
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("1,000", w / 2, 90);
      ctx.font = "20px sans-serif";
      ctx.fillText("CUSTOMERS", w / 2, 125);
    });
    const plaque = plane(0.6, 0.47, new THREE.MeshStandardMaterial({ map: plaqueTex }));
    plaque.position.set(3.3, 2.8, -ROOM + 0.03);
    const lamp = group(cyl(0.02, 0.02, 1.7, mat(C.black), 5, 0, 0.85, 0), cyl(0.15, 0.25, 0.3, uniqueMat(0xfff2c0, { emissive: 0xffd28a, emissiveIntensity: 0.8 }), 10, 0, 1.75, 0), cyl(0.2, 0.2, 0.03, mat(C.black), 10, 0, 0.015, 0));
    this.add("rank2", group(plaque, at(lamp, 3.55, 0, -3.0)));

    // Rank 3: pro desk swap handled in update + trophy
    const trophy = group(cyl(0.12, 0.06, 0.2, mat(C.yellow, { metal: 0.8, rough: 0.3 }), 10, 0, 0.25, 0), cyl(0.03, 0.03, 0.12, mat(C.yellow, { metal: 0.8 }), 6, 0, 0.1, 0), boxOn(0.18, 0.05, 0.18, mat(C.dark), 0, 0, 0));
    this.add("rank3", at(trophy, -ROOM + 0.35, 1.09, 1.85));

    // Rank 4: LED strip along the ceiling line + gold plaque
    const led = group(
      boxOn(ROOM * 2, 0.04, 0.04, uniqueMat(0x7b5cff, { emissive: 0x7b5cff, emissiveIntensity: 2 }), 0, 3.5, -ROOM + 0.05),
      boxOn(0.04, 0.04, ROOM * 2, uniqueMat(0x7b5cff, { emissive: 0x7b5cff, emissiveIntensity: 2 }), -ROOM + 0.05, 3.5, 0),
    );
    this.add("rank4", led);
    // Rank 5: golden mogul trophy display
    const display = group(
      boxOn(0.6, 0.9, 0.6, mat(0xffffff), 0, 0, 0),
      cyl(0.2, 0.1, 0.35, mat(0xffd23f, { metal: 0.9, rough: 0.2 }), 12, 0, 1.1, 0),
      sphere(0.12, mat(0xffd23f, { metal: 0.9, rough: 0.2 }), 0, 1.4, 0, 1),
    );
    this.add("rank5", at(display, -1.0, 0, 3.4));
  }

  /** Update visuals from game state. Cheap: only acts when the signature changes. */
  update(s: GameState): void {
    const sig = `${s.rank}|${s.upgrades.join(",")}|${s.day}|${s.cash}|${s.history.length}`;
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    const has = (id: string) => s.upgrades.includes(id);
    for (const id of ["ringlight", "design", "router", "inverter", "mic", "emailsuite", "adskills", "helpdesk", "secure", "assistant", "venue", "makeover"]) {
      this.show(id, has(id));
    }
    this.ringLight.intensity = has("ringlight") ? 1.2 : 0;
    this.neonLight.intensity = has("makeover") ? 1.4 : 0;
    this.show("chair0", !has("chair"));
    this.show("chair1", has("chair"));
    this.show("board0", !has("planner"));
    this.show("board1", has("planner"));
    this.show("phonecam", !has("camera"));
    this.show("camera", has("camera"));
    this.show("desk0", s.rank < 3);
    this.show("desk1", s.rank >= 3);
    this.show("cushion", s.rank < 2 && !has("makeover"));
    this.show("rank1", s.rank >= 1);
    this.show("rank2", s.rank >= 2);
    this.show("rank3", s.rank >= 3);
    this.show("rank4", s.rank >= 4);
    this.show("rank5", s.rank >= 5);
    // Walls and floor evolve
    const wall = has("makeover") ? C.wallBrand : s.rank >= 2 ? C.wallWarm : C.wallBare;
    this.wallMat.color.setHex(wall);
    this.wallMatLeft.color.setHex(has("makeover") ? 0x4a3680 : s.rank >= 2 ? 0xf7e3c4 : 0xe3d6c2);
    this.floorMat.color.setHex(s.rank >= 1 || has("makeover") ? C.floorWood : C.floorConcrete);
    this.drawLaptopScreen(s);
    void this.monitorTex;
  }

  private drawLaptopScreen(s: GameState): void {
    const ctx = this.laptopScreenCtx;
    const w = 256;
    const h = 160;
    ctx.fillStyle = "#16132a";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ff8a3d";
    ctx.fillRect(0, 0, w, 22);
    ctx.fillStyle = "#16132a";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText(`Day ${s.day}  •  ₦${Math.round(s.cash).toLocaleString()}`, 8, 16);
    const hist = s.history.slice(-10);
    const max = Math.max(1, ...hist.map((d) => d.grossRevenue));
    hist.forEach((d, i) => {
      const bh = (d.grossRevenue / max) * 100;
      ctx.fillStyle = d.netProfit >= 0 ? "#2ec27e" : "#ff5d8f";
      ctx.fillRect(12 + i * 24, 145 - bh, 16, bh);
    });
    if (!hist.length) {
      ctx.fillStyle = "#cfc8ff";
      ctx.font = "16px sans-serif";
      ctx.fillText("Let's build something!", 40, 90);
    }
    this.laptopScreenTex.needsUpdate = true;
  }

  setNight(night: boolean): void {
    this.skyMat.map = night ? this.skyNight : this.skyDay;
    this.skyMat.needsUpdate = true;
  }

  tick(dt: number, powerCut: boolean): void {
    this.t += dt;
    const blink = Math.sin(this.t * 6) > 0;
    this.blinkers.forEach((b, i) => {
      const m = b.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = powerCut && i > 0 ? 0.1 : (i + Math.floor(this.t * 2)) % 3 === 0 && blink ? 0.6 : 1.8;
    });
    this.plantSway.forEach((p, i) => (p.rotation.z = Math.sin(this.t * 1.2 + i) * 0.04));
    this.neonMat.emissiveIntensity = 1.4 + Math.sin(this.t * 3) * 0.2;
    const flicker = powerCut ? (Math.sin(this.t * 37) > 0.7 ? 0.25 : 0.05) : 1;
    this.bulbMat.emissiveIntensity = 1.4 * flicker;
  }
}

function makePlant(scale: number, sway: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.18, 0.14, 0.3, mat(C.pot), 8, 0, 0.15, 0));
  const leaves = new THREE.Group();
  leaves.position.y = 0.3;
  for (let i = 0; i < 6; i++) {
    const leaf = sphere(0.16, mat(i % 2 ? C.plant : C.plantDark), 0, 0, 0, 0);
    leaf.scale.set(0.6, 1.4, 0.3);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.12, 0.22 + (i % 3) * 0.06, Math.sin(a) * 0.12);
    leaf.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.5);
    leaves.add(leaf);
  }
  g.add(leaves);
  sway.push(leaves);
  g.scale.setScalar(scale);
  return g;
}

function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, night: boolean): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  if (night) {
    g.addColorStop(0, "#0b1033");
    g.addColorStop(1, "#3a2a6b");
  } else {
    g.addColorStop(0, "#7fd3ff");
    g.addColorStop(0.7, "#ffd1a1");
    g.addColorStop(1, "#ffb37a");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Sun / moon
  ctx.fillStyle = night ? "#f4f1d0" : "#fff3b0";
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.28, night ? 22 : 34, 0, Math.PI * 2);
  ctx.fill();
  // Skyline silhouettes (original, generic city)
  const rand = (i: number) => ((Math.sin(i * 91.7) + 1) / 2);
  let x = 0;
  let i = 0;
  while (x < w) {
    const bw = 30 + rand(i) * 50;
    const bh = 60 + rand(i + 3) * 150;
    ctx.fillStyle = night ? "#1b1640" : "#5b6b8c";
    ctx.fillRect(x, h - bh, bw, bh);
    // windows
    for (let wy = h - bh + 10; wy < h - 10; wy += 16) {
      for (let wx = x + 6; wx < x + bw - 8; wx += 12) {
        if (rand(wx * 3 + wy) > (night ? 0.45 : 0.75)) {
          ctx.fillStyle = night ? "#ffd27a" : "#a9c3e8";
          ctx.fillRect(wx, wy, 5, 7);
        }
      }
    }
    x += bw + 4;
    i++;
  }
  // a tower with antenna
  ctx.fillStyle = night ? "#241c52" : "#4a5a7a";
  ctx.fillRect(w * 0.42, h - 250, 34, 250);
  ctx.fillRect(w * 0.42 + 15, h - 290, 4, 40);
}
