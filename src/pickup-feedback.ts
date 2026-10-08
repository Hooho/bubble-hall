import { isActive, MAX_LIVES, rewardNames, type Reward } from './skills';
import { rewardIcon } from './reward-icons';
import './pickup-feedback.css';

/**
 * Pickup feedback, one distinct language per item family:
 *  - score   (coin)                  → coin pops "+5" and the player's score card flashes gold
 *  - growth  (bomb / flame / speed)  → "+1" over the head, a glint flies into the matching attribute chip, which bumps
 *  - protect (shield / life)         → double shockwave around the player, icon hovers, a protection pill appears at the top
 *  - active  (4 skills)              → icon arcs into the skill slot, slot flips in with a burst, "就绪" bubble above the slot
 * All effects are DOM-only and ephemeral: they never change gameplay or capture pointer input.
 */
export type PickupFamily = 'score' | 'growth' | 'protect' | 'active';
export const pickupFamily = (item: Reward): PickupFamily =>
  item === 'coin' ? 'score' : item === 'shield' || item === 'life' ? 'protect' : isActive(item) ? 'active' : 'growth';

const colors: Record<Reward, string> = { coin:'#efab24', bomb:'#3b7fe0', flame:'#ff7a2b', speed:'#2aaef5', shield:'#2fbf68', life:'#f2547f', invincible:'#9375da', super:'#ec3b3f', dash:'#f5a300', rapid:'#e56746' };
const growthLabel: Partial<Record<Reward, string>> = { bomb: '容量 +1', flame: '范围 +1', speed: '移速 ↑' };
const growthSlot: Partial<Record<Reward, number>> = { bomb: 0, flame: 1, speed: 2 };
const protectCopy: Partial<Record<Reward, [string, string]>> = { shield: ['获得护盾', '挡下一次爆炸'] };
const activeHint: Partial<Record<Reward, string>> = { invincible: '3 秒内不受伤害', super: '准备后放弹，可穿透一个箱子', dash: '5 秒移动大幅加速', rapid: '4 秒内按住连续放弹' };

const reducedMotion = () => document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const center = (el: Element) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

function temporary(root: HTMLElement, element: HTMLElement, duration: number): HTMLElement {
  root.append(element);
  window.setTimeout(() => element.remove(), duration);
  return element;
}

function make(className: string, point: { x: number; y: number }, color: string, html = ''): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  el.style.cssText = `left:${point.x}px;top:${point.y}px;--pickup-color:${color}`;
  el.innerHTML = html;
  return el;
}

/** Small glints that travel from the pickup point to a HUD target. */
function glints(root: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }, color: string, count = 3): void {
  for (let i = 0; i < count; i += 1) {
    const glint = temporary(root, make('pickup-glint', from, color), 1100);
    glint.animate([
      { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 },
      { transform: 'translate(-50%,calc(-50% - 22px)) scale(1)', opacity: .9, offset: .3 },
      { transform: `translate(calc(-50% + ${to.x - from.x}px),calc(-50% + ${to.y - from.y}px)) scale(.15)`, opacity: 0 },
    ], { duration: 800, delay: i * 60, fill: 'both', easing: 'cubic-bezier(.2,.7,.3,1)' });
  }
}

export function showPickup(root: HTMLElement, item: Reward, point: { x: number; y: number } | null, capped = false, replaced = false, own = true, lives = 0): void {
  const reduced = reducedMotion();
  const color = colors[item];
  const family = pickupFamily(item);

  // Keep concurrent feedback bounded when several players collect at once.
  const previous = root.querySelectorAll('.pickup-particle');
  if (previous.length >= 6) previous[0].remove();

  if (!own) {
    // Opponents: just a quiet icon blip so the player can read what was taken.
    if (point) {
      const blip = temporary(root, make('pickup-particle pickup-other', point, color, rewardIcon(item)), 900);
      if (!reduced) blip.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.5)' }, { opacity: .85, transform: 'translate(-50%,calc(-50% - 16px)) scale(.85)', offset: .3 }, { opacity: 0, transform: 'translate(-50%,calc(-50% - 30px)) scale(.8)' }], { duration: 850, fill: 'forwards' });
    }
    return;
  }

  if (family === 'score') return scoreFeedback(root, point, color, reduced);
  if (family === 'growth') return growthFeedback(root, item, point, color, capped, reduced);
  if (family === 'protect') return protectFeedback(root, item, point, color, capped, reduced, lives);
  return activeFeedback(root, item, point, color, replaced, reduced);
}

function scoreFeedback(root: HTMLElement, point: { x: number; y: number } | null, color: string, reduced: boolean): void {
  if (point) {
    const prev = root.querySelector<HTMLElement>('.pickup-player-coin');
    const total = 5 + Number(prev?.dataset.total ?? 0);
    prev?.remove();
    const coin = temporary(root, make('pickup-particle pickup-player-coin', point, color, `${rewardIcon('coin')}<b>＋${total}</b>`), 1100);
    coin.dataset.total = String(total);
    if (!reduced) coin.animate([{ transform: 'translate(-50%,-50%) scale(.5)', opacity: 0, easing: 'cubic-bezier(.2,.8,.3,1.3)' }, { transform: 'translate(-50%,calc(-50% - 26px)) scale(1.15)', opacity: 1, offset: .2 }, { transform: 'translate(-50%,calc(-50% - 36px)) scale(1)', opacity: 1, offset: .7 }, { transform: 'translate(-50%,calc(-50% - 48px)) scale(.95)', opacity: 0 }], { duration: 1050, easing: 'linear', fill: 'forwards' });
  }
  const card = root.querySelector<HTMLElement>('.match-score.is-you');
  if (card && !reduced) card.animate([{ boxShadow: '0 0 0 0 #ffcf3a00', background: '#fff8d8' }, { boxShadow: '0 0 0 4px #ffcf3a88', background: '#fff3c0', offset: .3 }, { boxShadow: '0 0 0 0 #ffcf3a00', background: '' }], { duration: 700 });
  if (!reduced) navigator.vibrate?.(6);
}

function growthFeedback(root: HTMLElement, item: Reward, point: { x: number; y: number } | null, color: string, capped: boolean, reduced: boolean): void {
  const chip = root.querySelectorAll<HTMLElement>('.base-attributes > div')[growthSlot[item] ?? -1];
  if (point) {
    const label = capped ? '已满' : growthLabel[item] ?? '';
    const pop = temporary(root, make(`pickup-particle pickup-growth${capped ? ' is-capped' : ''}`, point, color, `${rewardIcon(item)}<b>${label}</b>`), 1100);
    if (!reduced) pop.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0, easing: 'cubic-bezier(.2,.8,.3,1.3)' }, { transform: 'translate(-50%,calc(-50% - 30px)) scale(1.12)', opacity: 1, offset: .25 }, { transform: 'translate(-50%,calc(-50% - 40px)) scale(1)', opacity: 1, offset: .7 }, { transform: 'translate(-50%,calc(-50% - 52px)) scale(.95)', opacity: 0 }], { duration: 1050, easing: 'linear', fill: 'forwards' });
    if (chip && !reduced && !capped) glints(root, point, center(chip), color, 4);
  }
  if (!chip) return;
  chip.style.setProperty('--pickup-color', color);
  chip.classList.remove('attr-bump', 'attr-capped');
  void chip.offsetWidth;
  chip.classList.add(capped ? 'attr-capped' : 'attr-bump');
  window.setTimeout(() => chip.classList.remove('attr-bump', 'attr-capped'), 1300);
  if (!capped) {
    const c = center(chip);
    const plus = temporary(root, make('attr-plus', { x: c.x, y: c.y - 18 }, color, '+1'), 1200);
    if (!reduced) plus.animate([{ opacity: 0, transform: 'translate(-50%,0) scale(.6)' }, { opacity: 1, transform: 'translate(-50%,-14px) scale(1.1)', offset: .3 }, { opacity: 0, transform: 'translate(-50%,-30px) scale(1)' }], { duration: 1100, delay: reduced ? 0 : 450, fill: 'both' });
    if (!reduced) navigator.vibrate?.(8);
  }
}

function protectFeedback(root: HTMLElement, item: Reward, point: { x: number; y: number } | null, color: string, capped: boolean, reduced: boolean, lives = 0): void {
  if (point) {
    if (!reduced && !capped) {
      for (let i = 0; i < 2; i += 1) {
        const wave = temporary(root, make('pickup-shockwave', { x: point.x, y: point.y + 26 }, color), 1000);
        wave.style.animationDelay = `${i * 160}ms`;
      }
    }
    const icon = temporary(root, make(`pickup-particle pickup-protect${capped ? ' is-capped' : ''}`, point, color, rewardIcon(item)), 1300);
    if (!reduced) icon.animate([{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 0, easing: 'cubic-bezier(.2,.8,.3,1.4)' }, { transform: 'translate(-50%,calc(-50% - 34px)) scale(1.1)', opacity: 1, offset: .25 }, { transform: 'translate(-50%,calc(-50% - 38px)) scale(1)', opacity: 1, offset: .75 }, { transform: 'translate(-50%,calc(-50% - 40px)) scale(.6)', opacity: 0 }], { duration: 1250, easing: 'linear', fill: 'forwards' });
  }
  // The pill sits in the passive-status row under the board (never over the playfield).
  const slot = root.querySelector<HTMLElement>('#passive-status');
  const stage = slot?.parentElement;
  if (!slot || !stage) return;
  stage.querySelector('.pickup-protect-pill')?.remove();
  const [title, note] = item === 'life'
    ? capped ? [`额外生命已满`, `最多 ${MAX_LIVES} 条`] : [`额外生命 +1`, `共 ${lives} 条`]
    : capped ? [`${rewardNames[item]}已在身上`, '不叠加'] : protectCopy[item] ?? [rewardNames[item], ''];
  const pill = document.createElement('div');
  pill.className = `pickup-protect-pill${capped ? ' is-capped' : ''}`;
  pill.setAttribute('role', 'status');
  pill.style.setProperty('--pickup-color', color);
  const pips = item === 'life' ? `<span class="life-pips" aria-hidden="true">${Array.from({ length: MAX_LIVES }, (_, i) => `<i class="${i < lives ? 'on' : ''}${i === lives - 1 && !capped ? ' new' : ''}"></i>`).join('')}</span>` : '';
  pill.innerHTML = `${rewardIcon(item)}<strong>${title}</strong><small>${note}</small>${pips}`;
  pill.style.top = `${slot.offsetTop + slot.offsetHeight / 2 + 4}px`;
  stage.append(pill);
  window.setTimeout(() => pill.remove(), 2300);
  const badge = root.querySelector<HTMLElement>(`#passive-status [data-passive="${item}"]`);
  if (badge && !reduced) badge.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: .35 }, { transform: 'scale(1)' }], { duration: 600, delay: 300 });
  if (!reduced && !capped) navigator.vibrate?.([12, 30, 12]);
}

function activeFeedback(root: HTMLElement, item: Reward, point: { x: number; y: number } | null, color: string, replaced: boolean, reduced: boolean): void {
  const slot = root.querySelector<HTMLElement>('#skill-button');
  const target = slot ? center(slot) : null;
  if (point) {
    const icon = temporary(root, make('pickup-particle pickup-active', point, color, rewardIcon(item)), 1100);
    if (!reduced) {
      const dx = target ? target.x - point.x : 0, dy = target ? target.y - point.y : -44;
      // Arc: rise first, then swoop into the slot.
      icon.animate([
        { transform: 'translate(-50%,-50%) scale(.5) rotate(0)', opacity: 0 },
        { transform: 'translate(-50%,calc(-50% - 36px)) scale(1.3) rotate(-12deg)', opacity: 1, offset: .28 },
        { transform: `translate(calc(-50% + ${dx * .55}px),calc(-50% + ${Math.min(dy * .3, -60)}px)) scale(1) rotate(8deg)`, opacity: 1, offset: .62 },
        { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.5) rotate(0)`, opacity: .2 },
      ], { duration: 900, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'forwards' });
      if (target) glints(root, point, target, color, 3);
    }
  }
  const dock = root.querySelector<HTMLElement>('.skill-dock');
  if (!dock) return;
  if (slot && !reduced) {
    window.setTimeout(() => {
      slot.animate([{ transform: 'perspective(300px) rotateY(90deg) scale(.9)' }, { transform: 'perspective(300px) rotateY(-12deg) scale(1.12)', offset: .6 }, { transform: 'perspective(300px) rotateY(0) scale(1)' }], { duration: 520, easing: 'cubic-bezier(.3,.7,.3,1.3)' });
      slot.animate([{ boxShadow: `0 0 0 2px ${color}` }, { boxShadow: `0 0 26px 7px ${color}`, offset: .4 }, { boxShadow: '0 0 0 0 transparent' }], { duration: 1100 });
      if (target) {
        const burst = temporary(root, make('pickup-burst', target, color), 800);
        burst.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>';
      }
    }, point ? 780 : 0);
  }
  dock.querySelector('.pickup-banner')?.remove();
  const banner = document.createElement('div');
  banner.className = 'pickup-banner';
  banner.setAttribute('role', 'status');
  banner.style.setProperty('--pickup-color', color);
  const touch = !!root.querySelector('.game-screen.layout-touch');
  banner.innerHTML = `${rewardIcon(item)}<div><strong>${rewardNames[item]} ${replaced ? '已替换' : '就绪'}</strong><small>${activeHint[item] ?? ''} · ${touch ? '点技能键释放' : '按 E 释放'}</small></div>`;
  if (slot) {
    // point the bubble's tail at the skill slot, wherever the dock places it
    const d = dock.getBoundingClientRect(), r = slot.getBoundingClientRect();
    banner.style.setProperty('--tail-right', `${Math.max(14, d.right - (r.left + r.width / 2) - 6)}px`);
  }
  dock.append(banner);
  window.setTimeout(() => banner.remove(), 2600);
  if (!reduced) navigator.vibrate?.([10, 35, 10, 35, 18]);
}
