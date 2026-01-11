// server/src/modules/abilities/executors/spells/empower.spell.ts
// EMPOWER - Potencializa unidade adjacente temporariamente

import type {
  AbilityDefinition,
  AbilityExecutionResult,
  AbilityExecutionContext,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import { resolveSpellValue } from "../helpers";
import { applyConditionToUnit } from "../../../conditions/conditions";

/**
 * ⚡ EMPOWER - Potencializa unidade adjacente temporariamente
 * Nota: Validação de alcance e tipo de alvo já foi feita em validateSpellUse()
 */
export function executeEmpower(
  caster: BattleUnit,
  target: BattleUnit | { x: number; y: number } | null,
  _allUnits: BattleUnit[],
  spell: AbilityDefinition,
  _context?: AbilityExecutionContext
): AbilityExecutionResult {
  // Validação: target deve ser uma unidade
  if (!target || !("id" in target)) {
    return {
      success: false,
      error: "Potencializar requer uma unidade como alvo",
    };
  }

  const targetUnit = target as BattleUnit;

  // Resolver duração da condição (pode ser dinâmica)
  const duration = resolveSpellValue(spell.conditionDuration, caster, 1);

  // Aplicar condição EMPOWERED
  applyConditionToUnit(targetUnit, "EMPOWERED");

  // Valor do boost baseado no Focus do conjurador
  const boostValue = Math.floor(caster.focus / 2);

  return {
    success: true,
    conditionsApplied: [
      {
        targetId: targetUnit.id,
        conditionId: "EMPOWERED",
      },
    ],
  };
}
