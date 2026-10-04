import './style.css';
import './arcade.css';
import './skills.css';
import './competition.css';
import './lobby.css';
import { maps, mapInfo, type MapId } from './maps';
import { roster, playerName, personalityName, playerAvatar } from './roster';
import { createTournament, advance, pendingPlayerMatch, submitMatch, simulate, roundNames, tournamentOrder, ranked, type Tournament, type Bonus, type Match } from './tournament';
import { itemGuideMarkup } from './item-guide';
import { newCareer, settleQuick, settleTournament, leaderboard } from './career';
import { cosmetics, equipCosmetic } from './cosmetics';
import { createSaveStore } from './shared/save-store';
import { openSaveDialog } from './save-dialog';
import { initialSave, validateSave, savedMatchSlots, type Save, type MatchSlots } from './save';
import { rewardNames, type Reward } from './skills';
import { rewardIcon } from './reward-icons';
import { ArcadeAudio } from './audio';
import { Difficulty, Direction, GameEngine, GameEvent } from './game';

type Screen = 'home' | 'setup' | 'game' | 'pause' | 'result' | 'settings' | 'howto' | 'items' | 'tournament' | 'players' | 'leaderboard';

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
let quickId: string = crypto.randomUUID();
const saveStore = createSaveStore<Save>('bubble-club:save:v1', validateSave);
let settings = initialSave().settings;
let suspended: Save['active'] = null;
let matches: MatchSlots = {quick:null,championship:null};
let restoring = false;
let confirmNewMatch = false;
let saveRevision = 0;
let saveError = '';
let writeQueue = Promise.resolve();

function captureMatch(): void {
  if(game&&!game.getResult()) {
    suspended={id:quickId,mode:matchMode,snapshot:game.snapshot()};
    matches[matchMode]=suspended;
  }
}

function persist(): void {
  if (saveError) return;
  captureMatch();
  const data: Save = structuredClone({ career, tournament: competition, active: suspended, matches, settings });
  writeQueue = writeQueue.then(async () => { if (saveError) return; const e = await saveStore.write(data,saveRevision); saveRevision = e.revision; }).catch(error => {
    saveError = error instanceof Error ? error.message : '存档失败';
    game?.pause(); holdingBomb = false; heldDirections.clear();
    showPauseOverlay();
    alert(`${saveError}。请先导出本页进度备份，再刷新。`);
  });
}

function applyPreferences(): void {
  document.documentElement.classList.toggle('reduce-motion',settings.reducedMotion);
  document.documentElement.classList.toggle('force-touch',settings.controls==='touch');
  document.documentElement.dataset.palette = settings.palette;
  game?.configure(settings.quality,settings.reducedMotion);
  game?.setPlayerColor(cosmetics.find(c=>c.id===settings.palette)!.color);
}
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
  applyPreferences();
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
    case 'howto': return howtoMarkup();
    default: return homeMarkup();
  }
}

function homeMarkup(): string {
  return `
    <main class="screen home-screen">
      <header class="lobby-top"><span class="brand">◈ BUBBLE CLUB</span><nav class="lobby-tools" aria-label="大厅工具"><button class="lobby-ranking" data-action="leaderboard">积分榜</button><button class="icon-button" data-action="settings" aria-label="设置">⚙</button></nav></header>
      <div class="hero-stage" aria-hidden="true"><div class="stage-orbit"></div><div class="toy-character"><i class="toy-antenna"></i><div class="toy-head"><div class="toy-face"><i></i><i></i></div></div><div class="toy-body"><span>✦</span></div><i class="toy-hand left"></i><i class="toy-hand right"></i><i class="toy-foot left"></i><i class="toy-foot right"></i></div><div class="hero-bubble bubble-a"></div><div class="hero-bubble bubble-b"></div><div class="hero-bubble bubble-c"></div><span class="stage-label">蓝蓝 / BUBBLE EXPLORER</span></div>
      <div class="home-orbit orbit-one"></div><div class="home-orbit orbit-two"></div>
      <div class="home-copy">
        <p class="eyebrow">READY, SET, POP!</p>
        <h1>泡泡<br><em>大作战<span>!</span></em></h1>
        <p class="home-subtitle">两分钟积分对战。<br>炸箱 +10，命中 +100；存活到最后或超时争最高分。</p>
      </div>
      <div class="home-actions">
        <button class="button button-primary mode-entry" data-action="enter-quick"><span><strong>单次对战</strong><small>${matches.quick?'继续上次比赛':'轻松开局 · 两分钟对战'}</small></span><b aria-hidden="true">▶</b></button>
        <button class="button mode-entry championship-entry" data-action="enter-championship"><span><strong>冠军之路</strong><small>${matches.championship || (competition&&competition.round!=='complete')?'继续上次比赛':'64 位选手 · 冲击冠军'}</small></span><b aria-hidden="true">♛</b></button>
      </div>
      <div class="home-footer">随时开局 · 无需登录 <span>BLUE BAY / 01</span></div>
    </main>`;
}

function setupMarkup(): string {
  return `
    <main class="screen setup-screen">
      <div class="topline"><button class="icon-button" data-action="home" aria-label="返回">←</button><span class="screen-kicker">准备出发 / 01</span><span class="topline-spacer"></span></div>
      <section class="setup-layout">
        <div class="setup-intro"><p class="eyebrow">MATCH SETUP</p><h2>选好你的<br><em>战术。</em></h2><p>通用比赛规则：每场 2 分钟。炸箱 +10，命中对手 +100。死亡即淘汰；最后一人提前获胜，否则超时比较存活者积分；自爆和无敌期间受击不计分。</p></div>
        <div class="setup-panel">
          <div class="setup-block"><div class="field-label">地图 / MAP</div><div class="map-grid">${maps.map(m => `<button class="map-option ${selectedMap === m.id ? 'selected' : ''}" data-map="${m.id}"><strong>${m.name}</strong><small>${m.caption}</small></button>`).join('')}<button class="map-option" data-action="random-map">随机地图 ↻</button></div></div>
          <div class="setup-block"><div class="field-label">电脑难度 / AI</div><div class="difficulty-row">
            ${difficultyButton('easy', '轻松', '反应慢 · 适合熟悉规则')}${difficultyButton('normal', '标准', '会躲避 · 会追击')}${difficultyButton('hard', '困难', '会封路 · 不会作弊')}${difficultyButton('master', '大师', '快速判断 · 熟练用技能')}
          </div></div>
          <div class="skill-guide"><strong>本场开放技能补给</strong><p>炸箱获取成长、护盾、额外生命和主动技能。E 释放技能，F 替换脚下道具；手机使用独立技能按钮。</p><p>无敌 3 秒 · 疾跑 5 秒 · 连发 4 秒（按住放弹）<br>超级炸弹：先准备，再放弹，可穿透一个箱子。</p></div>
          <div class="reward-gallery">${(Object.keys(rewardNames) as Reward[]).map(kind => `<div>${rewardIcon(kind)}<small>${rewardNames[kind]}</small></div>`).join('')}</div>
          <div class="setup-facts"><span><b>01</b> 玩家</span><span><b>03</b> 电脑</span><span><b>120s</b> 单局</span></div>
          ${confirmNewMatch ? `<section class="save-warning" aria-labelledby="replace-match-title"><h3 id="replace-match-title">发现未完成的比赛</h3><p>开始新比赛会替换这一局的存档，积分和历史战绩不会清空。</p><div class="page-actions"><button class="button button-primary" data-action="play-confirmed">确认开始新比赛</button><button class="button" data-action="continue-save">继续旧比赛</button><button class="button" data-action="cancel-new-match">取消</button></div></section>` : '<button class="button button-primary button-large full-width" data-action="play">进入街区 <span>→</span></button>'}
        </div>
      </section>
    </main>`;
}

function difficultyButton(value: Difficulty, title: string, caption: string): string {
  return `<button class="difficulty ${difficulty === value ? 'selected' : ''}" data-difficulty="${value}"><strong>${title}</strong><small>${caption}</small></button>`;
}

function page(title: string, content: string, back: 'home' | 'settings' = 'home'): string {
  return `<main class="screen"><div class="topline"><button class="icon-button" data-action="${back}" aria-label="${back==='settings'?'返回设置':'返回大厅'}">←</button><span class="screen-kicker">BUBBLE CLUB</span></div><section class="competition-content"><h1>${title}</h1>${content}</section></main>`;
}

function avatarMarkup(id: string): string {
  return id==='player'?'<span class="portrait portrait-you" aria-label="你的头像">YOU</span>':`<img class="portrait" src="${playerAvatar(id)}" alt="${playerName(id)}头像" loading="lazy" width="56" height="56">`;
}

function playersMarkup(): string {
  return page('选手图鉴', `<p class="competition-note">63 位挑战者 · 认识每位对手的性格与能力。</p><p><a class="button" href="/?preview=nuwa">女娲战场试演 →</a></p><div class="competition-grid">${roster.map(p => `<article class="competition-card contestant-card"><div class="contestant-heading">${avatarMarkup(p.id)}<div><h3>${p.name}</h3><p>${personalityName[p.personality]} · 智力 ${'★'.repeat(p.intelligence)}</p></div></div><small>编号 ${p.id} · ${p.personality === 'brave' ? '优先逼近对手与进攻技能' : p.personality === 'careful' ? '优先逃生与保护技能' : '优先拾取补给、积累能力'}</small></article>`).join('')}</div>`,'settings');
}

function leaderboardMarkup(): string {
  return page('本地积分榜', `<p class="competition-note">长期积分与战场分数分开：有效命中 +20，单次胜利 +100；晋级 +40 / +80 / +120，冠军 +400。难度倍率 1 / 1.3 / 1.6 / 2。电脑只通过实际或模拟比赛积分。</p><div class="competition-card">${leaderboard(career).map((p,i)=>`<div class="score-row ${p.id === 'player' ? 'you' : ''}"><span>${i+1}</span>${avatarMarkup(p.id)}<strong>${playerName(p.id)}</strong><span>${p.points} 分</span><small>冠军 ${p.crowns}</small></div>`).join('')}</div>`);
}

function tournamentMarkup(): string {
  const t = competition;
  if (!t) return page('冠军赛', '<p>64 名选手，一座奖杯。</p><button class="button button-primary" data-action="new-tournament">创建赛事</button>');
  const order = tournamentOrder(t);
  const groupCards = (matches: Match[]) => matches.map((m,i)=>({m,i})).sort((a,b)=>Number(b.m.members.includes('player'))-Number(a.m.members.includes('player'))).map(({m,i})=>`<article class="competition-card ${m.members.includes('player')?'my-match':''}"><strong>第 ${i+1} 组${m.members.includes('player')?' · 我的比赛':''}</strong>${(m.standings??m.members.map(id=>({id,score:null}))).map(p=>`<div class="score-row ${p.id==='player'?'you':''}"><strong>${playerName(p.id)}</strong><span>${p.score??'待赛'}</span>${m.winner===p.id?'<b>胜出</b>':''}</div>`).join('')}</article>`).join('');
  return page(t.round === 'complete' ? '冠军诞生' : roundNames[t.round], `<p class="competition-note">64 → 16 → 4 → 2 · 电脑组快速模拟，玩家组实际对战。晋级同分安排加赛；决赛先胜两局夺冠。</p>
    ${t.round === 'complete' ? `<div class="medal-strip">${order.slice(0, 4).map((id, i) => `<b>${['冠军','亚军','季军','第四名'][i]} · ${playerName(id)}</b>`).join('')}</div><p>你的名次：第 ${order.indexOf('player') + 1} 名</p>` : `<div class="page-actions">${t.needsReward ? (['capacity','speed','shield'] as Bonus[]).map(b => `<button class="button button-primary" data-bonus="${b}">下一场：${b === 'capacity' ? '容量 +1' : b === 'speed' ? '速度 +1 档' : '一次护盾'}</button>`).join('') : `<button class="button button-primary" data-action="tournament-play">${pendingPlayerMatch(t) ? t.replay ? '进入同分加赛' : '进入我的比赛' : '模拟其余比赛并继续'}</button>`}</div>`}
    ${t.finals.length?`<div class="final-score">决赛大比分 ${t.finals.map(id=>`${playerName(id)} ${t.finalWins[id]??0}`).join(' : ')}</div>`:''}
    <div class="competition-grid">${groupCards(t.matches)}</div>
    ${t.archive.length?`<h2>已完成轮次</h2>${t.archive.map((g,i)=>`<details class="stage-archive"><summary>${roundNames[g.round]} · ${g.matches.length} 场 <span>查看赛果</span></summary><div class="competition-grid">${groupCards(g.matches)}</div></details>`).join('')}`:''}`);
}

function progressTournament(): void {
  const t = competition;
  if (!t || t.round === 'complete' || t.needsReward) return;
  if (matches.championship) { suspended=matches.championship;handleAction('continue-save'); return; }
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
        <div class="round-clock"><small>ROUND TIME</small><strong id="timer">02:00</strong></div>
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
  const standings = ranked(game?.getStandings() ?? []);
  const copy = result === 'win' ? ['本场获胜！', '成为最后的存活者，或超时以最高分胜出。'] : result === 'lose' ? ['比赛结束', '下次争取更多有效命中。'] : ['本场平局', '存活者最高分并列，或所有选手同归于尽。'];
  copy[1] += `</p><div class="result-standings">${standings.map((a,i)=>`<div class="result-standing ${a.id==='player'?'you':''}"><b class="place-number">${i+1}</b><div><strong>${playerName(a.id)}</strong><small>${a.alive?'存活':'已淘汰'} · 命中 ${a.hits} · 炸箱 ${a.crates}</small></div><strong>${a.score}<small>本局分</small></strong></div>`).join('')}</div><p class="result-copy">长期积分已自动结算；赛事全部结束后记录最终名次。`;
  return `<main class="screen result-screen result-${result}"><div class="result-burst">${result === 'win' ? '✦' : result === 'lose' ? '×' : '•'}</div><p class="eyebrow">ROUND COMPLETE · ${result.toUpperCase()}</p><h1>${copy[0]}</h1><p class="result-copy">${copy[1]}</p><div class="result-actions"><button class="button button-primary button-large" data-action="restart">${matchMode === 'championship' ? '返回赛事签表' : '再来一局'} <span>→</span></button><button class="button button-ghost" data-action="home">返回主菜单</button></div><div class="result-note">NO LOGIN · LOCAL SCORE</div></main>`;
}

function settingsMarkup(): string {
  const extras = `<div class="competition-card"><h3>选手衣橱 · ${career.coins} 奖励币</h3><p>奖励币来自完赛，不同于场内金币的 +5 分。外观不增加战斗属性。</p><div class="cosmetic-grid">${cosmetics.map(c=>`<button class="cosmetic-option ${settings.palette===c.id?'selected':''}" data-cosmetic="${c.id}"><span class="suit-preview" style="--suit:#${c.color.toString(16)}"><i></i></span><strong>${c.name}</strong><small>${settings.palette===c.id?'已装备':settings.unlocked.includes(c.id)?'装备':`${c.price} 奖励币解锁`}</small></button>`).join('')}</div></div><div class="setting-row"><span><strong>画质</strong><small>低画质关闭阴影，适合低性能设备</small></span><select aria-label="画质" data-setting="quality"><option value="high" ${settings.quality==='high'?'selected':''}>精细</option><option value="low" ${settings.quality==='low'?'selected':''}>流畅</option></select></div>
    <button class="setting-row" data-action="toggle-motion"><span><strong>减少动态效果</strong><small>关闭镜头震动与大厅漂浮动画</small></span><b>${settings.reducedMotion?'开启':'关闭'}</b></button>
    <div class="setting-row"><span><strong>操作方式</strong></span><select aria-label="操作方式" data-setting="controls"><option value="auto" ${settings.controls==='auto'?'selected':''}>自动</option><option value="touch" ${settings.controls==='touch'?'selected':''}>显示触控</option></select></div>
    <button class="setting-row" data-action="players"><span><strong>选手图鉴</strong><small>63 位选手 · 头像、性格与能力</small></span><b>查看 →</b></button>
    <button class="setting-row" data-action="howto"><span><strong>玩法说明</strong><small>计分、胜负和操作方式</small></span><b>查看 →</b></button>
    <div class="competition-card"><h3>本地存档 · 进度胶囊</h3><p>${saveError ? '⚠ 存档异常，请先导出备份再刷新。' : `修订 ${saveRevision} · 每 2 秒自动保存比赛`}</p><p>文件和存档码包含相同进度。离线保存在当前浏览器，换设备前请导出备份。</p><div class="save-storage-actions"><button class="button" data-action="export-save">↓ 导出文件</button><button class="button" data-action="export-code">↗ 导出存档码</button><button class="button" data-action="import-save">↑ 导入文件</button><button class="button" data-action="import-code">↙ 导入存档码</button></div><div class="page-actions"><button class="button" data-action="restore-backup">恢复上一份备份</button><button class="button" data-action="reset-progress">清空游戏进度</button></div><p>自动保留上一份备份与最多 5 份历史恢复点；导入前先校验、确认，再保留旧进度。</p></div>`;
  return `<main class="screen simple-screen"><div class="topline"><button class="icon-button" data-action="back">←</button><span class="screen-kicker">设置 / SETTINGS</span><span class="topline-spacer"></span></div><section class="simple-content"><p class="eyebrow">SYSTEM CHECK</p><h2>让街区<br><em>更顺手。</em></h2><div class="settings-list">${extras}<button class="setting-row" data-action="items"><span><strong>道具图鉴</strong><small>全部 10 种道具 · 效果、释放方式与限制</small></span><b>查看 →</b></button><button class="setting-row" data-action="toggle-sound"><span><strong>声音效果</strong><small>爆炸、拾取和胜负反馈</small></span><b id="sound-label">${soundEnabled ? '开启' : '关闭'}</b></button><div class="setting-row"><span><strong>操作方式</strong><small>键盘 / 触控会自动适配</small></span><b>AUTO</b></div><div class="setting-row"><span><strong>画面风格</strong><small>程序化低多边形 · 原型版</small></span><b>2.5D</b></div></div></section></main>`;
}

function howtoMarkup(): string {
  return `<main class="screen simple-screen"><div class="topline"><button class="icon-button" data-action="back">←</button><span class="screen-kicker">通用比赛规则</span></div><section class="simple-content howto-content"><h2>两分钟，<em>争最高分。</em></h2><div class="rule-grid"><article><h3>炸箱 +10</h3><p>每个被炸毁的箱子计分一次，并可能掉落道具。</p></article><article><h3>命中 +100</h3><p>有效命中对手或击破护盾得分。自爆、命中无敌选手不计分；同一次连锁对同一人只计一次，归属实际伤害炸弹的主人。</p></article><article><h3>按积分判胜</h3><p>每场限时 2 分钟，死亡即淘汰（额外生命道具除外）。只剩一人立即获胜；否则时间结束比较存活者积分，最高分获胜，并列则平局。全部阵亡为平局。</p></article></div><button class="button button-primary" data-action="back">知道了 →</button></section></main>`;
}

function wireScreen(): void {
  app.querySelectorAll<HTMLButtonElement>('[data-cosmetic]').forEach(button=>button.addEventListener('click',()=>{
    if(!equipCosmetic(career,settings,button.dataset.cosmetic??'')){alert('奖励币不足，完成比赛后再来兑换吧');return;}
    applyPreferences();persist();render();
  }));
  app.querySelectorAll<HTMLSelectElement>('[data-setting]').forEach(select=>select.addEventListener('change',()=>{
    if(select.dataset.setting==='quality') settings.quality=select.value as 'low'|'high';
    if(select.dataset.setting==='controls') settings.controls=select.value as 'auto'|'touch';
    applyPreferences(); persist();
  }));
  app.querySelectorAll<HTMLButtonElement>('[data-bonus]').forEach(button => button.addEventListener('click', () => { if (competition) { competition.bonus = button.dataset.bonus as Bonus; competition.needsReward = false; persist(); render(); } }));
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
    case 'continue-save': if(!suspended)break; if(saveError){alert(saveError);break;} restoring=true; matchMode=suspended.mode; quickId=suspended.id; selectedMap=suspended.snapshot.mapId; difficulty=suspended.snapshot.difficulty; opponents=suspended.snapshot.opponents; screen='game'; render(); break;
    case 'toggle-motion': settings.reducedMotion=!settings.reducedMotion; applyPreferences(); persist(); render(); break;
    case 'export-save': case 'export-code': showSaveTransfer('export'); break;
    case 'import-save': case 'import-code': showSaveTransfer('import'); break;
    case 'restore-backup': void restoreBackup(); break;
    case 'reset-progress': if(confirm('清空泡泡堂的积分、战绩和当前赛事？建议先导出备份。')){stopGame();adoptSave(initialSave());persist();render();}break;
    case 'leaderboard': screen = 'leaderboard'; render(); break;
    case 'enter-quick': suspended=matches.quick; if(suspended)handleAction('continue-save');else handleAction('start'); break;
    case 'enter-championship':
      suspended=matches.championship;
      if(suspended)handleAction('continue-save');
      else if(competition&&competition.round!=='complete'){screen='tournament';render();}
      else handleAction('new-tournament');
      break;
    case 'players': screen = 'players'; render(); break;
    case 'new-tournament': if (competition && competition.round !== 'complete' && !confirm('放弃当前冠军赛并创建新赛事？')) break; stopGame(); suspended=null;matches.championship=null; competition = createTournament(difficulty); screen = 'tournament'; render(); break;
    case 'tournament': screen = 'tournament'; render(); break;
    case 'tournament-play': progressTournament(); break;
    case 'skill': game?.usePlayerSkill(); break;
    case 'swap': game?.replacePlayerSkill(); break;
    case 'start': confirmNewMatch=false; screen = 'setup'; render(); break;
    case 'cancel-new-match': confirmNewMatch=false; render(); break;
    case 'play':
      if(suspended){
        confirmNewMatch=true; render();
        const button=app.querySelector<HTMLButtonElement>('[data-action="play-confirmed"]');
        button?.scrollIntoView({block:'center'});button?.focus({preventScroll:true});
        break;
      }
      startQuickMatch(); break;
    case 'play-confirmed': if(screen==='setup'&&confirmNewMatch)startQuickMatch(); break;
    case 'random-map': selectedMap = maps[Math.floor(Math.random() * maps.length)].id; render(); break;
    case 'home': stopGame(); screen = 'home'; render(); window.scrollTo(0,0);break;
    case 'howto': screen = 'howto'; render(); break;
    case 'settings': screen = 'settings'; render(); break;
    case 'items': screen = 'items'; render(); window.scrollTo(0, 0); break;
    case 'back': screen = 'home'; render(); break;
    case 'pause': showPauseOverlay(); break;
    case 'resume': if(saveError){alert(saveError);break;} hidePauseOverlay(); game?.resume(); break;
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
        applyPreferences();
        startNewRound = false;
        screen = 'game';
        updateHud();
      }
      break;
    case 'bomb': game?.placePlayerBomb(); break;
    case 'toggle-sound': soundEnabled = audio.toggle(); render(); break;
    default: break;
  }
  if (['new-tournament','tournament-play','home','pause','restart','reset-progress'].includes(action)) persist();
}

function startQuickMatch(): void {
  confirmNewMatch=false;
  stopGame(); suspended=null;matches.quick=null; quickId=crypto.randomUUID(); matchMode='quick';
  opponents=[...roster].sort(()=>Math.random()-0.5).slice(0,3);
  audio.play('start');startNewRound=true;screen='game';render();
  window.scrollTo(0,0);persist();
}

async function replaceSave(data: Save): Promise<void> {
  await writeQueue;
  const e = saveError ? await saveStore.recover(data) : await saveStore.write(data,saveRevision,{archive:true});
  stopGame(); saveRevision=e.revision; saveError=''; adoptSave(e.data);
}

function showSaveTransfer(mode: 'export' | 'import', initialImport?: Save): void {
  openSaveDialog({
    mode, transfer: saveStore.transfer, initialImport,
    snapshot: () => { captureMatch(); return structuredClone({ career, tournament: competition, active: suspended, matches, settings }); },
    replace: async data => { await replaceSave(data); render(); },
  });
}

async function restoreBackup(): Promise<void> {
  try {
    const e=saveStore.backup();
    if(!e){alert('尚无可恢复的备份');return;}
    showSaveTransfer('import',e.data);
  } catch(error) { alert(error instanceof Error?error.message:'恢复失败'); }
}

function adoptSave(data: Save): void { career=data.career;competition=data.tournament;suspended=data.active;matches=savedMatchSlots(data);settings=data.settings;applyPreferences(); }

function mountGame(): void {
  canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
  if (!canvas) return;
  if (!game) {
    game = new GameEngine(canvas);
    gameEventUnsubscribe = game.on(handleGameEvent);
  }
  if(restoring && suspended){game.restore(suspended.snapshot);restoring=false;startNewRound=false;resizeGame();requestAnimationFrame(()=>showPauseOverlay());}
  else if (startNewRound) {
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
  captureMatch();
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
    suspended=null; matches[matchMode]=null;persist();
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

try { const e=saveStore.load(); if(e){saveRevision=e.revision;adoptSave(e.data);} } catch(error) { saveError=error instanceof Error?error.message:'无法读取存档'; }
render();
setInterval(()=>{if(game?.isRunning())persist();},2000);
window.addEventListener('storage',event=>{if(event.key===saveStore.key){game?.pause();showPauseOverlay();saveError='其他标签页已更新存档，请刷新后继续';}});
document.addEventListener('visibilitychange', () => { if (document.hidden) { showPauseOverlay(); if(game)persist(); } });
