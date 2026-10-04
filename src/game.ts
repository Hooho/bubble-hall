import * as THREE from 'three';
import { attachNuwa, faceCharacter } from './character-art';
import { mapInfo, type MapId } from './maps';
import { roster, type Contestant } from './roster';
import type { Bonus } from './tournament';
import { MATCH_RULES } from './match-rules';
import { rewardCanvas } from './reward-icons';
import { isActive, newSkills, rewardNames, type Reward } from './skills';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const BOARD_WIDTH = 13;
export const BOARD_HEIGHT = 11;

export type Difficulty = 'easy' | 'normal' | 'hard' | 'master';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type TileKind = 'floor' | 'wall' | 'crate';
export type ItemKind = Reward;

export type GridPosition = { x: number; y: number };

type Bomb = {
  id: number;
  ownerId: string;
  position: GridPosition;
  timer: number;
  range: number;
  piercing?: boolean;
};

type BombPrediction = Pick<Bomb, 'position' | 'timer' | 'range' | 'piercing'>;

type ExplosionPattern = {
  center: GridPosition;
  rays: Array<{ direction: GridPosition; length: number }>;
};

type BotState = 'escape' | 'attack' | 'break' | 'collect' | 'patrol' | 'stuck';

type Item = {
  kind: ItemKind;
  position: GridPosition;
};

type Actor = {
  intelligence: number;
  score: number;
  hits: number;
  crates: number;
  respawnDelay: number;
  skills: ReturnType<typeof newSkills>;
  id: string;
  name: string;
  color: number;
  position: GridPosition;
  spawn: GridPosition;
  alive: boolean;
  bombCapacity: number;
  bombsActive: number;
  range: number;
  speed: number;
  moveCooldown: number;
  decisionCooldown: number;
  personality: 'brave' | 'careful' | 'collector';
  state: BotState;
  plannedPath: GridPosition[];
  blockedMoves: number;
  group: THREE.Group;
  body: THREE.Mesh;
  ring: THREE.Mesh;
  label: THREE.Sprite;
};

type Explosion = {
  mesh: THREE.Group;
  ttl: number;
};

type ActorData = Omit<Actor, 'group' | 'body' | 'ring' | 'label'>;
export type GameSnapshot = { mapId: MapId; difficulty: Difficulty; opponents: Contestant[]; tiles: TileKind[][]; actors: ActorData[]; bombs: Bomb[]; items: Item[]; remaining: number; elapsed: number; coinTimer: number; bombId: number; rng: number };

export type GameEvent =
  | { type: 'notice'; text: string }
  | { type: 'bomb-placed' }
  | { type: 'explosion' }
  | { type: 'actor-died'; actorId: string }
  | { type: 'item-picked'; actorId: string; item: ItemKind }
  | { type: 'round-over'; result: 'win' | 'lose' | 'draw' };

type Listener = (event: GameEvent) => void;

const DIRECTIONS: Record<Direction, GridPosition> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const ACTOR_COLORS = {
  player: 0x2f80ed,
  ruby: 0xe15c70,
  cyan: 0x27a6d9,
  violet: 0x6378d8,
};

const SPAWNS: GridPosition[] = [
  { x: 1, y: 1 },
  { x: BOARD_WIDTH - 2, y: BOARD_HEIGHT - 2 },
  { x: BOARD_WIDTH - 2, y: 1 },
  { x: 1, y: BOARD_HEIGHT - 2 },
];

function key(position: GridPosition): string {
  return `${position.x},${position.y}`;
}

function samePosition(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

function distance(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

class SeededRandom {
  private state: number;

  public constructor(seed: number) {
    this.state = seed >>> 0;
  }

  public next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
  public exportState(): number { return this.state; }
  public importState(state: number): void { this.state = state >>> 0; }
}

export class GameEngine {
  public readonly scene = new THREE.Scene();
  public readonly camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  public readonly renderer: THREE.WebGLRenderer;

  private readonly world = new THREE.Group();
  private readonly mapGroup = new THREE.Group();
  private readonly actorGroup = new THREE.Group();
  private readonly bombGroup = new THREE.Group();
  private readonly warningGroup = new THREE.Group();
  private readonly effectGroup = new THREE.Group();
  private readonly itemGroup = new THREE.Group();
  private readonly tileMeshes = new Map<string, THREE.Mesh>();
  private readonly actors = new Map<string, Actor>();
  private readonly bombs: Bomb[] = [];
  private readonly items: Item[] = [];
  private readonly explosions: Explosion[] = [];
  private readonly listeners = new Set<Listener>();
  private readonly rng: SeededRandom;
  private tiles: TileKind[][] = [];
  private bombId = 0;
  private elapsed = 0;
  private remaining: number = MATCH_RULES.duration;
  private coinTimer = 5;
  private mapId: MapId = 'bay';
  private opponents: Contestant[] = roster.slice(0, 3);
  private reducedMotion = false;
  private shakeTime = 0;
  private shakeStrength = 0;
  private running = false;
  private result: 'win' | 'lose' | 'draw' | null = null;
  private difficulty: Difficulty = 'normal';

  public constructor(canvas: HTMLCanvasElement) {
    this.rng = new SeededRandom(2187);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = new THREE.Color(0xf4faff);
    this.scene.add(this.world);
    this.world.add(this.mapGroup, this.itemGroup, this.warningGroup, this.bombGroup, this.actorGroup, this.effectGroup);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x7895b8, 1.6);
    this.scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xfff9ee, 1.7);
    keyLight.position.set(-3, 18, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.intensity = 0.35;
    Object.assign(keyLight.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
    keyLight.shadow.normalBias = 0.04;
    keyLight.shadow.radius = 3;
    this.scene.add(keyLight);

    this.camera.position.set(0, 18, 9);
    this.camera.lookAt(0, 0, 0);
  }

  public on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public start(difficulty: Difficulty, mapId: MapId = 'bay', opponents: Contestant[] = roster.slice(0, 3)): void {
    this.mapId = mapId;
    this.opponents = opponents;
    this.difficulty = difficulty;
    this.resetWorld();
    this.running = true;
  }

  public pause(): void {
    this.running = false;
  }

  public configure(quality: 'low' | 'high', reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    this.renderer.setPixelRatio(quality === 'low' ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = quality === 'high';
  }

  public setPlayerColor(color: number): void {
    const actor=this.actors.get('player');
    if(!actor)return;
    actor.color=color;
    for(const name of ['body','head','ring']) {
      const mesh=actor.group.getObjectByName(name) as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial> | undefined;
      mesh?.material.color.setHex(color);
    }
  }

  public snapshot(): GameSnapshot {
    return structuredClone({ mapId: this.mapId, difficulty: this.difficulty, opponents: this.opponents, tiles: this.tiles, actors: [...this.actors.values()].map(({ group, body, ring, label, ...data }) => data), bombs: this.bombs, items: this.items, remaining: this.remaining, elapsed: this.elapsed, coinTimer: this.coinTimer, bombId: this.bombId, rng: this.rng.exportState() });
  }

  public restore(snapshot: GameSnapshot): void {
    const s = structuredClone(snapshot);
    this.start(s.difficulty, s.mapId, s.opponents);
    this.clearGroup(this.mapGroup); this.clearGroup(this.actorGroup); this.actors.clear(); this.tileMeshes.clear();
    this.tiles = s.tiles; this.createMapMeshes();
    for (const a of s.actors) {
      this.createActor(a.id, a.name, a.color, a.spawn, a.personality);
      const actor = this.actors.get(a.id)!; Object.assign(actor, a); actor.group.visible = a.alive && !a.skills.respawning;
    }
    this.bombs.splice(0, this.bombs.length, ...s.bombs); this.items.splice(0, this.items.length, ...s.items);
    this.bombs.forEach(b => this.addBombVisual(b)); this.items.forEach(i => this.createItemMesh(i));
    this.remaining = Math.max(0, Math.min(s.remaining, MATCH_RULES.duration - s.elapsed)); this.elapsed = s.elapsed; this.coinTimer = s.coinTimer; this.bombId = s.bombId; this.rng.importState(s.rng);
    this.updateMeshes(); this.pause();
  }

  public resume(): void {
    if (!this.result) this.running = true;
  }

  public isRunning(): boolean {
    return this.running;
  }

  public getResult(): 'win' | 'lose' | 'draw' | null {
    return this.result;
  }

  public getRemainingTime(): number {
    return Math.ceil(this.remaining);
  }

  public getPlayerStats(): { bombs: number; maxBombs: number; range: number; alive: boolean } {
    const player = this.actors.get('player');
    return {
      bombs: player?.bombsActive ?? 0,
      maxBombs: player?.bombCapacity ?? 1,
      range: player?.range ?? 2,
      alive: player?.alive ?? false,
    };
  }

  public getEnemyStats(): Array<{ name: string; alive: boolean; color: string }> {
    return [...this.actors.values()]
      .filter((actor) => actor.id !== 'player')
      .map((actor) => ({ name: actor.name, alive: actor.alive, color: `#${actor.color.toString(16).padStart(6, '0')}` }));
  }

  public getStandings() {
    return [...this.actors.values()].map(a => ({ id: a.id, name: a.name, score: a.score, hits: a.hits, crates: a.crates, alive: a.alive })).sort((a, b) => b.score - a.score);
  }

  public grantBonus(id: string, bonus: Bonus): void {
    const actor = this.actors.get(id);
    if (!actor) return;
    if (bonus === 'capacity') actor.bombCapacity++;
    if (bonus === 'speed') actor.speed = 1.1;
    if (bonus === 'shield') actor.skills.shield = true;
  }

  private award(id: string, kind: 'hit' | 'crate'): void {
    const actor = this.actors.get(id);
    if (!actor) return;
    actor.score += kind === 'hit' ? MATCH_RULES.hitPoints : MATCH_RULES.cratePoints;
    if (kind === 'hit') actor.hits++; else actor.crates++;
    if (id === 'player') this.emit({ type: 'notice', text: kind === 'hit' ? '命中对手 +100 分' : '炸开补给箱 +10 分' });
  }

  public getSkillStats() {
    const actor = this.actors.get('player');
    const item = this.items.find((item) => actor && samePosition(item.position, actor.position) && isActive(item.kind));
    return { ...(actor?.skills ?? newSkills()), swap: item && actor?.skills.active && !actor.skills.armed ? rewardNames[item.kind] : null };
  }

  public usePlayerSkill(): void {
    const actor = this.actors.get('player');
    if (actor && this.running) this.useSkill(actor);
  }

  public replacePlayerSkill(): void {
    const actor = this.actors.get('player');
    if (actor && this.running && !actor.skills.armed) this.collectItem(actor, true);
  }

  private useSkill(actor: Actor): void {
    const s = actor.skills;
    if (!actor.alive || s.respawning || !s.active) return;
    if (s.active === 'super') { s.armed = !s.armed; return; }
    if (s.active === 'invincible') s.invincible = 3;
    if (s.active === 'dash') s.dash = 5;
    if (s.active === 'rapid') s.rapid = 4;
    if (actor.id === 'player') this.emit({ type: 'notice', text: `${rewardNames[s.active]}已启动` });
    s.active = null;
  }

  public update(delta: number): void {
    const safeDelta = Math.min(delta, 0.08);
    if (!this.running) {
      this.updateEffects(safeDelta);
      return;
    }

    this.elapsed += safeDelta;
    this.remaining = Math.max(0, this.remaining - safeDelta);
    this.coinTimer -= safeDelta;
    if (this.coinTimer <= 0 && this.remaining > 0) {
      this.spawnCoin();
      this.coinTimer = 5 + this.rng.next() * 4;
    }
    this.updateActors(safeDelta);
    this.updateBombs(safeDelta);
    this.updateEffects(safeDelta);
    this.updateMeshes();

    if (this.remaining <= 0 && !this.result) {
      this.checkRoundEnd();
    }
  }

  public render(): void {
    const shake = this.shakeTime > 0 && !this.reducedMotion && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? this.shakeStrength * (this.shakeTime / 0.2) : 0;
    this.camera.position.set(
      shake > 0 ? Math.sin(this.elapsed * 91) * shake : 0,
      18,
      9 + (shake > 0 ? Math.cos(this.elapsed * 83) * shake : 0),
    );
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  public resize(width: number, height: number): void {
    const aspect = width / Math.max(height, 1);
    const viewHeight = Math.max(11.2, 13.8 / aspect);
    this.camera.left = (-viewHeight * aspect) / 2;
    this.camera.right = (viewHeight * aspect) / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  public movePlayer(direction: Direction): void {
    const player = this.actors.get('player');
    if (!player || !player.alive || !this.running) return;
    this.tryMove(player, direction);
  }

  public faceActor(id: string, direction: Direction): void {
    const actor = this.actors.get(id);
    if (actor) faceCharacter(actor.group, direction);
  }

  public placePlayerBomb(): void {
    const player = this.actors.get('player');
    if (!player || !player.alive || !this.running) return;
    this.placeBomb(player);
  }

  public destroy(): void {
    for (const group of [this.mapGroup,this.actorGroup,this.itemGroup,this.bombGroup,this.warningGroup,this.effectGroup]) this.clearGroup(group);
    this.renderer.dispose();
  }

  private resetWorld(): void {
    this.tiles = this.generateMap(2187);
    this.bombs.length = 0;
    this.items.length = 0;
    this.explosions.length = 0;
    this.actors.clear();
    this.tileMeshes.clear();
    this.bombId = 0;
    this.elapsed = 0;
    this.remaining = MATCH_RULES.duration;
    this.coinTimer = 5;
    this.shakeTime = 0;
    this.shakeStrength = 0;
    this.result = null;
    this.clearGroup(this.mapGroup);
    this.clearGroup(this.actorGroup);
    this.clearGroup(this.bombGroup);
    this.clearGroup(this.warningGroup);
    this.clearGroup(this.effectGroup);
    this.clearGroup(this.itemGroup);

    this.createMapMeshes();
    this.createActor('player', '你', ACTOR_COLORS.player, SPAWNS[0], 'careful');
    this.opponents.forEach((p, i) => {
      this.createActor(p.id, p.name, p.color, SPAWNS[i + 1], p.personality);
      this.actors.get(p.id)!.intelligence = p.intelligence;
    });
    this.updateMeshes();
  }

  private clearGroup(group: THREE.Group): void {
    for (const child of [...group.children]) {
      this.disposeObject(child);
      group.remove(child);
    }
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      const disposable = child as THREE.Mesh & { material?: THREE.Material | THREE.Material[] };
      if (!(child instanceof THREE.Sprite)) disposable.geometry?.dispose();
      if (child instanceof THREE.Sprite) child.material.map?.dispose();
      if (Array.isArray(disposable.material)) disposable.material.forEach((material) => material.dispose());
      else disposable.material?.dispose();
    });
  }

  private generateMap(seed: number): TileKind[][] {
    const random = new SeededRandom(seed);
    const map: TileKind[][] = Array.from({ length: BOARD_HEIGHT }, () => Array<TileKind>(BOARD_WIDTH).fill('floor'));

    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      for (let x = 0; x < BOARD_WIDTH; x += 1) {
        const isBorder = x === 0 || y === 0 || x === BOARD_WIDTH - 1 || y === BOARD_HEIGHT - 1;
        const isPillar = x % 2 === 0 && y % 2 === 0;
        const pillar = this.mapId === 'arena' ? isPillar && x !== 6 && y !== 4 && y !== 6 : this.mapId === 'garden' ? isPillar && x > 2 && x < 10 && y > 2 && y < 8 : isPillar;
        if (isBorder || pillar) map[y][x] = 'wall';
      }
    }

    const spawnSafe = (x: number, y: number): boolean => SPAWNS.some((spawn) => Math.abs(spawn.x - x) <= 1 && Math.abs(spawn.y - y) <= 1);
    for (let y = 1; y < BOARD_HEIGHT - 1; y += 1) {
      for (let x = 1; x < BOARD_WIDTH - 1; x += 1) {
        if (map[y][x] !== 'floor' || spawnSafe(x, y)) continue;
        if (this.mapId === 'factory' && (x === 6 || y === 5)) continue;
        // Mirror obstacles for equal spawn opportunities.
        if (x > 6 || y > 5) { map[y][x] = map[Math.min(y, 10 - y)][Math.min(x, 12 - x)]; continue; }
        if (random.next() < mapInfo(this.mapId).density) map[y][x] = 'crate';
      }
    }

    // Keep the center and each spawn's first corridor open so the round starts fairly.
    const openCells = [
      { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 7, y: 4 },
      { x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 },
      { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 },
      { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 10, y: 1 }, { x: 11, y: 2 },
      { x: 2, y: 9 }, { x: 1, y: 8 }, { x: 10, y: 9 }, { x: 11, y: 8 },
    ];
    for (const cell of openCells) map[cell.y][cell.x] = 'floor';
    return map;
  }

  private createMapMeshes(): void {
    const material = (color: number, roughness = 0.45) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
    const theme = mapInfo(this.mapId);
    const floors = [material(theme.floor, 0.85), material(0xf3f7f5, 0.85)];
    const wallMaterial = material(0x639cb8);
    const wallCapMaterial = material(theme.wall, 0.28);
    const porcelain = material(0xf3fcff, 0.3);
    const crateMaterial = material(0xce924d, 0.7);
    const crateCapMaterial = material(theme.crate, 0.65);
    const strapMaterial = material(0xfff0cc, 0.7);
    const claspMaterial = material(0x9e6c35, 0.4);
    const rounded = (w: number, h: number, d: number, m: THREE.Material, radius = 0.06) =>
      new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), m);
    const tray = rounded(13.3, 0.22, 11.3, material(0xb9d4df), 0.1);
    tray.position.y = -0.29;
    tray.receiveShadow = true;
    this.mapGroup.add(tray);

    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      for (let x = 0; x < BOARD_WIDTH; x += 1) {
        const position = { x, y };
        const floor = rounded(0.98, 0.07, 0.98, floors[(x + y) % 2], 0.025);
        floor.receiveShadow = true;
        floor.position.set(this.worldX(x), -0.14, this.worldZ(y));
        this.mapGroup.add(floor);

        const kind = this.tiles[y][x];
        if (kind === 'floor') continue;
        const isWall = kind === 'wall';
        const mesh = rounded(isWall ? 0.9 : 0.76, isWall ? 0.48 : 0.46, isWall ? 0.9 : 0.76, isWall ? wallMaterial : crateMaterial, 0.085);
        mesh.position.set(this.worldX(x), isWall ? 0.15 : 0.14, this.worldZ(y));
        if (isWall) {
          const rim = rounded(0.92, 0.12, 0.92, porcelain, 0.055);
          rim.position.y = 0.2;
          const cap = rounded(0.81, 0.15, 0.81, wallCapMaterial, 0.07);
          cap.position.y = 0.285;
          const inset = rounded(0.57, 0.014, 0.57, material(0xb9e6ef, 0.32), 0.006);
          inset.position.y = 0.365;
          mesh.add(rim, cap, inset);
        } else {
          const cap = rounded(0.81, 0.12, 0.81, crateCapMaterial, 0.045);
          cap.position.y = 0.23;
          const strap = rounded(0.14, 0.035, 0.78, strapMaterial, 0.012);
          strap.position.y = 0.305;
          const band = rounded(0.14, 0.42, 0.025, strapMaterial, 0.01);
          band.position.set(0, 0.02, 0.387);
          const clasp = rounded(0.22, 0.14, 0.045, claspMaterial, 0.018);
          clasp.position.set(0, 0.08, 0.408);
          mesh.add(cap, strap, band, clasp);
        }
        this.mapGroup.add(mesh);
        mesh.traverse((child) => { if (child instanceof THREE.Mesh) { child.castShadow = true; child.receiveShadow = true; } });
        this.tileMeshes.set(key(position), mesh);
      }
    }
  }

  private createActor(id: string, name: string, color: number, spawn: GridPosition, personality: Actor['personality']): void {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.29, 0.22, 6, 16),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.08 }),
    );
    body.position.y = 0.43;
    body.name = 'body';
    const protection = new THREE.Mesh(new THREE.SphereGeometry(0.61, 16, 12), new THREE.MeshBasicMaterial({ color: 0x70e7ff, transparent: true, opacity: 0.24, depthWrite: false, wireframe: true }));
    protection.name = 'protection';
    protection.position.y = 0.55;
    protection.visible = false;
    group.add(protection);
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.32 }));
    head.position.y = 0.83;
    head.name = 'head';
    head.castShadow = true;
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf9fdff, roughness: 0.35 }));
    visor.scale.set(1, 0.65, 0.45);
    visor.position.set(0, 0.86, 0.29);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshBasicMaterial({ color: 0x17375b }));
      eye.scale.y = 1.5; eye.position.set(side * 0.095, 0.88, 0.395);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      hand.position.set(side * 0.34, 0.39, 0.08);
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: 0x163c6c }));
      shoe.scale.set(1, 0.65, 1.3); shoe.position.set(side * 0.17, 0.11, 0.1);
      group.add(eye, hand, shoe);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(id === 'player' ? 0.34 : 0.3, id === 'player' ? 0.44 : 0.37, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: id === 'player' ? 0.78 : 0.42, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.name = 'ring';
    ring.position.y = 0.03;
    const label = this.createActorLabel(id === 'player' ? 'YOU' : name, color, id === 'player');
    label.name = 'name-label';
    label.position.set(0, 1.38, 0);
    group.add(body, head, visor, ring, label);
    if (id === '0') { attachNuwa(group); label.position.y = 1.2; }
    this.actorGroup.add(group);
    this.actors.set(id, {
      score: 0, hits: 0, crates: 0, respawnDelay: 0,
      intelligence: 3,
      skills: newSkills(),
      id,
      name,
      color,
      position: { ...spawn },
      spawn: { ...spawn },
      alive: true,
      bombCapacity: 1,
      bombsActive: 0,
      range: 2,
      speed: 1,
      moveCooldown: 0,
      decisionCooldown: 0.2,
      personality,
      state: 'patrol',
      plannedPath: [],
      blockedMoves: 0,
      group,
      body,
      ring,
      label,
    });
  }

  private createActorLabel(text: string, color: number, isPlayer: boolean): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to create actor label');
    context.fillStyle = isPlayer ? '#2f80ed' : '#ffffff';
    context.strokeStyle = isPlayer ? '#ffffff' : `#${color.toString(16).padStart(6, '0')}`;
    context.lineWidth = 4;
    context.beginPath();
    context.roundRect(4, 4, 248, 56, 18);
    context.fill();
    context.stroke();
    context.fillStyle = isPlayer ? '#ffffff' : '#173d73';
    context.font = '700 26px Chakra Petch, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 32);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(isPlayer ? 1.08 : 0.86, isPlayer ? 0.27 : 0.22, 1);
    sprite.renderOrder = 10;
    return sprite;
  }

  private updateActors(delta: number): void {
    const player = this.actors.get('player');
    if (player) player.moveCooldown = Math.max(0, player.moveCooldown - delta);
    const danger = this.getDangerKeys();
    for (const actor of this.actors.values()) {
      const s = actor.skills;
      for (const name of ['invincible', 'dash', 'rapid', 'bombCooldown'] as const) s[name] = Math.max(0, s[name] - delta);
      if (s.respawning) {
        actor.respawnDelay = Math.max(0, actor.respawnDelay - delta);
        if (actor.respawnDelay > 0) continue;
        const safe = this.findNearest(actor.spawn, (p) => this.isWalkable(p, actor) && !this.isOccupiedByOtherActor(p, actor.id) && this.isStableSafe(p, 0));
        if (safe) { actor.position = safe; s.respawning = false; s.invincible = 2; actor.group.visible = true; actor.plannedPath = []; actor.state = 'patrol'; }
        continue;
      }
      if (actor.id === 'player' || !actor.alive) continue;
      actor.moveCooldown = Math.max(0, actor.moveCooldown - delta);
      actor.decisionCooldown -= delta;
      if (actor.decisionCooldown <= 0 && s.active) {
        const threatened = danger.has(key(actor.position));
        if ((s.active === 'invincible' || s.active === 'dash') ? threatened : actor.personality !== 'careful' && this.canEscapeAfterBomb(actor)) this.useSkill(actor);
      }

      if (danger.has(key(actor.position)) && actor.state !== 'escape') this.beginEscape(actor);
      if (actor.state === 'escape') {
        this.executeEscape(actor, danger);
        continue;
      }

      if (actor.decisionCooldown <= 0) {
        actor.decisionCooldown = (this.difficulty === 'easy' ? 0.5 : this.difficulty === 'master' ? 0.09 : this.difficulty === 'hard' ? 0.15 : 0.28) * (1.3 - actor.intelligence * 0.1);
        this.decideBot(actor);
      }
    }
  }

  private decideBot(bot: Actor): void {
    const danger = this.getDangerKeys();

    const player = [...this.actors.values()]
      .filter(actor => actor.id !== bot.id && actor.alive)
      .sort((a,b) => distance(bot.position,a.position) - distance(bot.position,b.position))[0];
    const nearestCrate = this.findNearest(bot.position, (position) => Object.values(DIRECTIONS).some((direction) => {
      const adjacent = { x: position.x + direction.x, y: position.y + direction.y };
      return this.inBounds(adjacent) && this.tiles[adjacent.y][adjacent.x] === 'crate';
    }));
    const nearestItem = bot.personality === 'collector' || bot.bombCapacity === 1
      ? this.findNearest(bot.position, (position) => this.items.some((item) => samePosition(item.position, position)))
      : null;
    const nearPlayer = player?.alive && distance(bot.position, player.position) <= 5;
    const canBomb = bot.bombsActive < bot.bombCapacity && this.canEscapeAfterBomb(bot);
    const wantsAttack = bot.personality === 'brave' || !!nearPlayer || !nearestCrate;

    if (canBomb && ((nearPlayer && wantsAttack) || (nearestCrate && distance(bot.position, nearestCrate) <= 2))) {
      if (this.placeBomb(bot)) {
        this.beginEscape(bot);
        this.executeEscape(bot, this.getDangerKeys());
      }
      return;
    }

    let target: GridPosition | null = null;
    if (nearestItem) {
      bot.state = 'collect';
      target = nearestItem;
    } else if (wantsAttack && player?.alive) {
      bot.state = 'attack';
      target = player.position;
    } else if (nearestCrate) {
      bot.state = 'break';
      target = nearestCrate;
    } else {
      bot.state = 'patrol';
      target = this.findNearest(bot.position, () => true);
    }

    if (target) {
      const next = this.nextStepToward(bot.position, target, danger, bot);
      if (next && !this.tryMove(bot, this.directionBetween(bot.position, next))) {
        bot.state = 'stuck';
        bot.blockedMoves += 1;
      } else if (next) {
        bot.blockedMoves = 0;
      }
    }
  }

  private beginEscape(bot: Actor): void {
    bot.state = 'escape';
    bot.blockedMoves = 0;
    bot.plannedPath = this.findTimedEscapePath(bot) ?? [];
  }

  private executeEscape(bot: Actor, danger: Set<string>): void {
    const stepDuration = 0.14 / bot.speed;
    const next = bot.plannedPath[0];
    const nextArrival = bot.moveCooldown + stepDuration;

    if (!next || this.isDangerousAt(next, nextArrival)) {
      bot.plannedPath = this.findTimedEscapePath(bot) ?? [];
    }

    const escapeStep = bot.plannedPath[0];
    if (escapeStep && bot.moveCooldown <= 0) {
      const moved = this.tryMove(bot, this.directionBetween(bot.position, escapeStep));
      if (moved) {
        bot.plannedPath.shift();
        bot.blockedMoves = 0;
      } else {
        bot.blockedMoves += 1;
        bot.state = 'stuck';
        bot.plannedPath = this.findTimedEscapePath(bot) ?? [];
        const fallback = this.findEmergencyStep(bot);
        if (fallback) this.tryMove(bot, this.directionBetween(bot.position, fallback));
      }
    }

    if (!danger.has(key(bot.position)) && bot.plannedPath.length === 0) {
      bot.state = 'patrol';
      bot.blockedMoves = 0;
      bot.decisionCooldown = 0;
    }
  }

  private updateBombs(delta: number): void {
    for (const bomb of this.bombs) bomb.timer -= delta;
    const ready = this.bombs.filter((bomb) => bomb.timer <= 0);
    for (const bomb of ready) this.explodeBomb(bomb);
  }

  private explodeBomb(firstBomb: Bomb): void {
    if (!this.bombs.some((bomb) => bomb.id === firstBomb.id)) return;
    const existingItems = new Set(this.items);
    const queue = [firstBomb];
    const exploded = new Set<number>();
    const blastCells: GridPosition[] = [];
    const cellOwners = new Map<string, string[]>();
    const explosionPatterns: ExplosionPattern[] = [];
    while (queue.length > 0) {
      const bomb = queue.shift();
      if (!bomb || exploded.has(bomb.id)) continue;
      exploded.add(bomb.id);
      const index = this.bombs.findIndex((candidate) => candidate.id === bomb.id);
      if (index >= 0) this.bombs.splice(index, 1);
      this.removeBombVisuals(bomb.id);
      const owner = this.actors.get(bomb.ownerId);
      if (owner) owner.bombsActive = Math.max(0, owner.bombsActive - 1);

      const cells = [bomb.position];
      const rays: ExplosionPattern['rays'] = [];
      for (const direction of Object.values(DIRECTIONS)) {
        let rayLength = 0;
        let pierced = false;
        for (let distanceFromBomb = 1; distanceFromBomb <= bomb.range; distanceFromBomb += 1) {
          const cell = { x: bomb.position.x + direction.x * distanceFromBomb, y: bomb.position.y + direction.y * distanceFromBomb };
          if (!this.inBounds(cell)) break;
          const tile = this.tiles[cell.y][cell.x];
          if (tile === 'wall') break;
          cells.push(cell);
          rayLength = distanceFromBomb;
          if (tile === 'crate') {
            this.destroyCrate(cell);
            this.award(bomb.ownerId, 'crate');
            if (bomb.piercing && !pierced) { pierced = true; continue; }
            break;
          }
        }
        if (rayLength > 0) rays.push({ direction, length: rayLength });
      }
      explosionPatterns.push({ center: { ...bomb.position }, rays });
      for (const cell of cells) {
        const owners = cellOwners.get(key(cell)) ?? [];
        if (!owners.includes(bomb.ownerId)) owners.push(bomb.ownerId);
        cellOwners.set(key(cell), owners);
        if (!blastCells.some((existing) => samePosition(existing, cell))) blastCells.push(cell);
        const chained = this.bombs.find((candidate) => samePosition(candidate.position, cell));
        if (chained) {
          chained.timer = 0;
          queue.push(chained);
        }
      }
    }

    this.createExplosionEffect(explosionPatterns);
    this.emit({ type: 'explosion' });
    for (const actor of this.actors.values()) {
      if (actor.alive && blastCells.some((cell) => samePosition(cell, actor.position))) {
        const s = actor.skills;
        if (s.invincible > 0 || s.respawning) continue;
        const attacker = cellOwners.get(key(actor.position))?.find(id => id !== actor.id);
        if (attacker) this.award(attacker, 'hit');
        if (s.shield) { s.shield = false; s.invincible = 0.8; this.emit({ type: 'notice', text: `${actor.name}的护盾被击破` }); continue; }
        if (s.life) {
          s.life = false;
          s.respawning = true;
          actor.respawnDelay = 0;
          actor.group.visible = false;
          if (actor.id === 'player') this.emit({ type: 'notice', text: '额外生命：等待安全复活' });
          continue;
        }
        actor.alive = false;
        actor.group.visible = false;
        this.emit({ type: 'actor-died', actorId: actor.id });
        if (actor.id === 'player') this.emit({ type: 'notice', text: '你已淘汰，可观看剩余选手比赛' });
      }
    }
    this.removeCollectedItems(blastCells, existingItems);
    this.checkRoundEnd();
  }

  private destroyCrate(position: GridPosition): void {
    this.tiles[position.y][position.x] = 'floor';
    const mesh = this.tileMeshes.get(key(position));
    if (mesh) {
      this.mapGroup.remove(mesh);
      this.disposeObject(mesh);
      this.tileMeshes.delete(key(position));
    }
    if (this.rng.next() < 0.42) {
      const kinds: ItemKind[] = ['bomb', 'bomb', 'flame', 'flame', 'speed', 'speed', 'shield', 'life', 'invincible', 'super', 'dash', 'rapid'];
      this.items.push({ kind: kinds[Math.floor(this.rng.next() * kinds.length)], position: { ...position } });
      this.createItemMesh(this.items[this.items.length - 1]);
    }
  }

  private removeCollectedItems(blastCells: GridPosition[], existingItems: Set<Item>): void {
    for (let index = this.items.length - 1; index >= 0; index -= 1) {
      if (!existingItems.has(this.items[index])) continue;
      if (!blastCells.some((cell) => samePosition(cell, this.items[index].position))) continue;
      const item = this.items.splice(index, 1)[0];
      const mesh = this.itemGroup.children.find((child) => child.userData.itemKey === key(item.position));
      if (mesh) { this.itemGroup.remove(mesh); this.disposeObject(mesh); }
    }
  }

  private createItemMesh(item: Item): void {
    const texture = new THREE.CanvasTexture(rewardCanvas(item.kind));
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    mesh.scale.set(0.86, 0.86, 1);
    mesh.position.set(this.worldX(item.position.x), 0.5, this.worldZ(item.position.y));
    mesh.userData.itemKey = key(item.position);
    this.itemGroup.add(mesh);
  }

  private spawnCoin(): void {
    if (this.items.filter(item => item.kind === 'coin').length >= 6) return;
    const danger = this.getDangerKeys();
    const candidates: GridPosition[] = [];
    for (let y = 1; y < BOARD_HEIGHT - 1; y++) {
      for (let x = 1; x < BOARD_WIDTH - 1; x++) {
        const position = { x, y };
        if (this.tiles[y][x] !== 'floor' || danger.has(key(position))) continue;
        if (this.items.some(item => samePosition(item.position, position))) continue;
        if (this.bombs.some(bomb => samePosition(bomb.position, position))) continue;
        if ([...this.actors.values()].some(actor => actor.alive && samePosition(actor.position, position))) continue;
        candidates.push(position);
      }
    }
    if (!candidates.length) return;
    const item: Item = { kind: 'coin', position: candidates[Math.floor(this.rng.next() * candidates.length)] };
    this.items.push(item);
    this.createItemMesh(item);
  }

  private createBombWarning(bomb: Bomb): void {
    const group = new THREE.Group();
    group.userData.bombId = bomb.id;
    const material = new THREE.MeshBasicMaterial({ color: 0xe15c70, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false });
    for (const cell of this.getBlastCells(bomb.position, bomb.range, bomb.piercing)) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(this.worldX(cell.x), -0.075, this.worldZ(cell.y));
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.72, 0.72)),
        new THREE.LineBasicMaterial({ color: 0xe15c70, transparent: true, opacity: 0.82 }),
      );
      outline.rotation.x = -Math.PI / 2;
      outline.position.copy(mesh.position);
      group.add(mesh, outline);
    }
    this.warningGroup.add(group);
  }

  private getBlastCells(position: GridPosition, range: number, piercing = false): GridPosition[] {
    const cells = [{ ...position }];
    for (const direction of Object.values(DIRECTIONS)) {
      let pierced = false;
      for (let distanceFromBomb = 1; distanceFromBomb <= range; distanceFromBomb += 1) {
        const cell = { x: position.x + direction.x * distanceFromBomb, y: position.y + direction.y * distanceFromBomb };
        if (!this.inBounds(cell)) break;
        const tile = this.tiles[cell.y][cell.x];
        if (tile === 'wall') break;
        cells.push(cell);
        if (tile === 'crate') { if (piercing && !pierced) pierced = true; else break; }
      }
    }
    return cells;
  }

  private removeBombVisuals(bombId: number): void {
    const bombMesh = this.bombGroup.children.find((child) => child.userData.bombId === bombId);
    if (bombMesh) {
      this.bombGroup.remove(bombMesh);
      this.disposeObject(bombMesh);
    }
    const warningMesh = this.warningGroup.children.find((child) => child.userData.bombId === bombId);
    if (warningMesh) {
      this.warningGroup.remove(warningMesh);
      this.disposeObject(warningMesh);
    }
  }

  private createExplosionEffect(patterns: ExplosionPattern[]): void {
    const group = new THREE.Group();
    const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x229fff, transparent: true, opacity: 0.48, side: THREE.DoubleSide, depthWrite: false });
    const outerFlameMaterial = new THREE.MeshBasicMaterial({ color: 0x16a9f4, transparent: true, opacity: 0.8, depthWrite: false });
    const innerFlameMaterial = new THREE.MeshBasicMaterial({ color: 0xa1efff, transparent: true, opacity: 0.92, depthWrite: false });
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false });
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xf5ffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0x83ddff, transparent: true, opacity: 0.96, depthWrite: false });
    const paintedCells = new Set<string>();

    const paintGroundCell = (cell: GridPosition): void => {
      if (paintedCells.has(key(cell))) return;
      paintedCells.add(key(cell));
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.84), groundMaterial);
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(this.worldX(cell.x), 0.035, this.worldZ(cell.y));
      group.add(tile);
    };

    for (const pattern of patterns) {
      paintGroundCell(pattern.center);
      const centerX = this.worldX(pattern.center.x);
      const centerZ = this.worldZ(pattern.center.y);

      const centerOuter = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 8), outerFlameMaterial);
      centerOuter.position.set(centerX, 0.22, centerZ);
      centerOuter.userData.effectPart = 'centerOuter';
      const centerInner = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 8), innerFlameMaterial);
      centerInner.position.set(centerX, 0.34, centerZ);
      centerInner.userData.effectPart = 'centerInner';
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), coreMaterial);
      core.position.set(centerX, 0.48, centerZ);
      core.userData.effectPart = 'core';
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.25, 24), ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(centerX, 0.07, centerZ);
      ring.userData.effectPart = 'ring';
      group.add(centerOuter, centerInner, core, ring);

      for (const offset of [{ x: -0.28, z: -0.18 }, { x: 0.25, z: -0.12 }, { x: -0.2, z: 0.24 }, { x: 0.3, z: 0.2 }]) {
        const spark = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), sparkMaterial);
        spark.position.set(centerX + offset.x, 0.3, centerZ + offset.z);
        spark.userData.effectPart = 'spark';
        spark.userData.velocity = new THREE.Vector3(offset.x * 7, 2, offset.z * 7);
        group.add(spark);
      }

      for (const ray of pattern.rays) {
        for (let step = 1; step <= ray.length; step += 1) {
          paintGroundCell({ x: pattern.center.x + ray.direction.x * step, y: pattern.center.y + ray.direction.y * step });
        }
        const rayLength = ray.length + 0.45;
        const rayCenterX = centerX + ray.direction.x * rayLength * 0.5;
        const rayCenterZ = centerZ + ray.direction.y * rayLength * 0.5;
        const outerRay = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, Math.max(0.1, rayLength - 0.56), 4, 12), outerFlameMaterial);
        const innerRay = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, Math.max(0.1, rayLength - 0.4), 4, 12), innerFlameMaterial);
        outerRay.position.set(rayCenterX, 0.2, rayCenterZ);
        innerRay.position.set(rayCenterX, 0.34, rayCenterZ);
        if (ray.direction.x !== 0) {
          outerRay.rotation.z = ray.direction.x > 0 ? -Math.PI / 2 : Math.PI / 2;
          innerRay.rotation.z = outerRay.rotation.z;
        } else {
          outerRay.rotation.x = ray.direction.y > 0 ? Math.PI / 2 : -Math.PI / 2;
          innerRay.rotation.x = outerRay.rotation.x;
        }
        outerRay.userData.effectPart = 'rayOuter';
        innerRay.userData.effectPart = 'rayInner';
        group.add(outerRay, innerRay);
      }
    }
    this.effectGroup.add(group);
    this.shakeTime = Math.max(this.shakeTime, 0.2);
    this.shakeStrength = 0.12;
    this.explosions.push({ mesh: group, ttl: 0.46 });
  }

  private updateEffects(delta: number): void {
    this.shakeTime = Math.max(0, this.shakeTime - delta);
    for (let index = this.explosions.length - 1; index >= 0; index -= 1) {
      const effect = this.explosions[index];
      effect.ttl -= delta;
      const progress = 1 - clamp(effect.ttl / 0.46, 0, 1);
      const fade = clamp(effect.ttl / 0.46, 0, 1);
      effect.mesh.traverse((child) => {
        const mesh = child as THREE.Mesh & { material?: THREE.Material | THREE.Material[] };
        const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const material of materials) {
          const animatedMaterial = material as THREE.Material & { opacity?: number; userData: { baseOpacity?: number } };
          animatedMaterial.userData.baseOpacity ??= animatedMaterial.opacity ?? 1;
          if (animatedMaterial.opacity !== undefined) animatedMaterial.opacity = animatedMaterial.userData.baseOpacity * fade;
        }
        if (child.userData.effectPart === 'ring') child.scale.setScalar(1 + progress * 3);
        if (child.userData.effectPart === 'rayOuter' || child.userData.effectPart === 'rayInner') child.scale.y = 1 + Math.sin(this.elapsed * 34) * 0.12;
        if (child.userData.effectPart === 'centerOuter' || child.userData.effectPart === 'centerInner' || child.userData.effectPart === 'core') child.scale.setScalar(1 + Math.sin(this.elapsed * 40) * 0.2);
        if (child.userData.effectPart === 'spark') {
          const velocity = child.userData.velocity as THREE.Vector3;
          child.position.addScaledVector(velocity, delta);
          velocity.y -= delta * 8;
          child.scale.setScalar(Math.max(0.1, fade));
        }
      });
      if (effect.ttl <= 0) {
        this.effectGroup.remove(effect.mesh);
        this.disposeObject(effect.mesh);
        this.explosions.splice(index, 1);
      }
    }
    for (const mesh of this.itemGroup.children) mesh.position.y = 0.5 + Math.sin(this.elapsed * 2.5 + mesh.position.x) * 0.045;
    for (const warning of this.warningGroup.children) {
      const pulse = 0.16 + (Math.sin(this.elapsed * 8) + 1) * 0.08;
      const material = (warning.children[0] as THREE.Mesh | undefined)?.material as THREE.MeshBasicMaterial | undefined;
      if (material) material.opacity = pulse;
    }
  }

  private updateMeshes(): void {
    for (const actor of this.actors.values()) {
      actor.group.position.set(this.worldX(actor.position.x), 0, this.worldZ(actor.position.y));
      actor.ring.rotation.z += 0.018;
      actor.body.position.y = 0.43 + Math.sin(this.elapsed * 5 + actor.position.x) * 0.015;
      const protection = actor.group.getObjectByName('protection');
      if (protection) protection.visible = actor.skills.shield || (actor.skills.invincible > 0 && (actor.skills.invincible > 0.8 || Math.sin(this.elapsed * 28) > 0));
    }
    for (const bomb of this.bombs) {
      const mesh = this.bombGroup.children.find((child) => child.userData.bombId === bomb.id);
      if (mesh) {
        mesh.position.set(this.worldX(bomb.position.x), 0, this.worldZ(bomb.position.y));
        mesh.scale.setScalar(1 + Math.sin(this.elapsed * 12) * 0.08);
        const ring = mesh.children[1] as THREE.Mesh | undefined;
        if (ring) ring.rotation.z = -this.elapsed * 4;
      }
    }
  }

  private placeBomb(actor: Actor): boolean {
    if (actor.skills.respawning || actor.skills.bombCooldown > 0) return false;
    if (actor.bombsActive >= actor.bombCapacity || this.bombs.some((bomb) => samePosition(bomb.position, actor.position))) return false;
    const bomb: Bomb = { id: ++this.bombId, ownerId: actor.id, position: { ...actor.position }, timer: 2, range: actor.range + (actor.skills.armed ? 2 : 0), piercing: actor.skills.armed };
    actor.skills.bombCooldown = actor.skills.rapid > 0 ? 0.12 : 0.35;
    if (actor.skills.armed) { actor.skills.active = null; actor.skills.armed = false; }
    this.bombs.push(bomb);
    actor.bombsActive += 1;
    this.addBombVisual(bomb);
    this.emit({ type: 'bomb-placed' });
    return true;
  }

  private addBombVisual(bomb: Bomb): void {
    const mesh = new THREE.Group();
    mesh.userData.bombId = bomb.id;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), new THREE.MeshStandardMaterial({ color: 0x209ff0, roughness: 0.16, metalness: 0.25 }));
    body.position.y = 0.28;
    if (bomb.piercing) { (body.material as THREE.MeshStandardMaterial).color.setHex(0xffbb45); body.scale.setScalar(1.2); }
    const countdownRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 24), new THREE.MeshBasicMaterial({ color: 0xe15c70, transparent: true, opacity: 0.95 }));
    countdownRing.rotation.x = -Math.PI / 2;
    countdownRing.position.y = 0.05;
    body.castShadow = true;
    mesh.add(body, countdownRing);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), new THREE.MeshBasicMaterial({ color: 0xe7ffff }));
    glint.position.set(-0.1, 0.46, 0.17); mesh.add(glint);
    this.bombGroup.add(mesh);
    this.createBombWarning(bomb);
  }

  private tryMove(actor: Actor, direction: Direction): boolean {
    if (!actor.alive || actor.skills.respawning || actor.moveCooldown > 0) return false;
    const delta = DIRECTIONS[direction];
    const next = { x: actor.position.x + delta.x, y: actor.position.y + delta.y };
    if (!this.inBounds(next) || !this.isWalkable(next, actor)) return false;
    const occupant = [...this.actors.values()].find((candidate) => candidate.alive && candidate.id !== actor.id && samePosition(candidate.position, next));
    if (occupant) return false;
    actor.position = next;
    faceCharacter(actor.group, direction);
    actor.moveCooldown = 0.14 / Math.min(1.7, actor.speed * (actor.skills.dash > 0 ? 1.4 : 1));
    this.collectItem(actor);
    return true;
  }

  private collectItem(actor: Actor, replace = false): void {
    if (!actor.alive || actor.skills.respawning) return;
    const index = this.items.findIndex((item) => samePosition(item.position, actor.position));
    if (index < 0) return;
    if (isActive(this.items[index].kind) && actor.skills.active && !replace) return;
    const item = this.items.splice(index, 1)[0];
    const mesh = this.itemGroup.children.find((child) => child.userData.itemKey === key(item.position));
    if (mesh) { this.itemGroup.remove(mesh); this.disposeObject(mesh); }
    if (item.kind === 'coin') actor.score += MATCH_RULES.coinPoints;
    if (item.kind === 'bomb') actor.bombCapacity = Math.min(5, actor.bombCapacity + 1);
    if (item.kind === 'flame') actor.range = Math.min(5, actor.range + 1);
    if (item.kind === 'speed') actor.speed = Math.min(1.3, actor.speed + 0.1);
    if (item.kind === 'shield') actor.skills.shield = true;
    if (item.kind === 'life') actor.skills.life = true;
    if (isActive(item.kind)) actor.skills.active = item.kind;
    this.emit({ type: 'item-picked', actorId: actor.id, item: item.kind });
  }

  private canEscapeAfterBomb(actor: Actor): boolean {
    const predictedBomb: BombPrediction = { position: { ...actor.position }, timer: 2, range: actor.range + (actor.skills.armed ? 2 : 0), piercing: actor.skills.armed };
    return this.findTimedEscapePath(actor, predictedBomb) !== null;
  }

  private findTimedEscapePath(actor: Actor, extraBomb?: BombPrediction): GridPosition[] | null {
    const moveTime = 0.14 / actor.speed;
    const queue: Array<{ position: GridPosition; time: number; path: GridPosition[] }> = [{
      position: { ...actor.position },
      time: actor.moveCooldown,
      path: [],
    }];
    const visited = new Set([key(actor.position)]);
    const maxSteps = BOARD_WIDTH * BOARD_HEIGHT;

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      if (
        current.path.length > 0
        && this.isStableSafe(current.position, current.time, extraBomb)
      ) {
        return current.path;
      }
      if (current.path.length >= maxSteps) continue;

      for (const direction of Object.values(DIRECTIONS)) {
        const next = { x: current.position.x + direction.x, y: current.position.y + direction.y };
        if (!this.inBounds(next) || !this.isWalkable(next, actor) || this.isOccupiedByOtherActor(next, actor.id)) continue;
        if (visited.has(key(next))) continue;

        const arrivalTime = current.time + moveTime;
        if (this.isDangerousAt(next, arrivalTime, extraBomb) || this.isDangerousAt(next, arrivalTime + moveTime, extraBomb)) continue;
        visited.add(key(next));
        queue.push({ position: next, time: arrivalTime, path: [...current.path, next] });
      }
    }
    return null;
  }

  private isDangerousAt(position: GridPosition, timeFromNow: number, extraBomb?: BombPrediction): boolean {
    const bombs: BombPrediction[] = extraBomb ? [...this.bombs, extraBomb] : this.bombs;
    const safetyMargin = 0.2;
    const explosionDuration = 0.38;
    return bombs.some((bomb) => {
      if (!this.getBlastCells(bomb.position, bomb.range, bomb.piercing).some((cell) => samePosition(cell, position))) return false;
      const explodeAt = Math.max(0, bomb.timer);
      return timeFromNow >= explodeAt - safetyMargin && timeFromNow <= explodeAt + explosionDuration;
    });
  }

  private isStableSafe(position: GridPosition, timeFromNow: number, extraBomb?: BombPrediction): boolean {
    const bombs: BombPrediction[] = extraBomb ? [...this.bombs, extraBomb] : this.bombs;
    const explosionDuration = 0.38;
    return bombs.every((bomb) => {
      const inBlast = this.getBlastCells(bomb.position, bomb.range, bomb.piercing).some((cell) => samePosition(cell, position));
      return !inBlast || timeFromNow > Math.max(0, bomb.timer) + explosionDuration;
    });
  }

  private findEmergencyStep(actor: Actor): GridPosition | null {
    const candidates = Object.values(DIRECTIONS)
      .map((direction) => ({ x: actor.position.x + direction.x, y: actor.position.y + direction.y }))
      .filter((position) => this.inBounds(position) && this.isWalkable(position, actor) && !this.isOccupiedByOtherActor(position, actor.id))
      .sort((a, b) => Number(this.isDangerousAt(a, 0.18)) - Number(this.isDangerousAt(b, 0.18)));
    return candidates.find((position) => !this.isDangerousAt(position, 0.18)) ?? candidates[0] ?? null;
  }

  private isOccupiedByOtherActor(position: GridPosition, actorId: string): boolean {
    return [...this.actors.values()].some((candidate) => candidate.alive && candidate.id !== actorId && samePosition(candidate.position, position));
  }

  private getDangerKeys(extraPosition?: GridPosition, extraRange?: number): Set<string> {
    const danger = new Set<string>();
    const addBombDanger = (position: GridPosition, range: number): void => {
      danger.add(key(position));
      for (const direction of Object.values(DIRECTIONS)) {
        for (let step = 1; step <= range; step += 1) {
          const cell = { x: position.x + direction.x * step, y: position.y + direction.y * step };
          if (!this.inBounds(cell) || this.tiles[cell.y][cell.x] === 'wall') break;
          danger.add(key(cell));
          if (this.tiles[cell.y][cell.x] === 'crate') break;
        }
      }
    };
    for (const bomb of this.bombs) for (const cell of this.getBlastCells(bomb.position, bomb.range, bomb.piercing)) danger.add(key(cell));
    if (extraPosition && extraRange) addBombDanger(extraPosition, extraRange);
    return danger;
  }

  private nextStepToward(start: GridPosition, target: GridPosition, danger: Set<string>, actor: Actor): GridPosition | null {
    const queue: GridPosition[] = [{ ...start }];
    const previous = new Map<string, GridPosition | null>([[key(start), null]]);
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      if (samePosition(current, target)) break;
      const candidates = Object.values(DIRECTIONS)
        .map((direction) => ({ x: current.x + direction.x, y: current.y + direction.y }))
        .filter((candidate) => !previous.has(key(candidate)) && this.inBounds(candidate) && this.isWalkable(candidate, actor) && !danger.has(key(candidate)));
      for (const candidate of candidates) {
        previous.set(key(candidate), current);
        queue.push(candidate);
      }
    }
    if (!previous.has(key(target))) return null;
    let current: GridPosition = { ...target };
    while (previous.get(key(current)) && !samePosition(previous.get(key(current)) as GridPosition, start)) current = previous.get(key(current)) as GridPosition;
    return current;
  }

  private findNearest(start: GridPosition, predicate: (position: GridPosition) => boolean): GridPosition | null {
    const queue: GridPosition[] = [{ ...start }];
    const visited = new Set([key(start)]);
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      if (!samePosition(current, start) && predicate(current)) return current;
      for (const direction of Object.values(DIRECTIONS)) {
        const next = { x: current.x + direction.x, y: current.y + direction.y };
        if (visited.has(key(next)) || !this.inBounds(next) || this.tiles[next.y][next.x] !== 'floor') continue;
        visited.add(key(next));
        queue.push(next);
      }
    }
    return null;
  }

  private isWalkable(position: GridPosition, actor: Actor): boolean {
    const tile = this.tiles[position.y][position.x];
    if (tile === 'wall' || tile === 'crate') return false;
    const bomb = this.bombs.find((candidate) => samePosition(candidate.position, position));
    if (bomb && !samePosition(actor.position, position)) return false;
    return true;
  }

  private checkRoundEnd(): void {
    if (this.result) return;
    const survivors = [...this.actors.values()].filter(a => a.alive);
    if (survivors.length === 0) { this.finishRound('draw'); return; }
    if (survivors.length === 1) { this.finishRound(survivors[0].id === 'player' ? 'win' : 'lose'); return; }
    if (this.remaining > 0) return;
    const standings = this.getStandings().filter(a => this.actors.get(a.id)?.alive);
    const winners = standings.filter(a => a.score === standings[0]?.score);
    this.finishRound(winners.some(a => a.id === 'player') ? winners.length > 1 ? 'draw' : 'win' : 'lose');
  }

  private finishRound(result: 'win' | 'lose' | 'draw'): void {
    this.result = result;
    this.running = false;
    this.emit({ type: 'round-over', result });
  }

  private directionBetween(from: GridPosition, to: GridPosition): Direction {
    if (to.x > from.x) return 'right';
    if (to.x < from.x) return 'left';
    if (to.y > from.y) return 'down';
    return 'up';
  }

  private inBounds(position: GridPosition): boolean {
    return position.x >= 0 && position.x < BOARD_WIDTH && position.y >= 0 && position.y < BOARD_HEIGHT;
  }

  private worldX(x: number): number {
    return x - (BOARD_WIDTH - 1) / 2;
  }

  private worldZ(y: number): number {
    return y - (BOARD_HEIGHT - 1) / 2;
  }

  private emit(event: GameEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}
