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
  flame: [
    { path: 'M32 3 L41 13 L36 13 L36 22 L28 22 L28 13 L23 13 Z M61 32 L51 41 L51 36 L42 36 L42 28 L51 28 L51 23 Z M32 61 L23 51 L28 51 L28 42 L36 42 L36 51 L41 51 Z M3 32 L13 23 L13 28 L22 28 L22 36 L13 36 L13 41 Z', fill: '#f38a35', stroke: '#fff', width: 2 },
    { path: 'M32 19 A13 13 0 1 0 32 45 A13 13 0 1 0 32 19 Z', fill: '#d65a23', stroke: '#fff3c5', width: 2 },
    { path: 'M32 23 L35 29 L42 32 L35 35 L32 42 L29 35 L22 32 L29 29 Z', fill: '#fff0a0' },
    { path: 'M18 9 L9 9 L9 18 M46 9 L55 9 L55 18 M9 46 L9 55 L18 55 M46 55 L55 55 L55 46', fill: 'none', stroke: '#ffce87', width: 2 },
  ],
  bomb: [
    { path: 'M27 20 Q27 9 38 11', fill: 'none', stroke: '#586786', width: 4 },
    { path: 'M21 19 L32 19 L34 26 L19 26 Z', fill: '#263d6b', stroke: '#fff', width: 2 },
    { path: 'M27 24 A18 18 0 1 0 27 60 A18 18 0 1 0 27 24 Z', fill: '#367cca', stroke: '#fff', width: 2 },
    { path: 'M39 32 Q46 49 30 55 Q17 58 12 45 Q20 56 32 47 Q39 41 39 32 Z', fill: '#24518d' },
    { path: 'M17 37 Q18 31 25 31', fill: 'none', stroke: '#bceaff', width: 4 },
    { path: 'M43 5 L51 5 L51 14 L60 14 L60 22 L51 22 L51 31 L43 31 L43 22 L34 22 L34 14 L43 14 Z', fill: '#38b899', stroke: '#fff', width: 2.5 },
  ],
  super: [
    { path: 'M10 20 L5 12 M7 32 L2 31 M49 40 L60 43 M46 52 L53 59', fill: 'none', stroke: '#f1b73e', width: 3 },
    { path: 'M34 21 Q35 9 46 12 L50 8', fill: 'none', stroke: '#98592c', width: 4 },
    { path: 'M50 2 L53 8 L60 9 L55 14 L56 20 L50 17 L44 20 L45 14 L40 9 L47 8 Z', fill: '#ffd95c', stroke: '#fff', width: 2 },
    { path: 'M26 19 L38 21 L38 28 L24 26 Z', fill: '#b47829', stroke: '#fff', width: 2 },
    { path: 'M30 23 A19 19 0 1 0 30 61 A19 19 0 1 0 30 23 Z', fill: '#f4b638', stroke: '#fff', width: 2 },
    { path: 'M45 31 Q53 50 35 58 Q20 63 13 48 Q24 58 36 48 Q45 41 45 31 Z', fill: '#d48b22' },
    { path: 'M18 35 Q21 29 28 29', fill: 'none', stroke: '#fff2b8', width: 4 },
    { path: 'M32 31 L22 44 L29 44 L26 54 L40 39 L33 39 L37 31 Z', fill: '#fff8d9', stroke: '#b8791e', width: 1.5 },
  ],
  speed: [
    { path: 'M7 19 L18 17 L24 23 L30 16 L39 29 Q45 34 54 35 Q60 36 60 43 L59 51 L6 51 L5 37 Z', fill: '#54b6e7', stroke: '#fff', width: 2.5 },
    { path: 'M9 21 L17 20 L23 27 L29 24 L32 29 Q22 36 14 27 L8 29 Z', fill: '#244e7e' },
    { path: 'M7 33 L14 31 L16 42 L7 43 Z M39 33 Q46 38 55 38 L58 43 L41 43 Z', fill: '#d8f4ff' },
    { path: 'M21 34 L26 40 L37 34', fill: 'none', stroke: '#fff', width: 3 },
    { path: 'M29 22 L35 22 M32 27 L38 27 M35 32 L41 32', fill: 'none', stroke: '#fff', width: 2.5 },
    { path: 'M6 44 Q30 47 60 43 L60 51 Q44 55 7 52 Z', fill: '#fff9df', stroke: '#377aa9', width: 2 },
    { path: 'M8 54 L57 54 M13 49 L13 52 M22 50 L22 53 M45 49 L45 53 M53 48 L53 52', fill: 'none', stroke: '#244e7e', width: 2 },
  ],
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
