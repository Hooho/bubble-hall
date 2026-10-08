import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Ancient-Chinese courtyard props: a seated stone lion (石狮子), and a
 * red palace-wall segment (宫墙) with a yellow glazed-tile roof. Every prop is built once from
 * primitives and merged into one geometry per material, so each instance is only a few meshes.
 */

type MaterialKey = 'mane' | 'stone' | 'stoneDark' | 'carve' | 'red' | 'gold' | 'wall' | 'tile' | 'tileDark' | 'plinth';

export type MergedProp = Array<{ geometry: THREE.BufferGeometry; material: THREE.Material }>;

const materials = (): Record<MaterialKey, THREE.Material> => ({
  stone: new THREE.MeshStandardMaterial({ color: 0xc9c1b2, roughness: 0.8 }),
  mane: new THREE.MeshStandardMaterial({ color: 0xa79d8c, roughness: 0.85 }),
  stoneDark: new THREE.MeshStandardMaterial({ color: 0xa29d92, roughness: 0.9 }),
  carve: new THREE.MeshStandardMaterial({ color: 0x4d4943, roughness: 0.9 }),
  red: new THREE.MeshStandardMaterial({ color: 0xc8322a, roughness: 0.55 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xe8b94a, roughness: 0.35, metalness: 0.35 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xb8392c, roughness: 0.75 }),
  tile: new THREE.MeshStandardMaterial({ color: 0xf0b72f, roughness: 0.4 }),
  tileDark: new THREE.MeshStandardMaterial({ color: 0xc98a1c, roughness: 0.45 }),
  plinth: new THREE.MeshStandardMaterial({ color: 0xcfc9bc, roughness: 0.85 }),
});

class PropBuilder {
  private readonly parts = new Map<MaterialKey, THREE.BufferGeometry[]>();
  public add(geometry: THREE.BufferGeometry, key: MaterialKey, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], rot: [number, number, number] = [0, 0, 0]): void {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
      new THREE.Vector3(...scale),
    );
    const g = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(matrix);
    g.deleteAttribute('uv');
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key)!.push(g);
  }
  public build(mats: Record<MaterialKey, THREE.Material>): MergedProp {
    return [...this.parts.entries()].map(([key, list]) => {
      const geometry = mergeGeometries(list)!;
      geometry.computeBoundingSphere();
      list.forEach((g) => g.dispose());
      return { geometry, material: mats[key] };
    });
  }
}

const sphere = new THREE.SphereGeometry(1, 18, 14);
const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 14);

/** Seated guardian lion facing +z, sitting straight on the floor. Height ≈ 0.85. */
function buildLion(mats: Record<MaterialKey, THREE.Material>): MergedProp {
  const p = new PropBuilder();
  const top = 0.0; // sits directly on the flagstones (no plinth)
  // haunches + back
  p.add(sphere, 'stone', [0, top + 0.15, -0.1], [0.27, 0.19, 0.27]);
  // chest, upright
  p.add(sphere, 'stone', [0, top + 0.3, 0.04], [0.2, 0.27, 0.18]);
  // front legs + paws
  for (const s of [-1, 1]) {
    p.add(cyl, 'stone', [s * 0.11, top + 0.14, 0.15], [0.058, 0.26, 0.058]);
    p.add(sphere, 'stone', [s * 0.11, top + 0.03, 0.2], [0.075, 0.045, 0.09]);
    // claws
    for (const c of [-1, 0, 1]) p.add(sphere, 'carve', [s * 0.11 + c * 0.03, top + 0.02, 0.285], [0.012, 0.012, 0.012]);
    // hind feet
    p.add(sphere, 'stone', [s * 0.2, top + 0.04, -0.02], [0.08, 0.045, 0.11]);
  }
  // embroidered ball (绣球) under the right paw
  p.add(sphere, 'stone', [0.2, top + 0.075, 0.22], [0.075, 0.075, 0.075]);
  p.add(new THREE.TorusGeometry(0.075, 0.012, 6, 18), 'carve', [0.2, top + 0.075, 0.22], [1, 1, 1], [0, Math.PI / 4, 0]);
  p.add(new THREE.TorusGeometry(0.075, 0.012, 6, 18), 'carve', [0.2, top + 0.075, 0.22], [1, 1, 1], [Math.PI / 2, 0, 0]);
  // red silk ribbon + golden bell on the neck
  p.add(new THREE.TorusGeometry(0.16, 0.028, 8, 24), 'red', [0, top + 0.47, 0.05], [1, 1, 0.85], [Math.PI / 2 - 0.25, 0, 0]);
  p.add(sphere, 'gold', [0, top + 0.43, 0.2], [0.045, 0.045, 0.045]);
  // head
  const hy = top + 0.62, hz = 0.1;
  p.add(sphere, 'stone', [0, hy, hz], [0.2, 0.18, 0.18]);
  // curly mane: ring of curls behind the face + a crown row
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    p.add(sphere, 'mane', [Math.cos(a) * 0.2, hy + Math.sin(a) * 0.18, hz - 0.06], [0.065, 0.065, 0.06]);
  }
  for (const cx of [-0.1, 0, 0.1]) p.add(sphere, 'mane', [cx, hy + 0.15, hz + 0.04], [0.05, 0.05, 0.05]);
  // ears
  for (const s of [-1, 1]) p.add(sphere, 'stone', [s * 0.17, hy + 0.12, hz + 0.02], [0.045, 0.035, 0.03]);
  // big round eyes with dark pupils, heavy brows
  for (const s of [-1, 1]) {
    p.add(sphere, 'stone', [s * 0.075, hy + 0.04, hz + 0.155], [0.045, 0.04, 0.035]);
    p.add(sphere, 'carve', [s * 0.075, hy + 0.04, hz + 0.188], [0.018, 0.018, 0.01]);
    p.add(box, 'stoneDark', [s * 0.08, hy + 0.09, hz + 0.15], [0.09, 0.022, 0.04], [0, 0, s * -0.2]);
  }
  // wide muzzle, nose, open grinning mouth with tongue
  p.add(sphere, 'stone', [0, hy - 0.05, hz + 0.16], [0.11, 0.07, 0.07]);
  p.add(sphere, 'carve', [0, hy - 0.005, hz + 0.225], [0.035, 0.022, 0.02]);
  p.add(sphere, 'carve', [0, hy - 0.1, hz + 0.18], [0.075, 0.03, 0.03]);
  p.add(sphere, 'red', [0, hy - 0.105, hz + 0.195], [0.035, 0.015, 0.02]);
  // curled tail behind
  for (let i = 0; i < 4; i += 1) p.add(sphere, 'stone', [-0.05 + i * 0.04, top + 0.32 + i * 0.05, -0.32 + i * 0.015], [0.06, 0.06, 0.05]);
  return p.build(mats);
}

/** Palace wall segment running along x (rotate 90° for z). Origin is the floor; height ≈ 0.98. */
function buildPalaceWall(mats: Record<MaterialKey, THREE.Material>): MergedProp {
  const p = new PropBuilder();
  p.add(box, 'plinth', [0, 0.07, 0], [1, 0.14, 0.86]);
  p.add(box, 'wall', [0, 0.42, 0], [1, 0.56, 0.7]);
  // gold door-stud style band under the eaves
  p.add(box, 'tileDark', [0, 0.69, 0], [1, 0.035, 0.8]);
  // glazed roof: eave slab + triangular prism (3-sided cylinder lying along x) + ridge
  p.add(box, 'tile', [0, 0.73, 0], [1.02, 0.05, 0.88]);
  p.add(new THREE.CylinderGeometry(0.42, 0.42, 1.02, 3), 'tile', [0, 0.8, 0], [1, 0.85, 0.5], [0, 0, Math.PI / 2]);
  p.add(box, 'tileDark', [0, 0.925, 0], [1.03, 0.05, 0.08]);
  // tile ribs on both roof slopes
  for (let i = 0; i < 4; i += 1) {
    const x = -0.375 + i * 0.25;
    for (const s of [-1, 1]) p.add(box, 'tileDark', [x, 0.83, s * 0.17], [0.035, 0.03, 0.3], [s * -0.62, 0, 0]);
  }
  return p.build(mats);
}

export type AncientKit = { lion: MergedProp; wall: MergedProp; dispose: () => void };

export function createAncientKit(): AncientKit {
  const mats = materials();
  const lion = buildLion(mats);
  const wall = buildPalaceWall(mats);
  return {
    lion,
    wall,
    dispose: () => {
      [...lion, ...wall].forEach(({ geometry }) => geometry.dispose());
      Object.values(mats).forEach((m) => m.dispose());
    },
  };
}

/** Builds one instance. The first sub-mesh is the root (so it can be stored as a tile mesh). */
export function instantiate(prop: MergedProp): THREE.Mesh {
  const [first, ...rest] = prop;
  const root = new THREE.Mesh(first.geometry, first.material);
  for (const part of rest) root.add(new THREE.Mesh(part.geometry, part.material));
  return root;
}

/** 青石板 flagstones: one slab per cell (some split in two), blue-grey with worn edges, cracks and moss. */
export function slateTexture(cols: number, rows: number, seed: number): THREE.CanvasTexture {
  const cell = 96;
  const canvas = document.createElement('canvas');
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext('2d')!;
  let state = seed >>> 0;
  const rand = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 0x100000000; };
  ctx.fillStyle = '#4d5a5e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const slab = (x: number, y: number, w: number, h: number) => {
    const tone = 0.88 + rand() * 0.2;
    const base = new THREE.Color(0x8a9ea6).multiplyScalar(tone);
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, `#${base.clone().lerp(new THREE.Color(0xffffff), 0.12).getHexString()}`);
    g.addColorStop(1, `#${base.clone().multiplyScalar(0.9).getHexString()}`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(x + 3, y + 3, w - 6, h - 6, 6); ctx.fill();
    // worn light edge (top-left) + shadow edge (bottom-right)
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath(); ctx.moveTo(x + 7, y + h - 6); ctx.lineTo(x + 5, y + 7); ctx.lineTo(x + w - 7, y + 5); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,30,35,0.25)';
    ctx.beginPath(); ctx.moveTo(x + w - 4, y + 9); ctx.lineTo(x + w - 4, y + h - 4); ctx.lineTo(x + 9, y + h - 4); ctx.stroke();
    // stone speckle
    for (let i = 0; i < (w * h) / 260; i += 1) {
      ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(20,30,40,0.1)';
      ctx.fillRect(x + 6 + rand() * (w - 12), y + 6 + rand() * (h - 12), 2, 2);
    }
    // occasional hairline crack
    if (rand() < 0.3) {
      ctx.strokeStyle = 'rgba(30,40,45,0.35)';
      ctx.lineWidth = 1.2;
      let cx = x + 10 + rand() * (w - 20), cy = y + 8;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      for (let k = 0; k < 4; k += 1) { cx += (rand() - 0.5) * 14; cy += h / 5; ctx.lineTo(cx, cy); }
      ctx.stroke();
    }
  };
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const px = x * cell, py = y * cell;
      const r = rand();
      if (r < 0.2) { slab(px, py, cell / 2, cell); slab(px + cell / 2, py, cell / 2, cell); }
      else if (r < 0.4) { slab(px, py, cell, cell / 2); slab(px, py + cell / 2, cell, cell / 2); }
      else slab(px, py, cell, cell);
      // moss in some grout corners
      if (rand() < 0.35) {
        ctx.fillStyle = `rgba(96,140,70,${0.35 + rand() * 0.3})`;
        const mx = px + (rand() < 0.5 ? 0 : cell), my = py + (rand() < 0.5 ? 0 : cell);
        for (let k = 0; k < 6; k += 1) { ctx.beginPath(); ctx.arc(mx + (rand() - 0.5) * 14, my + (rand() - 0.5) * 14, 2 + rand() * 3, 0, Math.PI * 2); ctx.fill(); }
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
