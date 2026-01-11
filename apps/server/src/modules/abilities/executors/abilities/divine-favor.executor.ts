// server/src/modules/abilities/executors/skills/divine-favor.skill.ts
// DIVINE_FAVOR (Favor Divino) - Clérigo: Próximo ataque tem vantagem

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import { applyConditionToUnit } from "../../../conditions/conditions";

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

  applyConditionToUnit(effectTarget, "HELP_NEXT");

  return {
    success: true,
    conditionApplied: "HELP_NEXT",
  };
}
