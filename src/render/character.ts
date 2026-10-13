// The player character: an original low-poly figure built from primitives with
// procedural animations (idle, walk, sit & type, record, celebrate, tired).
import * as THREE from "three";
import { HAIR_COLORS, OUTFITS, SKIN_TONES, box, cyl, group, mat, sphere, uniqueMat } from "./kit";
import type { Avatar } from "../engine/types";

export type Pose = "stand" | "sit" | "record" | "celebrate" | "think";

interface Limb {
  pivot: THREE.Group;
  lower?: THREE.Group;
}

export class Character {
  readonly root = new THREE.Group();
  private hips = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private legL: Limb;
  private legR: Limb;
  private armL: Limb;
  private armR: Limb;
  private skinMat = uniqueMat(SKIN_TONES[2]!);
  private outfitMat = uniqueMat(OUTFITS[0]!);
  private hairMat = uniqueMat(HAIR_COLORS[0]!);
  private pants = mat(0x2b2f4a);
  private shoes = mat(0xf5f2ea);

  private target: THREE.Vector3 | null = null;
  private targetFacing = 0;
  private pose: Pose = "stand";
  private poseAfterWalk: Pose = "stand";
  private t = 0;
  private celebrateUntil = 0;
  private walking = false;
  tired = false;
  speed = 2.2;
  onArrive: (() => void) | null = null;

  constructor() {
    this.root.name = "character";
    this.hips.position.y = 0.78;
    this.root.add(this.hips);

    this.legL = this.makeLeg(-0.11);
    this.legR = this.makeLeg(0.11);

    // Torso
    const body = box(0.44, 0.5, 0.26, this.outfitMat, 0, 0.27, 0);
    const belt = box(0.45, 0.06, 0.27, this.pants, 0, 0.02, 0);
    const collar = box(0.2, 0.05, 0.2, this.skinMat, 0, 0.53, 0);
    this.torso.add(body, belt, collar);
    this.hips.add(this.torso);

    this.armL = this.makeArm(-0.29);
    this.armR = this.makeArm(0.29);

    // Head
    this.head.position.y = 0.56;
    const neck = cyl(0.06, 0.07, 0.08, this.skinMat, 6, 0, 0.03, 0);
    const skull = sphere(0.19, this.skinMat, 0, 0.22, 0, 1);
    skull.scale.set(1, 1.08, 0.98);
    const hair = sphere(0.2, this.hairMat, 0, 0.3, -0.02, 1);
    hair.scale.set(1.04, 0.72, 1.04);
    const eyeMat = mat(0x111111);
    const eyeL = sphere(0.025, eyeMat, -0.07, 0.24, 0.17, 0);
    const eyeR = sphere(0.025, eyeMat, 0.07, 0.24, 0.17, 0);
    const smile = box(0.08, 0.015, 0.02, mat(0x5a2a1a), 0, 0.15, 0.18);
    this.head.add(neck, skull, hair, eyeL, eyeR, smile);
    this.torso.add(this.head);
  }

  private makeLeg(x: number): Limb {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0, 0);
    const thigh = box(0.15, 0.4, 0.17, this.pants, 0, -0.2, 0);
    const lower = new THREE.Group();
    lower.position.y = -0.4;
    const shin = box(0.14, 0.36, 0.16, this.pants, 0, -0.18, 0);
    const shoe = box(0.15, 0.08, 0.26, this.shoes, 0, -0.38, 0.05);
    lower.add(shin, shoe);
    pivot.add(thigh, lower);
    this.hips.add(pivot);
    return { pivot, lower };
  }

  private makeArm(x: number): Limb {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.48, 0);
    const upper = box(0.12, 0.3, 0.13, this.outfitMat, 0, -0.14, 0);
    const lower = new THREE.Group();
    lower.position.y = -0.28;
    const fore = box(0.11, 0.26, 0.12, this.skinMat, 0, -0.12, 0);
    const hand = sphere(0.065, this.skinMat, 0, -0.27, 0, 0);
    lower.add(fore, hand);
    pivot.add(upper, lower);
    this.torso.add(pivot);
    return { pivot, lower };
  }

  setAvatar(a: Avatar): void {
    this.skinMat.color.setHex(SKIN_TONES[a.skin % SKIN_TONES.length]!);
    this.outfitMat.color.setHex(OUTFITS[a.outfit % OUTFITS.length]!);
    this.hairMat.color.setHex(HAIR_COLORS[a.hair % HAIR_COLORS.length]!);
  }

  placeAt(p: THREE.Vector3, facing: number, pose: Pose): void {
    this.root.position.copy(p);
    this.root.rotation.y = facing;
    this.pose = pose;
    this.target = null;
    this.walking = false;
  }

  walkTo(p: THREE.Vector3, facing: number, poseAfter: Pose, onArrive?: () => void): void {
    if (this.root.position.distanceTo(p) < 0.05) {
      this.root.rotation.y = facing;
      this.pose = poseAfter;
      onArrive?.();
      return;
    }
    this.target = p.clone();
    this.targetFacing = facing;
    this.poseAfterWalk = poseAfter;
    this.walking = true;
    this.pose = "stand";
    this.onArrive = onArrive ?? null;
  }

  celebrate(seconds = 2.2): void {
    this.celebrateUntil = this.t + seconds;
  }

  get isBusy(): boolean {
    return this.walking;
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;
    // Movement
    if (this.walking && this.target) {
      const pos = this.root.position;
      const dir = new THREE.Vector3().subVectors(this.target, pos);
      dir.y = 0;
      const dist = dir.length();
      if (dist < 0.04) {
        pos.copy(this.target);
        this.walking = false;
        this.target = null;
        this.pose = this.poseAfterWalk;
        const cb = this.onArrive;
        this.onArrive = null;
        cb?.();
      } else {
        const step = Math.min(dist, this.speed * dt);
        dir.normalize();
        pos.addScaledVector(dir, step);
        const desired = Math.atan2(dir.x, dir.z);
        this.root.rotation.y = lerpAngle(this.root.rotation.y, desired, Math.min(1, dt * 10));
      }
    } else if (!this.walking) {
      this.root.rotation.y = lerpAngle(this.root.rotation.y, this.targetFacingOr(), Math.min(1, dt * 6));
    }

    const celebrating = t < this.celebrateUntil;
    const reset = (l: Limb) => {
      l.pivot.rotation.set(0, 0, 0);
      l.lower?.rotation.set(0, 0, 0);
    };
    [this.legL, this.legR, this.armL, this.armR].forEach(reset);
    this.hips.position.y = 0.78;
    this.hips.rotation.set(0, 0, 0);
    this.torso.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);

    const breathe = Math.sin(t * 2.2) * 0.012;

    if (this.walking) {
      const s = Math.sin(t * 9);
      this.legL.pivot.rotation.x = s * 0.6;
      this.legR.pivot.rotation.x = -s * 0.6;
      this.legL.lower!.rotation.x = Math.max(0, -s) * 0.6;
      this.legR.lower!.rotation.x = Math.max(0, s) * 0.6;
      this.armL.pivot.rotation.x = -s * 0.5;
      this.armR.pivot.rotation.x = s * 0.5;
      this.hips.position.y = 0.78 + Math.abs(Math.cos(t * 9)) * 0.04;
    } else if (celebrating) {
      const jump = Math.abs(Math.sin(t * 7)) * 0.28;
      this.hips.position.y = 0.78 + jump;
      this.armL.pivot.rotation.z = -2.6 + Math.sin(t * 14) * 0.2;
      this.armR.pivot.rotation.z = 2.6 - Math.sin(t * 14) * 0.2;
      this.head.rotation.x = -0.2;
    } else if (this.pose === "sit") {
      this.hips.position.y = 0.52;
      this.legL.pivot.rotation.x = -1.45;
      this.legR.pivot.rotation.x = -1.45;
      this.legL.lower!.rotation.x = 1.45;
      this.legR.lower!.rotation.x = 1.45;
      // typing
      const tired = this.tired ? 0.5 : 1;
      this.armL.pivot.rotation.x = -1.05;
      this.armR.pivot.rotation.x = -1.05;
      this.armL.lower!.rotation.x = -0.5 + Math.sin(t * 16 * tired) * 0.08;
      this.armR.lower!.rotation.x = -0.5 + Math.cos(t * 15 * tired) * 0.08;
      this.torso.rotation.x = this.tired ? 0.25 : 0.08;
      this.head.rotation.x = this.tired ? 0.35 : 0.1 + Math.sin(t * 0.7) * 0.05;
      this.head.rotation.y = Math.sin(t * 0.4) * 0.15;
    } else if (this.pose === "record") {
      this.armR.pivot.rotation.x = -0.4;
      this.armR.pivot.rotation.z = 0.3 + Math.sin(t * 3) * 0.25;
      this.armR.lower!.rotation.x = -0.9;
      this.armL.pivot.rotation.z = -0.25 - Math.sin(t * 2.4) * 0.2;
      this.head.rotation.y = Math.sin(t * 1.6) * 0.2;
      this.torso.rotation.y = Math.sin(t * 1.3) * 0.08;
      this.hips.position.y = 0.78 + breathe;
    } else if (this.pose === "think") {
      this.armR.pivot.rotation.x = -1.6;
      this.armR.lower!.rotation.x = -1.6;
      this.armL.pivot.rotation.x = -0.6;
      this.armL.lower!.rotation.x = -1.2;
      this.head.rotation.z = Math.sin(t * 0.8) * 0.12;
      this.head.rotation.x = -0.15;
    } else {
      this.hips.position.y = 0.78 + breathe;
      this.armL.pivot.rotation.z = -0.08;
      this.armR.pivot.rotation.z = 0.08;
      if (this.tired) {
        this.torso.rotation.x = 0.2;
        this.head.rotation.x = 0.35;
      } else {
        this.head.rotation.y = Math.sin(t * 0.5) * 0.25;
      }
    }
  }

  private targetFacingOr(): number {
    return this.targetFacing;
  }

  setFacing(f: number): void {
    this.targetFacing = f;
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function makeAssistant(): THREE.Group {
  const skin = mat(SKIN_TONES[3]!);
  const shirt = mat(0x2ec4b6);
  const pants = mat(0x33334d);
  const g = group(
    box(0.4, 0.45, 0.24, shirt, 0, 0.82, 0),
    box(0.15, 0.08, 0.5, pants, -0.1, 0.55, 0.2),
    box(0.15, 0.08, 0.5, pants, 0.1, 0.55, 0.2),
    box(0.13, 0.5, 0.14, pants, -0.1, 0.27, 0.42),
    box(0.13, 0.5, 0.14, pants, 0.1, 0.27, 0.42),
    sphere(0.17, skin, 0, 1.25, 0, 1),
    sphere(0.18, mat(0x1b1b1f), 0, 1.33, -0.02, 1),
    box(0.1, 0.1, 0.4, shirt, -0.26, 0.85, 0.18),
    box(0.1, 0.1, 0.4, shirt, 0.26, 0.85, 0.18),
  );
  g.children[6]!.scale.set(1.05, 0.7, 1.05);
  return g;
}
