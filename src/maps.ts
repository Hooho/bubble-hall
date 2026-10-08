export const maps = [
  { id: 'bay', name: '蓝湾广场', caption: '均衡路线 · 适合练习', density: 0.28, floor: 0xf3e6cf, grout: 0xd9c4a0, ground: 0xd8e9c4, bush: 0x6cbf55, wall: 0x5fbde8, crate: 0xe8963a, classic: { floor: 0xe6f0f3, wall: 0x91d2e6, crate: 0xf1c780 } },
  { id: 'candy', name: '糖果仓库', caption: '丰富补给 · 炸箱发育', density: 0.48, floor: 0xf7e6e6, grout: 0xe2c3c6, ground: 0xf2dcea, bush: 0xe58fb6, wall: 0xee86c0, crate: 0xeeac5c, classic: { floor: 0xf5eaf1, wall: 0xdda8cd, crate: 0xf3ce95 } },
  { id: 'garden', name: '环形花园', caption: '环形通道 · 追击绕行', density: 0.25, floor: 0xeee8cf, grout: 0xcfc6a0, ground: 0xc7e3b0, bush: 0x58b04c, wall: 0x5cc79a, crate: 0xdfa25a, classic: { floor: 0xe5f1df, wall: 0x83bca4, crate: 0xe6c79a } },
  { id: 'factory', name: '十字工坊', caption: '十字干道 · 中央交锋', density: 0.35, floor: 0xe8e6e0, grout: 0xc4c0b6, ground: 0xd5dde4, bush: 0x7aa86a, wall: 0x7ea3cc, crate: 0xe39a45, classic: { floor: 0xe3e9ed, wall: 0x8eacc4, crate: 0xe8af62 } },
  { id: 'arena', name: '冠军竞技场', caption: '对称空场 · 决赛交锋', density: 0.16, floor: 0xf6ecd2, grout: 0xdcc79b, ground: 0xeadfbe, bush: 0x8cbf5a, wall: 0xf0bb3e, crate: 0xe5a352, classic: { floor: 0xf5f0df, wall: 0xcbb979, crate: 0xe5c98e } },
  { id: 'grove', name: '森林花园', caption: '树木成墙 · 草坪对战', density: 0.3, floor: 0x9fd46e, grout: 0x8a6a45, ground: 0x7fbf5a, bush: 0x3f9a45, wall: 0x2f9a55, crate: 0xe39a45, decor: 'forest', classic: { floor: 0xe3f2d6, wall: 0x7cbf7a, crate: 0xe8b46a } },
  { id: 'palace', name: '古韵庭院', caption: '石狮镇守 · 青石板路', density: 0.32, floor: 0x8a9ea6, grout: 0x6b4f3a, ground: 0xb7c2a6, bush: 0x5d8f4f, wall: 0xb8392c, crate: 0xd99a4e, decor: 'ancient', classic: { floor: 0xe6ebec, wall: 0xc06a5e, crate: 0xe8b46a } },
] as const;
export type MapId = typeof maps[number]['id'];
export const mapInfo = (id: MapId) => maps.find(m => m.id === id) ?? maps[0];
