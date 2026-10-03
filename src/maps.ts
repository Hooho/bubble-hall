export const maps = [
  { id: 'bay', name: '蓝湾广场', caption: '均衡路线 · 适合练习', density: 0.28, floor: 0xe6f0f3, wall: 0x91d2e6, crate: 0xf1c780 },
  { id: 'candy', name: '糖果仓库', caption: '丰富补给 · 炸箱发育', density: 0.48, floor: 0xf5eaf1, wall: 0xdda8cd, crate: 0xf3ce95 },
  { id: 'garden', name: '环形花园', caption: '环形通道 · 追击绕行', density: 0.25, floor: 0xe5f1df, wall: 0x83bca4, crate: 0xe6c79a },
  { id: 'factory', name: '十字工坊', caption: '十字干道 · 中央交锋', density: 0.35, floor: 0xe3e9ed, wall: 0x8eacc4, crate: 0xe8af62 },
  { id: 'arena', name: '冠军竞技场', caption: '对称空场 · 双人决斗', density: 0.16, floor: 0xf5f0df, wall: 0xcbb979, crate: 0xe5c98e },
] as const;
export type MapId = typeof maps[number]['id'];
export const mapInfo = (id: MapId) => maps.find(m => m.id === id) ?? maps[0];
