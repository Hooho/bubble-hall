import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ entryPoints: ['src/tournament.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
for (let run = 0; run < 20; run++) {
  const t = api.createTournament('normal');
  assert.equal(t.matches.length, 16);
  assert.equal(new Set(t.matches.flatMap(m => m.members)).size, 64);
  let rounds = 0;
  while (t.round !== 'complete' && rounds++ < 12) {
    for (const m of t.matches) {
      const rows = m.members.map((id, i) => ({ id, alive: true, score: (m.members.length - i) * 100, hits: 1, crates: 0 }));
      assert.equal(api.submitMatch(t, m, rows), true);
    }
    api.advance(t); t.needsReward = false;
  }
  assert.equal(t.round, 'complete');
  assert.equal(api.tournamentOrder(t).length, 64);
  assert.equal(new Set(api.tournamentOrder(t)).size, 64);
  assert.deepEqual(t.archive.map(s=>s.matches.length), [16,8,4,2,1]);
  assert.deepEqual(t.eliminated.map(ids=>ids.length), [32,16,8,4]);
  assert.equal(t.podium.length, 4);
  for(const stage of t.archive) for(const match of stage.matches) {
    assert.equal(match.members.length,4);
    assert.equal(match.qualified.length,stage.round==='final'?0:2);
  }
}
const t = api.createTournament('hard'), m = t.matches[0];
assert.equal(api.submitMatch(t, m, m.members.map(id => ({ id, alive: true, score: 10, hits: 0, crates: 1 }))), false);
assert.equal(t.replay.length, 4); assert.equal(m.standings, null);
const row = (id,score,alive=true)=>({id,score,alive,hits:1,crates:0});
const cutoff = api.createTournament('easy'), cm = cutoff.matches[0], ids=cm.members;
assert.equal(api.submitMatch(cutoff,cm,[row(ids[0],300),row(ids[1],200),row(ids[2],200),row(ids[3],100)]),false);
assert.deepEqual(api.replayMembers(cutoff,cm),ids.slice(1,3));
assert.equal(api.submitMatch(cutoff,cm,[row(ids[2],100),row(ids[1],0)]),true);
assert.deepEqual(cm.qualified,[ids[0],ids[2]]);
assert.equal(cm.standings[1].score,200,'playoff does not replace original scoring');
const survival=api.createTournament('normal'),sm=survival.matches[0],si=sm.members;
api.submitMatch(survival,sm,[row(si[0],5),row(si[1],1),row(si[2],999,false),row(si[3],500,false)]);
assert.deepEqual(sm.qualified,si.slice(0,2),'survival outranks eliminated high scorers');
const final=api.createTournament('easy');final.round='final';final.matches=[final.matches[0]];
const fm=final.matches[0], fi=fm.members;
assert.equal(api.submitMatch(final,fm,fi.map((id,i)=>row(id,i<2?200:100))),false);
assert.equal(api.submitMatch(final,fm,[row(fi[1],50),row(fi[0],0)]),false);
assert.deepEqual(api.replayMembers(final,fm),fi.slice(2));
assert.equal(api.submitMatch(final,fm,[row(fi[3],50),row(fi[2],0)]),true);
api.advance(final);assert.deepEqual(final.podium,[fi[1],fi[0],fi[3],fi[2]]);
const legacy=api.createTournament('easy');delete legacy.format;
while(legacy.round!=='complete') {for(const match of legacy.matches)api.submitMatch(legacy,match,match.members.map((id,i)=>row(id,400-i*100)));api.advance(legacy);}
assert.equal(legacy.finalWins[legacy.podium[0]],2);
assert.equal(new Set(api.tournamentOrder(legacy)).size,64);
console.log('PASS: top-two progression, complete placements, cutoff/final playoffs and legacy compatibility');
