// server/src/modules/abilities/executors/skills/turn-undead.skill.ts
// TURN_UNDEAD (Expulsar Mortos-Vivos) - Clérigo: Aplica FRIGHTENED em inimigos adjacentes

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "../../../../../../shared/types/ability.types";
import type { BattleUnit } from "../../../../../../shared/types/battle.types";
import { isAdjacentOmnidirectional } from "../../../../../../shared/utils/distance.utils";

/**
 * CLERIC_TURN_UNDEAD: Aplica FRIGHTENED em inimigos adjacentes
 */
export function executeTurnUndead(
  caster: BattleUnit,
  _target: BattleUnit | null,
  allUnits: BattleUnit[],
  _skill: AbilityDefinition
): AbilityExecutionResult {
  const affectedUnits: BattleUnit[] = [];

  for (const unit of allUnits) {
    if (unit.ownerId === caster.ownerId) continue;
    if (!unit.isAlive) continue;
    if (
      !isAdjacentOmnidirectional(caster.posX, caster.posY, unit.posX, unit.posY)
    )
      continue;

    if (!unit.conditions.includes("FRIGHTENED")) {
      unit.conditions.push("FRIGHTENED");
      affectedUnits.push(unit);
    }
  }

  return {
    success: true,
    conditionApplied: "FRIGHTENED",
    damageDealt: affectedUnits.length,
  };
}
