// server/src/modules/abilities/executors/skills/second-wind.skill.ts
// SECOND_WIND (Retomar Fôlego) - Guerreiro: Recupera HP igual à Vitalidade

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "../../../../../../shared/types/ability.types";
import type { BattleUnit } from "../../../../../../shared/types/battle.types";

/**
 * WARRIOR_SECOND_WIND: Recupera HP igual à Vitalidade
 * Cooldown: 1 vez por batalha (tratado via metadata ou condição especial)
 */
export function executeSecondWind(
  caster: BattleUnit,
  _target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: AbilityDefinition
): AbilityExecutionResult {
  const healAmount = caster.vitality;
  // Use stored maxHp instead of recalculating
  const oldHp = caster.currentHp;
  caster.currentHp = Math.min(caster.currentHp + healAmount, caster.maxHp);
  const actualHeal = caster.currentHp - oldHp;

  return {
    success: true,
    healAmount: actualHeal,
  };
}
