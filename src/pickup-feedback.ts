import { isActive, rewardNames, type Reward } from './skills';
import { rewardIcon } from './reward-icons';
import './pickup-feedback.css';

const colors: Record<Reward, string> = { coin:'#efab24', bomb:'#6595ff', flame:'#ff963b', speed:'#35bdb0', shield:'#64aaff', life:'#f477a6', invincible:'#35cbea', super:'#ffbb36', dash:'#35d6c3', rapid:'#a08aff' };
const growth: Partial<Record<Reward,string>> = { bomb:'可放炸弹＋1', flame:'爆炸范围＋1', speed:'移动速度提升', shield:'护盾已获得', life:'额外生命已获得' };

/** Ephemeral DOM effects: never change gameplay or occupy pointer targets. */
export function showPickup(root: HTMLElement, item: Reward, point: {x:number;y:number} | null, capped = false, replaced = false, own = true): void {
  const reduced = document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const color = colors[item];
  const slot = root.querySelector<HTMLElement>('#skill-button');
  const active = isActive(item);
  const temporary = (element: HTMLElement, duration: number) => { root.append(element); window.setTimeout(() => element.remove(), duration); };
  if (point) {
    // Bound concurrent feedback when several players collect at once.
    const previous = root.querySelectorAll('.pickup-particle');
    if (previous.length >= 6) previous[0].remove();
    const previousCoin = item === 'coin' && own ? root.querySelector<HTMLElement>('.pickup-player-coin') : null;
    const coinTotal = 5 + Number(previousCoin?.dataset.total ?? 0);
    previousCoin?.remove();
    const particle = document.createElement('div');
    particle.className = 'pickup-particle';
    particle.style.cssText = `left:${point.x}px;top:${point.y}px;--pickup-color:${color}`;
    if (item === 'coin' && own) { particle.classList.add('pickup-player-coin'); particle.dataset.total = String(coinTotal); }
    particle.innerHTML = `${rewardIcon(item)}${item === 'coin' ? `<b>＋${own ? coinTotal : 5}</b>` : ''}`;
    temporary(particle, 1100);
    if (!reduced && !capped) {
      const ring = document.createElement('div');
      ring.className = 'pickup-ring';
      ring.style.cssText = `left:${point.x}px;top:${point.y + 24}px;--pickup-color:${color}`;
      temporary(ring,650);
    }
    if (!reduced) {
      const target = active && own && slot ? slot.getBoundingClientRect() : null;
      const dx = target ? target.left + target.width / 2 - point.x : 0;
      const dy = target ? target.top + target.height / 2 - point.y : -44;
      if (target) {
        // A few small glints follow the icon, instead of a large beam over the map.
        for (let i = 0; i < 3; i++) {
          const glint = document.createElement('i');
          glint.className = 'pickup-glint';
          glint.style.cssText = `left:${point.x}px;top:${point.y}px;--pickup-color:${color}`;
          temporary(glint,1100);
          glint.animate([
            {transform:'translate(-50%,-50%) scale(.3)',opacity:0},
            {transform:'translate(-50%,calc(-50% - 20px)) scale(1)',opacity:.8,offset:.3},
            {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.1)`,opacity:0},
          ],{duration:850,delay:i*55,fill:'both',easing:'cubic-bezier(.2,.7,.3,1)'});
        }
      }
      particle.animate([
        {transform:'translate(-50%,-50%) scale(.5)',opacity:0},
        {transform:'translate(-50%,calc(-50% - 20px)) scale(1.15)',opacity:1,offset:.3},
        {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(${target ? '.55' : '1'})`,opacity:0},
      ], {duration:active ? 850 : 1050,easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'});
    }
  }
  if (!own) return;
  if (item === 'coin') { if (!reduced) navigator.vibrate?.(6); return; }
  const dock = root.querySelector<HTMLElement>('.skill-dock');
  if (!dock) return;
  dock.querySelector('.pickup-banner')?.remove();
  const banner = document.createElement('div');
  banner.className = 'pickup-banner';
  banner.setAttribute('role','status');
  banner.style.setProperty('--pickup-color',color);
  const title = capped ? `${rewardNames[item]}已满` : active ? `${rewardNames[item]}${replaced ? '已替换' : '就绪'}` : growth[item];
  banner.innerHTML = `${rewardIcon(item)}<div><strong>${title}</strong><small>${active ? (item === 'super' ? '点击技能准备，再放弹释放' : '点击技能释放') : capped ? '当前效果保持不变' : '已生效'}</small></div>`;
  dock.append(banner);
  window.setTimeout(() => banner.remove(),2200);
  if (active && slot && !reduced) slot.animate([{boxShadow:`0 0 0 2px ${color}`},{boxShadow:`0 0 22px 5px ${color}`,offset:.5},{boxShadow:`0 0 0 0 transparent`}],{duration:1000});
  if (!reduced && !capped) navigator.vibrate?.(active ? [10,35,10] : 8);
}
