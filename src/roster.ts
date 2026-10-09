import sharedIdentities from "../../../packages/game-common/players/identities.json";
export const identities = sharedIdentities;
export type Personality = 'brave' | 'careful' | 'collector';
export const roster = identities.map((identity, index) => ({
  id: String(identity.id), name: identity.name,
  personality: (['brave', 'careful', 'collector'] as const)[index % 3],
  intelligence: 1 + ((identity.id * 7 + index) % 5),
  color: [0xe15c70, 0x27a6d9, 0x6378d8, 0x42b69a, 0xd9a330][index % 5],
}));
export type Contestant = typeof roster[number];
export const playerName = (id: string) => id === 'player' ? '你' : roster.find(p => p.id === id)?.name ?? '未知选手';
export const personalityName = { brave: '追击型', careful: '生存型', collector: '收集型' };
export const playerAvatar = (id: string): string => `${import.meta.env?.BASE_URL ?? '/'}shared-players/${identities.find(p => String(p.id) === id)?.avatar ?? `avatars/${id.padStart(3,'0')}.webp`}`;
