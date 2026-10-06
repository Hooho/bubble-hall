// Original, procedural interpretation of the supplied Nuwa reference sheets.
// Run manually; the checked-in GLB is the runtime asset, not a build prerequisite.
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { writeFile } from 'node:fs/promises';

// GLTFExporter uses the browser FileReader API for binary buffers, not rendering.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result=value; this.onloadend?.(); }); }
};
const model = new T.Group(); model.name='Nuwa';
const mat=(name,color,roughness=.65,metalness=0)=>new T.MeshStandardMaterial({name,color,roughness,metalness});
const hair=mat('Ink plum hair',0x39303f,.48),strand=mat('Hair satin',0x4c3e50,.55);
const skin=mat('Warm porcelain',0xffd5bd,.8),blush=mat('Rose cheeks',0xf1a7a7,.85);
const blue=mat('Moon blue silk',0x8bbfdc,.72),mint=mat('Jade skirt',0x94cdb3,.75);
const fold=mat('Skirt folds',0x72ae97,.78),pink=mat('Rose silk',0xe9a0bf,.7);
const ivory=mat('Ivory embroidery',0xfff2de,.72),jade=mat('Celadon jade',0x70cba7,.28,.12);
const gold=mat('Champagne gold',0xc9a769,.32,.45),ink=mat('Eyes and brows',0x352431,.55);
const iris=mat('Amber eyes',0x88563b,.4),white=mat('Eye highlights',0xfffbf4,.25);
function mesh(name,geometry,material,position=[0,0,0],scale=[1,1,1]) {
  const m=new T.Mesh(geometry,material); m.name=name;m.position.set(...position);m.scale.set(...scale);model.add(m);return m;
}
const sphere=(name,material,p,s)=>mesh(name,new T.SphereGeometry(1,24,16),material,p,s);
function tube(name,points,radius,material,segments=24) {
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
  return mesh(name,new T.TubeGeometry(curve,segments,radius,6,false),material);
}
function ring(name,p,radius,thickness,material,rotation=[0,0,0]) {
  const m=mesh(name,new T.TorusGeometry(radius,thickness,8,24),material,p);m.rotation.set(...rotation);return m;
}
function lathe(name,profile,material,p,depth=1) {
  return mesh(name,new T.LatheGeometry(profile.map(([x,y])=>new T.Vector2(x,y)),40),material,p,[1,1,depth]);
}
// Broad, tapered volumetric locks, rather than flat hair cards.
function lock(name,points,width,depth,material=hair) {
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
  const positions=[],indices=[],steps=20,sides=10;
  for(let i=0;i<=steps;i++) {
    const t=i/steps,c=curve.getPoint(t),tangent=curve.getTangent(t);
    const side=new T.Vector3(tangent.y,-tangent.x,0).normalize();
    const normal=new T.Vector3().crossVectors(tangent,side).normalize();
    const taper=Math.sin(Math.PI*(.1+.9*t))**.55;
    for(let j=0;j<sides;j++) {
      const a=j/sides*Math.PI*2;
      const p=c.clone().addScaledVector(side,Math.cos(a)*width*taper).addScaledVector(normal,Math.sin(a)*depth*taper);
      positions.push(p.x,p.y,p.z);
      if(i<steps){const n=i*sides+j,k=i*sides+(j+1)%sides;indices.push(n,k,n+sides,k,k+sides,n+sides);}
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  return mesh(name,g,material);
}
// Shoes and a flared skirt establish the feet at y=0 and forward at +Z.
for(const s of [-1,1]) {
  sphere('Ivory shoe',ivory,[s*.18,.09,.095],[.17,.085,.25]);
  tube('Shoe piping',[[s*.30,.12,.18],[s*.18,.16,.29],[s*.08,.12,.18]],.014,pink,12);
}
lathe('Pleated skirt',[[0,.10],[.47,.10],[.51,.16],[.44,.36],[.34,.67],[.26,.91],[0,.91]],mint,[0,0,0],.70);
for(let i=0;i<12;i++) {
  const a=i*Math.PI/6;
  tube('Skirt seam',[[Math.sin(a)*.49,.15,Math.cos(a)*.345],[Math.sin(a)*.4,.42,Math.cos(a)*.28],[Math.sin(a)*.28,.81,Math.cos(a)*.195]],.009,fold,12);
}
lathe('Cross collar robe',[[0,.64],[.34,.64],[.34,.83],[.28,1.15],[.19,1.37],[0,1.37]],blue,[0,0,0],.8);
sphere('Neck',skin,[0,1.39,.015],[.13,.19,.12]);
tube('Left collar',[[.16,1.36,.15],[.02,1.17,.23],[-.16,.91,.275]],.035,ivory);
tube('Right collar',[[-.16,1.36,.15],[-.05,1.21,.24],[.15,1.01,.28]],.035,pink);
lathe('Rose waist sash',[[.325,.0],[.34,.035],[.34,.12],[.325,.15]],pink,[0,.77,0],.81);
ring('Waist jade clasp',[0,.85,.293],.065,.018,gold);
sphere('Waist jade stone',jade,[0,.85,.298],[.052,.048,.02]);
for(const s of [-1,1]) {
  const sleeve=lathe('Bell sleeve',[[0,0],[.24,0],[.26,.05],[.22,.24],[.13,.55],[0,.55]],blue,[s*.47,.57,0],.95);
  sleeve.rotation.z=s*.48;
  const cuff=ring('Sleeve silk cuff',[s*.48,.60,.01],.225,.025,pink,[Math.PI/2,0,s*.48]);
  cuff.scale.set(1,.9,1);
  sphere('Hand',skin,[s*.51,.56,.085],[.105,.115,.095]);
  for(let k=0;k<3;k++)sphere('Fingers',skin,[s*(.52+k*.027),.51+k*.011,.12],[.025,.045,.024]);
  tube('Sleeve cloud',[[s*.44,.85,.185],[s*.51,.88,.20],[s*.57,.81,.20],[s*.52,.77,.215],[s*.46,.79,.22]],.012,ivory,18);
  tube('Silk stole',[[s*.18,1.30,-.03],[s*.30,1.19,.20],[s*.56,1.03,.18],[s*.58,.82,.12],[s*.39,.67,.29],[s*.19,.47,.32]],.048,pink);
  // Flowing ends are solid flattened ribbons, visible from behind and the side.
  lock('Ribbon tail',[[s*.19,.67,.31],[s*.25,.46,.35],[s*.52,.30,.16],[s*.65,.23,.09]],.068,.018,pink);
}
tube('Pendant cord',[[0,.78,.30],[.01,.57,.32],[0,.39,.35]],.009,gold);
ring('Pendant jade',[0,.45,.351],.045,.013,jade);
for(let k=-2;k<=2;k++)tube('Silk tassel',[[k*.008,.36,.35],[k*.012,.23,.37]],.007,pink,6);

// The complete back hair volume remains visible at every viewing angle.
sphere('Back hair mass',hair,[0,1.86,-.22],[.66,.79,.42]);
for(let k=-3;k<=3;k++) {
  const x=k*.155;
  lock('Long back lock',[[x*.8,2.24,-.42],[x*1.08,1.81,-.59],[x*1.06,1.27,-.46],[x*.92+.05,1.02,-.25]],.14,.09,k%2?strand:hair);
}
sphere('Face',skin,[0,2.01,.16],[.595,.585,.475]);
mesh('Hair crown',new T.SphereGeometry(1,40,24,0,Math.PI*2,0,1.49),hair,[0,2.11,-.025],[.704,.70,.55]);
// Side-swept fringe frames the forehead without hiding the eyes.
lock('Swept fringe',[[.39,2.64,.23],[.13,2.60,.46],[-.22,2.42,.54],[-.58,2.24,.32]],.145,.055);
lock('Fringe highlight',[[.36,2.67,.24],[.02,2.59,.49],[-.33,2.40,.51],[-.61,2.23,.27]],.045,.026,strand);
for(const s of [-1,1]) {
  sphere('Ear',skin,[s*.58,1.97,.06],[.095,.13,.085]);
  lock('Side framing lock',[[s*.55,2.47,.25],[s*.62,2.13,.26],[s*.58,1.77,.23],[s*.45,1.55,.28]],.105,.07);
  sphere('Eye white',white,[s*.232,2.055,.573],[.151,.179,.04]);
  sphere('Amber iris',iris,[s*.217,2.052,.612],[.106,.148,.025]);
  sphere('Pupil',ink,[s*.21,2.079,.634],[.066,.102,.014]);
  sphere('Eye glint',white,[s*.21-.025,2.125,.648],[.035,.044,.008]);
  sphere('Eye fleck',white,[s*.21+.033,1.994,.641],[.013,.017,.007]);
  tube('Upper lash',[[s*.085,2.10,.58],[s*.14,2.205,.59],[s*.27,2.227,.56],[s*.39,2.16,.49]],.019,ink);
  tube('Brow',[[s*.12,2.30,.55],[s*.24,2.33,.51],[s*.36,2.29,.46]],.014,hair,12);
  sphere('Blush',blush,[s*.38,1.86,.501],[.075,.033,.009]);
  tube('Earring chain',[[s*.61,1.94,.13],[s*.63,1.79,.16]],.008,gold,6);
  ring('Jade earring',[s*.63,1.75,.16],.055,.017,jade);
  sphere('Earring bead',jade,[s*.62,1.89,.145],[.025,.03,.025]);
}
sphere('Nose',skin,[0,1.939,.641],[.032,.035,.025]);
tube('Gentle smile',[[-.095,1.807,.595],[0,1.787,.613],[.092,1.811,.595]],.011,ink,16);
// Forehead chain and signature green jade discs.
tube('Forehead chain',[[-.42,2.45,.46],[-.18,2.38,.59],[0,2.36,.618],[.2,2.40,.57],[.4,2.50,.38]],.01,gold);
sphere('Forehead jade',jade,[0,2.307,.63],[.032,.065,.022]);
ring('Jade hair disc',[.50,2.54,.38],.127,.037,jade,[0,.3,-.28]);
ring('Hair disc gold loop',[.51,2.665,.389],.047,.012,gold,[0,0,.3]);
sphere('Jade pin bead',jade,[.47,2.36,.44],[.033,.036,.031]);
ring('Left hair disc',[-.57,2.51,.16],.10,.027,jade,[0,-.8,.3]);

// Bake transforms and batch geometry by material: 14 draw calls, no textures.
model.updateMatrixWorld(true);
const batches=new Map();
for(const child of model.children) {
  const g=child.geometry.clone().applyMatrix4(child.matrixWorld);
  g.deleteAttribute('uv');
  const list=batches.get(child.material)??[];list.push(g.toNonIndexed());batches.set(child.material,list);
}
const output=new T.Group();output.name='Nuwa';
for(const [material,geometries] of batches) {
  const m=new T.Mesh(mergeVertices(mergeGeometries(geometries)),material);m.name=material.name;output.add(m);
}
const box=new T.Box3().setFromObject(output),height=box.max.y-box.min.y;
// Shared model contract: 1.2 units high; origin at feet, forward +Z.
for(const m of output.children) {m.geometry.translate(0,-box.min.y,0);m.geometry.scale(1.2/height,1.2/height,1.2/height);}
output.userData={character:'nuwa',revision:1,style:'procedural chibi',forward:'+Z',origin:'feet',rigged:false};
const data=await new GLTFExporter().parseAsync(output,{binary:true,onlyVisible:true});
const file=new URL('../public/characters/nuwa/nuwa.glb',import.meta.url);
await writeFile(file,new Uint8Array(data));
console.log(JSON.stringify({file:file.pathname,bytes:data.byteLength,meshes:output.children.length,triangles:output.children.reduce((n,m)=>n+m.geometry.index.count/3,0)}));
