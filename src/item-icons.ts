import type { Reward } from './skills';

// Candy-style item icons. Each entry returns SVG inner markup for a 64x64 viewBox.
// `u` is a unique id prefix so several icons can live on one page.
const star = (cx: number, cy: number, R: number, r: number, n = 5, rot = -90): string => {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    const rad = i % 2 ? r : R;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(2)},${(cy + Math.sin(a) * rad).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
};
const sparkle = (x: number, y: number, s: number, fill = '#fff'): string =>
  `<path d="M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z" fill="${fill}"/>`;
type Stops = Array<[number, string]>;
const radial = (id: string, stops: Stops, cx = 0.35, cy = 0.3, r = 0.85): string =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</radialGradient>`;
const linear = (id: string, stops: Stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1): string =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const gloss = (cx: number, cy: number, rx: number, ry: number, rot = -32, op = 0.85): string =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="#fff" opacity="${op}"/>`;

// A small round bomb used by bomb / super / rapid.
const miniBomb = (_u: string, x: number, y: number, r: number, grad: string, capColor: string, fuse = true): string => `
  <rect x="${x - r * 0.32}" y="${y - r * 1.12}" width="${r * 0.64}" height="${r * 0.4}" rx="${r * 0.1}" fill="${capColor}"/>
  ${fuse ? `<path d="M${x + r * 0.05} ${y - r * 1.05}Q${x + r * 0.2} ${y - r * 1.6} ${x + r * 0.7} ${y - r * 1.55}" fill="none" stroke="#a5784a" stroke-width="${Math.max(1.6, r * 0.16)}" stroke-linecap="round"/>` : ''}
  <circle cx="${x}" cy="${y}" r="${r}" fill="url(#${grad})"/>
  ${gloss(x - r * 0.38, y - r * 0.4, r * 0.32, r * 0.2)}
  <circle cx="${x - r * 0.6}" cy="${y + r * 0.05}" r="${r * 0.09}" fill="#fff" opacity=".8"/>`;

export const ICONS: Record<Reward, { name: string; body: (u: string) => string }> = {
  coin: { name: '金币', body: (u: string) => `
    <defs>${radial(`${u}g`, [[0, '#fff6b8'], [0.42, '#ffcd3c'], [1, '#ec8f12']])}${linear(`${u}e`, [[0, '#e48a12'], [1, '#b85e08']])}</defs>
    <ellipse cx="32" cy="35.5" rx="22.5" ry="22" fill="url(#${u}e)"/>
    <circle cx="32" cy="31" r="22.5" fill="url(#${u}g)"/>
    <circle cx="32" cy="31" r="16.5" fill="none" stroke="#e5911a" stroke-width="2.4" opacity=".55"/>
    <circle cx="32.6" cy="31.6" r="16.5" fill="none" stroke="#fffbe0" stroke-width="1" opacity=".75"/>
    <path d="M37.6 25.4C36.6 23.1 34.6 22 32 22C28.8 22 26.5 23.8 26.5 26.5C26.5 32.4 37.7 29.6 37.7 35.6C37.7 38.4 35.2 40.2 32 40.2C29 40.2 26.9 38.9 26.1 36.5M32 18.2V44" transform="translate(0 1.5)" fill="none" stroke="#c97608" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>
    <path d="M37.6 25.4C36.6 23.1 34.6 22 32 22C28.8 22 26.5 23.8 26.5 26.5C26.5 32.4 37.7 29.6 37.7 35.6C37.7 38.4 35.2 40.2 32 40.2C29 40.2 26.9 38.9 26.1 36.5M32 18.2V44" fill="none" stroke="#e8921a" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M37.6 25.4C36.6 23.1 34.6 22 32 22C28.8 22 26.5 23.8 26.5 26.5C26.5 32.4 37.7 29.6 37.7 35.6C37.7 38.4 35.2 40.2 32 40.2C29 40.2 26.9 38.9 26.1 36.5M32 18.2V44" fill="none" stroke="#fff3bf" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M15.5 25A17 17 0 0 1 27 14" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".85"/>
    ${sparkle(52, 11, 5)}` },

  bomb: { name: '炸弹容量', body: (u: string) => `
    <defs>${radial(`${u}b`, [[0, '#8cc1ff'], [0.45, '#3b7fe0'], [1, '#183f92']])}${radial(`${u}p`, [[0, '#9dffb4'], [0.6, '#3fcf6c'], [1, '#1f9a4a']], 0.35, 0.3, 0.9)}</defs>
    ${miniBomb(u, 30, 37, 19, `${u}b`, '#28406e')}
    <path d="${star(48.5, 9.5, 6, 2.4, 6)}" fill="#ffd23f"/>
    <circle cx="48.5" cy="9.5" r="1.9" fill="#fff"/>
    <circle cx="49.5" cy="49.5" r="10" fill="url(#${u}p)" stroke="#fff" stroke-width="2.5"/>
    <path d="M49.5 44.2V54.8M44.2 49.5H54.8" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>` },

  flame: { name: '爆炸范围', body: (u: string) => {
    // Classic bomber cross blast: a bright explosion in the middle, flame arms reaching out
    // in four directions and ending in arrow tips (range +1).
    const arm = (rot: number) => `<g transform="rotate(${rot} 32 32)">
      <path d="M32 25.5H52.5V23.5L60.5 32L52.5 40.5V38.5H32Z" fill="url(#${u}out)" stroke-linejoin="round"/>
      <path d="M32 29H52Q54.5 30.4 54.5 32Q54.5 33.6 52 35H32Z" fill="url(#${u}in)"/>
      <path d="M42 27.4H50" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>
    </g>`;
    // 💥-style comic burst: irregular sharp spikes (uneven lengths and spacing), red → yellow → white.
    const jag = (spikes: Array<[number, number]>, cx: number, cy: number, scale: number, tilt: number) => 'M' + spikes.map(([ang, r]) => {
      const a = ((ang + tilt) * Math.PI) / 180;
      return `${(cx + Math.cos(a) * r * scale).toFixed(2)},${(cy + Math.sin(a) * r * scale).toFixed(2)}`;
    }).join('L') + 'Z';
    const outer: Array<[number, number]> = [[0, 21], [17, 11], [34, 17.5], [52, 10.5], [70, 22], [88, 11.5], [104, 16], [122, 10], [140, 20.5], [158, 11], [176, 17], [195, 10.5], [214, 22.5], [232, 11], [250, 16.5], [268, 10], [287, 20], [305, 11.5], [324, 17.5], [342, 10.5]];
    const inner = outer.map(([ang, r]): [number, number] => [ang + 4, r > 13 ? r * 0.68 : r * 0.62]);
    const core = outer.filter((_, i) => i % 2 === 0).flatMap(([ang, r]): Array<[number, number]> => [[ang + 8, r * 0.42], [ang + 26, 3.6]]);
    return `
    <defs>
      <linearGradient id="${u}out" gradientUnits="userSpaceOnUse" x1="32" y1="0" x2="61" y2="0"><stop offset="0" stop-color="#f0502a"/><stop offset=".7" stop-color="#ff7d2c"/><stop offset="1" stop-color="#e9381f"/></linearGradient>
      <linearGradient id="${u}in" gradientUnits="userSpaceOnUse" x1="32" y1="0" x2="53" y2="0"><stop offset="0" stop-color="#fffbe0"/><stop offset=".5" stop-color="#ffe36a"/><stop offset="1" stop-color="#ffb02e"/></linearGradient>
      ${radial(`${u}red`, [[0, '#ff7a3a'], [0.65, '#ee3b2a'], [1, '#c41f1f']], 0.45, 0.4, 0.8)}
      ${radial(`${u}yel`, [[0, '#fff6b0'], [0.6, '#ffd23f'], [1, '#ff9f1c']], 0.45, 0.4, 0.8)}
    </defs>
    ${[0, 90, 180, 270].map(arm).join('')}
    <path d="${jag(outer, 32, 32, 1, -8)}" fill="url(#${u}red)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="${jag(inner, 32.5, 32, 1, -8)}" fill="url(#${u}yel)"/>
    <path d="${jag(core, 32.5, 32, 1, -8)}" fill="#fffdf0"/>
    <path d="M24 22.5L27.5 26.5" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"/>`; } },

  speed: { name: '轻快鞋', body: (u: string) => `
    <defs>${linear(`${u}s`, [[0, '#7fe3ff'], [0.5, '#2aaef5'], [1, '#1673d6']])}${linear(`${u}o`, [[0, '#ffffff'], [1, '#d7e6f3']])}</defs>
    <path d="M3 25H13M5 32H14M3 39H11" stroke="#7fd3ff" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M14 46C13 36 15 24 21 18.5C23 16.5 27 16.5 29.5 18.5C31 24 35 28 42 30.5L51 33.5C57 35.5 60 39.5 60 45V46Z" fill="url(#${u}s)"/>
    <path d="M21 18.5C19 25 19 31 20.5 36" fill="none" stroke="#0f5fb8" stroke-width="2.4" stroke-linecap="round" opacity=".45"/>
    <path d="M31 25.5L35.5 23M34.5 29L39 26.5M38.5 31.5L43 29" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M44 38.5Q52 37 58 41" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>
    <rect x="11.5" y="44" width="51" height="10" rx="5" fill="url(#${u}o)" stroke="#9fc0de" stroke-width="1.4"/>
    <path d="M16 49H58" stroke="#ff7a59" stroke-width="2.4" stroke-linecap="round"/>
    ${gloss(22, 26, 3.5, 6.5, 18, 0.7)}` },

  shield: { name: '护盾', body: (u: string) => `
    <defs>${linear(`${u}s`, [[0, '#b6f7c4'], [0.45, '#3fcf6c'], [1, '#14864a']])}${linear(`${u}r`, [[0, '#f0fff3'], [1, '#a8f0bb']])}</defs>
    <path d="M32 5L53 12.5C53 33 46.5 48 32 58C17.5 48 11 33 11 12.5Z" fill="url(#${u}s)"/>
    <path d="M32 11.5L47.5 17C47.5 32 42.5 43.5 32 51.5C21.5 43.5 16.5 32 16.5 17Z" fill="none" stroke="url(#${u}r)" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M32 11.5L16.5 17C16.5 32 21.5 43.5 32 51.5Z" fill="#fff" opacity=".2"/>
    <text x="32" y="35.5" text-anchor="middle" font-family="Arial Rounded MT Bold,Arial Black,Arial,sans-serif" font-size="14.5" font-weight="900" letter-spacing="-.4" fill="#fff" stroke="#0f6e3a" stroke-width="2.6" paint-order="stroke" stroke-linejoin="round">360</text>
    ${sparkle(55, 8, 5)}${sparkle(8, 48, 3.5, '#c9f7d4')}` },

  life: { name: '额外生命', body: (u: string) => `
    <defs>${radial(`${u}h`, [[0, '#ffc2d4'], [0.4, '#ff5d8c'], [1, '#c41a4e']])}</defs>
    <path d="M30 55C24 50 6 39 6 23C6 12.5 14 7 21.5 7C26.5 7 29 9.5 30 12.5C31 9.5 33.5 7 38.5 7C46 7 54 12.5 54 23C54 39 36 50 30 55Z" fill="url(#${u}h)"/>
    ${gloss(18, 18, 6, 3.6, -35)}
    <circle cx="13.5" cy="27" r="1.8" fill="#fff" opacity=".85"/>
    <circle cx="49" cy="48" r="11" fill="#fff"/>
    <circle cx="49" cy="48" r="8.6" fill="#ff5d8c"/>
    <text x="49" y="52.2" text-anchor="middle" font-family="Arial Rounded MT Bold,Arial,sans-serif" font-size="11.5" font-weight="900" fill="#fff">+1</text>` },

  invincible: { name: '无敌泡泡', body: (u: string) => `
    <defs>${radial(`${u}b`, [[0, '#ffffff'], [0.55, '#efe8ff'], [0.85, '#bba6ff'], [1, '#8a6cf0']], 0.42, 0.38, 0.7)}
      ${linear(`${u}r`, [[0, '#ff8fd0'], [0.5, '#ffe66b'], [1, '#6fe3ff']], 0, 0, 1, 1)}
      ${radial(`${u}k`, [[0, '#ffe9d8'], [0.55, '#ffc49c'], [1, '#e8946a']], 0.4, 0.3, 0.9)}<clipPath id="${u}c"><circle cx="32" cy="32" r="23.2"/></clipPath></defs>
    <circle cx="32" cy="32" r="25" fill="url(#${u}b)"/>
    <path d="M47 50A22 22 0 0 0 54 31" fill="none" stroke="url(#${u}r)" stroke-width="3.4" stroke-linecap="round" opacity=".9"/>
    <g clip-path="url(#${u}c)"><g transform="translate(33 33) scale(.95) translate(-33 -32)">
    <g stroke="#c8754c" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
      <!-- arm: forearm up to the fist, upper arm with a big biceps bulge -->
      <path d="M17.5 27C17 36 22.5 45.5 30.5 50.5C36.5 54 45 52.5 51 47.5L51 36.5C50 28 41.5 24.5 37 30.5C35 33.5 33.3 35.5 31.2 35.5C29.4 32.5 28.4 29.5 28.2 26.5Z" fill="url(#${u}k)"/>
      <!-- fist -->
      <path d="M14.5 23.5C13.5 17.5 17 13 22.5 12.5C28 12 31.5 15.5 31 20.5C30.7 25 27.5 28 22.5 28.2C18.5 28.4 15.2 26.7 14.5 23.5Z" fill="url(#${u}k)"/>
      <path d="M25 17H30.4M25.3 21.4H30.6" fill="none" opacity=".7"/>
      <path d="M24.5 13.2C22 15 21.5 19 24 22.5" fill="none"/>
      <!-- elbow crease + biceps line -->
      <path d="M33.5 44.5C35 42.5 37.5 41.6 40 41.8" fill="none" opacity=".7"/>
    </g>
    <path d="M39.5 31.5C42 29 46 29.5 48 33" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>
    <path d="M17.5 17C18.5 15.2 20 14.4 21.5 14.2" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".85"/>
    </g></g>
    <path d="M45 21L47 17.5M50 25L53.5 23M41 19.5L41.5 15.5" stroke="#ffb21f" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M11.5 40A21 21 0 0 1 11 27" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" opacity=".9"/>
    <path d="M22 11.5A21 21 0 0 1 30 9.6" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".9"/>
    <circle cx="55" cy="12" r="3.2" fill="#e5dcff" stroke="#fff" stroke-width="1.2"/>
    <circle cx="9" cy="52" r="2.2" fill="#e5dcff" stroke="#fff" stroke-width="1"/>` },

  super: { name: '超级炸弹', body: (u: string) => `
    <defs>${radial(`${u}b`, [[0, '#ffa08f'], [0.45, '#ec3b3f'], [1, '#8f1020']])}${linear(`${u}x`, [[0, '#fff1a0'], [1, '#ffb11c']])}</defs>
    <path d="${star(31, 37, 28, 19, 10, -90)}" fill="url(#${u}x)" opacity=".95"/>
    ${miniBomb(u, 31, 37, 18, `${u}b`, '#5b1420')}
    <path d="${star(31, 38, 7.5, 3.4)}" fill="#ffe36a" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M44 7C47 10 49 9 50 6C53 9 52 13 49 14.5C46 14 44 11 44 7Z" fill="#ff8a2b"/>
    <path d="M47.5 9.5C48.5 11 49.5 11 50 10C51 11.5 50 13 48.5 13C47.5 12.5 47 11 47.5 9.5Z" fill="#ffe36a"/>` },

  dash: { name: '疾跑', body: (u: string) => {
    // Sprinting chibi runner: each limb drawn twice (dark outline stroke, then gradient stroke).
    const limbs = [
      { d: 'M33.5 25.5L25 23.5L19.5 30', w: 6 },          // back arm
      { d: 'M28 38L20 45.5L10.5 44', w: 7 },              // back leg (push-off)
      { d: 'M36 23L27.5 37.5', w: 10.5 },                 // torso, leaning forward
      { d: 'M28 38L38.5 42L36 53', w: 7 },                // front leg (knee up)
      { d: 'M36 25.5L45 30L51.5 23.5', w: 6 },            // front arm
    ];
    const line = (d: string, w: number, stroke: string) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `
    <defs>${linear(`${u}d`, [[0, '#ffe25a'], [0.55, '#ffad1f'], [1, '#f07a00']], 0, 0, 0.6, 1)}
      <linearGradient id="${u}s" gradientUnits="userSpaceOnUse" x1="10" y1="10" x2="40" y2="58"><stop offset="0" stop-color="#ffe25a"/><stop offset=".55" stop-color="#ffad1f"/><stop offset="1" stop-color="#f07a00"/></linearGradient></defs>
    <path d="M2.5 21H13M4.5 29H12M2 37H9" stroke="#ffc94a" stroke-width="3" stroke-linecap="round" opacity=".9"/>
    <circle cx="8" cy="50" r="3.4" fill="#fff" opacity=".9"/><circle cx="3.6" cy="47.6" r="2.2" fill="#fff" opacity=".75"/>
    ${limbs.map(l => line(l.d, l.w + 2.8, '#c96500')).join('')}
    ${limbs.map(l => line(l.d, l.w, `url(#${u}s)`)).join('')}
    <circle cx="42" cy="13.5" r="8" fill="#c96500"/>
    <circle cx="42" cy="13.5" r="6.7" fill="url(#${u}d)"/>
    <path d="M35.6 12.2C38 10.2 44 9.6 48.6 11.4" fill="none" stroke="#ff5a4a" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M35.8 12.5L30.5 9.5M35.8 12.5L31 15" stroke="#ff5a4a" stroke-width="2.2" stroke-linecap="round"/>
    ${gloss(39.5, 9.8, 2.2, 1.3, -20, 0.9)}
    <path d="M34 22.5L31 28" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".75"/>
    ${sparkle(56, 44, 4.5)}`; } },

  rapid: { name: '连发模式', body: (u: string) => `
    <defs>${radial(`${u}a`, [[0, '#ffc2a3'], [0.45, '#ff7d52'], [1, '#c23d1d']])}${radial(`${u}b`, [[0, '#ffd8c4'], [0.5, '#ffa07a'], [1, '#d9643c']])}</defs>
    <g opacity=".8">${miniBomb(u, 15, 40, 10, `${u}b`, '#7a3a26', false)}</g>
    <g opacity=".92">${miniBomb(u, 26, 38, 12.5, `${u}b`, '#6e2c1a', false)}</g>
    ${miniBomb(u, 41, 36, 16, `${u}a`, '#5c2312')}
    <path d="${star(53.5, 10, 5, 2, 6)}" fill="#ffd23f"/><circle cx="53.5" cy="10" r="1.6" fill="#fff"/>
    <path d="M4 52H22M8 57.5H20" stroke="#ff9a6b" stroke-width="2.8" stroke-linecap="round" opacity=".8"/>` },
};

// Sticker filter: white die-cut outline + soft drop shadow, shared by every icon.
export const stickerFilter = (id: string): string => `
  <filter id="${id}" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
    <feMorphology in="SourceAlpha" operator="dilate" radius="2.2" result="d"/>
    <feFlood flood-color="#ffffff"/><feComposite in2="d" operator="in" result="outline"/>
    <feGaussianBlur in="d" stdDeviation="1.8" result="b"/><feOffset in="b" dy="2.4" result="ob"/>
    <feFlood flood-color="#123a63" flood-opacity=".3"/><feComposite in2="ob" operator="in" result="shadow"/>
    <feMerge><feMergeNode in="shadow"/><feMergeNode in="outline"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`;

let seq = 0;
export function iconSvg(kind: Reward, cls = 'reward-icon'): string {
  const u = `i${kind}${seq++}`;
  return `<svg class="${cls}" viewBox="-2 -2 68 68" aria-hidden="true"><defs>${stickerFilter(`${u}stk`)}</defs><g filter="url(#${u}stk)">${ICONS[kind].body(u)}</g></svg>`;
}
