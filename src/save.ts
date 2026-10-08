import { newCareer, type Career } from './career';
import type { Tournament } from './tournament';
import type { GameSnapshot } from './game';
import { roster, playerName } from './roster';
import { maps } from './maps';
import { rewardNames } from './skills';
export type Settings = { quality: 'low' | 'high'; boardStyle?: 'modern' | 'classic'; reducedMotion: boolean; controls: 'auto' | 'touch'; palette: 'blue' | 'mint' | 'gold'; unlocked: string[] };
export type ActiveMatch = { id: string; mode: 'quick' | 'championship'; snapshot: GameSnapshot };
export type MatchSlots = Record<ActiveMatch['mode'], ActiveMatch | null>;
export type Save = { career: Career; tournament: Tournament | null; active: ActiveMatch | null; matches?: MatchSlots; settings: Settings };
export function savedMatchSlots(save: Save): MatchSlots {
  return save.matches ?? { quick: save.active?.mode==='quick'?save.active:null, championship: save.active?.mode==='championship'?save.active:null };
}
export const initialSave = (): Save => ({ career: newCareer(), tournament: null, active: null, settings: { quality: 'high', reducedMotion: false, controls: 'auto', palette: 'blue', unlocked: ['blue'] } });
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, max = 1e12) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
const text = (v: unknown, max = 100) => typeof v === 'string' && v.length <= max;
const ids = new Set(['player', ...roster.map(p => p.id)]);
const difficulty = (v: unknown) => ['easy','normal','hard','master'].includes(v as string);
const position = (v: unknown) => object(v) && Number.isInteger(v.x) && Number.isInteger(v.y) && num(v.x,12) && num(v.y,10);
const list = (v: unknown, max: number, check: (x: any) => boolean): boolean => Array.isArray(v) && v.length <= max && v.every(check);
const idList = (v: unknown, max: number) => list(v,max,x=>ids.has(x)) && new Set(v as string[]).size === (v as string[]).length;
const points = (v: unknown) => object(v) && Object.entries(v).every(([id,n])=>ids.has(id)&&num(n));
const standing = (v: unknown): boolean => object(v) && ids.has(v.id) && num(v.score) && num(v.hits) && num(v.crates) && typeof v.alive === 'boolean';
function match(v: unknown, topTwo: boolean, final: boolean): boolean {
  if (!object(v) || !text(v.id) || !idList(v.members,4) || v.members.length < 2 || (topTwo && v.members.length !== 4)) return false;
  const rows = (value: unknown) => list(value,4,standing) && (value as any[]).length===v.members.length && new Set((value as any[]).map(r=>r.id)).size===v.members.length && (value as any[]).every(r=>v.members.includes(r.id));
  if (v.standings === null) {
    if(v.winner !== null) return false;
    if(v.pendingRows !== undefined || v.rankGroups !== undefined) {
      if(!topTwo || !rows(v.pendingRows) || !list(v.rankGroups,4,g=>idList(g,4)&&g.length>0))return false;
      const order=v.rankGroups.flat();
      if(order.length!==v.members.length || new Set(order).size!==order.length || order.some((id:string)=>!v.members.includes(id)))return false;
    }
    return true;
  }
  if (!rows(v.standings) || !v.members.includes(v.winner)) return false;
  return !topTwo || (idList(v.qualified,2) && v.qualified.length===(final?0:2) && v.qualified.every((id:string,i:number)=>v.standings[i].id===id));
}
function tournament(v: unknown): boolean {
  if(!object(v) || (v.format!==undefined && v.format!=='top-two-v1')) return false;
  const topTwo=v.format==='top-two-v1';
  const rounds=topTwo?['first','second','third','semi','final']:['first','second','semi','bronze','final'];
  return text(v.id) && difficulty(v.difficulty) && [...rounds,'complete'].includes(v.round) && list(v.matches,16,m=>match(m,topTwo,v.round==='final')) && list(v.archive,12,s=>object(s)&&rounds.includes(s.round)&&list(s.matches,16,m=>match(m,topTwo,s.round==='final'))) && list(v.eliminated,topTwo?4:2,a=>idList(a,64)) && idList(v.finals,topTwo?4:2) && idList(v.bronze,2) && list(v.podium,4,id=>id===null||ids.has(id)) && points(v.finalWins) && [null,'capacity','speed','shield'].includes(v.bonus) && typeof v.needsReward==='boolean' && (v.replay===null||idList(v.replay,4));
}
function snapshot(v: unknown): boolean {
  if (!object(v) || !maps.some(m=>m.id===v.mapId) || !difficulty(v.difficulty) || !list(v.tiles,11,row=>list(row,13,t=>['wall','crate','floor'].includes(t))&&row.length===13) || v.tiles.length!==11 || !num(v.remaining,180) || !num(v.elapsed,1000) || !num(v.coinTimer,10) || !num(v.bombId) || !num(v.rng,4294967295)) return false;
  if (!list(v.opponents,3,p=>object(p)&&roster.some(r=>r.id===p.id)&&text(p.name,40)&&['brave','careful','collector'].includes(p.personality)&&num(p.color,0xffffff)&&num(p.intelligence,5))) return false;
  if (!list(v.actors,4,a=>object(a)&&ids.has(a.id)&&text(a.name,40)&&position(a.position)&&position(a.spawn)&&typeof a.alive==='boolean'&&['brave','careful','collector'].includes(a.personality)&&['escape','attack','break','collect','patrol','stuck'].includes(a.state)&&['score','hits','crates','respawnDelay','intelligence','color','bombCapacity','bombsActive','range','speed','moveCooldown','decisionCooldown','blockedMoves'].every(k=>typeof a[k]==='number'&&Number.isFinite(a[k]))&&a.bombCapacity>=1&&a.bombCapacity<=5&&a.range>=2&&a.range<=5&&a.speed>=1&&a.speed<=1.7&&list(a.plannedPath,143,position)&&object(a.skills)&&[null,'invincible','super','dash','rapid'].includes(a.skills.active)&&['armed','shield','life','respawning'].every(k=>typeof a.skills[k]==='boolean')&&['invincible','dash','rapid','bombCooldown'].every(k=>num(a.skills[k],10)))) return false;
  if (!v.actors.some((a:any)=>a.id==='player') || new Set(v.actors.map((a:any)=>a.id)).size!==v.actors.length) return false;
  // Imported names are rendered in the HUD: only canonical identity names are
  // accepted, never arbitrary markup carried by an external save file.
  if (!v.actors.every((a:any)=>a.name===playerName(a.id)) || !v.opponents.every((p:any)=>p.name===playerName(p.id))) return false;
  if (new Set(v.opponents.map((p:any)=>p.id)).size!==v.opponents.length || v.actors.length!==v.opponents.length+1 || !v.opponents.every((p:any)=>v.actors.some((a:any)=>a.id===p.id))) return false;
  return list(v.items,143,i=>object(i)&&Object.hasOwn(rewardNames,i.kind)&&position(i.position)) && list(v.bombs,20,b=>object(b)&&v.actors.some((a:any)=>a.id===b.ownerId)&&position(b.position)&&num(b.timer,2)&&num(b.id)&&Number.isInteger(b.range)&&b.range>=2&&b.range<=7&&(b.piercing===undefined||typeof b.piercing==='boolean'));
}
export function validateSave(v: unknown): v is Save {
  if (!object(v)||!object(v.career)||!object(v.settings)) return false;
  if (v.matches !== undefined && (!object(v.matches) || !(['quick','championship'] as const).every(mode=>{
    const m=v.matches[mode];
    return m===null || (object(m)&&text(m.id)&&m.mode===mode&&snapshot(m.snapshot)&&(mode==='quick'||v.tournament!==null));
  }))) return false;
  const c=v.career,s=v.settings;
  return points(c.points)&&points(c.crowns)&&num(c.coins)&&list(c.paid,100000,id=>text(id))&&list(c.history,10000,r=>object(r)&&text(r.id)&&text(r.date)&&['quick','championship'].includes(r.mode)&&difficulty(r.difficulty)&&num(r.place,64)&&r.place>=1&&num(r.points)&&list(r.standings,64,p=>object(p)&&ids.has(p.id)&&num(p.score))) && ['low','high'].includes(s.quality)&&(s.boardStyle===undefined||['modern','classic'].includes(s.boardStyle))&&typeof s.reducedMotion==='boolean'&&['auto','touch'].includes(s.controls)&&['blue','mint','gold'].includes(s.palette)&&list(s.unlocked,3,x=>['blue','mint','gold'].includes(x))&&s.unlocked.includes(s.palette) && (v.tournament===null||tournament(v.tournament)) && (v.active===null || (object(v.active)&&text(v.active.id)&&['quick','championship'].includes(v.active.mode)&&snapshot(v.active.snapshot)&& (v.active.mode==='quick'||v.tournament!==null)));
}
