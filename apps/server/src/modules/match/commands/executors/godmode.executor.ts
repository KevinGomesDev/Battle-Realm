// server/src/commands/executors/godmode.executor.ts
// Executor do comando /godmode - Ações infinitas na unidade selecionada

import type {
  CommandExecutorFn,
  CommandExecutionContext,
} from "../command-handler";
import type { CommandResult } from "@boundless/shared/types/commands.types";

/**
 * Executor do comando /godmode
 * Concede ações, movimentos e ataques "infinitos" (99) à unidade selecionada
 */
export const executeGodmodeCommand: CommandExecutorFn = (
  context: CommandExecutionContext,
  _args: Record<string, number | string | boolean>
): CommandResult => {
  const { selectedUnit } = context;

  // O handler já valida a unidade selecionada, mas verificamos por segurança
  if (!selectedUnit) {
    return {
      success: false,
      message: "Nenhuma unidade selecionada para aplicar godmode",
    };
  }

  if (!selectedUnit.isAlive) {
    return {
      success: false,
      message: "A unidade selecionada está morta",
    };
  }

  // Valores "infinitos" (99 é mais que suficiente para qualquer batalha)
  const INFINITE_VALUE = 99;

  // Aplicar godmode
  selectedUnit.actionsLeft = INFINITE_VALUE;
  selectedUnit.movesLeft = INFINITE_VALUE;
  selectedUnit.attacksLeftThisTurn = INFINITE_VALUE;
  selectedUnit.actionMarks = INFINITE_VALUE;

  // Restaurar HP e Mana também (bônus do godmode)
  selectedUnit.currentHp = selectedUnit.maxHp;
  selectedUnit.currentMana = selectedUnit.maxMana;
  selectedUnit.physicalProtection = selectedUnit.maxPhysicalProtection;
  selectedUnit.magicalProtection = selectedUnit.maxMagicalProtection;

  // Limpar cooldowns
  selectedUnit.unitCooldowns.clear();

  return {
    success: true,
    message: `⚡ GODMODE ativado em ${selectedUnit.name}! (99 ações/movimentos/ataques, HP/Mana cheios)`,
    data: {
      unitId: selectedUnit.id,
      unitName: selectedUnit.name,
      actionsLeft: INFINITE_VALUE,
      movesLeft: INFINITE_VALUE,
      attacksLeftThisTurn: INFINITE_VALUE,
    },
  };
};
