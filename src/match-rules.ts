// All modes (quick match and future tournament rounds) use this scoring contract.
export const MATCH_RULES = { duration: 120, hitPoints: 100, cratePoints: 10, coinPoints: 5 } as const;
/** Selectable round lengths (设置 → 每局时长); 120 s stays the default. */
export const MATCH_DURATIONS = [60, 120, 180] as const;
export const matchDuration = (seconds: unknown): number => (MATCH_DURATIONS as readonly unknown[]).includes(seconds) ? seconds as number : MATCH_RULES.duration;
