import './style.css';
import './arcade.css';
import './skills.css';
import './competition.css';
import './lobby.css';
import './gameplay-guide.css';
import './controls.css';
import { gameplayGuideMarkup } from './gameplay-guide';
import { maps, mapInfo, type MapId } from './maps';
import { roster, playerName, personalityName, playerAvatar } from './roster';
import { createTournament, advance, pendingPlayerMatch, submitMatch, simulate, roundTitle, isTopTwo, advancingIds, replayMembers, tournamentOrder, ranked, type Tournament, type Bonus, type Match } from './tournament';
import { itemGuideMarkup } from './item-guide';
import { newCareer, settleQuick, settleTournament, leaderboard } from './career';
import { cosmetics, equipCosmetic } from './cosmetics';
import { createSaveStore } from './shared/save-store';
import { openSaveDialog } from './save-dialog';
import { initialSave, validateSave, savedMatchSlots, type Save, type MatchSlots } from './save';
import { isActive, rewardNames, type Reward } from './skills';
import { rewardIcon } from './reward-icons';
import { showPickup } from './pickup-feedback';
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
let trial = false;
let guideBack: 'home' | 'settings' = 'home';
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
  if(!trial&&game&&!game.getResult()) {
    suspended={id:quickId,mode:matchMode,snapshot:game.snapshot()};
    matches[matchMode]=suspended;
  }
}

function persist(): void {
  if (saveError || trial) return;
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
    case 'howto': return gameplayGuideMarkup(guideBack);
    default: return homeMarkup();
  }
}

function homeMarkup(): string {
  return `
    <main class="screen home-screen">
      <header class="lobby-top"><span class="brand">◈ 泡泡大作战</span><nav class="lobby-tools" aria-label="大厅工具"><button class="lobby-ranking" data-action="leaderboard">积分榜</button><button class="icon-button" data-action="settings" aria-label="设置">⚙</button></nav></header>
      <div class="hero-stage" aria-hidden="true"><div class="stage-orbit"></div><div class="toy-character"><i class="toy-antenna"></i><div class="toy-head"><div class="toy-face"><i></i><i></i></div></div><div class="toy-body"><span>✦</span></div><i class="toy-hand left"></i><i class="toy-hand right"></i><i class="toy-foot left"></i><i class="toy-foot right"></i></div><div class="hero-bubble bubble-a"></div><div class="hero-bubble bubble-b"></div><div class="hero-bubble bubble-c"></div><span class="stage-label">蓝蓝 / BUBBLE EXPLORER</span></div>
      <div class="home-orbit orbit-one"></div><div class="home-orbit orbit-two"></div>
      <div class="home-copy">
        <h1 class="arc-title" aria-label="快跑！有炸弹！"><span class="arc-title-line" aria-hidden="true"><i>快</i><i>跑</i><i>！</i></span><span class="arc-title-line" aria-hidden="true"><i>有</i><i>炸</i><i>弹</i><i>！</i></span></h1>
        <p class="home-subtitle">两分钟积分对战。<br>炸箱 +10，命中 +100；存活到最后或超时争最高分。</p>
      </div>
      <div class="home-actions">
        <div class="lobby-secondary"><button data-action="trial"><span aria-hidden="true">▷</span> 试玩</button><button data-action="overview"><span aria-hidden="true">▤</span> 玩法一览</button></div>
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
  return page('本地积分榜', `<p class="competition-note">长期积分与战场分数分开：有效命中 +20，单次胜利 +100；晋级 +40 / +60 / +80 / +120，冠军 +400。难度倍率 1 / 1.3 / 1.6 / 2。电脑只通过实际或模拟比赛积分。</p><div class="competition-card">${leaderboard(career).map((p,i)=>`<div class="score-row ${p.id === 'player' ? 'you' : ''}"><span>${i+1}</span>${avatarMarkup(p.id)}<strong>${playerName(p.id)}</strong><span>${p.points} 分</span><small>冠军 ${p.crowns}</small></div>`).join('')}</div>`);
}

function tournamentMarkup(): string {
  const t = competition;
  if (!t) return page('冠军赛', '<p>64 名选手，一座奖杯。</p><button class="button button-primary" data-action="new-tournament">创建赛事</button>');
  const order = tournamentOrder(t);
  const groupCards = (matches: Match[], final = false) => matches.map((m,i)=>({m,i})).sort((a,b)=>Number(b.m.members.includes('player'))-Number(a.m.members.includes('player'))).map(({m,i})=>`<article class="competition-card ${m.members.includes('player')?'my-match':''}"><strong>第 ${i+1} 组${m.members.includes('player')?' · 我的比赛':''}</strong>${(m.standings??m.members.map(id=>({id,score:null}))).map(p=>`<div class="score-row ${p.id==='player'?'you':''}"><strong>${playerName(p.id)}</strong><span>${p.score??'待赛'}</span>${isTopTwo(t)?(advancingIds(t,m).includes(p.id)?'<b>晋级</b>':final&&m.winner===p.id?'<b>冠军</b>':''):(m.winner===p.id?'<b>胜出</b>':'')}</div>`).join('')}</article>`).join('');
  return page(t.round === 'complete' ? '冠军诞生' : roundTitle(t), `<p class="competition-note">${isTopTwo(t)?'64 → 32 → 16 → 8 → 4 · 每组前两名晋级，四人总决赛决出冠亚季军。存活优先，再按本局得分排名；晋级线同分加赛。':'旧赛制存档 · 四人组第一名晋级，决赛三局两胜；本赛事按原规则完成。'}</p>
    ${t.round === 'complete' ? `<div class="medal-strip">${order.slice(0, 4).map((id, i) => `<b>${['冠军','亚军','季军','第四名'][i]} · ${playerName(id)}</b>`).join('')}</div><p>你的名次：第 ${order.indexOf('player') + 1} 名</p>` : `<div class="page-actions">${t.needsReward ? (['capacity','speed','shield'] as Bonus[]).map(b => `<button class="button button-primary" data-bonus="${b}">下一场：${b === 'capacity' ? '容量 +1' : b === 'speed' ? '速度 +1 档' : '一次护盾'}</button>`).join('') : `<button class="button button-primary" data-action="tournament-play">${pendingPlayerMatch(t) ? t.replay ? '进入同分加赛' : '进入我的比赛' : '模拟其余比赛并继续'}</button>`}</div>`}
    ${!isTopTwo(t)&&t.finals.length?`<div class="final-score">决赛大比分 ${t.finals.map(id=>`${playerName(id)} ${t.finalWins[id]??0}`).join(' : ')}</div>`:''}
    <div class="competition-grid">${groupCards(t.matches,t.round==='final')}</div>
    ${t.archive.length?`<h2>已完成轮次</h2>${t.archive.map((g,i)=>`<details class="stage-archive"><summary>${roundTitle(t,g.round)} · ${g.matches.length} 场 <span>查看赛果</span></summary><div class="competition-grid">${groupCards(g.matches,g.round==='final')}</div></details>`).join('')}`:''}`);
}

function progressTournament(): void {
  const t = competition;
  if (!t || t.round === 'complete' || t.needsReward) return;
  if (matches.championship) { suspended=matches.championship;handleAction('continue-save'); return; }
  // Only simulate groups without the user; no parallel Three.js worlds.
  for (const m of t.matches) if (!m.standings && !m.members.includes('player')) submitMatch(t, m, simulate(m.members));
  const match = pendingPlayerMatch(t);
  if (!match) { advance(t); settleTournament(career,t); screen = 'tournament'; render(); return; }
  const members = replayMembers(t,match) ?? match.members;
  if (!members.includes('player')) { submitMatch(t, match, simulate(members)); advance(t); settleTournament(career,t); screen = 'tournament'; render(); return; }
  matchMode = 'championship'; difficulty = t.difficulty;
  selectedMap = ['semi','bronze','final'].includes(t.round) ? 'arena' : t.round === 'first' ? 'garden' : 'factory';
  opponents = members.filter(id => id !== 'player').map(id => roster.find(p => p.id === id)!);
  replaying = !!replayMembers(t,match);
  stopGame(); startNewRound = true; screen = 'game'; render();
}

function gameMarkup(): string {
  return `
    <main class="screen game-screen">
      <div class="game-topbar">
        <div class="match-id"><span class="live-dot"></span><span>${trial ? '试玩 · ' : ''}${mapInfo(selectedMap).name}</span><small>${trial ? '试玩 · 不计长期积分' : 'SCORE MATCH'}</small></div>
        <div class="round-clock"><small>ROUND TIME</small><strong id="timer">02:00</strong></div>
        <div class="game-actions"><button class="mini-action" data-action="pause">Ⅱ</button><button class="mini-action desktop-only" data-action="restart">↻</button></div>
      </div>
      <div class="game-layout">
        <aside id="match-scores" class="match-scores" aria-label="本局所有选手比分"></aside>
        <section class="board-wrap"><div class="board-glow"></div><canvas id="game-canvas"></canvas><div class="base-attributes" aria-label="玩家基础属性"><div title="本局炸弹总容量，爆炸后释放名额">${rewardIcon('bomb')}<span>容量 <b id="base-capacity">1</b><small id="base-available">可放 1</small></span></div><div title="普通炸弹向四个方向延伸的格数">${rewardIcon('flame')}<span>范围 <b id="base-range">2 格</b></span></div><div title="基础移动速度，不含临时疾跑加成">${rewardIcon('speed')}<span>移速 <b id="base-speed">100%</b></span></div></div></section>
      </div>
      <div class="desktop-controls"><span>方向键 / WASD 移动</span><b>SPACE</b><span>放置炸弹</span></div>
      <div class="mobile-controls"><div class="dpad"><button data-dir="up">▲</button><button data-dir="left">◀</button><button data-dir="down">▼</button><button data-dir="right">▶</button></div><button class="bomb-button" data-action="bomb" aria-label="放置炸弹"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M30 13l5-6 5 3-2 5M34 5l2-3" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M27 12l9 7-5 6-9-7z" fill="currentColor"/><circle cx="22" cy="29" r="15" fill="currentColor"/><path d="M13 26q1-7 8-7" fill="none" stroke="#83dfff" stroke-width="3" stroke-linecap="round"/></svg><small>炸弹</small></button></div>
      <div class="skill-dock"><div id="passive-status"></div><button id="skill-button" data-action="skill">空技能槽</button><button id="swap-button" data-action="swap" hidden></button></div>
      <div id="toast" class="game-toast" aria-live="polite"></div>
    </main>`;
}

function pauseMarkup(): string {
  return `<div class="modal-layer"><div class="pause-card"><p class="eyebrow">BREAK IN THE ACTION</p><h2>先歇一下。</h2><p>炸弹不会因为你看菜单而变得更快。</p><div class="modal-actions"><button class="button button-primary" data-action="resume">继续游戏</button><button class="button button-ghost" data-action="restart">重新开始</button><button class="button button-ghost" data-action="home">返回主菜单</button></div></div></div>`;
}

function resultMarkup(): string {
  if (trial) return page(game?.getResult() === 'win' ? '试玩完成！' : '本次试玩结束', `<div class="competition-card"><h2>${game?.getStandings().find(p=>p.id==='player')?.score ?? 0} 分</h2><p>这是本次试玩的局内得分，不计入长期积分、排行榜和正式战绩。</p><p>正式比赛与冠军赛的续玩进度保持不变。</p></div><div class="page-actions"><button class="button button-primary" data-action="restart">再试一次</button><button class="button" data-action="home">返回大厅</button></div>`);
  let result = game?.getResult() ?? 'draw';
  const standings = ranked(game?.getStandings() ?? []);
  const copy = result === 'win' ? ['本场获胜！', '成为最后的存活者，或超时以最高分胜出。'] : result === 'lose' ? ['比赛结束', '下次争取更多有效命中。'] : ['本场平局', '存活者最高分并列，或所有选手同归于尽。'];
  if (matchMode === 'championship' && competition && isTopTwo(competition)) {
    const finished = competition.archive.at(-1)?.matches.find(m=>m.members.includes('player'));
    if (replayMembers(competition,pendingPlayerMatch(competition) ?? {id:'',members:[],standings:null,winner:null})) {
      result='draw'; copy[0]='需要同分加赛'; copy[1]='晋级线或决赛名次同分，返回签表继续加赛。';
    } else if (competition.round === 'complete') {
      copy[0]=competition.podium[0]==='player'?'夺得总冠军！':'总决赛完成'; copy[1]=`本次冠军赛获得第 ${tournamentOrder(competition).indexOf('player')+1} 名。`;
    } else if (finished) {
      result=advancingIds(competition,finished).includes('player')?'win':'lose';
      copy[0]=result==='win'?'晋级成功！':'本轮止步';
      copy[1]='每组前两名晋级，存活优先，再按得分排名。';
    }
  }
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
  bombButton?.addEventListener('pointerdown', (event) => { event.preventDefault(); bombButton.setPointerCapture(event.pointerId); bombButton.classList.add('is-pressed'); holdingBomb = true; audio.unlock(); placeBombWithFeedback(); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) bombButton?.addEventListener(event, () => { holdingBomb = false; bombButton.classList.remove('is-pressed'); });
  app.querySelectorAll<HTMLElement>('[data-action]').forEach((element) => element.addEventListener('click', (event) => {
    if (element === bombButton && event.detail > 0) return;
    handleAction(element.dataset.action ?? '');
  }));
  app.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach((button) => button.addEventListener('click', () => {
    difficulty = button.dataset.difficulty as Difficulty;
    render();
  }));
  app.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach((button) => {
    const direction = button.dataset.dir as Direction;
    button.setAttribute('aria-label', {up:'向上移动',down:'向下移动',left:'向左移动',right:'向右移动'}[direction]);
    button.addEventListener('pointerdown', (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); button.classList.add('is-pressed'); if (game?.isRunning()) navigator.vibrate?.(8); heldDirections.add(direction); game?.movePlayer(direction); });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => { heldDirections.delete(direction); button.classList.remove('is-pressed'); });
  });
}

function handleAction(action: string): void {
  const wasTrial = trial;
  audio.unlock();
  if (action !== 'bomb') audio.play('click');
  if (!['bomb', 'skill', 'swap'].includes(action)) { heldDirections.clear(); holdingBomb = false; }
  switch (action) {
    case 'trial': stopGame(); trial=true; restoring=false; opponents=[]; startNewRound=true; screen='game'; audio.play('start'); render(); window.scrollTo(0,0); break;
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
    case 'home': stopGame(); trial=false; screen = 'home'; render(); window.scrollTo(0,0);break;
    case 'overview': guideBack='home'; screen='howto'; render(); window.scrollTo(0,0); break;
    case 'howto': guideBack='settings'; screen='howto'; render(); window.scrollTo(0,0); break;
    case 'settings': screen = 'settings'; render(); break;
    case 'items': screen = 'items'; render(); window.scrollTo(0, 0); break;
    case 'back': screen = 'home'; render(); break;
    case 'pause': showPauseOverlay(); break;
    case 'resume': if(saveError){alert(saveError);break;} hidePauseOverlay(); game?.resume(); break;
    case 'restart': if(trial){stopGame();startNewRound=true;screen='game';render();break;} quickId = crypto.randomUUID();
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
    case 'bomb': placeBombWithFeedback(); break;
    case 'toggle-sound': soundEnabled = audio.toggle(); render(); break;
    default: break;
  }
  if (!wasTrial && ['new-tournament','tournament-play','home','pause','restart','reset-progress'].includes(action)) persist();
}

function startQuickMatch(): void {
  confirmNewMatch=false;
  stopGame(); trial=false; suspended=null;matches.quick=null; quickId=crypto.randomUUID(); matchMode='quick';
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
    game.start(difficulty, selectedMap, opponents, {practice:trial});
    if (!trial && matchMode === 'championship' && competition && competition.round !== 'first' && !replaying) {
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
  if (holdingBomb && game?.getSkillStats().rapid && screen === 'game') placeBombWithFeedback();
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
    skillButton.title = skills.active ? `${rewardNames[skills.active]}：E 释放；已准备时再次按 E 取消` : '空技能槽：炸箱拾取技能';
    const skillMarkup = `${skills.active ? rewardIcon(skills.active) : '<span class="empty-skill-icon" aria-hidden="true">◇</span>'}<span>${skills.armed ? '已准备' : skills.active ? rewardNames[skills.active] : '技能'}</span><kbd>E</kbd>`;
    if (skillButton.innerHTML !== skillMarkup) skillButton.innerHTML = skillMarkup;
    skillButton.classList.toggle('armed', skills.armed);
  }
  const passives = app.querySelector('#passive-status');
  if (passives) passives.textContent = [skills.shield ? '◈ 护盾' : '', skills.life ? '♥ 复活 ×1' : '', skills.invincible > 0 ? `无敌 ${skills.invincible.toFixed(1)}s` : '', skills.dash > 0 ? `疾跑 ${skills.dash.toFixed(1)}s` : '', skills.rapid > 0 ? `连发 ${skills.rapid.toFixed(1)}s` : '', skills.respawning ? '等待安全复活' : ''].filter(Boolean).join(' · ');
  const swapButton = app.querySelector<HTMLButtonElement>('#swap-button');
  if (swapButton) {
    swapButton.hidden = false;
    swapButton.disabled = !skills.swap || !game.getPlayerStats().alive;
    swapButton.title = skills.swap ? `F 替换为 ${skills.swap}` : '站在技能道具上，按 F 替换';
    const markup = `${skills.swapKind ? rewardIcon(skills.swapKind) : '<span class="swap-skill-icon" aria-hidden="true">⇄</span>'}<span>${skills.swap ? '可替换' : '替换'}</span><kbd>F</kbd>`;
    if (swapButton.innerHTML !== markup) swapButton.innerHTML = markup;
  }
  const timer = document.querySelector<HTMLElement>('#timer');
  const base = game.getPlayerStats();
  for (const [id, value] of Object.entries({ 'base-capacity':String(base.maxBombs), 'base-available':`可放 ${Math.max(0,base.maxBombs-base.bombs)}`, 'base-range':`${base.range} 格`, 'base-speed':`${Math.round(base.speed*100)}%` })) {
    const element = app.querySelector<HTMLElement>(`#${id}`);
    if (element && element.textContent !== value) element.textContent = value;
  }
  if (timer) {
    const seconds = game.getRemainingTime();
    timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  const scoreboard = app.querySelector<HTMLElement>('#match-scores');
  if (scoreboard) {
    const standings = game.getStandings();
    for (const actor of standings) {
      let card = Array.from(scoreboard.children).find(node => (node as HTMLElement).dataset.actor === actor.id) as HTMLElement | undefined;
      if (!card) {
        card = document.createElement('div');
        card.dataset.actor = actor.id;
        card.className = 'match-score';
        card.append(document.createElement('span'), document.createElement('strong'));
        scoreboard.append(card);
      }
      card.classList.toggle('is-out', !actor.alive);
      card.classList.toggle('is-you', actor.id === 'player');
      card.children[0].textContent = actor.name;
      card.children[1].textContent = String(actor.score);
      card.title = `${actor.name}：${actor.score} 分${actor.alive ? '' : ' · 已淘汰'}`;
    }
  }
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
    if (event.actorId === 'player' && !event.capped) audio.play(event.item === 'coin' ? 'coin' : event.item === 'life' ? 'life' : isActive(event.item) ? 'pickup' : 'growth');
    showPickup(app, event.item, game?.getActorScreenPoint(event.actorId) ?? null, event.capped, event.replaced, event.actorId === 'player');
  }
  if (event.type === 'round-over') {
    if (!trial && matchMode === 'quick' && game) settleQuick(career, quickId, difficulty, game.getStandings());
    if (!trial && matchMode === 'championship' && competition && game) {
      const match = pendingPlayerMatch(competition);
      if (match && submitMatch(competition, match, game.getStandings())) {
        for (const m of competition.matches) if (!m.standings) submitMatch(competition, m, simulate(m.members));
        advance(competition);
        settleTournament(career,competition);
      }
    }
    if(!trial){suspended=null; matches[matchMode]=null;persist();}
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

function placeBombWithFeedback(): void {
  if (!game?.isRunning()) return;
  const before = game.getPlayerStats().bombs;
  game.placePlayerBomb();
  if (game.getPlayerStats().bombs <= before) return;
  navigator.vibrate?.([22, 35, 14]);
  const button = app.querySelector('.bomb-button');
  button?.classList.remove('is-fired');
  if (button instanceof HTMLElement) void button.offsetWidth;
  button?.classList.add('is-fired');
}

function clearControlInput(): void {
  holdingBomb = false;
  heldDirections.clear();
  app.querySelectorAll('.is-pressed').forEach(button => button.classList.remove('is-pressed'));
}

window.addEventListener('keydown', (event) => {
  if (screen === 'game' && !event.repeat && event.key.toLowerCase() === 'e') game?.usePlayerSkill();
  if (screen === 'game' && !event.repeat && event.key.toLowerCase() === 'f') game?.replacePlayerSkill();
  const map: Record<string, Direction | undefined> = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
  const direction = map[event.key];
  if (direction && screen === 'game') { event.preventDefault(); heldDirections.add(direction); }
  if (event.key === ' ' && screen === 'game') { event.preventDefault(); holdingBomb = true; if (!event.repeat) placeBombWithFeedback(); }
  if (event.key === 'Escape' && screen === 'game') handleAction('pause');
});

window.addEventListener('keyup', (event) => {
  if (event.key === ' ') holdingBomb = false;
  const map: Record<string, Direction | undefined> = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
  const direction = map[event.key.length === 1 ? event.key.toLowerCase() : event.key];
  if (direction) heldDirections.delete(direction);
});
window.addEventListener('blur', () => { clearControlInput(); showPauseOverlay(); });

try { const e=saveStore.load(); if(e){saveRevision=e.revision;adoptSave(e.data);} } catch(error) { saveError=error instanceof Error?error.message:'无法读取存档'; }
render();
setInterval(()=>{if(game?.isRunning())persist();},2000);
window.addEventListener('storage',event=>{if(event.key===saveStore.key){game?.pause();showPauseOverlay();saveError='其他标签页已更新存档，请刷新后继续';}});
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearControlInput(); showPauseOverlay(); if(game)persist(); } });
