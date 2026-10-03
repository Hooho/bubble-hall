import { rewardNames, type Reward } from './skills';
import { rewardIcon } from './reward-icons';

const descriptions: Record<Reward, { effect: string; use: string }> = {
  coin: { effect: '拾取后本场积分 +5，玩家和电脑规则相同。', use: '每隔 5–9 秒在安全空格随机出现，场上最多 6 枚。接触自动拾取，不占技能槽；爆炸会摧毁金币。' },
  bomb: { effect: '同时在场的炸弹容量 +1，最多 5 颗。', use: '拾取自动生效。本局保留，下一场重置。' },
  flame: { effect: '爆炸距离 +1 格，普通炸弹最多 5 格。', use: '拾取自动生效。范围越大，越要预留退路。' },
  speed: { effect: '基础移动速度提升 10%，最多提升至 130%。', use: '拾取自动生效，最多成长 3 次。不是限时疾跑。' },
  shield: { effect: '自动抵挡一次爆炸，破盾后保护 0.8 秒。', use: '不需要按键，不叠加层数。短暂保护防止连续爆炸立即击杀。' },
  life: { effect: '抵挡一次致命淘汰机会，消耗额外生命后在安全位置复活。', use: '最多储备 1 条。找不到安全位置仍会等待；复活保护 2 秒，基础成长保留。' },
  invincible: { effect: '无敌 3 秒，结束前保护罩闪烁。', use: '主动释放后立即生效、消耗道具。不能穿墙或穿炸弹。' },
  super: { effect: '下一颗炸弹范围额外 +2 格，每个方向可穿透一个箱子，不能穿固定墙。', use: '先按技能键准备，再按放弹释放；再次按技能键取消准备。成功放下才消耗。' },
  dash: { effect: '移动速度临时提高 40%，持续 5 秒；总速度不超过基础的 170%。', use: '主动释放后立即生效、消耗道具。与轻快鞋不同，它是限时增益。' },
  rapid: { effect: '持续 4 秒，放弹最小间隔由 0.35 秒缩短为 0.12 秒。', use: '启动后按住放弹连续放置，松开即停。仍受容量限制，同一格不能重复放弹。' },
};

export function itemGuideMarkup(): string {
  const groups: { title: string; subtitle: string; items: Reward[] }[] = [
    { title: '积分奖励', subtitle: '地图随机刷新 · 拾取即加分', items: ['coin'] },
    { title: '基础成长', subtitle: '拾取即生效 · 不占技能槽', items: ['bomb', 'flame', 'speed'] },
    { title: '被动保护', subtitle: '遇险自动触发 · 不需要操作', items: ['shield', 'life'] },
    { title: '主动技能', subtitle: '一次性使用 · 只有一个携带槽', items: ['invincible', 'super', 'dash', 'rapid'] },
  ];
  return `<main class="screen item-guide-screen"><div class="topline"><button class="icon-button" data-action="settings" aria-label="返回设置">←</button><span class="screen-kicker">道具图鉴 / FIELD GUIDE</span><span class="topline-spacer"></span></div>
    <section class="item-guide-content"><header><p class="eyebrow">KNOW YOUR POWER-UPS</p><h1>认准图标，<em>用对时机。</em></h1><p>全部 10 种道具 · 炸开补给箱有机会获得 · 图标与战场一致</p></header>
    <aside class="guide-controls"><strong>怎么释放？</strong><p>电脑：E 使用技能，F 替换脚下道具，空格放弹。手机：使用独立技能、替换与放弹按钮。</p><p>主动槽空时自动拾取；已有技能时不会覆盖，需要手动替换。超级炸弹准备中不能替换。</p></aside>
    ${groups.map(group => `<section class="guide-section"><h2>${group.title}</h2><p>${group.subtitle}</p><div class="guide-cards">${group.items.map(kind => `<article class="guide-card"><div class="guide-card-icon">${rewardIcon(kind)}</div><div><h3>${rewardNames[kind]}</h3><p>${descriptions[kind].effect}</p><small>${descriptions[kind].use}</small></div></article>`).join('')}</div></section>`).join('')}
    <aside class="guide-controls"><strong>保护判定顺序</strong><p>无敌 → 护盾 → 额外生命 → 淘汰。没有额外生命时不会复活。一次伤害不会同时消耗护盾和额外生命。</p></aside>
    <button class="button button-primary" data-action="settings">返回设置</button></section></main>`;
}
