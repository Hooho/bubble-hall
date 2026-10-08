import './style.css';
import './arcade.css';
import './skills.css';
import './competition.css';
import './lobby.css';
import './gameplay-guide.css';
import './controls.css';
import './settings.css';
import './page-layout.css';
import './game-layout.css';
import './theme.css';
import { notify, showDialog } from './ui-dialog';
import { gameplayGuideMarkup } from './gameplay-guide';
import { maps, mapInfo, type MapId } from './maps';
import { roster, playerName, personalityName, playerAvatar } from './roster';
import { createTournament, advance, pendingPlayerMatch, submitMatch, simulate, playerEliminated, simulateToEnd, roundTitle, isTopTwo, advancingIds, replayMembers, tournamentOrder, ranked, type Tournament, type Bonus, type Match } from './tournament';
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
    void notify('存档失败', `${saveError}。请先导出本页进度备份，再刷新。`);
  });
}

function applyPreferences(): void {
  document.documentElement.classList.toggle('reduce-motion',settings.reducedMotion);
  document.documentElement.classList.toggle('force-touch',settings.controls==='touch');
  document.documentElement.dataset.palette = settings.palette;
  game?.configure(settings.quality,settings.reducedMotion,settings.boardStyle??'modern');
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
      <div class="hero-stage" aria-hidden="true"><div class="stage-orbit"></div><div class="toy-character toy-two"><i class="toy-antenna"></i><div class="toy-head"><div class="toy-face"><i></i><i></i></div></div><div class="toy-body"><span>✦</span></div><i class="toy-hand left"></i><i class="toy-hand right"></i><i class="toy-foot left"></i><i class="toy-foot right"></i><i class="toy-bomb"></i></div><div class="toy-character"><i class="toy-antenna"></i><div class="toy-head"><div class="toy-face"><i></i><i></i></div></div><div class="toy-body"><span>✦</span></div><i class="toy-hand left"></i><i class="toy-hand right"></i><i class="toy-foot left"></i><i class="toy-foot right"></i></div><div class="hero-bubble bubble-a"></div><div class="hero-bubble bubble-b"></div><div class="hero-bubble bubble-c"></div><span class="stage-label">蓝蓝 &amp; 红红</span></div>
      <div class="home-orbit orbit-one"></div><div class="home-orbit orbit-two"></div>
      <div class="home-copy">
        <h1 class="arc-title" aria-label="快跑！有炸弹！"><span class="arc-title-line" aria-hidden="true"><i>快</i><i>跑</i><i>！</i></span><span class="arc-title-line" aria-hidden="true"><i>有</i><i>炸</i><i>弹</i><i>！</i></span></h1>
        <p class="home-subtitle">两分钟积分对战。<br>炸箱 +10，命中 +100；存活到最后或超时争最高分。</p>
      </div>
      <div class="home-actions">
        <div class="lobby-secondary"><button data-action="trial"><span aria-hidden="true">▷</span> 试玩</button><button data-action="overview"><span aria-hidden="true">▤</span> 玩法一览</button></div>
        <button class="button button-primary mode-entry" data-action="enter-quick"><span><strong>单次对战</strong><small>${matches.quick?'继续上次比赛':'轻松开局 · 两分钟对战'}</small></span><b aria-hidden="true">▶</b></button>
        <button class="button mode-entry championship-entry" data-action="enter-championship"><span><strong>冠军之路</strong><small>${matches.championship || (competition&&competition.round!=='complete')?'继续上次比赛':competition?'查看本届结果':'64 位选手 · 冲击冠军'}</small></span><b aria-hidden="true">♛</b></button>
      </div>
      <div class="home-footer">随时开局 · 无需登录 · 进度保存在本机</div>
    </main>`;
}

function setupMarkup(): string {
  return `
    <main class="screen setup-screen">
      <div class="topline"><button class="icon-button" data-action="home" aria-label="返回">←</button><span class="screen-kicker">大厅</span><span class="topline-spacer"></span></div>
      <section class="setup-layout">
        <div class="setup-intro"><h2>单次对战</h2><p class="page-sub">选好地图和电脑难度，两分钟一局。</p><p class="setup-rules">通用比赛规则：每场 2 分钟。炸箱 +10，命中对手 +100。死亡即淘汰；最后一人提前获胜，否则超时比较存活者积分；自爆和无敌期间受击不计分。</p></div>
        <div class="setup-panel">
          <div class="setup-block"><div class="field-label">地图</div><div class="map-grid">${maps.map(m => `<button class="map-option ${selectedMap === m.id ? 'selected' : ''}" data-map="${m.id}">${mapThumb(m)}<strong>${m.name}</strong><small>${m.caption}</small></button>`).join('')}<button class="map-option" data-action="random-map">随机地图 ↻</button></div></div>
          <div class="setup-block"><div class="field-label">电脑难度</div><div class="difficulty-row">
            ${difficultyButton('easy', '轻松', '反应慢 · 适合熟悉规则')}${difficultyButton('normal', '标准', '会躲避 · 会追击')}${difficultyButton('hard', '困难', '会封路 · 不会作弊')}${difficultyButton('master', '大师', '快速判断 · 熟练用技能')}
          </div></div>
          <div class="skill-guide"><strong>本场开放技能补给</strong><p>炸箱获取成长、护盾、额外生命和主动技能。E 释放技能，F 替换脚下道具；手机使用独立技能按钮。</p><p>无敌 3 秒 · 疾跑 5 秒 · 连发 4 秒（按住放弹）<br>超级炸弹：先准备，再放弹，可穿透一个箱子。</p></div>
          <div class="reward-gallery">${(Object.keys(rewardNames) as Reward[]).map(kind => `<div>${rewardIcon(kind)}<small>${rewardNames[kind]}</small></div>`).join('')}</div>
          <div class="setup-facts"><span><b>01</b> 玩家</span><span><b>03</b> 电脑</span><span><b>120s</b> 单局</span></div>
          ${confirmNewMatch ? `<section class="save-warning" aria-labelledby="replace-match-title"><h3 id="replace-match-title">发现未完成的比赛</h3><p>开始新比赛会替换这一局的存档，积分和历史战绩不会清空。</p><div class="page-actions"><button class="button button-primary" data-action="play-confirmed">确认开始新比赛</button><button class="button" data-action="continue-save">继续旧比赛</button><button class="button" data-action="cancel-new-match">取消</button></div></section>` : `<div class="setup-start"><span class="setup-start-summary">${mapInfo(selectedMap).name} · ${({easy:'轻松',normal:'标准',hard:'困难',master:'大师'} as const)[difficulty]}</span><button class="button button-primary button-large full-width" data-action="play">开始对战 <span>→</span></button></div>`}
        </div>
      </section>
    </main>`;
}

/** Tiny 5x4 board preview drawn with the map's own floor / wall / crate colours. */
function mapThumb(m: typeof maps[number]): string {
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  const pattern = 'WWWWW' + 'WFCFW' + 'WCWCW' + 'WWWWW';
  return `<span class="map-thumb" aria-hidden="true" style="--f:${hex(m.floor)};--w:${hex(m.wall)};--c:${hex(m.crate)}">${[...pattern].map(k => `<i class="t-${k}"></i>`).join('')}</span>`;
}

function difficultyButton(value: Difficulty, title: string, caption: string): string {
  return `<button class="difficulty ${difficulty === value ? 'selected' : ''}" data-difficulty="${value}"><strong>${title}</strong><small>${caption}</small></button>`;
}

function page(title: string, content: string, back: 'home' | 'settings' = 'home'): string {
  return `<main class="screen"><div class="topline"><button class="icon-button" data-action="${back}" aria-label="${back==='settings'?'返回设置':'返回大厅'}">←</button><span class="screen-kicker">${back==='settings'?'设置':'大厅'}</span></div><section class="competition-content"><h1>${title}</h1>${content}</section></main>`;
}

function avatarMarkup(id: string): string {
  return id==='player'?'<span class="portrait portrait-you" aria-label="你的头像">YOU</span>':`<img class="portrait" src="${playerAvatar(id)}" alt="${playerName(id)}头像" loading="lazy" width="56" height="56">`;
}

function playersMarkup(): string {
  return page('选手图鉴', `<p class="competition-note">63 位挑战者 · 认识每位对手的性格与能力。</p><p><a class="button" href="/?preview=nuwa">女娲战场试演 →</a></p><div class="competition-grid">${roster.map(p => `<article class="competition-card contestant-card"><div class="contestant-heading">${avatarMarkup(p.id)}<div><h3>${p.name}</h3><p>${personalityName[p.personality]} · 智力 ${'★'.repeat(p.intelligence)}</p></div></div><small>编号 ${p.id} · ${p.personality === 'brave' ? '优先逼近对手与进攻技能' : p.personality === 'careful' ? '优先逃生与保护技能' : '优先拾取补给、积累能力'}</small></article>`).join('')}</div>`,'settings');
}

function leaderboardMarkup(): string {
  const rows = leaderboard(career);
  const row = (p: typeof rows[number], i: number) => `<div class="score-row ${p.id === 'player' ? 'you' : ''}"><span>${i+1}</span>${avatarMarkup(p.id)}<strong>${playerName(p.id)}</strong><span>${p.points} 分</span><small>冠军 ${p.crowns}</small></div>`;
  const me = rows.findIndex(p => p.id === 'player');
  const top = rows.slice(0, 16), rest = rows.slice(16);
  return page('积分榜', `<p class="page-sub">本地离线榜 · ${rows.length} 位选手</p>
    ${me >= 0 ? `<div class="my-rank-card"><span>我的名次</span><b>第 ${me + 1} 名</b><span>${rows[me].points} 分 · 冠军 ${rows[me].crowns}</span></div>` : ''}
    <details class="leaderboard-rules"><summary>积分规则 <span>长期积分独立于战场分数</span></summary><p>有效命中 +20，单次胜利 +100；晋级 +40 / +60 / +80 / +120，冠军 +400。难度倍率 1 / 1.3 / 1.6 / 2。电脑只通过实际或模拟比赛积分。</p></details>
    <div class="competition-card leaderboard-list">${top.map(row).join('')}</div>
    ${rest.length ? `<details class="stage-archive leaderboard-more"><summary>第 17–${rows.length} 名 <span>展开查看</span></summary><div class="competition-card leaderboard-list">${rest.map((p, i) => row(p, i + 16)).join('')}</div></details>` : ''}`);
}

function tournamentMarkup(): string {
  const t = competition;
  if (!t) return page('冠军赛', '<p>64 名选手，一座奖杯。</p><button class="button button-primary" data-action="new-tournament">创建赛事</button>');
  const order = tournamentOrder(t);
  const groupCards = (matches: Match[], final = false) => matches.map((m,i)=>({m,i})).sort((a,b)=>Number(b.m.members.includes('player'))-Number(a.m.members.includes('player'))).map(({m,i})=>`<article class="competition-card ${m.members.includes('player')?'my-match':''}"><strong>第 ${i+1} 组${m.members.includes('player')?' · 我的比赛':''}</strong>${(m.standings??m.members.map(id=>({id,score:null}))).map(p=>`<div class="score-row ${p.id==='player'?'you':''}"><strong>${playerName(p.id)}</strong><span>${p.score??'待赛'}</span>${isTopTwo(t)?(advancingIds(t,m).includes(p.id)?'<b>晋级</b>':final&&m.winner===p.id?'<b>冠军</b>':''):(m.winner===p.id?'<b>胜出</b>':'')}</div>`).join('')}</article>`).join('');
  return page(t.round === 'complete' ? '冠军诞生' : roundTitle(t), `<p class="competition-note">${isTopTwo(t)?'64 → 32 → 16 → 8 → 4 · 每组前两名晋级，四人总决赛决出冠亚季军。存活优先，再按本局得分排名；晋级线同分加赛。':'旧赛制存档 · 四人组第一名晋级，决赛三局两胜；本赛事按原规则完成。'}</p>
    ${t.round === 'complete' ? (() => {
      const place = order.indexOf('player') + 1;
      const rec = career.history.find(h => h.id === t.id);
      const outRound = t.archive.find(g => !g.matches.some(m => advancingIds(t, m).includes('player')) && g.matches.some(m => m.members.includes('player')));
      const note = place <= 4 ? '登上领奖台！' : outRound ? `止步「${roundTitle(t, outRound.round)}」` : '';
      return `${podiumMarkup(order)}
      <div class="my-result-card"><div><span>你的最终名次</span><b>第 ${place} 名</b><small>${note}</small></div>${rec ? `<div><span>本届积分</span><b>+${rec.points}</b><small>奖励币 +${place === 1 ? 200 : place <= 8 ? 80 : 20}</small></div>` : ''}</div>
      <div class="page-actions"><button class="button button-primary" data-action="new-tournament">再开一届</button><button class="button" data-action="home">返回大厅</button></div>`; })() : `<div class="page-actions">${t.needsReward ? (['capacity','speed','shield'] as Bonus[]).map(b => `<button class="button button-primary" data-bonus="${b}">下一场：${b === 'capacity' ? '容量 +1' : b === 'speed' ? '速度 +1 档' : '一次护盾'}</button>`).join('') : (playerEliminated(t) ? `<button class="button button-primary" data-action="tournament-autosim">模拟至产生冠军</button>` : `<button class="button button-primary" data-action="tournament-play">${pendingPlayerMatch(t) ? t.replay ? '进入同分加赛' : '进入我的比赛' : '模拟其余比赛并继续'}</button>`)}</div>`}
    ${!isTopTwo(t)&&t.finals.length?`<div class="final-score">决赛大比分 ${t.finals.map(id=>`${playerName(id)} ${t.finalWins[id]??0}`).join(' : ')}</div>`:''}
    ${(() => { const mine = t.matches.filter(m => m.members.includes('player')); const rest = t.matches.filter(m => !m.members.includes('player'));
      if (!mine.length || !rest.length) return `<div class="competition-grid">${groupCards(t.matches,t.round==='final')}</div>`;
      const idx = (m: Match) => t.matches.indexOf(m);
      const cards = (list: Match[]) => groupCards(t.matches, t.round==='final').split('</article>').filter(Boolean).map(c => c + '</article>').filter(c => list.some(m => c.includes(`第 ${idx(m)+1} 组`)));
      return `<div class="competition-grid my-group">${cards(mine).join('')}</div><details class="stage-archive other-groups"><summary>其余 ${rest.length} 组 <span>展开查看</span></summary><div class="competition-grid">${cards(rest).join('')}</div></details>`; })()}
    ${t.archive.length?`<h2 class="section-title">已完成轮次</h2>${t.archive.map((g,i)=>`<details class="stage-archive"><summary>${roundTitle(t,g.round)} · ${g.matches.length} 场 <span>查看赛果</span></summary><div class="competition-grid">${groupCards(g.matches,g.round==='final')}</div></details>`).join('')}`:''}`);
}

/** Runs every remaining match after the player is knocked out, then shows the final standings. */
/** Stepped 2-1-3 podium with the 4th place below. */
function podiumMarkup(order: string[]): string {
  const crown = '<svg class="podium-crown" viewBox="0 0 64 44" aria-hidden="true"><path d="M6 38 L2 10 L18 22 L32 2 L46 22 L62 10 L58 38 Z" fill="#ffcf3a" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M6 38 h52" stroke="#e39a12" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="24" r="5" fill="#f2546a"/><circle cx="17" cy="29" r="3.5" fill="#2a8cf0"/><circle cx="47" cy="29" r="3.5" fill="#2a8cf0"/></svg>';
  const col = (rank: number) => {
    const id = order[rank - 1];
    if (!id) return '';
    const you = id === 'player';
    return `<div class="podium-col rank-${rank}${you ? ' you' : ''}">
      <div class="podium-player">${rank === 1 ? crown : ''}<div class="podium-avatar">${avatarMarkup(id)}</div><strong>${playerName(id)}</strong>${you ? '<em>你</em>' : ''}</div>
      <div class="podium-step"><b>${rank}</b><small>${['冠军', '亚军', '季军'][rank - 1]}</small></div></div>`;
  };
  const confetti = Array.from({ length: 26 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i * 0.23) % 3}s;--r:${(i * 47) % 360}deg;--c:${['#ffcf3a', '#2a8cf0', '#f2546a', '#3fd6a6', '#ff9f1c'][i % 5]}"></i>`).join('');
  const fourth = order[3];
  return `<section class="podium-stage" aria-label="领奖台">
    <div class="podium-confetti" aria-hidden="true">${confetti}</div>
    <div class="podium">${col(2)}${col(1)}${col(3)}</div>
    ${fourth ? `<div class="podium-fourth${fourth === 'player' ? ' you' : ''}"><span>第四名</span>${avatarMarkup(fourth)}<strong>${playerName(fourth)}</strong></div>` : ''}
  </section>`;
}

function autoSimulateTournament(): void {
  const t = competition;
  if (!t) return;
  stopGame(); suspended = null; matches.championship = null;
  if (t.round !== 'complete') simulateToEnd(t);
  settleTournament(career, t);
  persist();
  screen = 'tournament'; render(); window.scrollTo(0, 0);
}

let autoSimAfterRound = false;
let fastForwarding = false;

/** Finish the current match headlessly (no rendering); round-over fires from inside. */
function fastForwardMatch(): void {
  const engine = game;
  if (!engine) return;
  fastForwarding = true;
  engine.resume();
  for (let i = 0; i < 6000 && engine.isRunning(); i += 1) engine.update(1 / 30);
  fastForwarding = false;
}

/**
 * The player has been knocked out of the current match.
 * Championship (like 德州 冠军之路): no choice — the rest of the tournament is simulated automatically.
 * Single match: ask whether to simulate the rest of this match and jump to the result page.
 */
function handlePlayerKnockedOut(): void {
  if (!game || trial || autoSimAfterRound) return;
  const engine = game;
  const championship = matchMode === 'championship' && !!competition;
  // Defer one tick: if this death also ended the round, the round-over flow takes over instead.
  window.setTimeout(() => {
    if (game !== engine || screen !== 'game' || engine.getResult()) return;
    engine.pause();
    void showDialog({
      title: '你已被淘汰',
      body: championship
        ? '可以继续观战这一局，也可以直接模拟剩下的所有比赛，查看冠军赛最终名次。'
        : '可以继续观战，也可以直接模拟剩下的比赛，查看本局结果。',
      confirmText: '模拟剩下比赛',
      cancelText: '继续观战',
    }).then(ok => {
      if (game !== engine || screen !== 'game') return;
      if (!ok) { engine.resume(); return; }
      if (championship) autoSimAfterRound = true;
      fastForwardMatch();
    });
  }, 0);
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
        <div class="match-id"><span class="live-dot"></span><span>${trial ? '试玩 · ' : ''}${mapInfo(selectedMap).name}</span><small>${trial ? '试玩 · 不计长期积分' : matchMode === 'championship' ? '冠军之路' : '单次对战'}</small></div>
        <div class="round-clock"><small>剩余时间</small><strong id="timer">02:00</strong></div>
        <div class="game-actions"><button class="mini-action" data-action="pause" aria-label="暂停" title="暂停（Esc）">Ⅱ</button>${matchMode === 'championship' && !trial ? '' : '<button class="mini-action desktop-only" data-action="restart-ask" aria-label="重新开始" title="重新开始">↻</button>'}</div>
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

function pauseMarkup(mode: 'pause' | 'restart' = 'pause'): string {
  if (mode === 'restart') return `<div class="modal-layer"><div class="pause-card" role="dialog" aria-modal="true" aria-labelledby="pause-title"><p class="eyebrow">重新开始</p><h2 id="pause-title">重开这一局？</h2><p>当前比分和进度会作废，重新开局。</p><div class="modal-actions"><button class="button button-primary" data-action="resume">继续这一局</button><button class="button button-ghost" data-action="restart">确认重开</button></div><p class="modal-hint">Esc 继续游戏</p></div></div>`;
  return `<div class="modal-layer"><div class="pause-card" role="dialog" aria-modal="true" aria-labelledby="pause-title"><p class="eyebrow">已暂停</p><h2 id="pause-title">先歇一下。</h2><p>炸弹不会因为你看菜单而变得更快。</p><div class="modal-actions"><button class="button button-primary" data-action="resume">继续游戏</button>${matchMode === 'championship' && !trial ? '' : '<button class="button button-ghost" data-action="restart">重新开始</button>'}<button class="button button-ghost" data-action="home">${matchMode === 'championship' && !trial ? '返回大厅（比赛自动保存）' : '返回主菜单'}</button></div><p class="modal-hint">Esc 继续游戏</p></div></div>`;
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
  return `<main class="screen result-screen result-${result}"><div class="result-burst">${result === 'win' ? '✦' : result === 'lose' ? '×' : '•'}</div><p class="eyebrow">本局结束 · ${result === 'win' ? '胜利' : result === 'lose' ? '失利' : '平局'}</p><h1>${copy[0]}</h1><p class="result-copy">${copy[1]}</p><div class="result-actions"><button class="button button-primary button-large" data-action="restart">${matchMode === 'championship' ? '返回赛事签表' : '重新开始'} <span>→</span></button><button class="button button-ghost" data-action="home">返回主菜单</button></div><div class="result-note">无需登录 · 积分保存在本机</div></main>`;
}

type SegmentedSetting = 'boardStyle' | 'quality' | 'controls' | 'sound' | 'motion';

/** Pill-style segmented control (radiogroup) replacing native selects in settings. */
function segmented(setting: SegmentedSetting, label: string, current: string, options: Array<[string, string]>): string {
  const index = Math.max(0, options.findIndex(([value]) => value === current));
  return `<div class="segmented" role="radiogroup" aria-label="${label}" data-segmented="${setting}" style="--count:${options.length};--index:${index}"><span class="segmented-thumb" aria-hidden="true"></span>${options.map(([value, text], i) => `<button type="button" role="radio" data-value="${value}" aria-checked="${i === index}" tabindex="${i === index ? 0 : -1}">${text}</button>`).join('')}</div>`;
}

function applySegmented(setting: SegmentedSetting, value: string): void {
  if (setting === 'boardStyle') settings.boardStyle = value as 'modern' | 'classic';
  if (setting === 'quality') settings.quality = value as 'low' | 'high';
  if (setting === 'controls') settings.controls = value as 'auto' | 'touch';
  if (setting === 'motion') settings.reducedMotion = value === 'on';
  if (setting === 'sound') { if ((value === 'on') !== soundEnabled) soundEnabled = audio.toggle(); return; }
  applyPreferences(); persist();
}

function wireSegmented(group: HTMLElement): void {
  const buttons = [...group.querySelectorAll<HTMLButtonElement>('button[data-value]')];
  const select = (index: number, focus = false): void => {
    const button = buttons[index];
    if (!button || button.getAttribute('aria-checked') === 'true') { if (focus) button?.focus(); return; }
    buttons.forEach((b, i) => { b.setAttribute('aria-checked', String(i === index)); b.tabIndex = i === index ? 0 : -1; });
    group.style.setProperty('--index', String(index));
    if (focus) button.focus();
    applySegmented(group.dataset.segmented as SegmentedSetting, button.dataset.value ?? '');
  };
  buttons.forEach((button, index) => button.addEventListener('click', () => select(index)));
  group.addEventListener('keydown', event => {
    const current = buttons.findIndex(b => b.getAttribute('aria-checked') === 'true');
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    select((current + step + buttons.length) % buttons.length, true);
  });
}

function settingsMarkup(): string {
  const row = (title: string, note: string, control: string) => `<div class="setting-row"><span><strong>${title}</strong>${note ? `<small>${note}</small>` : ''}</span>${control}</div>`;
  const link = (action: string, title: string, note: string) => `<button class="setting-row" data-action="${action}"><span><strong>${title}</strong><small>${note}</small></span><b>查看 →</b></button>`;
  const onOff = (setting: SegmentedSetting, label: string, on: boolean) => segmented(setting, label, on ? 'on' : 'off', [['on', '开'], ['off', '关']]);
  const game = `<section class="settings-group" aria-labelledby="sg-game"><h3 id="sg-game" class="settings-group-title">游戏设置</h3>
    ${row('棋盘样式', '立体斜视角，或经典俯视棋盘', segmented('boardStyle', '棋盘样式', settings.boardStyle ?? 'modern', [['modern', '立体'], ['classic', '经典']]))}
    ${row('画质', '流畅模式关闭阴影，适合低性能设备', segmented('quality', '画质', settings.quality, [['high', '精细'], ['low', '流畅']]))}
    ${row('操作方式', '自动识别，或强制显示触控按键', segmented('controls', '操作方式', settings.controls, [['auto', '自动'], ['touch', '触控']]))}
    ${row('声音效果', '爆炸、拾取和胜负反馈', onOff('sound', '声音效果', soundEnabled))}
    ${row('减少动态效果', '关闭镜头震动与大厅漂浮动画', onOff('motion', '减少动态效果', settings.reducedMotion))}</section>`;
  const wardrobe = `<section class="settings-group" aria-labelledby="sg-wardrobe"><h3 id="sg-wardrobe" class="settings-group-title">选手衣橱 · ${career.coins} 奖励币</h3><div class="competition-card"><p>奖励币来自完赛，不同于场内金币的 +5 分。外观不增加战斗属性。</p><div class="cosmetic-grid">${cosmetics.map(c=>`<button class="cosmetic-option ${settings.palette===c.id?'selected':''}" data-cosmetic="${c.id}"><span class="suit-preview" style="--suit:#${c.color.toString(16)}"><i></i></span><strong>${c.name}</strong><small>${settings.palette===c.id?'已装备':settings.unlocked.includes(c.id)?'装备':`${c.price} 奖励币解锁`}</small></button>`).join('')}</div></div></section>`;
  const help = `<section class="settings-group" aria-labelledby="sg-help"><h3 id="sg-help" class="settings-group-title">图鉴与帮助</h3>
    ${link('howto', '玩法一览', '计分、胜负和操作方式')}${link('items', '道具图鉴', '全部 10 种道具 · 效果、释放方式与限制')}${link('players', '选手图鉴', '63 位选手 · 头像、性格与能力')}</section>`;
  const save = `<section class="settings-group" aria-labelledby="sg-save"><h3 id="sg-save" class="settings-group-title">本地存档</h3><div class="competition-card"><p>${saveError ? '⚠ 存档异常，请先导出备份再刷新。' : `修订 ${saveRevision} · 每 2 秒自动保存比赛`}</p><p>进度保存在当前浏览器。导入、导出均支持文件和存档码。</p><div class="save-storage-actions"><button class="button" data-action="import-save">↑ 导入</button><button class="button" data-action="export-save">↓ 导出</button></div></div></section>`;
  return `<main class="screen settings-screen"><div class="topline"><button class="icon-button" data-action="back" aria-label="返回大厅">←</button><span class="screen-kicker">大厅</span></div><section class="settings-layout"><header class="settings-heading"><h2>设置</h2><p class="page-sub">偏好、外观、图鉴和存档。</p></header><div class="settings-list">${game}${wardrobe}${help}${save}</div></section></main>`;
}

function wireScreen(): void {
  app.querySelectorAll<HTMLButtonElement>('[data-cosmetic]').forEach(button=>button.addEventListener('click',()=>{
    if(!equipCosmetic(career,settings,button.dataset.cosmetic??'')){void notify('奖励币不足','完成比赛后再来兑换吧。');return;}
    applyPreferences();persist();render();
  }));
  app.querySelectorAll<HTMLElement>('[data-segmented]').forEach(wireSegmented);
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
  app.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach((button) => button.setAttribute('aria-label', {up:'向上移动',down:'向下移动',left:'向左移动',right:'向右移动'}[button.dataset.dir as Direction]));
  const dpad = app.querySelector<HTMLElement>('.dpad');
  if (dpad) wireDpad(dpad);
}

/** The whole d-pad is one touch area: the held direction follows the finger, so sliding switches direction without lifting. */
function wireDpad(dpad: HTMLElement): void {
  let pointer: number | null = null;
  let current: Direction | null = null;
  const set = (next: Direction | null): void => {
    if (next === current) return;
    if (current) heldDirections.delete(current);
    current = next;
    dpad.querySelectorAll('[data-dir]').forEach(b => b.classList.toggle('is-pressed', (b as HTMLElement).dataset.dir === next));
    if (next) {
      heldDirections.add(next);
      if (game?.isRunning()) { navigator.vibrate?.(8); game.movePlayer(next); }
    }
  };
  const fromPoint = (x: number, y: number): Direction | null => {
    const r = dpad.getBoundingClientRect();
    // centre of the cross = centre of the "down" key column, between the two rows
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.62;
    const dx = x - cx, dy = y - cy;
    if (Math.hypot(dx, dy) < Math.min(r.width, r.height) * 0.12) return current;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  };
  dpad.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    pointer = event.pointerId;
    dpad.setPointerCapture(event.pointerId);
    const key = (event.target as HTMLElement).closest<HTMLElement>('[data-dir]');
    set(key ? key.dataset.dir as Direction : fromPoint(event.clientX, event.clientY));
  });
  dpad.addEventListener('pointermove', (event) => { if (event.pointerId === pointer) set(fromPoint(event.clientX, event.clientY)); });
  const release = (event: PointerEvent): void => { if (event.pointerId !== pointer) return; pointer = null; set(null); };
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) dpad.addEventListener(name, release);
}

function handleAction(action: string): void {
  const wasTrial = trial;
  audio.unlock();
  if (action !== 'bomb') audio.play('click');
  if (!['bomb', 'skill', 'swap'].includes(action)) { heldDirections.clear(); holdingBomb = false; }
  switch (action) {
    case 'trial': stopGame(); trial=true; restoring=false; opponents=[]; startNewRound=true; screen='game'; audio.play('start'); render(); window.scrollTo(0,0); break;
    case 'continue-save': if(!suspended)break; if(saveError){void notify('无法继续',saveError);break;} restoring=true; matchMode=suspended.mode; quickId=suspended.id; selectedMap=suspended.snapshot.mapId; difficulty=suspended.snapshot.difficulty; opponents=suspended.snapshot.opponents; screen='game'; render(); break;
    case 'toggle-motion': settings.reducedMotion=!settings.reducedMotion; applyPreferences(); persist(); render(); break;
    case 'export-save': case 'export-code': showSaveTransfer('export'); break;
    case 'import-save': case 'import-code': showSaveTransfer('import'); break;
    case 'restore-backup': void restoreBackup(); break;
    case 'reset-progress': void showDialog({title:'清空全部进度？',body:'积分、战绩和当前赛事都会清空，建议先导出备份。',confirmText:'清空',danger:true}).then(ok=>{if(ok){stopGame();adoptSave(initialSave());persist();render();}});break;
    case 'leaderboard': screen = 'leaderboard'; render(); break;
    case 'enter-quick': suspended=matches.quick; if(suspended)handleAction('continue-save');else handleAction('start'); break;
    case 'enter-championship':
      suspended=matches.championship;
      if(suspended)handleAction('continue-save');
      else if(competition&&playerEliminated(competition)) autoSimulateTournament();
      else if(competition){screen='tournament';render();window.scrollTo(0,0);}
      else handleAction('new-tournament');
      break;
    case 'players': screen = 'players'; render(); break;
    case 'new-tournament': { const start=()=>{ stopGame(); suspended=null;matches.championship=null; competition = createTournament(difficulty); screen = 'tournament'; render(); }; if (competition && competition.round !== 'complete') void showDialog({title:'放弃当前冠军赛？',body:'当前赛事进度会作废，并创建新的 64 人冠军赛。',confirmText:'放弃并新建',danger:true}).then(ok=>{if(ok)start();}); else start(); break; }
    case 'tournament': screen = 'tournament'; render(); break;
    case 'tournament-play': progressTournament(); break;
    case 'tournament-autosim': autoSimulateTournament(); break;
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
    case 'restart-ask': if (trial) { handleAction('restart'); break; } if (matchMode === 'championship') break; showPauseOverlay('restart'); break;
    case 'resume': if(saveError){void notify('无法继续',saveError);break;} hidePauseOverlay(); game?.resume(); break;
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
    if(!e){void notify('尚无可恢复的备份');return;}
    showSaveTransfer('import',e.data);
  } catch(error) { void notify('恢复失败', error instanceof Error?error.message:''); }
}

function adoptSave(data: Save): void { career=data.career;competition=data.tournament;suspended=data.active;matches=savedMatchSlots(data);settings=data.settings;applyPreferences(); }

function mountGame(): void {
  canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
  if (!canvas) return;
  if (!game) {
    game = new GameEngine(canvas);
    game.configure(settings.quality, settings.reducedMotion, settings.boardStyle ?? 'modern');
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
      card.dataset.short = actor.id === 'player' ? '你' : actor.name.split('·')[0].slice(0, 3);
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
  if (event.type === 'notice') { showToast(event.text); audio.play('pickup'); if (game && !game.getPlayerStats().alive && event.text.includes('你已淘汰')) handlePlayerKnockedOut(); }
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
    clearTimeout(resultTimer);
    // Championship: once the player is out of the tournament, simulate to the champion and show final results.
    if (!trial && matchMode === 'championship' && competition && (autoSimAfterRound || playerEliminated(competition))) {
      if (!autoSimAfterRound) showToast('本轮止步，冠军赛将快速模拟至产生冠军');
      resultTimer = window.setTimeout(autoSimulateTournament, autoSimAfterRound ? 0 : 1400);
      autoSimAfterRound = false;
      return;
    }
    resultTimer = window.setTimeout(() => { screen = 'result'; render(); }, fastForwarding ? 0 : 850);
  }
}

function showPauseOverlay(mode: 'pause' | 'restart' = 'pause'): void {
  holdingBomb = false;
  heldDirections.clear();
  if (!game || screen !== 'game' || app.querySelector('.modal-layer')) return;
  game.pause();
  app.insertAdjacentHTML('beforeend', pauseMarkup(mode));
  app.querySelector<HTMLButtonElement>('.modal-layer .button-primary')?.focus();
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
  if (event.key === 'Escape' && screen === 'game') handleAction(app.querySelector('.modal-layer') ? 'resume' : 'pause');
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
