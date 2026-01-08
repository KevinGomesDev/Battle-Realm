// shared/data/Templates/CommandsTemplates.ts
// Templates de comandos de batalha

import type { CommandDefinition } from "../../types/commands.types";

// =============================================================================
// SPAWN - Cria unidades inimigas aleatórias
// =============================================================================

export const SPAWN_COMMAND: CommandDefinition = {
  code: "spawn",
  name: "Spawn",
  description:
    "Cria unidades inimigas aleatórias em posições aleatórias da batalha",
  usage: "/spawn [quantidade]",
  allowedContexts: ["BATTLE"],
  requiresSelectedUnit: false,
  executorName: "executeSpawnCommand",
  params: [
    {
      name: "quantity",
      type: "number",
      required: false,
      defaultValue: 1,
      description: "Quantidade de unidades a criar (padrão: 1)",
    },
  ],
};

// =============================================================================
// GODMODE - Ações infinitas na unidade selecionada
// =============================================================================

export const GODMODE_COMMAND: CommandDefinition = {
  code: "godmode",
  name: "God Mode",
  description:
    "Concede ações infinitas à unidade selecionada (99 ações, movimentos e ataques)",
  usage: "/godmode",
  allowedContexts: ["BATTLE"],
  requiresSelectedUnit: true,
  executorName: "executeGodmodeCommand",
  params: [],
};

// =============================================================================
// LISTA DE TODOS OS COMANDOS
// =============================================================================

export const ALL_COMMANDS: CommandDefinition[] = [
  SPAWN_COMMAND,
  GODMODE_COMMAND,
];

// =============================================================================
// MAPA DE COMANDOS POR CÓDIGO
// =============================================================================

export const COMMANDS_MAP: Record<string, CommandDefinition> =
  ALL_COMMANDS.reduce((map, cmd) => {
    map[cmd.code] = cmd;
    return map;
  }, {} as Record<string, CommandDefinition>);

// =============================================================================
// HELPER: Buscar comando por código
// =============================================================================

export function findCommandByCode(code: string): CommandDefinition | undefined {
  return COMMANDS_MAP[code.toLowerCase()];
}
