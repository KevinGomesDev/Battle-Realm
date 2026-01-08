// server/src/modules/abilities/executors/skills/magic-weapon.skill.ts
// MAGIC_WEAPON (Arma Mágica) - Mago: Imbuí a arma de uma Unidade adjacente com Magia

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import { isAdjacentOmnidirectional } from "@boundless/shared/utils/distance.utils";

/**
 * MAGIC_WEAPON: Imbuí a arma de uma Unidade adjacente com Magia
 * Até o fim do Combate, os Ataques dessa Unidade causam dano Mágico ao invés de Físico.
 */
export function executeMagicWeapon(
  caster: BattleUnit,
  target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: AbilityDefinition
): AbilityExecutionResult {
  if (!target) {
    return { success: false, error: "Requer um aliado adjacente" };
  }

  // Verificar se é adjacente
  if (
    !isAdjacentOmnidirectional(
      caster.posX,
      caster.posY,
      target.posX,
      target.posY
    )
  ) {
    return { success: false, error: "Alvo deve estar adjacente" };
  }

  // Verificar se é aliado (mesmo dono)
  if (target.ownerId !== caster.ownerId) {
    return { success: false, error: "Só pode ser usado em aliados" };
  }

  // Aplicar condição MAGIC_WEAPON ao alvo
  if (!target.conditions.includes("MAGIC_WEAPON")) {
    target.conditions.push("MAGIC_WEAPON");
  }

  return {
    success: true,
    conditionApplied: "MAGIC_WEAPON",
  };
}
