// server/src/modules/abilities/executors/skills/celestial-expulsion.skill.ts
// CELESTIAL_EXPULSION (Expulsão Celestial) - Clérigo: Remove condições negativas do alvo

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "../../../../../../shared/types/ability.types";
import type { BattleUnit } from "../../../../../../shared/types/battle.types";

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

  const removedConditions: string[] = [];

  for (const condition of negativeConditions) {
    if (target.conditions.includes(condition)) {
      target.conditions = target.conditions.filter((c) => c !== condition);
      removedConditions.push(condition);
    }
  }

  return {
    success: true,
    conditionRemoved: removedConditions.join(", ") || "nenhuma",
  };
}
