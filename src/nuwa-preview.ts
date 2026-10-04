import { GameEngine, type Direction } from './game';
import { roster } from './roster';
import './nuwa-preview.css';

const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `<main><header><a href="/">← 返回游戏</a><h1>女娲 · 战场试演</h1><p>右下角为女娲。独立试演，不读取或覆盖比赛存档。</p></header><canvas aria-label="女娲战场试演"></canvas><nav><button id="play">开始试演</button><button id="reset">重置</button><span>方向键移动玩家 · 空格放炸弹</span></nav><section aria-label="女娲四方向素材">${['正面','背面','左侧','右侧'].map((name,i)=>`<figure><div style="background-position:${i%2*100}% ${Math.floor(i/2)*100}%"></div><figcaption><button data-facing="${['down','up','left','right'][i]}">${name}</button></figcaption></figure>`).join('')}</section></main>`;
const canvas = root.querySelector('canvas')!;
const engine = new GameEngine(canvas);
const play = root.querySelector<HTMLButtonElement>('#play')!;
function reset(): void { engine.start('easy', 'bay', roster.slice(0,3)); engine.pause(); play.textContent='开始试演'; }
reset();
root.querySelectorAll<HTMLButtonElement>('[data-facing]').forEach(button => {
  button.onclick = () => { engine.pause(); play.textContent='继续试演'; engine.faceActor('0', button.dataset.facing as Direction); };
});
const observer = new ResizeObserver(() => engine.resize(canvas.clientWidth, canvas.clientHeight));
observer.observe(canvas);
play.onclick=()=>{ if(engine.isRunning()){engine.pause();play.textContent='继续试演';}else{engine.resume();play.textContent='暂停';} };
root.querySelector<HTMLButtonElement>('#reset')!.onclick=reset;
window.addEventListener('keydown',event=>{
  const directions = {ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'} as const;
  if(event.key in directions){event.preventDefault();engine.movePlayer(directions[event.key as keyof typeof directions]);}
  if(event.code==='Space'){event.preventDefault();engine.placePlayerBomb();}
});
let previous=performance.now();
let frame=0;
function tick(now:number):void { engine.update(Math.min((now-previous)/1000,.05)); engine.render(); previous=now; frame=requestAnimationFrame(tick); }
frame=requestAnimationFrame(tick);
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);observer.disconnect();engine.destroy();});
window.addEventListener('blur',()=>{engine.pause();play.textContent='继续试演';});
