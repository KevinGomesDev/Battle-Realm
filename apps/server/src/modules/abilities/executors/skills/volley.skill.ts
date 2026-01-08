// server/src/modules/abilities/executors/skills/volley.skill.ts
// VOLLEY (Rajada) - Ranger: Ataca todos os inimigos em área

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "../../../../../../shared/types/ability.types";
import { resolveDynamicValue } from "../../../../../../shared/types/ability.types";
import type { BattleUnit } from "../../../../../../shared/types/battle.types";
import type { SkillExecutionContext } from "../types";
import { getManhattanDistance } from "../../../../../../shared/utils/distance.utils";
import { applyDamage } from "../../../combat/damage.utils";
import { processUnitDeath } from "../../../combat/death-logic";

/**
 * RANGER_VOLLEY: Ataca todos os inimigos em área com metade do dano
 * Pode atingir obstáculos destrutíveis na área
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

  const baseDamage = Math.floor(caster.combat / 2);
  // Resolver areaSize dinamicamente (pode ser número ou atributo)
  const areaSize = skill.areaSize
    ? resolveDynamicValue(skill.areaSize, caster)
    : 3;
  const radius = Math.floor(areaSize / 2); // Ex: 3x3 = radius 1
  let totalDamage = 0;
  let unitsHit = 0;
  const obstaclesDestroyed: string[] = [];

  // Atacar unidades na área
  for (const unit of allUnits) {
    if (unit.ownerId === caster.ownerId) continue;
    if (!unit.isAlive) continue;

    const distance = getManhattanDistance(
      centerX,
      centerY,
      unit.posX,
      unit.posY
    );
    // Checar se está dentro do quadrado de área (não Manhattan para área quadrada)
    if (
      Math.abs(unit.posX - centerX) > radius ||
      Math.abs(unit.posY - centerY) > radius
    )
      continue;

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

    unitsHit++;
  }

  // Atacar obstáculos destrutíveis na área
  if (context?.obstacles) {
    for (const obstacle of context.obstacles) {
      if (obstacle.destroyed) continue;

      // Checar se está dentro da área
      if (
        Math.abs(obstacle.posX - centerX) > radius ||
        Math.abs(obstacle.posY - centerY) > radius
      )
        continue;

      // Aplicar dano ao obstáculo
      obstacle.hp = (obstacle.hp ?? 0) - baseDamage;
      if (obstacle.hp <= 0) {
        obstacle.destroyed = true;
        obstaclesDestroyed.push(obstacle.id);
      }
    }
  }

  return {
    success: true,
    damageDealt: totalDamage,
  };
}
