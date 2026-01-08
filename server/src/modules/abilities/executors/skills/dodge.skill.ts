// server/src/modules/abilities/executors/skills/dodge.skill.ts
// DODGE (Esquiva) - Aumenta chance de esquiva até próximo turno

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "../../../../../../shared/types/ability.types";
import type { BattleUnit } from "../../../../../../shared/types/battle.types";
import {
  scanConditionsForAction,
  applyConditionScanResult,
} from "../../../conditions/conditions";

/**
 * DODGE (Esquiva): Aumenta chance de esquiva até próximo turno
 */
export function executeDodge(
  caster: BattleUnit,
  _target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: AbilityDefinition
): AbilityExecutionResult {
  const scan = scanConditionsForAction(caster.conditions, "DODGE");
  if (!scan.canPerform) {
    return { success: false, error: scan.blockReason };
  }

  // Aplicar condições
  caster.conditions = applyConditionScanResult(caster.conditions, scan);

  // Aplicar condição DODGING
  if (!caster.conditions.includes("DODGING")) {
    caster.conditions.push("DODGING");
  }

  return {
    success: true,
    conditionApplied: "DODGING",
  };
}
