// server/src/modules/abilities/executors/skills/dash.skill.ts
// DASH (Disparada) - Gasta uma ação para aplicar condição DASHING

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import {
  scanConditionsForAction,
  applyConditionScanResult,
  applyConditionToUnit,
} from "../../../conditions/conditions";

/**
 * DASH (Disparada): Gasta uma ação para aplicar condição DASHING
 * A condição DASHING aplica movimento extra = speed instantaneamente
 * e dura até o fim do turno atual
 */
export function executeDash(
  caster: BattleUnit,
  _target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: AbilityDefinition
): AbilityExecutionResult {
  const scan = scanConditionsForAction(caster.conditions, "DASH");
  if (!scan.canPerform) {
    return { success: false, error: scan.blockReason };
  }

  // Aplicar expiração de condições pela ação
  caster.conditions = applyConditionScanResult(caster.conditions, scan);

  // Aplicar condição DASHING - efeitos imediatos são aplicados automaticamente!
  const result = applyConditionToUnit(caster, "DASHING");

  return {
    success: true,
    movementGained: result.movementChange,
    conditionsApplied: result.wasAdded
      ? [{ targetId: caster.id, conditionId: "DASHING" }]
      : [],
  };
}
