// server/src/modules/abilities/executors/skills/total-destruction.skill.ts
// TOTAL_DESTRUCTION (Destruição Total) - Bárbaro: Dano igual ao Combat em alvo adjacente, recebe o mesmo dano

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import type { SkillExecutionContext } from "../types";
import { applyDamage } from "../../../combat/damage.utils";
import { processUnitDeath } from "../../../combat/death-logic";

/**
 * BARBARIAN_TOTAL_DESTRUCTION: Dano igual ao Combat em alvo adjacente, recebe o mesmo dano
 * Dano físico - usa sistema de proteção dual
 */
export function executeTotalDestruction(
  caster: BattleUnit,
  target: BattleUnit | null,
  allUnits: BattleUnit[],
  _skill: AbilityDefinition,
  context?: SkillExecutionContext
): AbilityExecutionResult {
  if (!target) {
    return { success: false, error: "Requer um alvo" };
  }

  const damage = caster.combat;

  // Aplicar dano físico no alvo usando sistema de proteção dual
  const targetResult = applyDamage(
    target.physicalProtection,
    target.magicalProtection,
    target.currentHp,
    damage,
    "FISICO"
  );
  target.physicalProtection = targetResult.newPhysicalProtection;
  target.magicalProtection = targetResult.newMagicalProtection;
  target.currentHp = targetResult.newHp;

  const targetDefeated = target.currentHp <= 0;
  if (targetDefeated) {
    processUnitDeath(target, allUnits, caster, "battle", context?.battleId);
  }

  // Aplicar mesmo dano físico no caster usando sistema de proteção dual
  const casterResult = applyDamage(
    caster.physicalProtection,
    caster.magicalProtection,
    caster.currentHp,
    damage,
    "FISICO"
  );
  caster.physicalProtection = casterResult.newPhysicalProtection;
  caster.magicalProtection = casterResult.newMagicalProtection;
  caster.currentHp = casterResult.newHp;

  if (caster.currentHp <= 0) {
    processUnitDeath(caster, allUnits, null, "battle", context?.battleId);
  }

  return {
    success: true,
    damageDealt: damage,
    targetHpAfter: target.currentHp,
    targetDefeated,
  };
}
