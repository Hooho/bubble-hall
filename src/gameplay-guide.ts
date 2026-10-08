import { rewardNames, type Reward } from './skills';
import { rewardIcon } from './reward-icons';
import { MATCH_RULES } from './match-rules';

export function gameplayGuideMarkup(back: 'home' | 'settings'): string {
  return `<main class="screen gameplay-guide">
    <header class="topline"><button class="icon-button" data-action="${back}" aria-label="返回${back==='home'?'大厅':'设置'}">←</button><span class="screen-kicker">${back==='home'?'大厅':'设置'}</span></header>
    <div class="playbook-content">
      <header class="playbook-intro"><h1>玩法一览</h1><p class="page-sub"><strong>每局 2 分钟</strong>（可在设置里改为 1 或 3 分钟）：活到最后，或到时争最高分。</p></header>
      <nav class="playbook-nav" aria-label="玩法章节"><a href="#guide-field">战场元素</a><a href="#guide-score">积分机制</a><a href="#guide-match">比赛机制</a><a href="#guide-items">道具图鉴</a></nav>
      <section id="guide-field" class="playbook-section"><h2><span>01</span> 战场元素</h2><div class="field-cards">
        <article class="field-card"><div class="field-art"><i class="guide-bomb"></i></div><h3>炸弹 <small>放下后快离开</small></h3><p><strong>2 秒爆炸</strong> · 放弹间隔 <strong>0.35 秒</strong>。<br>初始容量 1 颗、四向范围 2 格。连锁会提前引爆。</p></article>
        <article class="field-card"><div class="field-art"><i class="guide-crate"></i></div><h3>补给箱 <small>炸开有惊喜</small></h3><p>炸开 <strong>+${MATCH_RULES.cratePoints} 分</strong>，可能掉道具。<br>普通爆炸到箱子处停止。</p></article>
        <article class="field-card"><div class="field-art"><div class="guide-danger" aria-hidden="true">${Array.from({length:9},(_,i)=>`<i class="${[1,3,4,5,7].includes(i)?'danger-cell':''}"></i>`).join('')}</div></div><h3>红色预警 <small>这是危险区域</small></h3><p>红格是<strong>预计爆炸范围</strong>，尽快离开。</p></article>
        <article class="field-card"><div class="field-art skill-example">${rewardIcon('invincible')}<b>E</b></div><h3>一个技能槽 <small>拾取 → 携带 → 释放</small></h3><p>只能带 <strong>1 个主动技能</strong>。<br><strong>E 释放</strong>，站在新道具上 <strong>F 替换</strong>；手机点对应按钮。</p></article>
      </div><aside class="guide-controls"><strong>操作方式</strong><p><strong>方向键 / WASD</strong> 移动 · <strong>空格</strong> 放弹 · <strong>Esc</strong> 暂停。手机使用屏幕按钮。</p></aside></section>
      <section id="guide-score" class="playbook-section"><h2><span>02</span> 积分机制</h2><div class="score-examples"><article><b>+${MATCH_RULES.hitPoints}</b><strong>有效命中对手</strong></article><article><b>+${MATCH_RULES.cratePoints}</b><strong>炸毁一个箱子</strong></article><article>${rewardIcon('coin')}<b>+${MATCH_RULES.coinPoints}</b><strong>拾取一枚金币</strong></article></div><details class="guide-longterm"><summary>哪些命中计分？</summary><p>击破护盾算命中；自爆、命中无敌选手不加分。同次连锁对同一人只计一次，归属实际伤害炸弹的主人。</p></details><details class="guide-longterm"><summary>长期积分怎么计算？</summary><p>有效命中 +20，单次赛胜利 +100；四轮晋级依次 +40 / +60 / +80 / +120。最终冠军 +400、亚军 +240、季军 +160、第四名 +120、第五至八名 +80、第九至十六名 +40。</p><p>轻松 / 标准 / 困难 / 大师的长期积分倍率依次为 1 / 1.3 / 1.6 / 2。本局战场分数不乘难度倍率。试玩不计长期积分，也不进入正式战绩和积分榜。</p></details></section>
      <section id="guide-match" class="playbook-section"><h2><span>03</span> 比赛机制</h2><div class="match-guide-cards"><article><h3>单次对战</h3><p><strong>4 人 · ${MATCH_RULES.duration/60} 分钟</strong><br>独自存活即获胜；到时<strong>存活者最高分</strong>获胜。</p><details><summary>平局与淘汰</summary><p>最高分并列或全部阵亡则平局。死亡淘汰，额外生命道具除外。</p></details></article><article><h3>冠军之路</h3><p><strong>64 人 · 每组前 2 名晋级</strong><br>存活优先，其次比得分。</p><div class="tournament-route" aria-label="64强到32强到16强到8强到四人总决赛">64 <span>→</span> 32 <span>→</span> 16 <span>→</span> 8 <span>→</span> 4</div><p>最后 4 人争冠军；晋级线或决赛名次同分加赛。</p></article><article><h3>单人试玩</h3><p><strong>单人练习 · 机制相同</strong><br>到时或淘汰结束；不计长期积分，不影响正式进度。</p></article></div></section>
      <section id="guide-items" class="playbook-section"><h2><span>04</span> 道具图鉴</h2><p>全部 10 种 · 与地图上的图标一致</p><div class="guide-item-strip">${(Object.keys(rewardNames) as Reward[]).map(k => `<span>${rewardIcon(k)}<small>${rewardNames[k]}</small></span>`).join('')}</div><button class="button guide-item-link" data-action="items">查看完整道具图鉴 →</button><aside class="guide-controls"><strong>保护判定顺序</strong><p><strong>无敌 → 护盾 → 额外生命 → 淘汰</strong></p></aside></section>
      <button class="button button-primary" data-action="${back}">看明白了，返回${back==='home'?'大厅':'设置'} →</button>
    </div></main>`;
}
