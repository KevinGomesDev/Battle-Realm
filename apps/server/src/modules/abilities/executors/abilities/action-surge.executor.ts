// server/src/modules/abilities/executors/skills/action-surge.skill.ts
// ACTION_SURGE (Surto de Ação) - Guerreiro: Ganha uma ação extra

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";

/**
 * WARRIOR_ACTION_SURGE: Ganha uma ação extra (NÃO consome ação)
 */
export function executeActionSurge(
  caster: BattleUnit,
  _target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: AbilityDefinition
): AbilityExecutionResult {
  // Ganha uma ação extra (consumesAction=false na definição)
  caster.actionsLeft += 1;

  return {
    success: true,
    actionsGained: 1,
  };
}
