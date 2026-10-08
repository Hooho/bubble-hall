import { GameEngine } from './game';
import { maps } from './maps';
import { roster } from './roster';
import type { BoardStyle } from './game';

/**
 * Lobby attract mode: a real match played entirely by the AI, rendered behind the menu.
 * Rotates through maps; pauses when the tab is hidden; a single still frame for reduced motion.
 */
export function mountLobbyDemo(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean; quality: 'low' | 'high'; boardStyle: BoardStyle; onMap?: (name: string) => void }): () => void {
  const engine = new GameEngine(canvas);
  engine.configure(opts.quality, true, opts.boardStyle);
  let mapIndex = Math.floor(Math.random() * maps.length);
  let frame = 0, last = performance.now(), restartAt = 0, disposed = false;

  const pickOpponents = () => [...roster].sort(() => Math.random() - 0.5).slice(0, 3);
  const startRound = () => {
    mapIndex = (mapIndex + 1) % maps.length;
    engine.start('hard', maps[mapIndex].id, pickOpponents(), { demo: true });
    opts.onMap?.(maps[mapIndex].name);
    restartAt = 0;
  };
  const off = engine.on((event) => { if (event.type === 'round-over') restartAt = performance.now() + 1800; });

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    engine.resize(Math.max(1, rect.width), Math.max(1, rect.height));
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  const tick = (now: number) => {
    if (disposed) return;
    const delta = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (restartAt && now > restartAt) startRound();
    if (!document.hidden) { engine.update(delta); engine.render(); }
    frame = requestAnimationFrame(tick);
  };

  startRound();
  resize();
  if (opts.reducedMotion) {
    // advance a few seconds so bombs/crates are mid-action, then hold a still image
    for (let i = 0; i < 300; i += 1) engine.update(1 / 60);
    engine.render();
  } else {
    frame = requestAnimationFrame(tick);
  }

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    off();
    engine.destroy();
  };
}
