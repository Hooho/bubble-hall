import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Vector3 } from 'three';
import { build } from 'esbuild';

const bytes=await readFile('public/characters/nuwa/nuwa.glb');
assert.equal(bytes.readUInt32LE(0),0x46546c67,'GLB magic');
assert.equal(bytes.readUInt32LE(4),2,'glTF 2.0');
assert.equal(bytes.readUInt32LE(8),bytes.length,'complete binary file');
const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
assert.ok(!json.images?.length && !json.textures?.length,'self-contained geometry, no image planes');
assert.ok(json.buffers.every(b=>!b.uri),'embedded geometry');
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const bounds=new Box3().setFromObject(gltf.scene),size=bounds.getSize(new Vector3());
assert.ok(Math.abs(size.y-1.2)<.001,'known game height');
assert.ok(Math.abs(bounds.min.y)<.001,'feet at origin');
assert.ok(size.x>.5 && size.x<.9 && size.z>.35 && size.z<.8,'volumetric, within a tile');
let meshes=0,triangles=0;
gltf.scene.traverse(object=>{
  if(!object.isMesh)return;
  meshes++;triangles+=object.geometry.index.count/3;
  for(const value of object.geometry.attributes.position.array)assert.ok(Number.isFinite(value));
  for(const value of object.geometry.attributes.normal.array)assert.ok(Number.isFinite(value));
});
assert.ok(meshes<=16);assert.ok(triangles<50000);assert.ok(bytes.length<1000000);
const bundle=await build({entryPoints:['src/character-art.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {faceCharacter}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
gltf.scene.children[0].name='character-model';
for(const [direction,angle] of Object.entries({down:0,up:Math.PI,left:-Math.PI/2,right:Math.PI/2})){
  faceCharacter(gltf.scene,direction);
  assert.equal(gltf.scene.children[0].rotation.y,angle);
  assert.equal(gltf.scene.userData.characterFacing,direction);
}
console.log(`PASS: Nuwa GLB loads, feet and tile footprint, ${meshes} meshes / ${triangles} triangles, four real 3D rotations`);
