import { resolve } from "node:path";
import { defineConfig, searchForWorkspaceRoot } from "vite";

export default defineConfig({
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), resolve("../../packages/game-common")] } },
});
