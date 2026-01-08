// server/src/commands/index.ts
// Barrel export para o sistema de comandos

export {
  handleCommand,
  parseCommandArgs,
  setCommandExecutors,
  type CommandExecutionContext,
  type CommandExecutorFn,
} from "./command-handler";

export {
  COMMAND_EXECUTORS,
  executeSpawnCommand,
  executeGodmodeCommand,
} from "./executors/index";

// Inicializar executores no boot
import { setCommandExecutors } from "./command-handler";
import { COMMAND_EXECUTORS } from "./executors/index";
setCommandExecutors(COMMAND_EXECUTORS);
