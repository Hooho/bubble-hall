// Game adapter only. Persistence and transfer implementations live in common.
import { createEnvelopeStore } from '../../../../packages/game-common/src/storage/envelope-store';
export { checksum, type Envelope } from '../../../../packages/game-common/src/storage/envelope-store';
export function createSaveStore<T>(key: string, validate: (value: unknown) => value is T, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage) {
  return createEnvelopeStore({ key, gameId: 'bubble-hall', codePrefix: 'BUBBLE-SAVE-V1', validate, storage });
}
