import * as THREE from 'three';
import type { Direction } from './game';

export const NUWA_FRAMES: Record<Direction, readonly [number, number]> = {
  down: [0, 0.5], up: [0.5, 0.5], left: [0, 0], right: [0.5, 0],
};

/** Each actor owns its texture; the engine disposes it with the sprite. */
export function attachNuwa(group: THREE.Group): void {
  const material = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.08, depthWrite: true, toneMapped: false });
  const sprite = new THREE.Sprite(material);
  sprite.name = 'character-art';
  sprite.center.set(0.5, 0.05);
  sprite.position.y = 0.035;
  sprite.scale.set(1.12, 1.12, 1);
  sprite.visible = false;
  group.add(sprite);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.23, 24), new THREE.MeshBasicMaterial({ color: 0x385366, transparent: true, opacity: 0.16, depthWrite: false }));
  shadow.name = 'character-shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  group.add(shadow);
  const texture = new THREE.TextureLoader().load('/characters/nuwa/directions.png', () => {
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
  const sprite = group.getObjectByName('character-art') as THREE.Sprite | undefined;
  sprite?.material.map?.offset.set(...NUWA_FRAMES[direction]);
  if (sprite) sprite.center.y = direction === 'left' || direction === 'right' ? 0.068 : 0.049;
}
