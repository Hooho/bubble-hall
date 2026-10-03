// Framework-free persistence contract inspired by DEZHOU: version, revision,
// checksum, backup and expected-revision conflict detection. No game/UI imports.
export type Envelope<T> = { version: 1; revision: number; savedAt: string; checksum: string; data: T };
export const checksum = (text: string): string => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0).toString(16); };
export function createSaveStore<T>(key: string, validate: (value: unknown) => value is T, storage: Storage = localStorage) {
  const parse = (raw: string): Envelope<T> => {
    if (raw.length > 5_000_000) throw new Error('存档过大');
    const e = JSON.parse(raw) as Envelope<unknown>;
    if (e.version !== 1 || !Number.isSafeInteger(e.revision) || e.revision < 0 || !validate(e.data) || e.checksum !== checksum(JSON.stringify(e.data))) throw new Error('存档损坏或版本不兼容');
    return e as Envelope<T>;
  };
  const load = (): Envelope<T> | null => { const raw = storage.getItem(key); return raw ? parse(raw) : null; };
  const write = async (data: T, expectedRevision: number): Promise<Envelope<T>> => {
    const operation = () => {
      if (!validate(data)) throw new Error('存档数据校验失败');
      const current = load();
      if ((current?.revision ?? 0) !== expectedRevision) throw new Error('另一个标签页已更新存档，请刷新后继续；本页已暂停');
      const e: Envelope<T> = { version: 1, revision: expectedRevision + 1, savedAt: new Date().toISOString(), checksum: checksum(JSON.stringify(data)), data };
      if (current) storage.setItem(`${key}:backup`, JSON.stringify(current));
      storage.setItem(key, JSON.stringify(e)); return e;
    };
    return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request(`${key}:write`, operation) : operation();
  };
  // Recovery is explicit and only replaces an unreadable save. Preserve its raw
  // bytes for diagnosis; never replace a healthy newer revision silently.
  const recover = async (data: T): Promise<Envelope<T>> => {
    const operation = () => {
      if (!validate(data)) throw new Error('恢复数据校验失败');
      const raw = storage.getItem(key);
      if (raw) {
        let healthy = false;
        try { parse(raw); healthy = true; } catch { /* Explicit recovery path. */ }
        if (healthy) throw new Error('当前存档有效，请刷新后再导入，避免覆盖其他标签页');
        storage.setItem(`${key}:damaged`, raw);
      }
      const e: Envelope<T> = { version: 1, revision: 1, savedAt: new Date().toISOString(), checksum: checksum(JSON.stringify(data)), data };
      storage.setItem(key, JSON.stringify(e));
      return e;
    };
    return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request(`${key}:write`, operation) : operation();
  };
  return { key, load, parse, write, recover, backup: () => { const raw = storage.getItem(`${key}:backup`); return raw ? parse(raw) : null; } };
}
