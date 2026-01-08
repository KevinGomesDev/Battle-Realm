// server/src/commands/executors/index.ts
// Barrel export para executores de comando

import type { CommandExecutorFn } from "../command-handler";
import { executeSpawnCommand } from "./spawn.executor";
import { executeGodmodeCommand } from "./godmode.executor";

// Re-exportar executores individuais
export { executeSpawnCommand } from "./spawn.executor";
export { executeGodmodeCommand } from "./godmode.executor";

/**
 * Mapa de executores de comando por nome da função
 */
export const COMMAND_EXECUTORS: Record<string, CommandExecutorFn> = {
  executeSpawnCommand,
  executeGodmodeCommand,
};
