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
import './game-screen.css';
import './theme.css';
import './champion-celebration.css';
import { notify, showDialog } from './ui-dialog';
import { gameplayGuideMarkup } from './gameplay-guide';
import { maps, mapInfo, type MapId } from './maps';
import { roster, playerName, personalityName, playerAvatar } from './roster';
import { createTournament, advance, pendingPlayerMatch, submitMatch, simulate, playerEliminated, simulateToEnd, multiplier, roundTitle, isTopTwo, advancingIds, replayMembers, tournamentOrder, ranked, type Tournament, type Bonus, type Match } from './tournament';
import { itemGuideMarkup } from './item-guide';
import { newCareer, settleQuick, settleTournament, leaderboard } from './career';
import { cosmetics, equipCosmetic } from './cosmetics';
import { createSaveStore } from './shared/save-store';
import { openSaveDialog } from './save-dialog';
import { initialSave, validateSave, savedMatchSlots, type Save, type MatchSlots } from './save';
import { isActive, rewardNames, type Reward } from './skills';
import { rewardIcon } from './reward-icons';
import { showPickup, pickupFamily } from './pickup-feedback';
import { ArcadeAudio } from './audio';
import { Difficulty, Direction, GameEngine, GameEvent } from './game';

type Screen = 'home' | 'setup' | 'game' | 'pause' | 'result' | 'settings' | 'howto' | 'items' | 'tournament' | 'players' | 'leaderboard';

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) throw new Error('App root not found');
const app: HTMLDivElement = appRoot;

// Suppress browser callouts in battle without disabling editing in save dialogs.
for (const eventName of ['contextmenu', 'selectstart', 'dragstart'] as const) {
  app.addEventListener(eventName, (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('.game-screen')) return;
    if (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    event.preventDefault();
  });
}

let screen: Screen = 'home';
let difficulty: Difficulty = 'normal';
/** Championship setup view (difficulty picker) is shown instead of the bracket. */
let champSetup = false;
let champDifficulty: Difficulty = 'normal';
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
  game?.configure(settings.quality,settings.reducedMotion,settings.boardStyle ?? 'classic');
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
  wireLeaderboard();
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
        <p class="home-subtitle">${minutesText()}积分对战。<br>炸箱 +10，命中 +100；存活到最后或超时争最高分。</p>
      </div>
      <div class="home-actions">
        <div class="lobby-secondary"><button data-action="trial"><i aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M7 4.8v10.4a.8.8 0 0 0 1.2.7l8.2-5.2a.8.8 0 0 0 0-1.4L8.2 4.1A.8.8 0 0 0 7 4.8z" fill="currentColor"/></svg></i>试玩</button><button data-action="overview"><i aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M3.5 4.5c2.4-.6 4.6-.3 6.5 1v10.5c-1.9-1.3-4.1-1.6-6.5-1zM16.5 4.5c-2.4-.6-4.6-.3-6.5 1v10.5c1.9-1.3 4.1-1.6 6.5-1z" fill="currentColor"/></svg></i>玩法一览</button></div>
        <button class="button button-primary mode-entry" data-action="enter-quick"><span><strong>单次对战</strong><small>${matches.quick?'继续上次比赛':`轻松开局 · ${minutesText()}对战`}</small></span><b class="mode-icon mode-icon-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8.6 5.3c-.9-.6-2.1.1-2.1 1.2v11c0 1.1 1.2 1.8 2.1 1.2l8.6-5.5c.8-.5.8-1.8 0-2.4z" fill="currentColor"/></svg></b></button>
        <button class="button mode-entry championship-entry" data-action="enter-championship"><span><strong>冠军之路</strong><small>${matches.championship || (competition&&competition.round!=='complete')?'继续上次比赛':competition?'查看本届结果':'64 位选手 · 冲击冠军'}</small></span><b class="mode-icon mode-icon-crown" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4.2 9.3l3.9 3 3.1-5.1a.9.9 0 0 1 1.6 0l3.1 5.1 3.9-3a.6.6 0 0 1 1 .6l-1.7 7.6H4.9L3.2 9.9a.6.6 0 0 1 1-.6z" fill="currentColor"/><rect x="5" y="18.3" width="14" height="2.2" rx="1.1" fill="currentColor"/><circle cx="12" cy="4.6" r="1.5" fill="currentColor"/><circle cx="3.6" cy="7.9" r="1.3" fill="currentColor"/><circle cx="20.4" cy="7.9" r="1.3" fill="currentColor"/></svg></b></button>
      </div>
      <div class="home-footer">随时开局 · 无需登录 · 进度保存在本机</div>
    </main>`;
}

function setupMarkup(): string {
  return `
    <main class="screen setup-screen">
      <div class="topline"><button class="icon-button" data-action="home" aria-label="返回">←</button><span class="screen-kicker">大厅</span><span class="topline-spacer"></span></div>
      <section class="setup-layout">
        <div class="setup-intro"><h2>单次对战</h2><p class="page-sub">选好地图和电脑难度，${minutesText()}一局。</p><p class="setup-rules">通用比赛规则：每场 2 分钟。炸箱 +10，命中对手 +100。死亡即淘汰；最后一人提前获胜，否则超时比较存活者积分；自爆和无敌期间受击不计分。</p></div>
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

function page(title: string, content: string, back: 'home' | 'settings' = 'home', headerAction = '', screenClass = ''): string {
  return `<main class="screen ${screenClass}"><div class="topline"><button class="icon-button" data-action="${back}" aria-label="${back==='settings'?'返回设置':'返回大厅'}">←</button><span class="screen-kicker">${back==='settings'?'设置':'大厅'}</span></div><section class="competition-content">${headerAction ? `<div class="page-title-row"><h1>${title}</h1>${headerAction}</div>` : `<h1>${title}</h1>`}${content}</section></main>`;
}

function avatarMarkup(id: string): string {
  return id==='player'?'<span class="portrait portrait-you" aria-label="你的头像">YOU</span>':`<img class="portrait" src="${playerAvatar(id)}" alt="${playerName(id)}头像" loading="lazy" width="56" height="56">`;
}

function playersMarkup(): string {
  return page('选手图鉴', `<p class="competition-note">63 位挑战者 · 认识每位对手的性格与能力。</p><div class="competition-grid">${roster.map(p => `<article class="competition-card contestant-card"><div class="contestant-heading">${avatarMarkup(p.id)}<div><h3>${p.name}</h3><p>${personalityName[p.personality]} · 智力 ${'★'.repeat(p.intelligence)}</p></div></div><small>编号 ${p.id} · ${p.personality === 'brave' ? '优先逼近对手与进攻技能' : p.personality === 'careful' ? '优先逃生与保护技能' : '优先拾取补给、积累能力'}</small></article>`).join('')}</div>`,'settings');
}

function leaderboardMarkup(): string {
  const rows = leaderboard(career);
  const me = rows.findIndex(p => p.id === 'player');
  const tournaments = career.history.filter(h => h.mode === 'championship').length;
  const row = (p: typeof rows[number], i: number) => `<div class="score-row ${p.id === 'player' ? 'you' : ''} ${i < 3 ? `top-${i + 1}` : ''}" ${p.id === 'player' ? 'id="lb-me"' : ''}><span>${i+1}</span>${avatarMarkup(p.id)}<strong>${playerName(p.id)}</strong><span>${p.points} 分</span><small>冠军 ${p.crowns}</small></div>`;
  return page('积分榜', `<div class="lb-summary"><div><small>我的排名</small><strong>第 ${me + 1} 名 / ${rows.length} 位</strong></div><div><small>已进行冠军赛</small><strong>${tournaments} 次</strong></div></div>
    <details class="leaderboard-rules"><summary>积分规则 <span>长期积分独立于战场分数</span></summary><p>有效命中 +20，单次胜利 +100；晋级 +40 / +60 / +80 / +120，冠军 +400。难度倍率 1 / 1.3 / 1.6 / 2。电脑只通过实际或模拟比赛积分。</p></details>
    <div class="competition-card leaderboard-list">${rows.map(row).join('')}</div>
    <div class="lb-floating" role="group" aria-label="积分榜快捷操作">
      <button type="button" class="lb-scroll-top" data-lb="top" aria-label="滚动到顶部" hidden>↑</button>
      <button type="button" class="lb-locate" data-lb="me" aria-label="定位到我的排名，第 ${me + 1} 名"><span aria-hidden="true">⌖</span>定位自己<b>第 ${me + 1} 名</b></button>
    </div>`, 'home', '', 'leaderboard-screen');
}

function wireLeaderboard(): void {
  const top = app.querySelector<HTMLButtonElement>('.lb-scroll-top');
  if (!top) return;
  const reduce = () => settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduce() ? 'auto' : 'smooth' }));
  app.querySelector('.lb-locate')?.addEventListener('click', () => {
    const mine = app.querySelector<HTMLElement>('#lb-me');
    if (!mine) return;
    mine.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'center' });
    mine.classList.remove('lb-flash'); void mine.offsetWidth; mine.classList.add('lb-flash');
  });
}

window.addEventListener('scroll', () => {
  const top = app.querySelector<HTMLButtonElement>('.lb-scroll-top');
  if (top) top.hidden = window.scrollY < 320;
}, { passive: true });

const DIFFICULTY_INFO: Record<Difficulty, { name: string; note: string }> = {
  easy: { name: '轻松', note: '反应慢 · 适合熟悉规则' },
  normal: { name: '标准', note: '会躲避 · 会追击' },
  hard: { name: '困难', note: '会封路 · 不会作弊' },
  master: { name: '大师', note: '快速判断 · 熟练用技能' },
};

/** Pick the AI difficulty before a new championship starts. */
function championshipSetupMarkup(): string {
  const running = competition && competition.round !== 'complete';
  const options = (Object.keys(DIFFICULTY_INFO) as Difficulty[]).map(d => `<button type="button" class="difficulty champ-difficulty ${champDifficulty === d ? 'selected' : ''}" data-champ-difficulty="${d}" aria-pressed="${champDifficulty === d}"><strong>${DIFFICULTY_INFO[d].name}</strong><small>${DIFFICULTY_INFO[d].note}</small><b>积分 ×${multiplier[d]}</b></button>`).join('');
  return page('冠军之路', `<p class="page-sub">64 位选手分组对战，每组前两名晋级：64 → 32 → 16 → 8 → 4 人总决赛。整届比赛使用同一难度，难度越高，长期积分倍率越高。</p>
    <section class="competition-card champ-setup" aria-labelledby="champ-diff-title"><h3 id="champ-diff-title">选择电脑难度</h3><div class="difficulty-row champ-difficulty-row">${options}</div></section>
    ${running ? '<p class="page-sub champ-warning">⚠ 当前有一届冠军赛正在进行，开始新的一届会放弃它。</p>' : ''}
    <div class="page-actions champ-setup-actions"><button class="button button-primary button-large" data-action="tournament-start">开始冠军赛 · ${DIFFICULTY_INFO[champDifficulty].name} <span aria-hidden="true">→</span></button>${competition ? '<button class="button" data-action="tournament-setup-cancel">取消</button>' : ''}</div>`);
}

function tournamentMarkup(): string {
  const t = competition;
  if (!t || champSetup) return championshipSetupMarkup();
  const order = tournamentOrder(t);
  const groupCards = (matches: Match[], final = false) => matches.map((m,i)=>({m,i})).sort((a,b)=>Number(b.m.members.includes('player'))-Number(a.m.members.includes('player'))).map(({m,i})=>`<article class="competition-card ${m.members.includes('player')?'my-match':''}"><strong>第 ${i+1} 组${m.members.includes('player')?' · 我的比赛':''}</strong>${(m.standings??m.members.map(id=>({id,score:null}))).map(p=>`<div class="score-row ${p.id==='player'?'you':''}"><strong>${playerName(p.id)}</strong><span>${p.score??'待赛'}</span>${isTopTwo(t)?(advancingIds(t,m).includes(p.id)?'<b>晋级</b>':final&&m.winner===p.id?'<b>冠军</b>':''):(m.winner===p.id?'<b>胜出</b>':'')}</div>`).join('')}</article>`).join('');
  return page(t.round === 'complete' ? '冠军诞生' : roundTitle(t), `<p class="champ-difficulty-tag">难度 · ${DIFFICULTY_INFO[t.difficulty].name} <span>积分 ×${multiplier[t.difficulty]}</span></p><p class="competition-note">${isTopTwo(t)?'64 → 32 → 16 → 8 → 4 · 每组前两名晋级，四人总决赛决出冠亚季军。存活优先，再按本局得分排名；晋级线同分加赛。':'旧赛制存档 · 四人组第一名晋级，决赛三局两胜；本赛事按原规则完成。'}</p>
    ${t.round === 'complete' ? (() => {
      const place = order.indexOf('player') + 1;
      const rec = career.history.find(h => h.id === t.id);
      const outRound = t.archive.find(g => !g.matches.some(m => advancingIds(t, m).includes('player')) && g.matches.some(m => m.members.includes('player')));
      const note = place <= 4 ? '登上领奖台！' : outRound ? `止步「${roundTitle(t, outRound.round)}」` : '';
      return `${podiumMarkup(order)}
      <div class="my-result-card"><div><span>你的最终名次</span><b>第 ${place} 名</b><small>${note}</small></div>${rec ? `<div><span>本届积分</span><b>+${rec.points}</b><small>奖励币 +${place === 1 ? 200 : place <= 8 ? 80 : 20}</small></div>` : ''}</div>
`; })() : `<div class="page-actions">${t.needsReward ? (['capacity','speed','shield'] as Bonus[]).map(b => `<button class="button button-primary" data-bonus="${b}">下一场：${b === 'capacity' ? '容量 +1' : b === 'speed' ? '速度 +1 档' : '一次护盾'}</button>`).join('') : (playerEliminated(t) ? `<button class="button button-primary" data-action="tournament-autosim">模拟至产生冠军</button>` : `<button class="button button-primary" data-action="tournament-play">${pendingPlayerMatch(t) ? t.replay ? '进入同分加赛' : '进入我的比赛' : '模拟其余比赛并继续'}</button>`)}</div>`}
    ${!isTopTwo(t)&&t.finals.length?`<div class="final-score">决赛大比分 ${t.finals.map(id=>`${playerName(id)} ${t.finalWins[id]??0}`).join(' : ')}</div>`:''}
    ${(() => { const mine = t.matches.filter(m => m.members.includes('player')); const rest = t.matches.filter(m => !m.members.includes('player'));
      if (!mine.length || !rest.length) return `<div class="competition-grid">${groupCards(t.matches,t.round==='final')}</div>`;
      const idx = (m: Match) => t.matches.indexOf(m);
      const cards = (list: Match[]) => groupCards(t.matches, t.round==='final').split('</article>').filter(Boolean).map(c => c + '</article>').filter(c => list.some(m => c.includes(`第 ${idx(m)+1} 组`)));
      return `<div class="competition-grid my-group">${cards(mine).join('')}</div><details class="stage-archive other-groups"><summary>其余 ${rest.length} 组 <span>展开查看</span></summary><div class="competition-grid">${cards(rest).join('')}</div></details>`; })()}
    ${t.archive.length?`<h2 class="section-title">已完成轮次</h2>${t.archive.map((g,i)=>`<details class="stage-archive"><summary>${roundTitle(t,g.round)} · ${g.matches.length} 场 <span>查看赛果</span></summary><div class="competition-grid">${groupCards(g.matches,g.round==='final')}</div></details>`).join('')}`:''}`, 'home', t.round === 'complete' ? '<button class="button button-primary page-title-action" data-action="new-tournament">再开一届 <span aria-hidden="true">→</span></button>' : '');
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
  screen = t.podium.includes('player') ? 'result' : 'tournament';
  if (t.podium[0] === 'player') audio.play('champion');
  render(); window.scrollTo(0, 0);
}

let autoSimAfterRound = false;
let fastForwarding = false;

/** Finish the current match headlessly (no rendering); round-over fires from inside. */
function fastForwardMatch(): void {
  const engine = game;
  if (!engine) return;
  fastForwarding = true;
  try {
    engine.resume();
    for (let i = 0; i < 6000 && engine.isRunning(); i += 1) engine.update(1 / 30);
  } finally {
    fastForwarding = false;
  }
}

/** Keep the battle running; the in-flow spectator controls offer both paths. */
function handlePlayerKnockedOut(): void {
  if (!game || trial || autoSimAfterRound) return;
  holdingBomb = false;
  heldDirections.clear();
  if (matchMode === 'championship' && competition) autoSimAfterRound = true;
}

/** Player is out: finish this match headlessly; in the championship also simulate the rest of the event. */
function simulateRestAfterKnockout(): void {
  if (!game || trial || game.getPlayerStats().alive || game.getResult()) return;
  if (matchMode === 'championship' && competition) autoSimAfterRound = true;
  fastForwardMatch();
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

const touchQuery = matchMedia('(max-width: 900px), (pointer: coarse)');
/** Touch controls layout: narrow screen, coarse pointer, or forced in 设置 → 操作方式. */
const touchLayout = (): boolean => settings.controls === 'touch' || touchQuery.matches;

function gameModeLabel(): string {
  if (trial) return '试玩 · 不计积分';
  if (matchMode !== 'championship' || !competition) return '单次对战';
  if (replaying) return '冠军赛 · 加赛';
  const title = roundTitle(competition);
  return `冠军赛 · ${title.includes('·') ? title.split('·').pop()!.trim() : title}`;
}

function gameMarkup(): string {
  const canRestart = matchMode !== 'championship' || trial;
  return `
    <main class="screen game-screen${touchLayout() ? ' layout-touch' : ''}">
      <header class="game-topbar">
        <div class="match-id"><span class="mode-chip">${gameModeLabel()}</span><strong>${mapInfo(selectedMap).name}</strong></div>
        <div class="round-clock" role="timer" aria-label="剩余时间"><strong id="timer">0${matchMinutes()}:00</strong></div>
        <div class="game-actions">${canRestart ? '<button class="mini-action" data-action="restart-ask" aria-label="重新开始" title="重新开始">↻</button>' : ''}<button class="mini-action" data-action="pause" aria-label="暂停" title="暂停（Esc）">Ⅱ</button></div>
      </header>
      <div class="game-layout">
        <aside id="match-scores" class="match-scores" aria-label="本局所有选手比分"></aside>
        <section class="board-stage">
          <div class="board-card">
            <div class="board-wrap"><canvas id="game-canvas"></canvas></div>
            <div class="base-attributes" aria-label="玩家基础属性"><div title="炸弹容量：当前可放 / 总容量，爆炸后释放名额">${rewardIcon('bomb')}<span>容量 <b id="base-capacity">1/1</b></span></div><div title="普通炸弹向四个方向延伸的格数">${rewardIcon('flame')}<span>范围 <b id="base-range">2 格</b></span></div><div title="基础移动速度，不含临时疾跑加成">${rewardIcon('speed')}<span>移速 <b id="base-speed">100%</b></span></div></div>
          </div>
          <div id="passive-status" aria-label="保护与持续效果"></div>
        </section>
      </div>
      <div class="desktop-controls" aria-label="键盘操作"><p><b>↑↓←→</b><b>WASD</b>移动</p><p><b>SPACE</b>放炸弹</p><p><b>E</b>技能<b>F</b>替换</p><p><b>Esc</b>暂停</p></div>
      <div class="mobile-controls"><div class="dpad"><button data-dir="up" aria-label="上">▲</button><button data-dir="left" aria-label="左">◀</button><button data-dir="down" aria-label="下">▼</button><button data-dir="right" aria-label="右">▶</button></div><button class="bomb-button" data-action="bomb" aria-label="放置炸弹"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M30 13l5-6 5 3-2 5M34 5l2-3" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M27 12l9 7-5 6-9-7z" fill="currentColor"/><circle cx="22" cy="29" r="15" fill="currentColor"/><path d="M13 26q1-7 8-7" fill="none" stroke="#83dfff" stroke-width="3" stroke-linecap="round"/></svg><small>炸弹</small></button></div>
      <div class="skill-dock"><button id="skill-button" data-action="skill">空技能槽</button><button id="swap-button" data-action="swap" hidden></button></div>
      <div class="spectate-bar" hidden><span class="spectate-eye" aria-hidden="true">👀</span><div><strong id="spectate-title" role="status">你已被淘汰</strong><small id="spectate-note">本局结束后结算</small></div><nav class="spectate-actions" aria-label="淘汰后的选择"><button class="button button-primary" data-action="spectate-simulate">模拟剩下比赛</button><button class="button" data-action="spectate-watch">继续观战</button></nav></div>
      <div id="toast" class="game-toast" aria-live="polite"></div>
    </main>`;
}

function pauseMarkup(mode: 'pause' | 'restart' = 'pause'): string {
  if (mode === 'restart') return `<div class="modal-layer"><div class="pause-card" role="dialog" aria-modal="true" aria-labelledby="pause-title"><p class="eyebrow">重新开始</p><h2 id="pause-title">重开这一局？</h2><p>当前比分和进度会作废，重新开局。</p><div class="modal-actions"><button class="button button-primary" data-action="resume">继续这一局</button><button class="button button-ghost" data-action="restart">确认重开</button></div><p class="modal-hint">Esc 继续游戏</p></div></div>`;
  return `<div class="modal-layer"><div class="pause-card" role="dialog" aria-modal="true" aria-labelledby="pause-title"><p class="eyebrow">已暂停</p><h2 id="pause-title">先歇一下。</h2><p>炸弹不会因为你看菜单而变得更快。</p><div class="modal-actions"><button class="button button-primary" data-action="resume">继续游戏</button>${matchMode === 'championship' && !trial ? '' : '<button class="button button-ghost" data-action="restart">重新开始</button>'}<button class="button button-ghost" data-action="home">${matchMode === 'championship' && !trial ? '返回大厅（比赛自动保存）' : '返回主菜单'}</button></div><p class="modal-hint">Esc 继续游戏</p></div></div>`;
}

function resultMarkup(): string {
  if (!trial && matchMode === 'championship' && competition?.round === 'complete') {
    const place = tournamentOrder(competition).indexOf('player') + 1;
    const title = ['冠军', '亚军', '季军'][place - 1] ?? `第 ${place} 名`;
    const champion = place === 1;
    const ribbons = champion ? Array.from({length: 40}, (_, i) => `<i style="--x:${(i * 37) % 100}%;--delay:${(i % 8) * .18}s;--turn:${i * 31}deg;--color:${['#ffc64a','#ffffff','#439bff','#ff8b9d'][i % 4]}"></i>`).join('') : '';
    return `<main class="screen championship-award${champion ? ' is-champion' : ''}${settings.reducedMotion ? ' award-still' : ''}">
      <div class="award-confetti" aria-hidden="true">${ribbons}</div>
      <div class="award-content"><p class="award-label">冠军之路 · 总决赛</p>
      <div class="award-emblem" aria-hidden="true">${champion ? '<svg viewBox="0 0 160 180"><path d="M43 30H16v26c0 31 22 45 46 45M117 30h27v26c0 31-22 45-46 45" fill="none" stroke="#f7bb40" stroke-width="12"/><path d="M39 18h82v46c0 32-18 53-41 53S39 96 39 64Z" fill="url(#trophy-gold)"/><path d="M72 109h16v36h24v17H48v-17h24Z" fill="#d99a24"/><path d="m80 36 7 15 17 2-13 12 3 17-14-8-14 8 3-17-13-12 17-2Z" fill="#fff5c7"/><defs><linearGradient id="trophy-gold"><stop stop-color="#fff1a7"/><stop offset=".45" stop-color="#ffd04c"/><stop offset="1" stop-color="#d68a14"/></linearGradient></defs></svg>' : `<span>${place === 2 ? '🥈' : place === 3 ? '🥉' : '🏅'}</span>`}</div>
      <h1>恭喜你获得<span>${title}！</span></h1>
      <p class="award-description">${champion ? '从 64 位选手中脱颖而出，冠军属于你！' : '本届比赛圆满结束，见证你的精彩表现。'}</p>
      <button class="button button-primary button-large" data-action="championship-settlement">查看结算 <span aria-hidden="true">→</span></button></div></main>`;
  }
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

type SegmentedSetting = 'boardStyle' | 'matchMinutes' | 'quality' | 'controls' | 'sound' | 'motion';
const matchMinutes = (): 1 | 2 | 3 => settings.matchMinutes ?? 2;
const minutesText = (): string => ['', '一', '两', '三'][matchMinutes()] + '分钟';

/** Pill-style segmented control (radiogroup) replacing native selects in settings. */
function segmented(setting: SegmentedSetting, label: string, current: string, options: Array<[string, string]>): string {
  const index = Math.max(0, options.findIndex(([value]) => value === current));
  return `<div class="segmented" role="radiogroup" aria-label="${label}" data-segmented="${setting}" style="--count:${options.length};--index:${index}"><span class="segmented-thumb" aria-hidden="true"></span>${options.map(([value, text], i) => `<button type="button" role="radio" data-value="${value}" aria-checked="${i === index}" tabindex="${i === index ? 0 : -1}">${text}</button>`).join('')}</div>`;
}

function applySegmented(setting: SegmentedSetting, value: string): void {
  if (setting === 'boardStyle') settings.boardStyle = value as 'modern' | 'classic';
  if (setting === 'matchMinutes') settings.matchMinutes = Number(value) as 1 | 2 | 3;
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
    ${row('每局时长', '对新开的对局生效', segmented('matchMinutes', '每局时长', String(matchMinutes()), [['1', '1 分钟'], ['2', '2 分钟'], ['3', '3 分钟']]))}
    ${row('棋盘样式', '立体斜视角，或经典俯视棋盘', segmented('boardStyle', '棋盘样式', settings.boardStyle ?? 'classic', [['modern', '立体'], ['classic', '经典']]))}
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
  app.querySelectorAll<HTMLButtonElement>('[data-champ-difficulty]').forEach((button) => button.addEventListener('click', () => {
    champDifficulty = button.dataset.champDifficulty as Difficulty;
    render();
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
      else { champSetup = true; screen = 'tournament'; render(); window.scrollTo(0, 0); }
      break;
    case 'players': screen = 'players'; render(); break;
    case 'new-tournament': champDifficulty = competition?.difficulty ?? champDifficulty; champSetup = true; screen = 'tournament'; render(); window.scrollTo(0, 0); break;
    case 'tournament-setup-cancel': champSetup = false; screen = competition ? 'tournament' : 'home'; render(); window.scrollTo(0, 0); break;
    case 'tournament-start': { const start=()=>{ stopGame(); suspended=null;matches.championship=null; competition = createTournament(champDifficulty); champSetup = false; persist(); screen = 'tournament'; render(); window.scrollTo(0, 0); }; if (competition && competition.round !== 'complete') void showDialog({title:'放弃当前冠军赛？',body:'当前赛事进度会作废，并按新难度创建 64 人冠军赛。',confirmText:'放弃并新建',danger:true}).then(ok=>{if(ok)start();}); else start(); break; }
    case 'tournament': screen = 'tournament'; render(); break;
    case 'tournament-play': progressTournament(); break;
    case 'tournament-autosim': autoSimulateTournament(); break;
    case 'skill': game?.usePlayerSkill(); break;
    case 'spectate-simulate': simulateRestAfterKnockout(); break;
    case 'championship-settlement': stopGame(); screen = 'tournament'; render(); window.scrollTo(0, 0); break;
    case 'spectate-watch': {
      const title = app.querySelector('#spectate-title');
      if (title) title.textContent = '你已被淘汰 · 观战中';
      const button = app.querySelector<HTMLButtonElement>('[data-action="spectate-watch"]');
      if (button) button.hidden = true;
      game?.resume();
      break;
    }
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
    case 'home': stopGame(); trial=false; champSetup=false; screen = 'home'; render(); window.scrollTo(0,0);break;
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
        game.start(difficulty, selectedMap, opponents, { duration: matchMinutes() * 60 });
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
    game.configure(settings.quality, settings.reducedMotion, settings.boardStyle ?? 'classic');
    gameEventUnsubscribe = game.on(handleGameEvent);
  }
  if(restoring && suspended){game.restore(suspended.snapshot);restoring=false;startNewRound=false;resizeGame();requestAnimationFrame(()=>showPauseOverlay());}
  else if (startNewRound) {
    game.start(difficulty, selectedMap, opponents, { practice: trial, duration: matchMinutes() * 60 });
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
  autoSimAfterRound = false;
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
  if (passives) {
    const pill = (kind: Reward, label: string, color: string) => `<span class="passive-pill" data-passive="${kind}" style="--pill:${color}">${rewardIcon(kind)}${label}</span>`;
    const markup = [skills.shield ? pill('shield', '护盾', '#2fbf68') : '', skills.life > 0 ? pill('life', `复活 ×${skills.life}`, '#f2547f') : '', skills.invincible > 0 ? pill('invincible', `${skills.invincible.toFixed(1)}s`, '#9375da') : '', skills.dash > 0 ? pill('dash', `${skills.dash.toFixed(1)}s`, '#e39a00') : '', skills.rapid > 0 ? pill('rapid', `${skills.rapid.toFixed(1)}s`, '#e56746') : '', skills.respawning ? '<span class="passive-pill">等待安全复活</span>' : ''].join('');
    if (passives.innerHTML !== markup) passives.innerHTML = markup;
  }
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
  for (const [id, value] of Object.entries({ 'base-capacity':`${Math.max(0,base.maxBombs-base.bombs)}/${base.maxBombs}`, 'base-range':`${base.range} 格`, 'base-speed':`${Math.round(base.speed*100)}%` })) {
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
    const colors = game.getActorColors();
    const compact = scoreboard.clientWidth < 460;
    for (const actor of standings) {
      let card = Array.from(scoreboard.children).find(node => (node as HTMLElement).dataset.actor === actor.id) as HTMLElement | undefined;
      if (!card) {
        card = document.createElement('div');
        card.dataset.actor = actor.id;
        card.className = 'match-score';
        card.innerHTML = '<i class="score-dot" aria-hidden="true"></i><span class="score-name"></span><em class="score-tag">淘汰</em><strong></strong>';
        scoreboard.append(card);
      }
      card.classList.toggle('is-out', !actor.alive);
      card.classList.toggle('is-you', actor.id === 'player');
      card.style.setProperty('--dot', colors[actor.id] ?? '#9fb3c6');
      const name = actor.id === 'player' ? '你' : compact ? actor.name.split('·')[0].slice(0, 4) : actor.name;
      const nameEl = card.querySelector('.score-name')!, scoreEl = card.querySelector('strong')!;
      if (nameEl.textContent !== name) nameEl.textContent = name;
      if (scoreEl.textContent !== String(actor.score)) scoreEl.textContent = String(actor.score);
      card.title = `${actor.name}：${actor.score} 分${actor.alive ? '' : ' · 已淘汰'}`;
    }
  }
  const screenEl = app.querySelector<HTMLElement>('.game-screen');
  if (screenEl && screenEl.classList.contains('layout-touch') !== touchLayout()) { screenEl.classList.toggle('layout-touch', touchLayout()); resizeGame(); }
  const spectating = !trial && !game.getPlayerStats().alive && !game.getResult();
  if (screenEl && screenEl.classList.contains('is-spectating') !== spectating) {
    screenEl.classList.toggle('is-spectating', spectating);
    const bar = screenEl.querySelector<HTMLElement>('.spectate-bar');
    if (bar) bar.hidden = !spectating;
    screenEl.querySelectorAll<HTMLButtonElement>('.mobile-controls button, .skill-dock button').forEach(b => { if (spectating) b.disabled = true; else if (!b.matches('.skill-dock button')) b.disabled = false; });
  }
  if (spectating) {
    const note = app.querySelector<HTMLElement>('#spectate-note');
    const left = game.getStandings().filter(a => a.alive).length;
    const text = `剩余 ${left} 名选手 · ${matchMode === 'championship' ? '本局结束后自动结算整届比赛' : '本局结束后结算'}`;
    if (note && note.textContent !== text) note.textContent = text;
  }
  const toast = document.querySelector<HTMLElement>('#toast');
  if (toast && toastTimer > 0) {
    toastTimer -= 1 / 60;
    if (toastTimer <= 0) toast.textContent = '';
  }
}

function handleGameEvent(event: GameEvent): void {
  // Fast-forward preserves settlement, but must not schedule a burst of battle audio/effects.
  if (fastForwarding && event.type !== 'round-over') return;
  if (event.type === 'notice') { showToast(event.text); audio.play('pickup'); if (game && !game.getPlayerStats().alive && event.text.includes('你已淘汰')) handlePlayerKnockedOut(); }
  if (event.type === 'bomb-placed') audio.play('place');
  if (event.type === 'explosion') audio.play('blast');
  if (event.type === 'item-picked') {
    if (event.actorId === 'player' && !event.capped) audio.play(({ score: 'coin', growth: 'growth', protect: 'life', active: 'pickup' } as const)[pickupFamily(event.item)]);
    showPickup(app, event.item, game?.getActorScreenPoint(event.actorId) ?? null, event.capped, event.replaced, event.actorId === 'player', event.lives);
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
    const championshipComplete = !trial && matchMode === 'championship' && competition?.round === 'complete';
    if (championshipComplete) audio.play(competition?.podium[0] === 'player' ? 'champion' : 'win');
    else audio.play(event.result === 'win' ? 'win' : 'lose');
    clearTimeout(resultTimer);
    // Championship: once the player is out of the tournament, simulate to the champion and show final results.
    if (!championshipComplete && !trial && matchMode === 'championship' && competition && (autoSimAfterRound || !game?.getPlayerStats().alive || playerEliminated(competition))) {
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
