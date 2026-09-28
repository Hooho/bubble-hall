import './style.css';
import { Difficulty, Direction, GameEngine, GameEvent } from './game';

type Screen = 'home' | 'setup' | 'game' | 'pause' | 'result' | 'settings' | 'howto';

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) throw new Error('App root not found');
const app: HTMLDivElement = appRoot;

let screen: Screen = 'home';
let difficulty: Difficulty = 'normal';
let soundEnabled = true;
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
    case 'howto': return howtoMarkup();
    default: return homeMarkup();
  }
}

function homeMarkup(): string {
  return `
    <main class="screen home-screen">
      <div class="home-orbit orbit-one"></div><div class="home-orbit orbit-two"></div>
      <div class="home-copy">
        <p class="eyebrow"><span class="pulse-dot"></span> SINGLE PLAYER · 2.5D ARCADE</p>
        <h1>爆破<br><em>街区</em></h1>
        <p class="home-subtitle">在倒计时归零之前，<br>把整座街区变成你的战术地图。</p>
      </div>
      <div class="home-actions">
        <button class="button button-primary button-large" data-action="start">开始对战 <span>→</span></button>
        <div class="button-row">
          <button class="button button-ghost" data-action="howto">怎么玩</button>
          <button class="button button-ghost" data-action="settings">设置</button>
        </div>
      </div>
      <div class="home-stamp"><span>SEASON</span><strong>01</strong><small>街角花园</small></div>
      <div class="home-footer">NO LOGIN · NO INTERNET · JUST ONE MORE ROUND</div>
    </main>`;
}

function setupMarkup(): string {
  return `
    <main class="screen setup-screen">
      <div class="topline"><button class="icon-button" data-action="home" aria-label="返回">←</button><span class="screen-kicker">准备出发 / 01</span><span class="topline-spacer"></span></div>
      <section class="setup-layout">
        <div class="setup-intro"><p class="eyebrow">MATCH SETUP</p><h2>选好你的<br><em>战术。</em></h2><p>一场局内约 2–4 分钟的单机街机对战。先炸开路线，再决定要追谁。</p></div>
        <div class="setup-panel">
          <div class="setup-block"><div class="field-label">地图 / MAP</div><button class="map-choice active"><span class="map-thumb">✦</span><span><strong>街角花园</strong><small>四路相通 · 木箱密度 28%</small></span><i>✓</i></button></div>
          <div class="setup-block"><div class="field-label">电脑难度 / AI</div><div class="difficulty-row">
            ${difficultyButton('easy', '轻松', '反应慢 · 适合熟悉规则')}${difficultyButton('normal', '标准', '会躲避 · 会追击')}${difficultyButton('hard', '狠一点', '会封路 · 不会作弊')}
          </div></div>
          <div class="setup-facts"><span><b>01</b> 玩家</span><span><b>03</b> 电脑</span><span><b>180s</b> 单局</span></div>
          <button class="button button-primary button-large full-width" data-action="play">进入街区 <span>→</span></button>
        </div>
      </section>
    </main>`;
}

function difficultyButton(value: Difficulty, title: string, caption: string): string {
  return `<button class="difficulty ${difficulty === value ? 'selected' : ''}" data-difficulty="${value}"><strong>${title}</strong><small>${caption}</small></button>`;
}

function gameMarkup(): string {
  const stats = game?.getPlayerStats() ?? { bombs: 0, maxBombs: 1, range: 2, alive: true };
  const enemies = game?.getEnemyStats() ?? [];
  return `
    <main class="screen game-screen">
      <div class="game-topbar">
        <div class="match-id"><span class="live-dot"></span><span>街角花园</span><small>SOLO RUN</small></div>
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
      <div id="toast" class="game-toast" aria-live="polite"></div>
    </main>`;
}

function pauseMarkup(): string {
  return `<div class="modal-layer"><div class="pause-card"><p class="eyebrow">BREAK IN THE ACTION</p><h2>先歇一下。</h2><p>炸弹不会因为你看菜单而变得更快。</p><div class="modal-actions"><button class="button button-primary" data-action="resume">继续游戏</button><button class="button button-ghost" data-action="restart">重新开始</button><button class="button button-ghost" data-action="home">返回主菜单</button></div></div></div>`;
}

function resultMarkup(): string {
  const result = game?.getResult() ?? 'draw';
  const copy = result === 'win' ? ['街区归你了。', '你把三名电脑都留在了爆炸里。'] : result === 'lose' ? ['这次差一点。', '下一局，记得先给自己留一条退路。'] : ['同时引爆。', '没有赢家，但这场烟花很公平。'];
  return `<main class="screen result-screen result-${result}"><div class="result-burst">${result === 'win' ? '✦' : result === 'lose' ? '×' : '•'}</div><p class="eyebrow">ROUND COMPLETE · ${result.toUpperCase()}</p><h1>${copy[0]}</h1><p class="result-copy">${copy[1]}</p><div class="result-actions"><button class="button button-primary button-large" data-action="restart">再来一局 <span>→</span></button><button class="button button-ghost" data-action="home">返回主菜单</button></div><div class="result-note">NO LOGIN · LOCAL SCORE</div></main>`;
}

function settingsMarkup(): string {
  return `<main class="screen simple-screen"><div class="topline"><button class="icon-button" data-action="back">←</button><span class="screen-kicker">设置 / SETTINGS</span><span class="topline-spacer"></span></div><section class="simple-content"><p class="eyebrow">SYSTEM CHECK</p><h2>让街区<br><em>更顺手。</em></h2><div class="settings-list"><button class="setting-row" data-action="toggle-sound"><span><strong>声音效果</strong><small>爆炸、拾取和胜负反馈</small></span><b id="sound-label">${soundEnabled ? '开启' : '关闭'}</b></button><div class="setting-row"><span><strong>操作方式</strong><small>键盘 / 触控会自动适配</small></span><b>AUTO</b></div><div class="setting-row"><span><strong>画面风格</strong><small>程序化低多边形 · 原型版</small></span><b>2.5D</b></div></div></section></main>`;
}

function howtoMarkup(): string {
  return `<main class="screen simple-screen"><div class="topline"><button class="icon-button" data-action="back">←</button><span class="screen-kicker">玩法说明 / HOW TO PLAY</span><span class="topline-spacer"></span></div><section class="simple-content howto-content"><p class="eyebrow">THREE RULES</p><h2>炸开路线，<br><em>活着出来。</em></h2><div class="rule-grid"><article><span>01</span><h3>放炸弹</h3><p>炸弹 2 秒后爆炸。爆炸会沿四个方向扩散，撞到墙或木箱就停。</p></article><article><span>02</span><h3>留退路</h3><p>电脑和你遵守同样的规则。没有逃生路线时，不要贪那一箱道具。</p></article><article><span>03</span><h3>拿下街区</h3><p>炸掉所有电脑即可胜利。红、蓝、紫三名对手各有自己的习惯。</p></article></div><button class="button button-primary" data-action="back">知道了 <span>→</span></button></section></main>`;
}

function wireScreen(): void {
  app.querySelectorAll<HTMLElement>('[data-action]').forEach((element) => element.addEventListener('click', () => handleAction(element.dataset.action ?? '')));
  app.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach((button) => button.addEventListener('click', () => {
    difficulty = button.dataset.difficulty as Difficulty;
    render();
  }));
  app.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach((button) => {
    const direction = button.dataset.dir as Direction;
    const move = (event: Event) => { event.preventDefault(); game?.movePlayer(direction); };
    button.addEventListener('pointerdown', move);
    button.addEventListener('click', move);
  });
}

function handleAction(action: string): void {
  switch (action) {
    case 'start': screen = 'setup'; render(); break;
    case 'play': startNewRound = true; screen = 'game'; render(); break;
    case 'home': stopGame(); screen = 'home'; render(); break;
    case 'howto': screen = 'howto'; render(); break;
    case 'settings': screen = 'settings'; render(); break;
    case 'back': screen = 'home'; render(); break;
    case 'pause': showPauseOverlay(); break;
    case 'resume': hidePauseOverlay(); game?.resume(); break;
    case 'restart':
      hidePauseOverlay();
      if (screen === 'result') {
        stopGame();
        startNewRound = true;
        screen = 'game';
        render();
      } else if (game) {
        game.start(difficulty);
        startNewRound = false;
        screen = 'game';
        updateHud();
      }
      break;
    case 'bomb': game?.placePlayerBomb(); break;
    case 'toggle-sound': soundEnabled = !soundEnabled; render(); break;
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
    game.start(difficulty);
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
  game?.render();
  updateHud();
  if (screen === 'game' || screen === 'pause') animationFrame = requestAnimationFrame(loop);
}

function updateHud(): void {
  if (!game) return;
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
  if (aliveCount) aliveCount.textContent = `剩余玩家 ${enemyStats.filter((enemy) => enemy.alive).length + (stats.alive ? 1 : 0)}`;
  const playerStatus = document.querySelector<HTMLElement>('#player-status');
  if (playerStatus) playerStatus.textContent = stats.alive ? '战斗中' : '已出局';
  const toast = document.querySelector<HTMLElement>('#toast');
  if (toast && toastTimer > 0) {
    toastTimer -= 1 / 60;
    if (toastTimer <= 0) toast.textContent = '';
  }
}

function handleGameEvent(event: GameEvent): void {
  if (event.type === 'item-picked') {
    if (event.actorId === 'player') showToast(event.item === 'bomb' ? '炸弹容量 +1' : event.item === 'flame' ? '爆炸范围 +1' : '移动速度提升');
  }
  if (event.type === 'round-over') {
    window.setTimeout(() => { screen = 'result'; render(); }, 500);
  }
}

function showPauseOverlay(): void {
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
  const map: Record<string, Direction | undefined> = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
  const direction = map[event.key];
  if (direction && screen === 'game') { event.preventDefault(); game?.movePlayer(direction); }
  if (event.key === ' ' && screen === 'game') { event.preventDefault(); game?.placePlayerBomb(); }
  if (event.key === 'Escape' && screen === 'game') handleAction('pause');
});

render();
