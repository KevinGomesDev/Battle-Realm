// client/src/features/commands/utils/command-parser.ts
// Parser de comandos de chat para o cliente

import type {
  ParsedCommand,
  CommandPayload,
} from "@boundless/shared/types/commands.types";
import {
  findCommandByCode,
  ALL_COMMANDS,
} from "@boundless/shared/data/Templates/CommandsTemplates";

/**
 * Verifica se uma mensagem de chat é um comando
 */
export function isCommand(message: string): boolean {
  return message.trim().startsWith("/");
}

/**
 * Parseia uma mensagem de chat para identificar comandos
 */
export function parseCommand(message: string): ParsedCommand {
  const trimmed = message.trim();

  // Verificar se é um comando
  if (!trimmed.startsWith("/")) {
    return { isCommand: false };
  }

  // Extrair comando e argumentos
  const parts = trimmed.slice(1).split(/\s+/);
  const commandCode = parts[0]?.toLowerCase();
  const rawArgs = parts.slice(1);

  if (!commandCode) {
    return {
      isCommand: true,
      error: "Comando vazio",
    };
  }

  // Buscar definição do comando
  const commandDef = findCommandByCode(commandCode);
  if (!commandDef) {
    return {
      isCommand: true,
      commandCode,
      rawArgs,
      error: `Comando desconhecido: /${commandCode}`,
    };
  }

  // Parsear argumentos
  try {
    const parsedArgs = parseCommandArgs(commandDef, rawArgs);
    return {
      isCommand: true,
      commandCode,
      rawArgs,
      parsedArgs,
    };
  } catch (error) {
    return {
      isCommand: true,
      commandCode,
      rawArgs,
      error:
        error instanceof Error ? error.message : "Erro ao parsear argumentos",
    };
  }
}

/**
 * Parseia argumentos de um comando
 */
function parseCommandArgs(
  commandDef: {
    params: Array<{
      name: string;
      type: string;
      required: boolean;
      defaultValue?: unknown;
    }>;
  },
  rawArgs: string[]
): Record<string, number | string | boolean> {
  const parsed: Record<string, number | string | boolean> = {};

  for (let i = 0; i < commandDef.params.length; i++) {
    const param = commandDef.params[i];
    const rawValue = rawArgs[i];

    if (rawValue === undefined || rawValue === "") {
      // Usar valor padrão
      if (param.defaultValue !== undefined) {
        parsed[param.name] = param.defaultValue as number | string | boolean;
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

/**
 * Cria um payload de comando para enviar ao servidor
 */
export function createCommandPayload(
  parsed: ParsedCommand,
  selectedUnitId?: string
): CommandPayload | null {
  if (!parsed.isCommand || !parsed.commandCode || parsed.error) {
    return null;
  }

  return {
    commandCode: parsed.commandCode,
    args: parsed.parsedArgs || {},
    selectedUnitId,
  };
}

/**
 * Retorna lista de comandos disponíveis para autocomplete/ajuda
 */
export function getAvailableCommands(): Array<{
  code: string;
  name: string;
  usage: string;
  description: string;
}> {
  return ALL_COMMANDS.map((cmd) => ({
    code: cmd.code,
    name: cmd.name,
    usage: cmd.usage,
    description: cmd.description,
  }));
}

/**
 * Gera texto de ajuda para comandos
 */
export function getCommandsHelpText(): string {
  const lines = ["📜 Comandos disponíveis:", ""];

  for (const cmd of ALL_COMMANDS) {
    lines.push(`${cmd.usage}`);
    lines.push(`  └ ${cmd.description}`);
    lines.push("");
  }

  return lines.join("\n");
}
