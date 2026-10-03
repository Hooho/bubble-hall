import './style.css';
import './arcade.css';
import './skills.css';
import './competition.css';
import { maps, mapInfo, type MapId } from './maps';
import { roster, playerName, personalityName } from './roster';
import { createTournament, advance, pendingPlayerMatch, submitMatch, simulate, roundNames, tournamentOrder, ranked, type Tournament, type Bonus } from './tournament';
import { itemGuideMarkup } from './item-guide';
import { newCareer, settleQuick, settleTournament, leaderboard } from './career';
import { rewardNames, type Reward } from './skills';
import { rewardIcon } from './reward-icons';
import { ArcadeAudio } from './audio';
import { Difficulty, Direction, GameEngine, GameEvent } from './game';

type Screen = 'home' | 'setup' | 'game' | 'pause' | 'result' | 'settings' | 'howto' | 'items' | 'tournament' | 'players' | 'leaderboard' | 'history';

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) throw new Error('App root not found');
const app: HTMLDivElement = appRoot;

let screen: Screen = 'home';
let difficulty: Difficulty = 'normal';
let selectedMap: MapId = 'bay';
let opponents = roster.slice(0, 3);
let competition: Tournament | null = null;
let matchMode: 'quick' | 'championship' = 'quick';
let replaying = false;
let career = newCareer();
let quickId = crypto.randomUUID();
const audio = new ArcadeAudio();
let soundEnabled = audio.enabled;
const heldDirections = new Set<Direction>();
let holdingBomb = false;
let resultTimer = 0;
let game: GameEngine | null = null;
let gameEventUnsubscribe: (() => void) | null = null;
let startNewRound = true;
let canvas: HTMLCanvasElement | null = null;
let animationFrame = 0;
let lastTime = performance.now();
let toastTimer = 0;

function render(): void {
  app.innerHTML = screenMarkup(screen);
  wireScreen();
  if (screen === 'game') mountGame();
}

function screenMarkup(current: Screen): string {
  switch (current) {
    case 'home': return homeMarkup();
    case 'setup': return setupMarkup();
    case 'game': return gameMarkup();
    case 'pause': return `${gameMarkup()}${pauseMarkup()}`;
    case 'result': return resultMarkup();
    case 'settings': return settingsMarkup();
    case 'items': return itemGuideMarkup();
    case 'tournament': return tournamentMarkup();
    case 'players': return playersMarkup();
    case 'leaderboard': return leaderboardMarkup();
    case 'history': return historyMarkup();
    case 'howto': return howtoMarkup();
    default: return homeMarkup();
  }
}

function homeMarkup(): string {
  return `
    <main class="screen home-screen">
      <header class="lobby-top"><span class="brand">◈ BUBBLE CLUB</span><span class="local-badge">● 单机游乐场</span><button class="icon-button" data-action="settings" aria-label="设置">⚙</button></header>
      <div class="hero-stage" aria-hidden="true"><div class="stage-orbit"></div><div class="toy-character"><i class="toy-antenna"></i><div class="toy-head"><div class="toy-face"><i></i><i></i></div></div><div class="toy-body"><span>✦</span></div><i class="toy-hand left"></i><i class="toy-hand right"></i><i class="toy-foot left"></i><i class="toy-foot right"></i></div><div class="hero-bubble bubble-a"></div><div class="hero-bubble bubble-b"></div><div class="hero-bubble bubble-c"></div><span class="stage-label">蓝蓝 / BUBBLE EXPLORER</span></div>
      <div class="home-orbit orbit-one"></div><div class="home-orbit orbit-two"></div>
      <div class="home-copy">
        <p class="eyebrow">READY, SET, POP!</p>
        <h1>泡泡<br><em>大作战<span>!</span></em></h1>
        <p class="home-subtitle">三分钟积分对战。<br>炸箱 +10，命中 +100；存活到最后或超时争最高分。</p>
      </div>
      <div class="home-actions">
        <div class="mode-summary"><span>✦</span><div><strong>积分对战</strong><small>你和 3 位电脑 · 限时 3 分钟</small></div><b>SCORE</b></div>
        <button class="button button-primary button-large" data-action="start">开始对战 <span>▶</span></button>
        <div class="button-row">
          <button class="button button-ghost" data-action="howto">怎么玩</button>
          <button class="button button-ghost" data-action="settings">设置</button>
        </div>
      </div>
      <nav class="hub-links" style="grid-column:1/-1"><button data-action="new-tournament">冠军赛</button><button data-action="tournament">赛事签表</button><button data-action="players">选手图鉴</button><button data-action="leaderboard">积分榜</button><button data-action="history">历史战绩</button></nav><div class="home-footer">随时开局 · 无需登录 <span>BLUE BAY / 01</span></div>
    </main>`;
}

function setupMarkup(): string {
  return `
    <main class="screen setup-screen">
      <div class="topline"><button class="icon-button" data-action="home" aria-label="返回">←</button><span class="screen-kicker">准备出发 / 01</span><span class="topline-spacer"></span></div>
      <section class="setup-layout">
        <div class="setup-intro"><p class="eyebrow">MATCH SETUP</p><h2>选好你的<br><em>战术。</em></h2><p>通用比赛规则：每场 3 分钟。炸箱 +10，命中对手 +100。死亡即淘汰；最后一人提前获胜，否则超时比较存活者积分；自爆和无敌期间受击不计分。</p></div>
        <div class="setup-panel">
          <div class="setup-block"><div class="field-label">地图 / MAP</div><div class="map-grid">${maps.map(m => `<button class="map-option ${selectedMap === m.id ? 'selected' : ''}" data-map="${m.id}"><strong>${m.name}</strong><small>${m.caption}</small></button>`).join('')}<button class="map-option" data-action="random-map">随机地图 ↻</button></div></div>
          <div class="setup-block"><div class="field-label">电脑难度 / AI</div><div class="difficulty-row">
            ${difficultyButton('easy', '轻松', '反应慢 · 适合熟悉规则')}${difficultyButton('normal', '标准', '会躲避 · 会追击')}${difficultyButton('hard', '困难', '会封路 · 不会作弊')}${difficultyButton('master', '大师', '快速判断 · 熟练用技能')}
          </div></div>
          <div class="skill-guide"><strong>本场开放技能补给</strong><p>炸箱获取成长、护盾、额外生命和主动技能。E 释放技能，F 替换脚下道具；手机使用独立技能按钮。</p><p>无敌 3 秒 · 疾跑 5 秒 · 连发 4 秒（按住放弹）<br>超级炸弹：先准备，再放弹，可穿透一个箱子。</p></div>
          <div class="reward-gallery">${(Object.keys(rewardNames) as Reward[]).map(kind => `<div>${rewardIcon(kind)}<small>${rewardNames[kind]}</small></div>`).join('')}</div>
          <div class="setup-facts"><span><b>01</b> 玩家</span><span><b>03</b> 电脑</span><span><b>180s</b> 单局</span></div>
          <button class="button button-primary button-large full-width" data-action="play">进入街区 <span>→</span></button>
        </div>
      </section>
    </main>`;
}

function difficultyButton(value: Difficulty, title: string, caption: string): string {
  return `<button class="difficulty ${difficulty === value ? 'selected' : ''}" data-difficulty="${value}"><strong>${title}</strong><small>${caption}</small></button>`;
}

function page(title: string, content: string): string {
  return `<main class="screen"><div class="topline"><button class="icon-button" data-action="home" aria-label="返回大厅">←</button><span class="screen-kicker">BUBBLE CLUB</span></div><section class="competition-content"><h1>${title}</h1>${content}</section></main>`;
}

function playersMarkup(): string {
  return page('63 位挑战者', `<p class="competition-note">身份参考德州选手库，泡泡堂性格和能力独立配置。</p><div class="competition-grid">${roster.map(p => `<article class="competition-card"><h3>${p.name}</h3><p>${personalityName[p.personality]} · 智力 ${'★'.repeat(p.intelligence)}</p><small>编号 ${p.id} · ${p.personality === 'brave' ? '优先逼近对手与进攻技能' : p.personality === 'careful' ? '优先逃生与保护技能' : '优先拾取补给、积累能力'}</small></article>`).join('')}</div>`);
}

function leaderboardMarkup(): string {
  return page('本地积分榜', `<p class="competition-note">长期积分与战场分数分开：有效命中 +20，单次胜利 +100；晋级 +40 / +80 / +120，冠军 +400。难度倍率 1 / 1.3 / 1.6 / 2。电脑只通过实际或模拟比赛积分。</p><div class="competition-card">${leaderboard(career).map((p,i)=>`<div class="score-row ${p.id === 'player' ? 'you' : ''}"><span>${i+1}</span><strong>${playerName(p.id)}</strong><span>${p.points} 分</span><small>冠军 ${p.crowns}</small></div>`).join('')}</div>`);
}

function historyMarkup(): string {
  const records = career.history.filter(r=>r.mode==='championship');
  return page('历史战绩', `<div class="medal-strip">${['冠军','亚军','季军','八强'].map((name,i)=>`<b>${name} ${records.filter(r=>i===3 ? r.place>=5 && r.place<=8 : r.place===i+1).length}</b>`).join('')}</div><p class="competition-note">八强徽章仅计第 5–8 名，不重复累计冠亚季军；第四名保留名次记录。</p><div class="competition-grid">${career.history.length ? career.history.map(r=>`<article class="competition-card"><h3>${r.mode==='quick'?'单次比赛':'冠军赛'} · 第 ${r.place} 名</h3><p>${new Date(r.date).toLocaleString('zh-CN')} · ${r.difficulty}</p><strong>+${r.points} 长期积分</strong><details><summary>查看选手排名</summary>${r.standings.map((p,i)=>`<div class="score-row"><span>${i+1}</span><strong>${playerName(p.id)}</strong><span>${p.score} 分</span></div>`).join('')}</details></article>`).join('') : '<p>还没有完成的比赛。去争取你的第一座奖杯吧。</p>'}</div>`);
}

function tournamentMarkup(): string {
  const t = competition;
  if (!t) return page('冠军赛', '<p>64 名选手，一座奖杯。</p><button class="button button-primary" data-action="new-tournament">创建赛事</button>');
  const order = tournamentOrder(t);
  const groups = [...t.archive, ...(t.round === 'complete' ? [] : [{ round: t.round, matches: t.matches }])];
  return page(t.round === 'complete' ? '冠军诞生' : roundNames[t.round], `<p class="competition-note">64 → 16 → 4 → 2 · 电脑组快速模拟，玩家组实际对战。晋级同分安排加赛；决赛先胜两局夺冠。</p>
    ${t.round === 'complete' ? `<div class="medal-strip">${order.slice(0, 4).map((id, i) => `<b>${['冠军','亚军','季军','第四名'][i]} · ${playerName(id)}</b>`).join('')}</div><p>你的名次：第 ${order.indexOf('player') + 1} 名</p>` : `<div class="page-actions">${t.needsReward ? (['capacity','speed','shield'] as Bonus[]).map(b => `<button class="button button-primary" data-bonus="${b}">下一场：${b === 'capacity' ? '容量 +1' : b === 'speed' ? '速度 +1 档' : '一次护盾'}</button>`).join('') : `<button class="button button-primary" data-action="tournament-play">${pendingPlayerMatch(t) ? t.replay ? '进入同分加赛' : '进入我的比赛' : '模拟其余比赛并继续'}</button>`}</div>`}
    <div class="competition-grid">${groups.flatMap(g => g.matches.map((m, i) => `<article class="competition-card"><strong>${roundNames[g.round]} · 第 ${i + 1} 组${m.members.includes('player') ? ' · 我的组' : ''}</strong>${(m.standings ?? m.members.map(id => ({ id, score: null }))).map(p => `<div class="score-row ${p.id === 'player' ? 'you' : ''}"><strong>${playerName(p.id)}</strong><span>${p.score ?? '待赛'}</span>${m.winner === p.id ? '<b>晋级</b>' : ''}</div>`).join('')}</article>`)).join('')}</div>`);
}

function progressTournament(): void {
  const t = competition;
  if (!t || t.round === 'complete' || t.needsReward) return;
  // Only simulate groups without the user; no parallel Three.js worlds.
  for (const m of t.matches) if (!m.standings && !m.members.includes('player')) submitMatch(t, m, simulate(m.members));
  const match = pendingPlayerMatch(t);
  if (!match) { advance(t); settleTournament(career,t); screen = 'tournament'; render(); return; }
  const members = t.replay ?? match.members;
  if (!members.includes('player')) { submitMatch(t, match, simulate(members)); advance(t); settleTournament(career,t); screen = 'tournament'; render(); return; }
  matchMode = 'championship'; difficulty = t.difficulty;
  selectedMap = ['semi','bronze','final'].includes(t.round) ? 'arena' : t.round === 'first' ? 'garden' : 'factory';
  opponents = members.filter(id => id !== 'player').map(id => roster.find(p => p.id === id)!);
  replaying = !!t.replay;
  stopGame(); startNewRound = true; screen = 'game'; render();
}

function gameMarkup(): string {
  const stats = game?.getPlayerStats() ?? { bombs: 0, maxBombs: 1, range: 2, alive: true };
  const enemies = game?.getEnemyStats() ?? [];
  return `
    <main class="screen game-screen">
      <div class="game-topbar">
        <div class="match-id"><span class="live-dot"></span><span>${mapInfo(selectedMap).name}</span><small>SOLO RUN</small></div>
        <div class="round-clock"><small>ROUND TIME</small><strong id="timer">03:00</strong></div>
        <div class="game-actions"><button class="mini-action" data-action="pause">Ⅱ</button><button class="mini-action desktop-only" data-action="restart">↻</button></div>
      </div>
      <div class="game-layout">
        <aside class="player-card hud-card"><div class="avatar avatar-player">YOU</div><div><span class="card-label">你</span><strong id="player-status">准备中</strong></div><div class="player-stats"><span><i>●</i><b id="bomb-count">${stats.maxBombs - stats.bombs}</b></span><span><i class="flame-icon">✦</i><b id="range-count">${stats.range}</b></span></div></aside>
        <section class="board-wrap"><div class="board-glow"></div><canvas id="game-canvas"></canvas><div class="board-legend"><strong>地图图例</strong><span><i class="legend-swatch legend-floor"></i>可走</span><span><i class="legend-swatch legend-wall"></i>固定墙</span><span><i class="legend-swatch legend-crate"></i>可破坏</span><span><i class="legend-swatch legend-danger"></i>危险区</span></div><div class="board-caption"><span id="alive-count">剩余玩家 04</span><span>SAFE ZONE · ON</span></div></section>
        <aside id="enemy-stack" class="enemy-stack hud-card"><div class="card-label">对手 / RIVALS</div>${enemies.map((enemy) => `<div class="enemy-row ${enemy.alive ? '' : 'is-out'}"><span class="enemy-dot" style="--enemy:${enemy.color}"></span><span>${enemy.name}</span><small>${enemy.alive ? 'ACTIVE' : 'OUT'}</small></div>`).join('')}</aside>
      </div>
      <div class="desktop-controls"><span>方向键 / WASD 移动</span><b>SPACE</b><span>放置炸弹</span></div>
      <div class="mobile-controls"><div class="dpad"><button data-dir="up">↑</button><button data-dir="left">←</button><button data-dir="down">↓</button><button data-dir="right">→</button></div><button class="bomb-button" data-action="bomb"><span>✦</span><small>BOMB</small></button></div>
      <div class="skill-dock"><div id="passive-status"></div><button id="skill-button" data-action="skill">空技能槽</button><button id="swap-button" data-action="swap" hidden></button></div>
      <div id="toast" class="game-toast" aria-live="polite"></div>
    </main>`;
}

function pauseMarkup(): string {
  return `<div class="modal-layer"><div class="pause-card"><p class="eyebrow">BREAK IN THE ACTION</p><h2>先歇一下。</h2><p>炸弹不会因为你看菜单而变得更快。</p><div class="modal-actions"><button class="button button-primary" data-action="resume">继续游戏</button><button class="button button-ghost" data-action="restart">重新开始</button><button class="button button-ghost" data-action="home">返回主菜单</button></div></div></div>`;
}

function resultMarkup(): string {
  const result = game?.getResult() ?? 'draw';
  const standings = game?.getStandings() ?? [];
  const copy = result === 'win' ? ['本场获胜！', '成为最后的存活者，或超时以最高分胜出。'] : result === 'lose' ? ['比赛结束', '下次争取更多有效命中。'] : ['本场平局', '存活者最高分并列，或所有选手同归于尽。'];
  copy[1] += `<br>${standings.map(a => `${a.name}：${a.score} 分（命中 ${a.hits} · 炸箱 ${a.crates}）`).join('<br>')}`;
  return `<main class="screen result-screen result-${result}"><div class="result-burst">${result === 'win' ? '✦' : result === 'lose' ? '×' : '•'}</div><p class="eyebrow">ROUND COMPLETE · ${result.toUpperCase()}</p><h1>${copy[0]}</h1><p class="result-copy">${copy[1]}</p><div class="result-actions"><button class="button button-primary button-large" data-action="restart">${matchMode === 'championship' ? '返回赛事签表' : '再来一局'} <span>→</span></button><button class="button button-ghost" data-action="home">返回主菜单</button></div><div class="result-note">NO LOGIN · LOCAL SCORE</div></main>`;
}

function settingsMarkup(): string {
  return `<main class="screen simple-screen"><div class="topline"><button class="icon-button" data-action="back">←</button><span class="screen-kicker">设置 / SETTINGS</span><span class="topline-spacer"></span></div><section class="simple-content"><p class="eyebrow">SYSTEM CHECK</p><h2>让街区<br><em>更顺手。</em></h2><div class="settings-list"><button class="setting-row" data-action="items"><span><strong>道具图鉴</strong><small>全部 10 种道具 · 效果、释放方式与限制</small></span><b>查看 →</b></button><button class="setting-row" data-action="toggle-sound"><span><strong>声音效果</strong><small>爆炸、拾取和胜负反馈</small></span><b id="sound-label">${soundEnabled ? '开启' : '关闭'}</b></button><div class="setting-row"><span><strong>操作方式</strong><small>键盘 / 触控会自动适配</small></span><b>AUTO</b></div><div class="setting-row"><span><strong>画面风格</strong><small>程序化低多边形 · 原型版</small></span><b>2.5D</b></div></div></section></main>`;
}

function howtoMarkup(): string {
  return `<main class="screen simple-screen"><div class="topline"><button class="icon-button" data-action="back">←</button><span class="screen-kicker">通用比赛规则</span></div><section class="simple-content howto-content"><h2>三分钟，<em>争最高分。</em></h2><div class="rule-grid"><article><h3>炸箱 +10</h3><p>每个被炸毁的箱子计分一次，并可能掉落道具。</p></article><article><h3>命中 +100</h3><p>有效命中对手或击破护盾得分。自爆、命中无敌选手不计分；同一次连锁对同一人只计一次，归属实际伤害炸弹的主人。</p></article><article><h3>按积分判胜</h3><p>每场限时 3 分钟，死亡即淘汰（额外生命道具除外）。只剩一人立即获胜；否则时间结束比较存活者积分，最高分获胜，并列则平局。全部阵亡为平局。</p></article></div><button class="button button-primary" data-action="back">知道了 →</button></section></main>`;
}

function wireScreen(): void {
  app.querySelectorAll<HTMLButtonElement>('[data-bonus]').forEach(button => button.addEventListener('click', () => { if (competition) { competition.bonus = button.dataset.bonus as Bonus; competition.needsReward = false; render(); } }));
  app.querySelectorAll<HTMLButtonElement>('[data-map]').forEach(button => button.addEventListener('click', () => { selectedMap = button.dataset.map as MapId; render(); }));
  const bombButton = app.querySelector<HTMLButtonElement>('.bomb-button');
  bombButton?.addEventListener('pointerdown', (event) => { event.preventDefault(); bombButton.setPointerCapture(event.pointerId); holdingBomb = true; game?.placePlayerBomb(); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) bombButton?.addEventListener(event, () => { holdingBomb = false; });
  app.querySelectorAll<HTMLElement>('[data-action]').forEach((element) => element.addEventListener('click', () => handleAction(element.dataset.action ?? '')));
  app.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach((button) => button.addEventListener('click', () => {
    difficulty = button.dataset.difficulty as Difficulty;
    render();
  }));
  app.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach((button) => {
    const direction = button.dataset.dir as Direction;
    button.addEventListener('pointerdown', (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); heldDirections.add(direction); game?.movePlayer(direction); });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => heldDirections.delete(direction));
  });
}

function handleAction(action: string): void {
  audio.unlock();
  if (action !== 'bomb') audio.play('click');
  if (!['bomb', 'skill', 'swap'].includes(action)) { heldDirections.clear(); holdingBomb = false; }
  switch (action) {
    case 'leaderboard': screen = 'leaderboard'; render(); break;
    case 'history': screen = 'history'; render(); break;
    case 'players': screen = 'players'; render(); break;
    case 'new-tournament': if (competition && competition.round !== 'complete' && !confirm('放弃当前冠军赛并创建新赛事？')) break; competition = createTournament(difficulty); screen = 'tournament'; render(); break;
    case 'tournament': screen = 'tournament'; render(); break;
    case 'tournament-play': progressTournament(); break;
    case 'skill': game?.usePlayerSkill(); break;
    case 'swap': game?.replacePlayerSkill(); break;
    case 'start': screen = 'setup'; render(); break;
    case 'play': quickId = crypto.randomUUID(); matchMode = 'quick'; opponents = [...roster].sort(() => Math.random() - 0.5).slice(0, 3); audio.play('start'); startNewRound = true; screen = 'game'; render(); break;
    case 'random-map': selectedMap = maps[Math.floor(Math.random() * maps.length)].id; render(); break;
    case 'home': stopGame(); screen = 'home'; render(); break;
    case 'howto': screen = 'howto'; render(); break;
    case 'settings': screen = 'settings'; render(); break;
    case 'items': screen = 'items'; render(); window.scrollTo(0, 0); break;
    case 'back': screen = 'home'; render(); break;
    case 'pause': showPauseOverlay(); break;
    case 'resume': hidePauseOverlay(); game?.resume(); break;
    case 'restart': quickId = crypto.randomUUID();
      if (matchMode === 'championship') { stopGame(); screen = 'tournament'; render(); break; }
      hidePauseOverlay();
      if (screen === 'result') {
        stopGame();
        startNewRound = true;
        screen = 'game';
        render();
      } else if (game) {
        game.start(difficulty, selectedMap, opponents);
        startNewRound = false;
        screen = 'game';
        updateHud();
      }
      break;
    case 'bomb': game?.placePlayerBomb(); break;
    case 'toggle-sound': soundEnabled = audio.toggle(); render(); break;
    default: break;
  }
}

function mountGame(): void {
  canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
  if (!canvas) return;
  if (!game) {
    game = new GameEngine(canvas);
    gameEventUnsubscribe = game.on(handleGameEvent);
  }
  if (startNewRound) {
    game.start(difficulty, selectedMap, opponents);
    if (matchMode === 'championship' && competition && competition.round !== 'first' && !replaying) {
      if (competition.bonus) game.grantBonus('player', competition.bonus);
      opponents.forEach(p => game?.grantBonus(p.id, p.personality === 'careful' ? 'shield' : p.personality === 'collector' ? 'capacity' : 'speed'));
      competition.bonus = null;
    }
    startNewRound = false;
  } else {
    game.resume();
  }
  resizeGame();
  window.addEventListener('resize', resizeGame);
  lastTime = performance.now();
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(loop);
}

function stopGame(): void {
  clearTimeout(resultTimer);
  heldDirections.clear();
  cancelAnimationFrame(animationFrame);
  window.removeEventListener('resize', resizeGame);
  game?.pause();
  game?.destroy();
  game = null;
  gameEventUnsubscribe?.();
  gameEventUnsubscribe = null;
  hidePauseOverlay();
}

function resizeGame(): void {
  if (!game || !canvas) return;
  const rect = canvas.getBoundingClientRect();
  game.resize(Math.max(1, rect.width), Math.max(1, rect.height));
}

function loop(now: number): void {
  const delta = (now - lastTime) / 1000;
  lastTime = now;
  game?.update(delta);
  const direction = [...heldDirections].at(-1);
  if (direction && screen === 'game') game?.movePlayer(direction);
  if (holdingBomb && game?.getSkillStats().rapid && screen === 'game') game.placePlayerBomb();
  game?.render();
  updateHud();
  if (screen === 'game' || screen === 'pause') animationFrame = requestAnimationFrame(loop);
}

function updateHud(): void {
  if (!game) return;
  const skills = game.getSkillStats();
  const skillButton = app.querySelector<HTMLButtonElement>('#skill-button');
  if (skillButton) {
    skillButton.disabled = !skills.active || skills.respawning || !game.getPlayerStats().alive;
    const skillMarkup = skills.active ? `${rewardIcon(skills.active)}<span>${skills.armed ? '已准备 · 放弹释放 / E 取消' : `${rewardNames[skills.active]} · E`}</span>` : '空技能槽 · 炸箱获取';
    if (skillButton.innerHTML !== skillMarkup) skillButton.innerHTML = skillMarkup;
    skillButton.classList.toggle('armed', skills.armed);
  }
  const passives = app.querySelector('#passive-status');
  if (passives) passives.textContent = [skills.shield ? '◈ 护盾' : '', skills.life ? '♥ 复活 ×1' : '', skills.invincible > 0 ? `无敌 ${skills.invincible.toFixed(1)}s` : '', skills.dash > 0 ? `疾跑 ${skills.dash.toFixed(1)}s` : '', skills.rapid > 0 ? `连发 ${skills.rapid.toFixed(1)}s` : '', skills.respawning ? '等待安全复活' : ''].filter(Boolean).join(' · ');
  const swapButton = app.querySelector<HTMLButtonElement>('#swap-button');
  if (swapButton) { swapButton.hidden = !skills.swap; swapButton.textContent = `F 替换为 ${skills.swap ?? ''}`; }
  const timer = document.querySelector<HTMLElement>('#timer');
  const stats = game.getPlayerStats();
  const bombCount = document.querySelector<HTMLElement>('#bomb-count');
  const rangeCount = document.querySelector<HTMLElement>('#range-count');
  if (timer) {
    const seconds = game.getRemainingTime();
    timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  if (bombCount) bombCount.textContent = String(stats.maxBombs - stats.bombs);
  if (rangeCount) rangeCount.textContent = String(stats.range);
  const enemyStats = game.getEnemyStats();
  const enemyStack = document.querySelector<HTMLElement>('#enemy-stack');
  if (enemyStack) {
    enemyStack.innerHTML = `<div class="card-label">对手 / RIVALS</div>${enemyStats.map((enemy) => `<div class="enemy-row ${enemy.alive ? '' : 'is-out'}"><span class="enemy-dot" style="--enemy:${enemy.color}"></span><span>${enemy.name}</span><small>${enemy.alive ? 'ACTIVE' : 'OUT'}</small></div>`).join('')}`;
  }
  const aliveCount = document.querySelector<HTMLElement>('#alive-count');
  if (aliveCount) aliveCount.textContent = game.getStandings().map(a => `${a.name} ${a.score}`).join(' · ');
  const playerStatus = document.querySelector<HTMLElement>('#player-status');
  if (playerStatus) playerStatus.textContent = `${stats.alive ? '' : '已淘汰 · '}${game.getStandings().find(a => a.id === 'player')?.score ?? 0} 分${skills.respawning ? ' · 复活中' : ''}`;
  const toast = document.querySelector<HTMLElement>('#toast');
  if (toast && toastTimer > 0) {
    toastTimer -= 1 / 60;
    if (toastTimer <= 0) toast.textContent = '';
  }
}

function handleGameEvent(event: GameEvent): void {
  if (event.type === 'notice') { showToast(event.text); audio.play('pickup'); }
  if (event.type === 'bomb-placed') audio.play('place');
  if (event.type === 'explosion') audio.play('blast');
  if (event.type === 'item-picked') {
    if (event.actorId === 'player') audio.play('pickup');
    if (event.actorId === 'player') showToast(event.item === 'coin' ? '拾取金币 +5 分' : `获得 ${rewardNames[event.item]}`);
  }
  if (event.type === 'round-over') {
    if (matchMode === 'quick' && game) settleQuick(career, quickId, difficulty, game.getStandings());
    if (matchMode === 'championship' && competition && game) {
      const match = pendingPlayerMatch(competition);
      if (match && submitMatch(competition, match, game.getStandings())) {
        for (const m of competition.matches) if (!m.standings) submitMatch(competition, m, simulate(m.members));
        advance(competition);
        settleTournament(career,competition);
      }
    }
    heldDirections.clear();
    audio.play(event.result === 'win' ? 'win' : 'lose');
    clearTimeout(resultTimer);
    resultTimer = window.setTimeout(() => { screen = 'result'; render(); }, 850);
  }
}

function showPauseOverlay(): void {
  holdingBomb = false;
  heldDirections.clear();
  if (!game || screen !== 'game' || app.querySelector('.modal-layer')) return;
  game.pause();
  app.insertAdjacentHTML('beforeend', pauseMarkup());
  app.querySelectorAll<HTMLElement>('.modal-layer [data-action]').forEach((element) => element.addEventListener('click', () => handleAction(element.dataset.action ?? '')));
}

function hidePauseOverlay(): void {
  app.querySelector('.modal-layer')?.remove();
}

function showToast(message: string): void {
  const toast = document.querySelector<HTMLElement>('#toast');
  if (toast) toast.textContent = message;
  toastTimer = 2.2;
}

window.addEventListener('keydown', (event) => {
  if (screen === 'game' && !event.repeat && event.key.toLowerCase() === 'e') game?.usePlayerSkill();
  if (screen === 'game' && !event.repeat && event.key.toLowerCase() === 'f') game?.replacePlayerSkill();
  const map: Record<string, Direction | undefined> = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
  const direction = map[event.key];
  if (direction && screen === 'game') { event.preventDefault(); heldDirections.add(direction); }
  if (event.key === ' ' && screen === 'game') { event.preventDefault(); holdingBomb = true; if (!event.repeat) game?.placePlayerBomb(); }
  if (event.key === 'Escape' && screen === 'game') handleAction('pause');
});

window.addEventListener('keyup', (event) => {
  if (event.key === ' ') holdingBomb = false;
  const map: Record<string, Direction | undefined> = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
  const direction = map[event.key.length === 1 ? event.key.toLowerCase() : event.key];
  if (direction) heldDirections.delete(direction);
});
window.addEventListener('blur', () => { heldDirections.clear(); showPauseOverlay(); });

render();
document.addEventListener('visibilitychange', () => { if (document.hidden) showPauseOverlay(); });
