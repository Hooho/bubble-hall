import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const NUWA_MODEL_URL = `${import.meta.env?.BASE_URL ?? '/'}characters/nuwa/nuwa.glb`;
let template: Promise<THREE.Group> | undefined;

/** One download; each instance owns its disposable geometry and materials. */
export async function loadNuwaModel(): Promise<THREE.Group> {
  template ??= new GLTFLoader().loadAsync(NUWA_MODEL_URL).then(gltf=>gltf.scene).catch(error=>{template=undefined;throw error;});
  const model=(await template).clone(true);
  model.name='character-model';
  model.traverse(object=>{
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry=object.geometry.clone();
    object.material=Array.isArray(object.material)?object.material.map(m=>m.clone()):object.material.clone();
    object.castShadow=true; object.receiveShadow=true;
  });
  return model;
}

export function disposeNuwaModel(model: THREE.Object3D): void {
  model.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    object.geometry.dispose();
    for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();
  });
}
