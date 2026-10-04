import type { Reward } from './skills';

// Shared vector silhouettes: rendered as SVG in HUD and canvas textures in-world.
export const rewardArt: Record<Reward, { color: string; path: string }> = {
  coin: { color: '#efb526', path: 'M32 4 A28 28 0 1 0 32 60 A28 28 0 1 0 32 4 Z M32 10 A22 22 0 1 1 32 54 A22 22 0 1 1 32 10 Z M28 18 L37 18 L37 22 L33 22 L33 42 L39 42 L39 47 L25 47 L25 42 L29 42 L29 24 L25 26 L23 22 Z' },
  life: { color: '#f05280', path: 'M32 54 C25 48 7 36 7 23 C7 8 24 6 32 18 C40 6 57 8 57 23 C57 36 39 49 32 54 Z' },
  shield: { color: '#24b9b0', path: 'M32 6 L54 15 L51 35 Q47 49 32 58 Q17 49 13 35 L10 15 Z M32 17 L32 45 L41 35 L44 23 Z' },
  speed: { color: '#318acf', path: 'M15 10 L30 10 L30 31 Q37 39 52 40 L57 45 L57 54 L7 54 L7 39 L15 30 Z M12 46 L12 49 L51 49 L51 46 Z' },
  dash: { color: '#e7ad22', path: 'M35 4 L12 35 L28 35 L22 60 L53 24 L36 24 L43 4 Z' },
  flame: { color: '#f07b35', path: 'M34 4 Q38 22 48 26 Q61 43 45 55 Q30 64 17 52 Q4 39 20 22 L22 33 Q33 22 34 4 Z M32 35 Q18 49 31 53 Q43 51 32 35 Z' },
  bomb: { color: '#426fc1', path: 'M29 17 L29 10 L41 10 L41 17 Z M34 19 A19 19 0 1 0 34 57 A19 19 0 1 0 34 19 Z M44 5 L48 5 L48 9 L52 9 L52 13 L48 13 L48 17 L44 17 L44 13 L40 13 L40 9 L44 9 Z' },
  super: { color: '#df982a', path: 'M32 3 L38 15 L52 10 L48 24 L61 32 L48 39 L52 53 L38 49 L32 62 L25 49 L11 53 L15 39 L3 32 L15 24 L11 10 L25 15 Z M32 20 A12 12 0 1 0 32 44 A12 12 0 1 0 32 20 Z' },
  invincible: { color: '#9375da', path: 'M32 4 A28 28 0 1 0 32 60 A28 28 0 1 0 32 4 Z M32 10 A22 22 0 1 1 32 54 A22 22 0 1 1 32 10 Z M32 15 L37 26 L49 28 L40 36 L42 48 L32 42 L22 48 L24 36 L15 28 L27 26 Z' },
  rapid: { color: '#e56746', path: 'M6 17 L20 32 L6 47 L14 54 L35 32 L14 10 Z M30 17 L44 32 L30 47 L38 54 L59 32 L38 10 Z' },
};

type IconLayer = { path: string; fill: string; stroke?: string; width?: number; opacity?: number };
// One layered drawing feeds both the interface SVG and the in-world texture.
// Strong outer silhouettes remain legible at a single map-cell size.
const illustratedRewards: Partial<Record<Reward, IconLayer[]>> = {
  coin: [
    { path: 'M34 7 C49 7 59 18 59 33 C59 48 49 59 34 59 L28 59 L28 7 Z', fill: '#ba6b13', stroke: '#fff', width: 2 },
    { path: 'M50 17 L56 17 M53 25 L59 25 M53 34 L59 34 M51 43 L56 43 M46 51 L51 51', fill: 'none', stroke: '#f4b53b', width: 2 },
    { path: 'M29 5 A24 26 0 1 0 29 57 A24 26 0 1 0 29 5 Z', fill: '#ffcf46', stroke: '#fff8d3', width: 2 },
    { path: 'M29 11 A18 20 0 1 0 29 51 A18 20 0 1 0 29 11 Z', fill: '#f5ac22', stroke: '#cc8115', width: 2 },
    { path: 'M14 30 Q14 16 28 15 M17 46 Q24 51 34 47', fill: 'none', stroke: '#fff0a3', width: 3 },
    { path: 'M29 19 L33 27 L42 28 L35 35 L37 44 L29 39 L21 44 L23 35 L16 28 L25 27 Z', fill: '#ffe88a', stroke: '#ce8c23', width: 1.5 },
    { path: 'M48 3 L50 8 L55 10 L50 12 L48 17 L46 12 L41 10 L46 8 Z', fill: '#fff7ca' },
  ],
  dash: [
    { path: 'M5 23 L19 23 M3 33 L15 33 M7 43 L16 43', fill: 'none', stroke: '#edb23b', width: 4 },
    { path: 'M45 4 A6 6 0 1 0 45 16 A6 6 0 1 0 45 4 Z', fill: '#f3b22b', stroke: '#fff', width: 2 },
    { path: 'M35 18 L42 22 L36 33 L44 40 L42 52 L51 54 L50 60 L35 58 L35 45 L28 39 L22 49 L9 55 L6 49 L18 42 L24 29 L28 23 L23 23 L18 29 L13 25 L21 16 L30 16 Z', fill: '#e9a325', stroke: '#fff', width: 2 },
    { path: 'M39 21 L48 29 L56 25', fill: 'none', stroke: '#fff', width: 9 },
    { path: 'M39 21 L48 29 L56 25', fill: 'none', stroke: '#ce831b', width: 5 },
    { path: 'M29 26 L33 21', fill: 'none', stroke: '#ffe69a', width: 3 },
  ],
  rapid: [
    { path: 'M3 18 L11 18 M2 26 L8 26 M8 41 L16 41 M10 49 L20 49', fill: 'none', stroke: '#e26948', width: 3 },
    { path: 'M16 9 L19 5 L23 6 M30 18 L33 13 L37 14 M47 29 L50 22 L55 24', fill: 'none', stroke: '#925139', width: 3 },
    { path: 'M17 11 A9 9 0 1 0 17 29 A9 9 0 1 0 17 11 Z', fill: '#ffc6ad', stroke: '#fff', width: 2 },
    { path: 'M30 21 A12 12 0 1 0 30 45 A12 12 0 1 0 30 21 Z', fill: '#f39b70', stroke: '#fff', width: 2 },
    { path: 'M46 31 A14 14 0 1 0 46 59 A14 14 0 1 0 46 31 Z', fill: '#e56746', stroke: '#fff', width: 2 },
    { path: 'M13 17 L15 15 M24 29 L27 26 M38 42 L42 38', fill: 'none', stroke: '#fff5e4', width: 3 },
    { path: 'M56 17 L57 21 L61 22 L57 24 L56 28 L54 24 L50 22 L54 21 Z', fill: '#ffd65c', stroke: '#fff', width: 1 },
  ],
  invincible: [
    { path: 'M32 4 A28 28 0 1 0 32 60 A28 28 0 1 0 32 4 Z', fill: '#d5f7ff', stroke: '#fff', width: 3 },
    { path: 'M32 6 A26 26 0 1 0 32 58 A26 26 0 1 0 32 6 Z', fill: '#c0edff', stroke: '#42b8e4', width: 2 },
    { path: 'M20 47 L21 39 Q22 33 32 33 Q42 33 43 39 L44 47 Q32 53 20 47 Z', fill: '#397bc4' },
    { path: 'M32 18 A9 9 0 1 0 32 36 A9 9 0 1 0 32 18 Z', fill: '#397bc4', stroke: '#fff', width: 2 },
    { path: 'M26 26 Q32 23 38 26 L38 30 Q32 34 26 30 Z', fill: '#fff' },
    { path: 'M12 29 Q13 13 29 11 M42 53 Q54 48 54 35', fill: 'none', stroke: '#fff', width: 3.5 },
    { path: 'M52 4 L54 11 L61 13 L54 15 L52 22 L50 15 L43 13 L50 11 Z', fill: '#fff', stroke: '#5fcde7', width: 1.5 },
  ],
};

export function rewardLayers(kind: Reward): IconLayer[] {
  return illustratedRewards[kind] ?? [{ path: rewardArt[kind].path, fill: rewardArt[kind].color, stroke: '#fff', width: 2 }];
}

export function rewardIcon(kind: Reward): string {
  return `<svg class="reward-icon" viewBox="0 0 64 64" aria-hidden="true">${rewardLayers(kind).map(layer => `<path d="${layer.path}" fill="${layer.fill}" fill-rule="evenodd" stroke="${layer.stroke ?? 'none'}" stroke-width="${layer.width ?? 0}" stroke-linejoin="round" stroke-linecap="round" opacity="${layer.opacity ?? 1}"/>`).join('')}</svg>`;
}

export function rewardCanvas(kind: Reward): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Reward icon canvas unavailable');
  ctx.scale(1.7, 1.7);
  ctx.translate(5.6, 4);
  ctx.lineJoin = 'round';ctx.lineCap = 'round';
  for (const layer of rewardLayers(kind)) {
    const path = new Path2D(layer.path);
    ctx.globalAlpha = layer.opacity ?? 1;
    if (layer.fill !== 'none') { ctx.fillStyle = layer.fill; ctx.fill(path, 'evenodd'); }
    if (layer.stroke) { ctx.strokeStyle = layer.stroke; ctx.lineWidth = layer.width ?? 2; ctx.stroke(path); }
  }
  return canvas;
}
