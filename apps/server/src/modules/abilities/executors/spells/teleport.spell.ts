// server/src/modules/abilities/executors/spells/teleport.spell.ts
// TELEPORT - Move instantaneamente para uma posição

import type {
  AbilityDefinition,
  AbilityExecutionResult,
  AbilityExecutionContext,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import { getUnitSizeDefinition, type UnitSize } from "@boundless/shared/config";

/**
 * 🌀 TELEPORT - Move instantaneamente para uma posição
 * Nota: Validação de alcance já foi feita em validateSpellUse()
 */
export function executeTeleport(
  caster: BattleUnit,
  target: BattleUnit | { x: number; y: number } | null,
  allUnits: BattleUnit[],
  _spell: AbilityDefinition,
  _context?: AbilityExecutionContext
): AbilityExecutionResult {
  // Validação: target deve ser uma posição
  if (!target || "id" in target) {
    return {
      success: false,
      error: "Teleporte requer uma posição válida como alvo",
    };
  }

  const position = target as { x: number; y: number };

  // Validação específica: verificar se a posição não está ocupada (considerando tamanho)
  let occupied = false;
  for (const u of allUnits) {
    if (!u.isAlive) continue;
    const sizeDef = getUnitSizeDefinition(u.size as UnitSize);
    const dimension = sizeDef.dimension;
    for (let dx = 0; dx < dimension; dx++) {
      for (let dy = 0; dy < dimension; dy++) {
        if (u.posX + dx === position.x && u.posY + dy === position.y) {
          occupied = true;
          break;
        }
      }
      if (occupied) break;
    }
    if (occupied) break;
  }
  if (occupied) {
    return {
      success: false,
      error: "Posição ocupada por outra unidade",
    };
  }

  // Executar teleporte
  const from = { x: caster.posX, y: caster.posY };
  caster.posX = position.x;
  caster.posY = position.y;

  return {
    success: true,
    unitsMoved: [
      {
        unitId: caster.id,
        from,
        to: position,
      },
    ],
  };
}
