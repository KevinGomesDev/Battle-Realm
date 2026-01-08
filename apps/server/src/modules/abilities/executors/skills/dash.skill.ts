// server/src/modules/abilities/executors/skills/dash.skill.ts
// DASH (Disparada) - Gasta uma ação para dobrar o movimento

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import {
  scanConditionsForAction,
  applyConditionScanResult,
} from "../../../conditions/conditions";
import { calculateBaseMovement } from "../../../combat/movement-actions";

/**
 * DASH (Disparada): Gasta uma ação para dobrar o movimento
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

  // Aplicar condições
  caster.conditions = applyConditionScanResult(caster.conditions, scan);

  // Adicionar movimento extra (igual ao movimento base)
  const extraMovement = calculateBaseMovement(caster.speed);
  caster.movesLeft = caster.movesLeft + extraMovement;

  return {
    success: true,
    movementGained: extraMovement,
  };
}
