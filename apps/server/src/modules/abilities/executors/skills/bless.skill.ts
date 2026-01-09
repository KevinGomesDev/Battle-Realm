// server/src/modules/abilities/executors/skills/bless.skill.ts
// BLESS (Abençoar) - Clérigo: Aliados em área ganham BLESSED

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "@boundless/shared/types/ability.types";
import { resolveDynamicValue } from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import { getManhattanDistance } from "@boundless/shared/utils/distance.utils";
import { applyConditionToUnit } from "../../../conditions/conditions";

/**
 * CLERIC_BLESS: Aliados em área ganham BLESSED
 */
export function executeBless(
  caster: BattleUnit,
  _target: BattleUnit | null,
  allUnits: BattleUnit[],
  skill: AbilityDefinition
): AbilityExecutionResult {
  // Usar targetingPattern.maxRange como fonte de verdade
  const radius = skill.targetingPattern?.maxRange
    ? resolveDynamicValue(skill.targetingPattern.maxRange, caster)
    : 2;
  let unitsBlessed = 0;

  for (const unit of allUnits) {
    if (unit.ownerId !== caster.ownerId) continue;
    if (!unit.isAlive) continue;

    const distance = getManhattanDistance(
      caster.posX,
      caster.posY,
      unit.posX,
      unit.posY
    );
    if (distance > radius) continue;

    const result = applyConditionToUnit(unit, "BLESSED");
    if (result.wasAdded) {
      unitsBlessed++;
    }
  }

  return {
    success: true,
    conditionApplied: "BLESSED",
    damageDealt: unitsBlessed,
  };
}
