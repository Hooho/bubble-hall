import { itemGuideSections } from './item-guide';
import { rewardIcon } from './reward-icons';
import { MATCH_RULES } from './match-rules';

export function gameplayGuideMarkup(back: 'home' | 'settings'): string {
  return `<main class="screen gameplay-guide">
    <header class="topline"><button class="icon-button" data-action="${back}" aria-label="返回${back==='home'?'大厅':'设置'}">←</button><span class="screen-kicker">玩法一览 / PLAYBOOK</span></header>
    <div class="playbook-content">
      <header class="playbook-intro"><p class="eyebrow">LEARN. PLAY. POP!</p><h1>认准道具，<br><em>玩出你的节奏。</em></h1><p>两分钟一局。炸开箱子、拿下积分，也别忘了给自己留条退路。</p></header>
      <nav class="playbook-nav" aria-label="玩法章节"><a href="#guide-field">战场元素</a><a href="#guide-score">积分机制</a><a href="#guide-match">比赛机制</a><a href="#guide-items">道具图鉴</a></nav>
      <section id="guide-field" class="playbook-section"><h2><span>01</span> 战场元素</h2><div class="field-cards">
        <article class="field-card"><div class="field-art"><i class="guide-bomb"></i></div><h3>炸弹 <small>放下后快离开</small></h3><p>空格放弹，普通放弹间隔 0.35 秒，放下 2 秒后爆炸。初始可同时放 1 颗，拾取容量道具最多提升到 5 颗；爆炸后名额恢复。同一格不能重复放弹。</p><p>爆炸呈十字形，初始向四个方向各延伸 2 格。范围道具可将普通炸弹延伸至 5 格，连锁爆炸可能让附近炸弹提前引爆。</p></article>
        <article class="field-card"><div class="field-art"><i class="guide-crate"></i></div><h3>补给箱 <small>炸开有惊喜</small></h3><p>可以炸开的障碍物。每个箱子被炸毁，炸弹主人获得 ${MATCH_RULES.cratePoints} 分，并有机会掉落道具。普通爆炸到箱子处停止。</p></article>
        <article class="field-card"><div class="field-art"><div class="guide-danger" aria-hidden="true">${Array.from({length:9},(_,i)=>`<i class="${[1,3,4,5,7].includes(i)?'danger-cell':''}"></i>`).join('')}</div></div><h3>红色预警 <small>这是危险区域</small></h3><p>炸弹周围的红色格子标示预计爆炸范围。提前移动到范围外，注意连锁爆炸；预警不是护盾，也不能阻挡伤害。</p></article>
        <article class="field-card"><div class="field-art skill-example">${rewardIcon('invincible')}<b>E</b></div><h3>一个技能槽 <small>拾取 → 携带 → 释放</small></h3><p>通过拾取主动道具获得技能，按 E 释放。只能携带一个：已有技能时，再拾取只能替换，不能叠加或多带。</p><p>站在新道具上按 F 确认替换；手机点击“替换”。超级炸弹按 E 准备，再放弹释放。成长与被动道具自动生效，不占技能槽。</p></article>
      </div><aside class="guide-controls"><strong>操作方式</strong><p>电脑：方向键 / WASD 移动，空格放弹，E 技能，F 替换，Esc 暂停。手机：左侧方向键移动，右侧放弹，独立技能与替换按钮操作。</p></aside></section>
      <section id="guide-score" class="playbook-section"><h2><span>02</span> 积分机制</h2><div class="score-examples"><article><b>+${MATCH_RULES.hitPoints}</b><strong>有效命中对手</strong></article><article><b>+${MATCH_RULES.cratePoints}</b><strong>炸毁一个箱子</strong></article><article>${rewardIcon('coin')}<b>+${MATCH_RULES.coinPoints}</b><strong>拾取一枚金币</strong></article></div><p>这些是决定本局名次的战场分数。击破护盾也算有效命中；自爆、命中无敌选手不加分，同一次连锁对同一人只计一次，归属实际伤害炸弹的主人。</p><details class="guide-longterm"><summary>长期积分怎么计算？</summary><p>有效命中 +20，单次赛胜利 +100；四轮晋级依次 +40 / +60 / +80 / +120。最终冠军 +400、亚军 +240、季军 +160、第四名 +120、第五至八名 +80、第九至十六名 +40。</p><p>轻松 / 标准 / 困难 / 大师的长期积分倍率依次为 1 / 1.3 / 1.6 / 2。本局战场分数不乘难度倍率。试玩不计长期积分，也不进入正式战绩和积分榜。</p></details></section>
      <section id="guide-match" class="playbook-section"><h2><span>03</span> 比赛机制</h2><div class="match-guide-cards"><article><p class="eyebrow">QUICK MATCH</p><h3>单次对战</h3><p>你与 3 位电脑选手，${MATCH_RULES.duration/60} 分钟一局。只剩一位存活者时立即获胜；否则到时比较存活者得分，最高分获胜。</p><p>存活者最高分并列，或全部阵亡，则平局。死亡后本局淘汰，额外生命道具除外。</p></article><article><p class="eyebrow">CHAMPIONSHIP</p><h3>冠军之路</h3><p>64 位选手，四人一局，每组前两名晋级。先比较是否存活，再比较得分；晋级线同分时加赛。</p><div class="tournament-route" aria-label="64强到32强到16强到8强到四人总决赛">64 <span>→</span> 32 <span>→</span> 16 <span>→</span> 8 <span>→</span> 4</div><p>最终四人同场决出冠亚季军，决赛名次同分加赛。旧赛制存档保持原规则，完成后新建赛事使用本赛制。</p></article><article><p class="eyebrow">FREE PRACTICE</p><h3>单人试玩</h3><p>只有你一人，但地图、炸弹、伤害、道具和局内计分与正常比赛一致。到时或淘汰结束，可随时重新开始。</p><p>不计长期积分，不发正式奖励，不覆盖任何正式比赛进度。退出后再次试玩从头开始。</p></article></div></section>
      <section id="guide-items" class="playbook-section"><h2><span>04</span> 道具图鉴</h2><p>全部 10 种 · 与地图上的图标一致</p>${itemGuideSections()}<aside class="guide-controls"><strong>保护判定顺序</strong><p>无敌 → 护盾 → 额外生命 → 淘汰。没有额外生命不会复活，一次伤害不会同时消耗护盾与额外生命。</p></aside></section>
      <button class="button button-primary" data-action="${back}">看明白了，返回${back==='home'?'大厅':'设置'} →</button>
    </div></main>`;
}
