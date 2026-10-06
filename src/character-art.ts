import * as THREE from 'three';
import type { Direction } from './game';
import { loadNuwaModel, disposeNuwaModel } from './nuwa-model';

const released = new WeakSet<THREE.Object3D>();
export function releaseCharacter(group: THREE.Object3D): void { released.add(group); }

/** Real geometry rotates with movement. A failed GLB falls back to the old art. */
export function attachNuwa(group: THREE.Group): void {
  void loadNuwaModel().then(model=>{
    if(released.has(group)){disposeNuwaModel(model);return;}
    for(const child of group.children) {
      if(!['ring','player-aura','protection','name-label'].includes(child.name))child.visible=false;
    }
    group.add(model);
    faceCharacter(group,(group.userData.characterFacing as Direction | undefined) ?? 'down');
  }).catch(error=>{
    if(released.has(group))return;
    console.warn('女娲 GLB 加载失败，使用原有角色素材。',error);
    attachNuwaSprite(group);
  });
}

export const NUWA_FRAMES: Record<Direction, readonly [number, number]> = {
  down: [0, 0.5], up: [0.5, 0.5], left: [0, 0], right: [0.5, 0],
};

/** Each actor owns its texture; the engine disposes it with the sprite. */
function attachNuwaSprite(group: THREE.Group): void {
  const material = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.08, depthWrite: true, toneMapped: false });
  const sprite = new THREE.Sprite(material);
  sprite.name = 'character-art';
  sprite.center.set(0.56, 0.42);
  // Lift the billboard out of the front wall's depth plane while keeping
  // its projected center on the same tile (camera elevation: 18 / 9).
  sprite.position.set(0, 0.8, 0.4);
  sprite.scale.set(1.1, 1.1, 1);
  sprite.visible = false;
  group.add(sprite);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.23, 24), new THREE.MeshBasicMaterial({ color: 0x385366, transparent: true, opacity: 0.16, depthWrite: false }));
  shadow.name = 'character-shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  shadow.position.z = 0.32;
  group.add(shadow);
  const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}characters/nuwa/directions.png`, () => {
    if(released.has(group)){texture.dispose();return;}
    // Keep the old model until the asset has loaded successfully.
    for (const child of group.children) {
      if (!['character-art', 'character-shadow', 'ring', 'protection', 'name-label'].includes(child.name)) child.visible = false;
    }
    sprite.visible = true;
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(0.5, 0.5);
  texture.offset.set(...NUWA_FRAMES.down);
  material.map = texture;
}

export function faceCharacter(group: THREE.Group, direction: Direction): void {
  if(group.userData)group.userData.characterFacing=direction;
  const model=group.getObjectByName('character-model');
  if(model?.rotation) model.rotation.y={down:0,up:Math.PI,left:-Math.PI/2,right:Math.PI/2}[direction];
  const sprite = group.getObjectByName('character-art') as THREE.Sprite | undefined;
  sprite?.material.map?.offset.set(...NUWA_FRAMES[direction]);
  if (sprite) {
    sprite.center.x = { down: 0.56, up: 0.5, left: 0.52, right: 0.48 }[direction];
    sprite.center.y = direction === 'left' || direction === 'right' ? 0.439 : 0.42;
  }
}
