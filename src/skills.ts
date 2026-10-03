export type ActiveSkill = 'invincible' | 'super' | 'dash' | 'rapid';
export type Reward = 'coin' | 'bomb' | 'flame' | 'speed' | 'shield' | 'life' | ActiveSkill;
export const rewardNames: Record<Reward, string> = {
  coin: '金币',
  bomb: '炸弹容量', flame: '爆炸范围', speed: '轻快鞋', shield: '护盾', life: '额外生命',
  invincible: '无敌泡泡', super: '超级炸弹', dash: '疾跑', rapid: '连发模式',
};
export const isActive = (kind: Reward): kind is ActiveSkill => ['invincible', 'super', 'dash', 'rapid'].includes(kind);
export const newSkills = () => ({ active: null as ActiveSkill | null, armed: false, shield: false, life: false, invincible: 0, dash: 0, rapid: 0, bombCooldown: 0, respawning: false });
