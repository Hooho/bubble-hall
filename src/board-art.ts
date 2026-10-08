import * as THREE from 'three';
import { iconSvg } from './item-icons';

/** Procedural board art (floor stones, wooden crates, shield badge) drawn on canvases — no image assets needed. */

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
const shade = (color: number, amount: number) => {
  const c = new THREE.Color(color);
  return `#${(amount >= 0 ? c.lerp(new THREE.Color(0xffffff), amount) : c.lerp(new THREE.Color(0x000000), -amount)).getHexString()}`;
};

const toTexture = (canvas: HTMLCanvasElement) => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

/** Warm stone tiles, one per grid cell, with grout lines and slight per-tile variation. */
export function floorTexture(cols: number, rows: number, base: number, grout: number, seed: number): THREE.CanvasTexture {
  const cell = 96;
  const canvas = document.createElement('canvas');
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext('2d')!;
  let state = seed >>> 0;
  const rand = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 0x100000000; };
  ctx.fillStyle = hex(grout);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const px = x * cell + 4;
      const py = y * cell + 4;
      const size = cell - 8;
      const tint = (rand() - 0.5) * 0.08 + ((x + y) % 2 ? -0.025 : 0.02);
      const gradient = ctx.createLinearGradient(px, py, px, py + size);
      gradient.addColorStop(0, shade(base, Math.max(0, tint) + 0.08));
      gradient.addColorStop(1, shade(base, Math.min(0, tint) - 0.03));
      ctx.fillStyle = gradient;
      roundRect(ctx, px, py, size, size, 10);
      ctx.fill();
      // Soft bevel: light top-left edge, darker bottom-right edge.
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.moveTo(px + 8, py + size - 4); ctx.lineTo(px + 4, py + 8); ctx.lineTo(px + size - 8, py + 4); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,90,50,0.16)';
      ctx.beginPath(); ctx.moveTo(px + size - 3, py + 10); ctx.lineTo(px + size - 3, py + size - 3); ctx.lineTo(px + 10, py + size - 3); ctx.stroke();
      // A few speckles so the stone doesn't look like flat plastic.
      for (let i = 0; i < 5; i += 1) {
        ctx.fillStyle = `rgba(150,115,70,${0.05 + rand() * 0.07})`;
        ctx.beginPath(); ctx.arc(px + 10 + rand() * (size - 20), py + 10 + rand() * (size - 20), 1.5 + rand() * 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  return toTexture(canvas);
}

/** Lawn: mowed stripes in two greens per cell, grass blades and a few tiny flowers. */
export function grassTexture(cols: number, rows: number, base: number, seed: number): THREE.CanvasTexture {
  const cell = 96;
  const canvas = document.createElement('canvas');
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext('2d')!;
  let state = seed >>> 0;
  const rand = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 0x100000000; };
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const px = x * cell, py = y * cell;
      const light = (x + y) % 2 === 0;
      const g = ctx.createLinearGradient(px, py, px, py + cell);
      g.addColorStop(0, shade(base, light ? 0.1 : -0.02));
      g.addColorStop(1, shade(base, light ? 0.02 : -0.09));
      ctx.fillStyle = g;
      ctx.fillRect(px, py, cell, cell);
      // grass blades
      for (let i = 0; i < 26; i += 1) {
        const bx = px + rand() * cell, by = py + 8 + rand() * (cell - 8), h = 5 + rand() * 7;
        ctx.strokeStyle = rand() < 0.5 ? `rgba(255,255,220,${0.18 + rand() * 0.15})` : `rgba(40,100,30,${0.14 + rand() * 0.12})`;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + (rand() - 0.5) * 4, by - h * 0.6, bx + (rand() - 0.5) * 6, by - h); ctx.stroke();
      }
      // occasional tiny flowers
      if (rand() < 0.22) {
        const fx = px + 16 + rand() * (cell - 32), fy = py + 16 + rand() * (cell - 32);
        const petal = ['#ffffff', '#ffe36a', '#ffb3cf'][Math.floor(rand() * 3)];
        ctx.fillStyle = petal;
        for (let k = 0; k < 5; k += 1) { const a = (k / 5) * Math.PI * 2; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 3.4, fy + Math.sin(a) * 3.4, 2.6, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#f5a623';
        ctx.beginPath(); ctx.arc(fx, fy, 2, 0, Math.PI * 2); ctx.fill();
      }
      // soft cell edge so the grid stays readable
      ctx.strokeStyle = 'rgba(30,80,20,0.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, cell - 2, cell - 2);
    }
  }
  return toTexture(canvas);
}

/** Wooden crate face: plank frame, X brace and corner nails. Used on all six faces. */
export function crateTexture(wood: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  // Inner planks.
  ctx.fillStyle = shade(wood, -0.08);
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 4; i += 1) {
    ctx.fillStyle = i % 2 ? shade(wood, -0.04) : shade(wood, -0.1);
    ctx.fillRect(0, i * 64, size, 64);
    ctx.fillStyle = 'rgba(90,50,15,0.35)';
    ctx.fillRect(0, i * 64, size, 3);
  }
  ctx.strokeStyle = 'rgba(110,60,20,0.18)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i += 1) {
    const y = 10 + i * 18;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(80, y + 6, 170, y - 6, size, y + 2); ctx.stroke();
  }
  const plank = (draw: () => void) => {
    ctx.save();
    ctx.shadowColor = 'rgba(70,35,5,0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = shade(wood, 0.12);
    draw();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = shade(wood, -0.35);
    ctx.lineWidth = 3;
    ctx.stroke();
  };
  // X brace (drawn before the frame so the frame sits on top).
  for (const flip of [false, true]) {
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(flip ? -Math.PI / 4 : Math.PI / 4);
    plank(() => roundRect(ctx, -size * 0.62, -17, size * 1.24, 34, 6));
    ctx.restore();
  }
  // Frame.
  const frame = 34;
  plank(() => { ctx.beginPath(); ctx.roundRect(4, 4, size - 8, frame, 8); });
  plank(() => { ctx.beginPath(); ctx.roundRect(4, size - frame - 4, size - 8, frame, 8); });
  plank(() => { ctx.beginPath(); ctx.roundRect(4, 4, frame, size - 8, 8); });
  plank(() => { ctx.beginPath(); ctx.roundRect(size - frame - 4, 4, frame, size - 8, 8); });
  // Top highlight on frame.
  ctx.fillStyle = 'rgba(255,240,200,0.35)';
  ctx.fillRect(12, 9, size - 24, 5);
  // Nails.
  for (const [nx, ny] of [[21, 21], [size - 21, 21], [21, size - 21], [size - 21, size - 21]]) {
    ctx.fillStyle = shade(wood, -0.5);
    ctx.beginPath(); ctx.arc(nx, ny, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(nx - 1.5, ny - 1.5, 1.8, 0, Math.PI * 2); ctx.fill();
  }
  return toTexture(canvas);
}

/** Glowing green "360" shield (same art as the item icon) floating over a shielded player. */
export function shieldBadgeTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const texture = toTexture(canvas);
  const c = size / 2;
  const halo = ctx.createRadialGradient(c, c, 20, c, c, c);
  halo.addColorStop(0, 'rgba(140,255,170,0.55)');
  halo.addColorStop(0.55, 'rgba(70,220,120,0.18)');
  halo.addColorStop(1, 'rgba(70,220,120,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);
  const image = new Image();
  const svg = iconSvg('shield').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" ');
  image.onload = () => { ctx.drawImage(image, 28, 28, 200, 200); texture.needsUpdate = true; };
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return texture;
}
