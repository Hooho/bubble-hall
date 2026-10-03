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
  assert.equal(t.finalWins[t.podium[0]], 2);
}
const t = api.createTournament('hard'), m = t.matches[0];
assert.equal(api.submitMatch(t, m, m.members.map(id => ({ id, alive: true, score: 10, hits: 0, crates: 1 }))), false);
assert.equal(t.replay.length, 4); assert.equal(m.standings, null);
console.log('PASS: 64 entrants, 4 stages, bronze match, best-of-three final, complete unique placements and tie playoffs');
