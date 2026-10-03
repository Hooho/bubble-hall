import { roster } from './roster';
import type { Difficulty } from './game';
export type Standing = { id: string; score: number; hits: number; crates: number; alive: boolean };
export type Round = 'first' | 'second' | 'semi' | 'bronze' | 'final' | 'complete';
export const roundNames: Record<Round, string> = { first: '首轮 · 64 强', second: '次轮 · 16 强', semi: '半决赛', bronze: '季军争夺战', final: '总决赛 · 三局两胜', complete: '赛事结束' };
export type Bonus = 'capacity' | 'speed' | 'shield';
export type Match = { id: string; members: string[]; standings: Standing[] | null; winner: string | null };
export type Tournament = { id: string; difficulty: Difficulty; round: Round; matches: Match[]; archive: { round: Round; matches: Match[] }[]; eliminated: string[][]; finals: string[]; bronze: string[]; podium: string[]; finalWins: Record<string, number>; bonus: Bonus | null; needsReward: boolean; replay: string[] | null };
const shuffled = <T>(values: T[]): T[] => { const a = [...values]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const group = (members: string[], size: number): Match[] => Array.from({ length: Math.ceil(members.length / size) }, (_, i) => ({ id: crypto.randomUUID(), members: members.slice(i * size, (i + 1) * size), standings: null, winner: null }));
export function createTournament(difficulty: Difficulty): Tournament {
  return { id: crypto.randomUUID(), difficulty, round: 'first', matches: group(shuffled(['player', ...roster.map(p => p.id)]), 4), archive: [], eliminated: [], finals: [], bronze: [], podium: [], finalWins: {}, bonus: null, needsReward: false, replay: null };
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
  const sorted = ranked(rows);
  // Simulation resolves ties with a simulated playoff, not an arbitrary name ordering.
  if (sorted.length > 1 && sorted[0].score === sorted[1].score) sorted[Math.floor(Math.random() * 2)].score += 5;
  return ranked(sorted);
}
export function pendingPlayerMatch(t: Tournament): Match | undefined { return t.matches.find(m => !m.standings && m.members.includes('player')); }
export function submitMatch(t: Tournament, match: Match, rows: Standing[]): boolean {
  if (match.standings) return true;
  const winners = winnerIds(rows);
  if (winners.length !== 1) { t.replay = winners; return false; }
  const missing = match.members.filter(id => !rows.some(p => p.id === id)).map(id => ({ id, score: 0, hits: 0, crates: 0, alive: false }));
  match.standings = ranked([...rows, ...missing]); match.winner = winners[0]; t.replay = null; return true;
}
export function advance(t: Tournament): void {
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
export const tournamentOrder = (t: Tournament): string[] => [...t.podium, ...(t.eliminated[1] ?? []), ...(t.eliminated[0] ?? [])];
export const multiplier: Record<Difficulty, number> = { easy: 1, normal: 1.3, hard: 1.6, master: 2 };
export const placementPoints = (place: number) => place === 1 ? 400 : place === 2 ? 240 : place === 3 ? 160 : place === 4 ? 120 : place <= 8 ? 80 : place <= 16 ? 40 : 0;
