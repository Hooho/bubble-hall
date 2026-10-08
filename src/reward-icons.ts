import type { Reward } from './skills';
import { iconSvg } from './item-icons';

// Candy-style item icons (see item-icons.ts). The same SVG feeds the interface
// directly and is rasterised onto a canvas for the in-world item textures.

export function rewardIcon(kind: Reward): string {
  return iconSvg(kind, 'reward-icon');
}

const images = new Map<Reward, HTMLImageElement>();

function iconImage(kind: Reward): HTMLImageElement {
  let image = images.get(kind);
  if (!image) {
    image = new Image();
    const svg = iconSvg(kind, 'reward-icon').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" ');
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    images.set(kind, image);
  }
  return image;
}

/** Draws the icon onto a canvas. If the SVG is still decoding, `onReady` fires once it has been drawn. */
export function rewardCanvas(kind: Reward, onReady?: () => void): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Reward icon canvas unavailable');
  const image = iconImage(kind);
  const draw = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 8, 8, 240, 240); };
  if (image.complete && image.naturalWidth > 0) draw();
  else image.addEventListener('load', () => { draw(); onReady?.(); }, { once: true });
  return canvas;
}

/** Warm the image cache so in-world items render on their first frame. */
export function preloadRewardIcons(kinds: Reward[]): void {
  kinds.forEach(iconImage);
}
