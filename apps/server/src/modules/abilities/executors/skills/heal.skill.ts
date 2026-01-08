// server/src/modules/abilities/executors/skills/heal.skill.ts
// HEAL (Curar) - Clérigo: Cura aliado adjacente

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";

/**
 * CLERIC_HEAL: Cura aliado adjacente (Focus de HP)
 */
export function executeHeal(
  caster: BattleUnit,
  target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: AbilityDefinition
): AbilityExecutionResult {
  const healTarget = target || caster;

  if (healTarget.ownerId !== caster.ownerId) {
    return { success: false, error: "Só pode curar aliados" };
  }

  const healAmount = caster.focus;
  // Use stored maxHp instead of recalculating
  const oldHp = healTarget.currentHp;
  healTarget.currentHp = Math.min(
    healTarget.currentHp + healAmount,
    healTarget.maxHp
  );
  const actualHeal = healTarget.currentHp - oldHp;

  return {
    success: true,
    healAmount: actualHeal,
    targetHpAfter: healTarget.currentHp,
  };
}
