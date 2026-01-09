// server/src/modules/abilities/executors/skills/volley.skill.ts
// VOLLEY (Rajada) - Ranger: Ataca todos os inimigos em área

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import type { SkillExecutionContext } from "../types";
import { applyDamage } from "../../../combat/damage.utils";
import { processUnitDeath } from "../../../combat/death-logic";
import { getEnemiesInArea } from "../helpers";

/**
 * RANGER_VOLLEY: Ataca todos os inimigos em área com metade do dano
 * Usa o sistema padronizado de targeting
 */
export function executeVolley(
  caster: BattleUnit,
  target: BattleUnit | null,
  allUnits: BattleUnit[],
  skill: AbilityDefinition,
  context?: SkillExecutionContext
): AbilityExecutionResult {
  // Determinar centro da área: targetPosition ou posição do target
  const centerX = context?.targetPosition?.x ?? target?.posX;
  const centerY = context?.targetPosition?.y ?? target?.posY;

  if (centerX === undefined || centerY === undefined) {
    return { success: false, error: "Requer uma posição ou alvo" };
  }

  const pattern = skill.targetingPattern;
  if (!pattern) {
    return {
      success: false,
      error: "Skill VOLLEY não tem targetingPattern definido",
    };
  }

  // Grid dimensions from context or defaults
  const gridWidth = context?.gridWidth ?? 20;
  const gridHeight = context?.gridHeight ?? 15;
  const obstacles = context?.obstacles ?? [];

  // Usar sistema padronizado para encontrar inimigos na área
  const enemies = getEnemiesInArea(
    pattern,
    caster,
    centerX,
    centerY,
    allUnits,
    obstacles,
    gridWidth,
    gridHeight
  );

  const baseDamage = Math.floor(caster.combat / 2);
  let totalDamage = 0;
  let unitsHit = 0;
  const targetIds: string[] = [];

  // Atacar unidades na área
  for (const unit of enemies) {
    // Dano físico - usar sistema de proteção dual
    const damageResult = applyDamage(
      unit.physicalProtection,
      unit.magicalProtection,
      unit.currentHp,
      baseDamage,
      "FISICO"
    );
    unit.physicalProtection = damageResult.newPhysicalProtection;
    unit.magicalProtection = damageResult.newMagicalProtection;
    unit.currentHp = damageResult.newHp;
    totalDamage += baseDamage;

    if (unit.currentHp <= 0) {
      processUnitDeath(unit, allUnits, caster, "battle", context?.battleId);
    }

    targetIds.push(unit.id);
    unitsHit++;
  }

  return {
    success: true,
    damageDealt: totalDamage,
    targetIds,
  };
}
