import type { Career } from './career';
import type { Settings } from './save';
export const cosmetics = [
  { id: 'blue', name: '海湾蓝', color: 0x2787e8, price: 0 },
  { id: 'mint', name: '薄荷巡游', color: 0x29bba0, price: 120 },
  { id: 'gold', name: '冠军金', color: 0xefb83e, price: 240 },
] as const;
export function equipCosmetic(career: Career, settings: Settings, id: string): boolean {
  const item = cosmetics.find(c=>c.id===id);
  if(!item) return false;
  if(!settings.unlocked.includes(id)) {
    if(career.coins<item.price) return false;
    career.coins-=item.price; settings.unlocked.push(id);
  }
  settings.palette=item.id;
  return true;
}
