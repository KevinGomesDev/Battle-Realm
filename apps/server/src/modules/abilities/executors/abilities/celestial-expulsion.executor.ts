// server/src/modules/abilities/executors/skills/celestial-expulsion.skill.ts
// CELESTIAL_EXPULSION (Expulsão Celestial) - Clérigo: Remove condições negativas do alvo

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import { removeConditionsFromUnit } from "../../../conditions/conditions";

/**
 * CLERIC_CELESTIAL_EXPULSION: Remove condições negativas do alvo
 */
export function executeCelestialExpulsion(
  _caster: BattleUnit,
  target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: AbilityDefinition
): AbilityExecutionResult {
  if (!target) {
    return { success: false, error: "Requer um alvo" };
  }

  // Lista de condições negativas que podem ser removidas
  const negativeConditions = [
    "STUNNED",
    "FROZEN",
    "BURNING",
    "SLOWED",
    "FRIGHTENED",
    "POISONED",
    "BLEEDING",
    "GRAPPLED",
    "PRONE",
    "DISARMED",
    "HUNTERS_MARK",
  ];

  // Filtrar apenas as condições que o alvo possui
  const conditionsToRemove = negativeConditions.filter((c) =>
    target.conditions.includes(c)
  );

  // Remover usando função centralizada (atualiza activeEffects)
  removeConditionsFromUnit(target, conditionsToRemove);

  return {
    success: true,
    conditionRemoved: conditionsToRemove.join(", ") || "nenhuma",
  };
}
