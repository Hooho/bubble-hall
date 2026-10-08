import { roster } from './roster';
import type { Difficulty } from './game';
export type Standing = { id: string; score: number; hits: number; crates: number; alive: boolean };
export type Round = 'first' | 'second' | 'third' | 'semi' | 'bronze' | 'final' | 'complete';
export const roundNames: Record<Round, string> = { first: '首轮 · 64 强', second: '次轮 · 32 强', third: '第三轮 · 16 强', semi: '半决赛 · 8 强', bronze: '季军争夺战', final: '四人总决赛', complete: '赛事结束' };
export type Bonus = 'capacity' | 'speed' | 'shield';
export type Match = { id: string; members: string[]; standings: Standing[] | null; winner: string | null; qualified?: string[]; pendingRows?: Standing[]; rankGroups?: string[][] };
export type Tournament = { format?: 'top-two-v1'; id: string; difficulty: Difficulty; round: Round; matches: Match[]; archive: { round: Round; matches: Match[] }[]; eliminated: string[][]; finals: string[]; bronze: string[]; podium: string[]; finalWins: Record<string, number>; bonus: Bonus | null; needsReward: boolean; replay: string[] | null };
export const isTopTwo = (t: Tournament): boolean => t.format === 'top-two-v1';
export function roundTitle(t: Tournament, round = t.round): string {
  if (isTopTwo(t)) return roundNames[round];
  return ({ second: '次轮 · 16 强', semi: '半决赛', final: '总决赛 · 三局两胜' } as Partial<Record<Round,string>>)[round] ?? roundNames[round];
}
export function advancingIds(t: Tournament, m: Match): string[] {
  return isTopTwo(t) ? m.qualified ?? [] : m.winner ? [m.winner] : [];
}
export function advancementPoints(t: Tournament, round: Round): number {
  return isTopTwo(t)
    ? ({ first: 40, second: 60, third: 80, semi: 120 } as Partial<Record<Round,number>>)[round] ?? 0
    : ({ first: 40, second: 80, semi: 120 } as Partial<Record<Round,number>>)[round] ?? 0;
}
const shuffled = <T>(values: T[]): T[] => { const a = [...values]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const group = (members: string[], size: number): Match[] => Array.from({ length: Math.ceil(members.length / size) }, (_, i) => ({ id: crypto.randomUUID(), members: members.slice(i * size, (i + 1) * size), standings: null, winner: null }));
export function createTournament(difficulty: Difficulty): Tournament {
  return { format: 'top-two-v1', id: crypto.randomUUID(), difficulty, round: 'first', matches: group(shuffled(['player', ...roster.map(p => p.id)]), 4), archive: [], eliminated: [], finals: [], bronze: [], podium: [], finalWins: {}, bonus: null, needsReward: false, replay: null };
}
export function ranked(rows: Standing[]): Standing[] {
  return [...rows].sort((a, b) => Number(b.alive) - Number(a.alive) || b.score - a.score);
}
export function winnerIds(rows: Standing[]): string[] {
  const sorted = ranked(rows); const first = sorted[0];
  if (!first || !first.alive) return sorted.map(p => p.id);
  return sorted.filter(p => p.alive && p.score === first.score).map(p => p.id);
}
export function simulate(members: string[]): Standing[] {
  const rows = members.map(id => { const p = roster.find(p => p.id === id); const hits = Math.floor(Math.random() * (2 + (p?.intelligence ?? 3))); const crates = Math.floor(2 + Math.random() * 12); return { id, score: hits * 100 + crates * 10, hits, crates, alive: true }; });
  const scores = new Set<number>();
  // Simulated tie-breaks resolve every place, including the second-place cutoff.
  for (const row of shuffled(rows)) { while(scores.has(row.score)) row.score += 5; scores.add(row.score); }
  return ranked(rows);
}
export function pendingPlayerMatch(t: Tournament): Match | undefined { return t.matches.find(m => !m.standings && m.members.includes('player')); }
export function submitMatch(t: Tournament, match: Match, rows: Standing[]): boolean {
  if (isTopTwo(t)) return submitTopTwo(t,match,rows);
  if (match.standings) return true;
  const winners = winnerIds(rows);
  if (winners.length !== 1) { t.replay = winners; return false; }
  const missing = match.members.filter(id => !rows.some(p => p.id === id)).map(id => ({ id, score: 0, hits: 0, crates: 0, alive: false }));
  match.standings = ranked([...rows, ...missing]); match.winner = winners[0]; t.replay = null; return true;
}
export function advance(t: Tournament): void {
  if (isTopTwo(t)) { advanceTopTwo(t); return; }
  if (t.round === 'complete' || t.matches.some(m => !m.standings)) return;
  t.archive.push({ round: t.round, matches: structuredClone(t.matches) });
  const winners = t.matches.map(m => m.winner!);
  const losers = t.matches.flatMap(m => m.standings!.filter(p => p.id !== m.winner));
  if (t.round === 'first' || t.round === 'second') {
    t.eliminated.push(losers.sort((a, b) => {
      const place = (id: string) => t.matches.find(m => m.members.includes(id))!.standings!.findIndex(p => p.id === id);
      return place(a.id) - place(b.id) || b.hits - a.hits || b.score - a.score;
    }).map(p => p.id));
    t.round = t.round === 'first' ? 'second' : 'semi';
    t.matches = group(winners, t.round === 'semi' ? 2 : 4);
  } else if (t.round === 'semi') {
    t.finals = winners; t.bronze = losers.map(p => p.id); t.round = 'bronze'; t.matches = group(t.bronze, 2);
  } else if (t.round === 'bronze') {
    t.podium[2] = winners[0]; t.podium[3] = losers[0].id; t.round = 'final'; t.matches = group(t.finals, 2);
  } else {
    const id = winners[0]; t.finalWins[id] = (t.finalWins[id] ?? 0) + 1;
    if (t.finalWins[id] >= 2) { t.podium[0] = id; t.podium[1] = t.finals.find(p => p !== id)!; t.round = 'complete'; t.matches = []; }
    else t.matches = group(t.finals, 2);
  }
  t.needsReward = (t.round === 'second' || t.round === 'semi' || (t.round === 'bronze' && t.finals.includes('player'))) && winners.includes('player');
}
export const tournamentOrder = (t: Tournament): string[] => [...t.podium, ...[...t.eliminated].reverse().flat()];
export const multiplier: Record<Difficulty, number> = { easy: 1, normal: 1.3, hard: 1.6, master: 2 };
export const placementPoints = (place: number) => place === 1 ? 400 : place === 2 ? 240 : place === 3 ? 160 : place === 4 ? 120 : place <= 8 ? 80 : place <= 16 ? 40 : 0;

function tiedGroups(rows: Standing[]): string[][] {
  const sorted = ranked(rows), groups: string[][] = [];
  sorted.forEach((r,i) => {
    const previous = sorted[i-1];
    if (previous && previous.alive === r.alive && previous.score === r.score) groups[groups.length-1].push(r.id);
    else groups.push([r.id]);
  });
  return groups;
}

// Only the group crossing the qualifying cutoff replays. Final ties settle all medals.
export function replayMembers(t: Tournament, match: Match): string[] | null {
  if (!isTopTwo(t)) return t.replay;
  let position = 0;
  for (const ids of match.rankGroups ?? []) {
    if (ids.length > 1 && (t.round === 'final' || (position < 2 && position + ids.length > 2))) return ids;
    position += ids.length;
  }
  return null;
}

function submitTopTwo(t: Tournament, match: Match, rows: Standing[]): boolean {
  if (match.standings) return true;
  const replay = replayMembers(t,match), expected = replay ?? match.members;
  if (rows.length !== expected.length || new Set(rows.map(r=>r.id)).size !== expected.length || rows.some(r=>!expected.includes(r.id))) throw new Error('赛事成绩与参赛名单不一致');
  if (replay) {
    const index = match.rankGroups!.findIndex(ids=>ids === replay);
    match.rankGroups!.splice(index,1,...tiedGroups(rows));
  } else {
    match.pendingRows = structuredClone(rows);
    match.rankGroups = tiedGroups(rows);
  }
  const unresolved = replayMembers(t,match);
  if (unresolved) { t.replay = [...unresolved]; return false; }
  const order = match.rankGroups!.flat();
  match.standings = order.map(id=>match.pendingRows!.find(r=>r.id === id)!);
  match.winner = order[0];
  match.qualified = t.round === 'final' ? [] : order.slice(0,2);
  delete match.pendingRows; delete match.rankGroups;
  t.replay = null;
  return true;
}

function advanceTopTwo(t: Tournament): void {
  if (t.round === 'complete' || !t.matches.length || t.matches.some(m=>!m.standings)) return;
  t.archive.push({round:t.round,matches:structuredClone(t.matches)});
  if (t.round === 'final') {
    t.podium = t.matches[0].standings!.map(r=>r.id);
    t.round = 'complete'; t.matches = []; t.needsReward = false; t.replay = null;
    return;
  }
  const qualified = t.matches.flatMap(m=>m.qualified!);
  // Rank equal-round eliminations by their group place, then actual score.
  const eliminated = t.matches.flatMap(m=>m.standings!.slice(2).map((r,i)=>({r,place:i})));
  eliminated.sort((a,b)=>a.place-b.place || b.r.score-a.r.score || b.r.hits-a.r.hits);
  t.eliminated.push(eliminated.map(({r})=>r.id));
  const next: Partial<Record<Round,Round>> = {first:'second',second:'third',third:'semi',semi:'final'};
  t.round = next[t.round]!;
  t.matches = group(shuffled(qualified),4);
  if (t.round === 'final') t.finals = [...qualified];
  t.needsReward = qualified.includes('player'); t.replay = null;
}

/** The player is out: the tournament is still running but no current group includes them. */
export const playerEliminated = (t: Tournament): boolean => t.round !== 'complete' && !t.matches.some(m => m.members.includes('player'));

/** Simulates every remaining match and round until the tournament is complete. */
export function simulateToEnd(t: Tournament): void {
  for (let rounds = 0; t.round !== 'complete' && rounds < 30; rounds += 1) {
    for (const m of t.matches) {
      for (let tries = 0; !m.standings && tries < 10; tries += 1) submitMatch(t, m, simulate(replayMembers(t, m) ?? m.members));
    }
    advance(t);
  }
}
