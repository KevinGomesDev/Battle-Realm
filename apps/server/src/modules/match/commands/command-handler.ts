// server/src/commands/command-handler.ts
// Handler central para processamento de comandos de batalha

import type { BattleSessionState } from "../../battle/colyseus/schemas";
import type { BattleUnitSchema } from "../../battle/colyseus/schemas";
import type {
  CommandPayload,
  CommandResult,
  CommandDefinition,
} from "../../../../../shared/types/commands.types";
import {
  findCommandByCode,
  COMMANDS_MAP,
} from "../../../../../shared/data/Templates/CommandsTemplates";

// Forward declaration - será importado pelo index
let COMMAND_EXECUTORS: Record<string, CommandExecutorFn> = {};

export function setCommandExecutors(
  executors: Record<string, CommandExecutorFn>
) {
  COMMAND_EXECUTORS = executors;
}

/**
 * Contexto de execução passado para os executores de comando
 */
export interface CommandExecutionContext {
  /** Estado da batalha */
  battleState: BattleSessionState;
  /** ID do usuário que executou o comando */
  userId: string;
  /** Unidade selecionada (se aplicável) */
  selectedUnit: BattleUnitSchema | null;
  /** Largura do grid */
  gridWidth: number;
  /** Altura do grid */
  gridHeight: number;
}

/**
 * Tipo da função executora de comando
 */
export type CommandExecutorFn = (
  context: CommandExecutionContext,
  args: Record<string, number | string | boolean>
) => CommandResult;

/**
 * Handler principal para processar comandos
 */
export function handleCommand(
  payload: CommandPayload,
  context: CommandExecutionContext
): CommandResult {
  const { commandCode, args, selectedUnitId } = payload;

  // Buscar definição do comando
  const commandDef = findCommandByCode(commandCode);
  if (!commandDef) {
    return {
      success: false,
      message: `Comando desconhecido: /${commandCode}`,
    };
  }

  // Verificar se o comando requer unidade selecionada
  if (commandDef.requiresSelectedUnit) {
    if (!selectedUnitId) {
      return {
        success: false,
        message: `O comando /${commandCode} requer uma unidade selecionada`,
      };
    }

    // Buscar a unidade selecionada
    const selectedUnit = context.battleState.units.get(selectedUnitId);
    if (!selectedUnit) {
      return {
        success: false,
        message: `Unidade selecionada não encontrada`,
      };
    }

    context.selectedUnit = selectedUnit;
  }

  // Buscar executor
  const executor = COMMAND_EXECUTORS[commandDef.executorName];
  if (!executor) {
    return {
      success: false,
      message: `Executor não implementado para /${commandCode}`,
    };
  }

  // Executar comando
  try {
    return executor(context, args);
  } catch (error) {
    console.error(`[Command] Erro ao executar /${commandCode}:`, error);
    return {
      success: false,
      message: `Erro ao executar /${commandCode}: ${
        error instanceof Error ? error.message : "Erro desconhecido"
      }`,
    };
  }
}

/**
 * Valida e parseia argumentos do comando
 */
export function parseCommandArgs(
  commandDef: CommandDefinition,
  rawArgs: string[]
): Record<string, number | string | boolean> {
  const parsed: Record<string, number | string | boolean> = {};

  for (let i = 0; i < commandDef.params.length; i++) {
    const param = commandDef.params[i];
    const rawValue = rawArgs[i];

    if (rawValue === undefined || rawValue === "") {
      // Usar valor padrão
      if (param.defaultValue !== undefined) {
        parsed[param.name] = param.defaultValue;
      } else if (param.required) {
        throw new Error(`Parâmetro obrigatório ausente: ${param.name}`);
      }
    } else {
      // Converter para o tipo correto
      switch (param.type) {
        case "number":
          const num = parseInt(rawValue, 10);
          if (isNaN(num)) {
            throw new Error(`${param.name} deve ser um número`);
          }
          parsed[param.name] = num;
          break;
        case "boolean":
          parsed[param.name] =
            rawValue.toLowerCase() === "true" || rawValue === "1";
          break;
        case "string":
        default:
          parsed[param.name] = rawValue;
          break;
      }
    }
  }

  return parsed;
}
