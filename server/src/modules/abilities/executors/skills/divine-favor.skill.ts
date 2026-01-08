// server/src/modules/abilities/executors/skills/divine-favor.skill.ts
// DIVINE_FAVOR (Favor Divino) - Clérigo: Próximo ataque tem vantagem

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "../../../../../../shared/types/ability.types";
import type { BattleUnit } from "../../../../../../shared/types/battle.types";

/**
 * CLERIC_DIVINE_FAVOR: Próximo ataque tem vantagem
 */
export function executeDivineFavor(
  caster: BattleUnit,
  target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: AbilityDefinition
): AbilityExecutionResult {
  const effectTarget = target || caster;

  if (!effectTarget.conditions.includes("HELP_NEXT")) {
    effectTarget.conditions.push("HELP_NEXT");
  }

  return {
    success: true,
    conditionApplied: "HELP_NEXT",
  };
}
