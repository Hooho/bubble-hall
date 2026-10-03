import { roster } from './roster';
import { multiplier, placementPoints, tournamentOrder, winnerIds, type Tournament, type Standing } from './tournament';
import type { Difficulty } from './game';
export type RecordEntry = { id: string; date: string; mode: 'quick' | 'championship'; difficulty: Difficulty; place: number; points: number; standings: { id: string; score: number }[] };
export type Career = { points: Record<string, number>; crowns: Record<string, number>; history: RecordEntry[]; paid: string[]; coins: number };
export const newCareer = (): Career => ({ points: {}, crowns: {}, history: [], paid: [], coins: 0 });
export function settleQuick(c: Career, id: string, difficulty: Difficulty, rows: Standing[]): void {
  if (c.paid.includes(id)) return;
  const winners = winnerIds(rows); const before = c.points.player ?? 0;
  for (const r of rows) c.points[r.id] = (c.points[r.id] ?? 0) + Math.round((r.hits * 20 + (r.alive && winners.includes(r.id) ? 100 : 0)) * multiplier[difficulty]);
  const sorted = [...rows].sort((a, b) => Number(b.alive) - Number(a.alive) || b.score - a.score);
  const place = sorted.findIndex(r => r.id === 'player') + 1;
  c.history.unshift({ id, date: new Date().toISOString(), mode: 'quick', difficulty, place, points: (c.points.player ?? 0) - before, standings: sorted });
  c.paid.push(id); c.coins += place === 1 ? 30 : 10;
}
export function settleTournament(c: Career, t: Tournament): void {
  for (const stage of t.archive) for (const m of stage.matches) {
    if (c.paid.includes(m.id)) continue;
    const advancement = stage.round === 'first' ? 40 : stage.round === 'second' ? 80 : stage.round === 'semi' ? 120 : 0;
    for (const r of m.standings ?? []) c.points[r.id] = (c.points[r.id] ?? 0) + Math.round((r.hits * 20 + (r.id === m.winner ? advancement : 0)) * multiplier[t.difficulty]);
    c.paid.push(m.id);
  }
  if (t.round !== 'complete' || c.paid.includes(t.id)) return;
  const order = tournamentOrder(t);
  order.forEach((id, i) => { c.points[id] = (c.points[id] ?? 0) + Math.round(placementPoints(i + 1) * multiplier[t.difficulty]); });
  c.crowns[order[0]] = (c.crowns[order[0]] ?? 0) + 1;
  const place = order.indexOf('player') + 1;
  const points = t.archive.flatMap(s => s.matches.map(m => {
    const r = m.standings?.find(a => a.id === 'player');
    const bonus = m.winner !== 'player' ? 0 : s.round === 'first' ? 40 : s.round === 'second' ? 80 : s.round === 'semi' ? 120 : 0;
    return r ? Math.round((r.hits * 20 + bonus) * multiplier[t.difficulty]) : 0;
  })).reduce((a,b)=>a+b,0) + Math.round(placementPoints(place) * multiplier[t.difficulty]);
  c.history.unshift({ id: t.id, date: new Date().toISOString(), mode: 'championship', difficulty: t.difficulty, place, points, standings: order.map(id => ({ id, score: c.points[id] ?? 0 })) });
  c.coins += place === 1 ? 200 : place <= 8 ? 80 : 20; c.paid.push(t.id);
}
export const leaderboard = (c: Career) => ['player', ...roster.map(p=>p.id)].map(id=>({id,points:c.points[id]??0,crowns:c.crowns[id]??0})).sort((a,b)=>b.points-a.points||b.crowns-a.crowns);
