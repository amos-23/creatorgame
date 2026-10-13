// Small helpers for building original low-poly models from primitives.
import * as THREE from "three";

const matCache = new Map<string, THREE.Material>();

export function mat(color: number, opts: { rough?: number; metal?: number; emissive?: number; emissiveIntensity?: number; transparent?: number } = {}): THREE.MeshStandardMaterial {
  const key = `${color}-${opts.rough ?? 0.8}-${opts.metal ?? 0}-${opts.emissive ?? 0}-${opts.emissiveIntensity ?? 1}-${opts.transparent ?? 1}`;
  const cached = matCache.get(key);
  if (cached) return cached as THREE.MeshStandardMaterial;
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.rough ?? 0.8,
    metalness: opts.metal ?? 0,
    flatShading: true,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: (opts.transparent ?? 1) < 1,
    opacity: opts.transparent ?? 1,
  });
  matCache.set(key, m);
  return m;
}

/** A unique (uncached) material, for things whose colour changes at runtime. */
export function uniqueMat(color: number, opts: { rough?: number; emissive?: number; emissiveIntensity?: number } = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.rough ?? 0.8,
    flatShading: true,
    emissive: opts.emissive ?? 0,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
}

function shadowed<T extends THREE.Mesh>(m: T, cast = true, receive = true): T {
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

export function box(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material));
  m.position.set(x, y, z);
  return m;
}

/** Box positioned by its bottom face (y = floor of the box). */
export function boxOn(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  return box(w, h, d, material, x, y + h / 2, z);
}

export function cyl(rTop: number, rBottom: number, h: number, material: THREE.Material, seg = 8, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), material));
  m.position.set(x, y, z);
  return m;
}

export function sphere(r: number, material: THREE.Material, x = 0, y = 0, z = 0, detail = 1): THREE.Mesh {
  const m = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), material));
  m.position.set(x, y, z);
  return m;
}

export function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  return g;
}

export function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, ry = 0): T {
  o.position.set(x, y, z);
  o.rotation.y = ry;
  return o;
}

/** Canvas-backed texture for signs, screens and posters. */
export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function plane(w: number, h: number, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.receiveShadow = true;
  return m;
}

export const PALETTE = {
  wallBare: 0xd9cbb5,
  wallWarm: 0xf3d9b1,
  wallBrand: 0x3d2c6b,
  floorConcrete: 0x9a958c,
  floorWood: 0xb07a4a,
  wood: 0x8a5a36,
  woodLight: 0xc89263,
  dark: 0x2a2633,
  black: 0x1a1a22,
  white: 0xf5f2ea,
  orange: 0xff8a3d,
  pink: 0xff5d8f,
  teal: 0x2ec4b6,
  yellow: 0xffd23f,
  green: 0x2ec27e,
  purple: 0x7b5cff,
  plant: 0x3f9b55,
  plantDark: 0x2c7a42,
  pot: 0xc8643b,
  metal: 0x8f96a3,
  screen: 0x6ad1ff,
};

export const SKIN_TONES = [0xf1c27d, 0xc68642, 0x8d5524, 0x6b3e1f, 0x4a2a14];
export const OUTFITS = [0xff8a3d, 0x2ec4b6, 0x7b5cff, 0xff5d8f, 0x2ec27e, 0xffd23f];
export const HAIR_COLORS = [0x1b1b1f, 0x3b2416, 0x5a3a22];
