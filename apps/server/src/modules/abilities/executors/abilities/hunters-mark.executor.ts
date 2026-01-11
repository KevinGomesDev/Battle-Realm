// server/src/modules/abilities/executors/skills/hunters-mark.skill.ts
// HUNTERS_MARK (Marca do Caçador) - Ranger: Marca um inimigo

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import { applyConditionToUnit } from "../../../conditions/conditions";

/**
 * RANGER_HUNTERS_MARK: Marca um inimigo (+2 dano em ataques contra ele)
 */
export function executeHuntersMark(
  _caster: BattleUnit,
  target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: AbilityDefinition
): AbilityExecutionResult {
  if (!target) {
    return { success: false, error: "Requer um alvo" };
  }

  applyConditionToUnit(target, "HUNTERS_MARK");

  return {
    success: true,
    conditionApplied: "HUNTERS_MARK",
  };
}
