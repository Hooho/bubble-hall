import assert from 'node:assert/strict';
import { build } from 'esbuild';
async function load(path){const b=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false});return import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);}
const {createSaveStore}=await load('src/shared/save-store.ts');
const {initialSave,validateSave,savedMatchSlots}=await load('src/save.ts');
const {createTournament,submitMatch,advance}=await load('src/tournament.ts');
const {settleQuick,settleTournament}=await load('src/career.ts');
const memory=new Map(); const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
const store=createSaveStore('test',validateSave,storage);
const save=initialSave(); assert.ok(validateSave(save));
assert.equal(save.settings.boardStyle,'classic');
const oldStyleSave=initialSave();delete oldStyleSave.settings.boardStyle;assert.ok(validateSave(oldStyleSave));
const modernStyleSave=initialSave();modernStyleSave.settings.boardStyle='modern';assert.ok(validateSave(modernStyleSave));
const playoffSave=initialSave();playoffSave.tournament=createTournament('easy');
const playoff=playoffSave.tournament.matches[0];
submitMatch(playoffSave.tournament,playoff,playoff.members.map(id=>({id,score:10,hits:1,crates:1,alive:true})));
assert.ok(validateSave(JSON.parse(JSON.stringify(playoffSave))),'pending playoff survives save round trip');
const damagedPlayoff=structuredClone(playoffSave);damagedPlayoff.tournament.matches[0].rankGroups=[['player','player']];
assert.equal(validateSave(damagedPlayoff),false);
const rewards=initialSave();rewards.tournament=createTournament('easy');
for(const match of rewards.tournament.matches)submitMatch(rewards.tournament,match,match.members.map((id,i)=>({id,score:400-i*100,hits:1,crates:0,alive:true})));
const second=rewards.tournament.matches[0].qualified[1],third=rewards.tournament.matches[0].standings[2].id;
advance(rewards.tournament);settleTournament(rewards.career,rewards.tournament);
assert.equal(rewards.career.points[second],60,'second place receives hit + advancement reward');
assert.equal(rewards.career.points[third],20,'third place receives no advancement reward');
await store.write(save,0); assert.equal(store.load().revision,1);
await assert.rejects(()=>store.write(save,0),/标签页/);
await store.write(save,1); assert.equal(store.backup().revision,1);
assert.throws(()=>store.parse('{"version":3}'));
assert.equal(validateSave({...save,active:{}}),false);
const rows=[{id:'player',score:10,hits:1,crates:1,alive:true},{id:'0',score:0,hits:0,crates:0,alive:false}];
settleQuick(save.career,'quick-1','hard',rows); const points=save.career.points.player;
assert.equal(points,192);settleQuick(save.career,'quick-1','hard',rows);assert.equal(save.career.points.player,points);
save.tournament=createTournament('normal');
while(save.tournament.round!=='complete'){
  for(const m of save.tournament.matches)submitMatch(save.tournament,m,m.members.map((id,i)=>({id,score:100-i,hits:1,crates:0,alive:true})));
  advance(save.tournament);settleTournament(save.career,save.tournament);
  assert.ok(validateSave(save),`valid ${save.tournament.round} save`);
}
const before=JSON.stringify(save.career);settleTournament(save.career,save.tournament);assert.equal(JSON.stringify(save.career),before);
assert.equal(save.career.history.length,2);
await store.write(save,2);assert.ok(validateSave(store.load().data));
console.log('PASS: version/checksum validation, backup, conflict, difficulty score, idempotent awards and all tournament save stages');
await assert.rejects(()=>store.recover(save),/当前存档有效/);
storage.setItem('test','broken');await store.recover(save);
assert.equal(storage.getItem('test:damaged'),'broken');assert.ok(validateSave(store.load().data));
const {equipCosmetic}=await load('src/cosmetics.ts');
const wardrobe=initialSave();assert.equal(equipCosmetic(wardrobe.career,wardrobe.settings,'mint'),false);
wardrobe.career.coins=120;assert.equal(equipCosmetic(wardrobe.career,wardrobe.settings,'mint'),true);
assert.equal(wardrobe.career.coins,0);assert.equal(equipCosmetic(wardrobe.career,wardrobe.settings,'mint'),true);
assert.ok(validateSave(wardrobe));assert.equal(equipCosmetic(wardrobe.career,wardrobe.settings,'invalid'),false);
console.log('PASS: damaged-save recovery preserves original; cosmetic purchases charge once');
const legacy=initialSave();
assert.deepEqual(savedMatchSlots(legacy),{quick:null,championship:null});
const quick={id:'quick-snapshot',mode:'quick',snapshot:{}};
const championship={id:'championship-snapshot',mode:'championship',snapshot:{}};
legacy.active=quick;
assert.deepEqual(savedMatchSlots(legacy),{quick,championship:null});
legacy.active=championship;
assert.deepEqual(savedMatchSlots(legacy),{quick:null,championship});
legacy.matches={quick,championship};
assert.deepEqual(savedMatchSlots(legacy),{quick,championship});
assert.equal(validateSave({...initialSave(),matches:{quick:null,championship:null}}),true);
assert.equal(validateSave({...initialSave(),matches:{quick:championship,championship:null}}),false);
assert.equal(validateSave({...initialSave(),matches:{}}),false);
console.log('PASS: legacy save migration, separate match slots and invalid-slot rejection');

const {roster,playerName}=await load('src/roster.ts');
const {newSkills}=await load('src/skills.ts');
const contestants=roster.slice(0,3);
const richSnapshot={
  mapId:'bay',difficulty:'hard',opponents:contestants,
  tiles:Array.from({length:11},(_,y)=>Array.from({length:13},(_,x)=>x===0||x===12||y===0||y===10?'wall':'floor')),
  actors:['player',...contestants.map(p=>p.id)].map((id,i)=>({
    id,name:playerName(id),color:0x2f80ed,intelligence:3,personality:'careful',alive:true,
    position:{x:1+i*2,y:1},spawn:{x:1+i*2,y:1},score:100+i,hits:1,crates:2,
    bombCapacity:3,bombsActive:i===0?1:0,range:4,speed:1.2,respawnDelay:0,
    moveCooldown:0.1,decisionCooldown:0.2,state:'escape',plannedPath:[{x:2,y:1}],blockedMoves:0,
    skills:{...newSkills(),active:'super',shield:true,life:i===0?2:0,invincible:1.2},
  })),
  bombs:[{id:2,ownerId:'player',position:{x:2,y:1},timer:1.1,range:4,piercing:true}],
  items:[{kind:'coin',position:{x:4,y:3}},{kind:'life',position:{x:5,y:3}}],
  remaining:88,elapsed:32,coinTimer:1,bombId:2,rng:1234567,
};
const progress=initialSave();
progress.career=structuredClone(save.career);
progress.settings={quality:'low',reducedMotion:true,controls:'touch',palette:'mint',unlocked:['blue','mint']};
progress.tournament=createTournament('hard');
progress.matches={quick:{id:'quick-unfinished',mode:'quick',snapshot:richSnapshot},championship:{id:'champ-unfinished',mode:'championship',snapshot:{...richSnapshot,remaining:65,elapsed:55}}};
progress.active=progress.matches.championship;
assert.ok(validateSave(progress));
// Removed map (古韵庭院): an unfinished match saved on it still loads, falling back to 蓝湾广场.
const retired=structuredClone(progress); retired.matches.quick.snapshot.mapId='palace';
assert.ok(validateSave(retired)); assert.equal(retired.matches.quick.snapshot.mapId,'bay');
// Extra life used to be a boolean: older saves load as a count; stacked counts survive; out-of-range counts are rejected.
const legacyLife=structuredClone(progress); legacyLife.matches.quick.snapshot.actors[0].skills.life=true; legacyLife.matches.quick.snapshot.actors[1].skills.life=false;
assert.ok(validateSave(legacyLife)); assert.equal(legacyLife.matches.quick.snapshot.actors[0].skills.life,1); assert.equal(legacyLife.matches.quick.snapshot.actors[1].skills.life,0);
const stacked=structuredClone(progress); stacked.matches.quick.snapshot.actors[0].skills.life=3; assert.ok(validateSave(stacked));
// Selectable round length: snapshot keeps its own duration; settings accept 1-3 minutes only.
const long=structuredClone(progress); long.matches.quick.snapshot.duration=180; assert.ok(validateSave(long));
const odd=structuredClone(progress); odd.matches.quick.snapshot.duration=90; assert.equal(validateSave(odd),false);
const mins=structuredClone(progress); mins.settings.matchMinutes=3; assert.ok(validateSave(mins));
const badMins=structuredClone(progress); badMins.settings.matchMinutes=5; assert.equal(validateSave(badMins),false);
const tooMany=structuredClone(progress); tooMany.matches.quick.snapshot.actors[0].skills.life=4; assert.equal(validateSave(tooMany),false);
const fractional=structuredClone(progress); fractional.matches.quick.snapshot.actors[0].skills.life=1.5; assert.equal(validateSave(fractional),false);
const packed=store.transfer.exportJSON(progress);
assert.deepEqual(store.transfer.parseJSON(packed),progress);
const code=await store.transfer.createCode(progress);
assert.match(code,/^BUBBLE-SAVE-V1\.(G|P)\./);
assert.deepEqual(await store.transfer.parseCode(code.replace(/(.{50})/g,'$1\n')),progress);
const beforeImport=storage.getItem('test');
await assert.rejects(()=>store.transfer.parseCode('RIVER-SAVE-V2.P.eyJ2IjoyfQ'),/前缀/);
assert.equal(storage.getItem('test'),beforeImport,'parsing must never write');
const {checksum}=await load('src/shared/save-store.ts');
const legacyFile=JSON.stringify({version:1,revision:19,savedAt:'2026-01-01T00:00:00Z',checksum:checksum(JSON.stringify(progress)),data:progress});
assert.deepEqual(await store.transfer.parseFile({size:legacyFile.length,text:async()=>legacyFile}),progress);
await store.write(progress,store.load().revision,{archive:true});
assert.deepEqual(store.load().data,progress);
assert.ok(validateSave(store.backup().data));
console.log('PASS: legacy JSON and compressed code preserve both match slots, championship, score, cosmetics, bombs, timers, RNG and skills; wrong-game import leaves save untouched');
