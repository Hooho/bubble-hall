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

export function rewardIcon(kind: Reward): string {
  const art = rewardArt[kind];
  return `<svg class="reward-icon" viewBox="0 0 64 64" aria-hidden="true"><path d="${art.path}" fill="${art.color}" fill-rule="evenodd" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>`;
}

export function rewardCanvas(kind: Reward): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Reward icon canvas unavailable');
  ctx.scale(1.7, 1.7);
  ctx.translate(5.6, 4);
  const art = rewardArt[kind];
  const path = new Path2D(art.path);
  ctx.shadowColor = '#173d7360'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 4;
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.stroke(path);
  const gradient = ctx.createLinearGradient(0, 4, 0, 60);
  gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(0.23, art.color); gradient.addColorStop(1, art.color);
  ctx.fillStyle = gradient; ctx.fill(path, 'evenodd');
  return canvas;
}
