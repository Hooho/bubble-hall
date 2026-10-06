import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GameEngine, type Direction } from './game';
import { faceCharacter } from './character-art';
import { loadNuwaModel, disposeNuwaModel, NUWA_MODEL_URL } from './nuwa-model';
import { roster } from './roster';
import './nuwa-preview.css';

const root = document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML = `<main class="nuwa-studio"><header class="studio-header"><a href="${import.meta.env.BASE_URL}">← 返回游戏</a><span>CHARACTER LAB / 001</span></header>
  <section class="model-showcase"><div class="model-story"><p class="studio-kicker">NUWA · 女娲</p><h1>从画中，<br>走进街区。</h1><p>玉饰、墨发、月蓝汉服。根据原有四视图重新构建的立体 Q 版角色。</p><div class="model-badges"><span>真实 3D 网格</span><span>GLB · 758 KB</span></div><p class="model-note">程序建模第一版 · 无骨骼、无动作帧<br>不是图片贴在平面上，可旋转检查侧面和背面。</p><a class="model-download" href="${NUWA_MODEL_URL}" download="nuwa.glb">↓ 下载女娲 GLB</a></div>
  <div class="model-stage"><canvas id="model-canvas" aria-label="女娲3D模型展台，可拖动旋转"></canvas><span class="stage-instruction">拖动旋转 · 滚轮 / 双指缩放</span><p id="model-status" role="status">正在加载 GLB…</p><button id="rotate" aria-pressed="false">自动旋转</button></div></section>
  <nav class="facing-controls" aria-label="模型朝向">${(['down','up','left','right'] as const).map((d,i)=>`<button data-facing="${d}" aria-pressed="${i===0}">${['正面','背面','左侧','右侧'][i]}</button>`).join('')}</nav>
  <section class="battle-preview"><div class="battle-heading"><div><p class="studio-kicker">IN THE GAME</p><h2>真实棋盘试演</h2><p>女娲在右下角，移动时会转动 3D 身体。独立试演，不读取或覆盖比赛存档。</p></div><div class="battle-actions"><button id="play">开始试演</button><button id="reset">重置</button></div></div><canvas id="battle-canvas" aria-label="女娲战场试演"></canvas><nav class="preview-touch" aria-label="试玩操作"><button data-move="up" aria-label="向上">↑</button><button data-move="left" aria-label="向左">←</button><button data-move="down" aria-label="向下">↓</button><button data-move="right" aria-label="向右">→</button><button id="bomb">放炸弹</button><span>方向键移动玩家 · 空格放炸弹</span></nav></section>
  <details class="source-art"><summary>查看原始四方向参考图</summary><div>${['正面','背面','左侧','右侧'].map((name,i)=>`<figure><div style="background-image:url('${import.meta.env.BASE_URL}characters/nuwa/directions.png');background-position:${i%2*100}% ${Math.floor(i/2)*100}%"></div><figcaption>${name}</figcaption></figure>`).join('')}</div></details></main>`;

const canvas = root.querySelector<HTMLCanvasElement>('#battle-canvas')!;
const engine = new GameEngine(canvas);
const play = root.querySelector<HTMLButtonElement>('#play')!;
function reset(): void { engine.start('easy','bay',roster.slice(0,3)); engine.pause(); play.textContent='开始试演'; }
reset();
const modelCanvas=root.querySelector<HTMLCanvasElement>('#model-canvas')!;
const renderer=new THREE.WebGLRenderer({canvas:modelCanvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(30,1,.01,30);camera.position.set(1.5,1.05,2.7);
const controls=new OrbitControls(camera,modelCanvas);controls.target.set(0,.65,0);controls.minDistance=1.6;controls.maxDistance=5;controls.maxPolarAngle=Math.PI*.55;controls.enablePan=false;controls.enableDamping=true;controls.autoRotateSpeed=1.2;
scene.add(new THREE.HemisphereLight(0xf2f9ff,0xa2a3ac,2.8));
const light=new THREE.DirectionalLight(0xffecd7,3.2);light.position.set(-2,4,4);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-2;light.shadow.camera.right=2;light.shadow.camera.top=2;light.shadow.camera.bottom=-2;light.shadow.bias=-.001;scene.add(light);
const rim=new THREE.DirectionalLight(0xbceaff,2);rim.position.set(2,2,-3);scene.add(rim);
const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.65,.7,.06,64),new THREE.MeshStandardMaterial({color:0xebf7fc,roughness:.55}));pedestal.position.y=-.035;pedestal.receiveShadow=true;scene.add(pedestal);
const trim=new THREE.Mesh(new THREE.TorusGeometry(.64,.008,8,64),new THREE.MeshStandardMaterial({color:0x76c6dc,metalness:.35,roughness:.45}));trim.rotation.x=Math.PI/2;trim.position.y=.001;scene.add(trim);
const holder=new THREE.Group();scene.add(holder);
let disposed=false;
void loadNuwaModel().then(model=>{
  if(disposed){disposeNuwaModel(model);return;}
  holder.add(model);faceCharacter(holder,'down');
  root.querySelector('#model-status')!.textContent='GLB 已加载 · 可旋转查看';
}).catch(()=>{if(!disposed)root.querySelector('#model-status')!.textContent='模型未能加载，请刷新重试。';});
root.querySelector<HTMLButtonElement>('#rotate')!.onclick=event=>{
  controls.autoRotate=!controls.autoRotate;
  const button=event.currentTarget as HTMLButtonElement;button.setAttribute('aria-pressed',String(controls.autoRotate));button.textContent=controls.autoRotate?'停止旋转':'自动旋转';
};
root.querySelectorAll<HTMLButtonElement>('[data-facing]').forEach(button=>button.onclick=()=>{
  const direction=button.dataset.facing as Direction;
  engine.pause();play.textContent='继续试演';engine.faceActor('0',direction);faceCharacter(holder,direction);
  camera.position.set(0,.9,3);controls.target.set(0,.65,0);controls.autoRotate=false;controls.update();
  const rotate=root.querySelector<HTMLButtonElement>('#rotate')!;rotate.setAttribute('aria-pressed','false');rotate.textContent='自动旋转';
  root.querySelectorAll<HTMLButtonElement>('[data-facing]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
});
const observer=new ResizeObserver(()=>{
  engine.resize(canvas.clientWidth,canvas.clientHeight);
  renderer.setSize(modelCanvas.clientWidth,modelCanvas.clientHeight,false);
  camera.aspect=modelCanvas.clientWidth/Math.max(1,modelCanvas.clientHeight);camera.updateProjectionMatrix();
});observer.observe(canvas);observer.observe(modelCanvas);
play.onclick=()=>{if(engine.isRunning()){engine.pause();play.textContent='继续试演';}else{engine.resume();play.textContent='暂停';}};
root.querySelector<HTMLButtonElement>('#reset')!.onclick=reset;
root.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(button=>button.onclick=()=>engine.movePlayer(button.dataset.move as Direction));
root.querySelector<HTMLButtonElement>('#bomb')!.onclick=()=>engine.placePlayerBomb();
window.addEventListener('keydown',event=>{
  const directions={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'} as const;
  if(event.key in directions){event.preventDefault();engine.movePlayer(directions[event.key as keyof typeof directions]);}
  if(event.code==='Space'){event.preventDefault();engine.placePlayerBomb();}
});
let previous=performance.now(),frame=0;
function tick(now:number):void {const delta=Math.max(0,Math.min((now-previous)/1000,.05));engine.update(delta);engine.render();controls.update(delta);renderer.render(scene,camera);previous=now;frame=requestAnimationFrame(tick);}
frame=requestAnimationFrame(tick);
window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();engine.destroy();controls.dispose();disposeNuwaModel(scene);renderer.dispose();});
window.addEventListener('blur',()=>{engine.pause();play.textContent='继续试演';});
