import { copyPlayers } from '../../../packages/game-common/src/publishing/copy-players.mjs';

copyPlayers(new URL('../public/shared-players/', import.meta.url));
