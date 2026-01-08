// server/src/modules/abilities/executors/skills/bless.skill.ts
// BLESS (Abençoar) - Clérigo: Aliados em área ganham BLESSED

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "../../../../../../shared/types/ability.types";
import { resolveDynamicValue } from "../../../../../../shared/types/ability.types";
import type { BattleUnit } from "../../../../../../shared/types/battle.types";
import { getManhattanDistance } from "../../../../../../shared/utils/distance.utils";

/**
 * CLERIC_BLESS: Aliados em área ganham BLESSED
 */
export function executeBless(
  caster: BattleUnit,
  _target: BattleUnit | null,
  allUnits: BattleUnit[],
  skill: AbilityDefinition
): AbilityExecutionResult {
  const radius = skill.rangeDistance
    ? resolveDynamicValue(skill.rangeDistance, caster)
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

    if (!unit.conditions.includes("BLESSED")) {
      unit.conditions.push("BLESSED");
      unitsBlessed++;
    }
  }

  return {
    success: true,
    conditionApplied: "BLESSED",
    damageDealt: unitsBlessed,
  };
}
