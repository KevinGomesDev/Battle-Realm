// server/src/modules/abilities/executors/skills/arcane-shield.skill.ts
// ARCANE_SHIELD (Escudo Arcano) - Mago: Redução de dano igual à metade do Foco

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "@boundless/shared/types/ability.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";

/**
 * ARCANE_SHIELD: Recebe Redução de Dano igual à metade do Foco até o próximo turno
 * Não gasta ação!
 */
export function executeArcaneShield(
  caster: BattleUnit,
  _target: BattleUnit | null,
  _allUnits: BattleUnit[],
  _skill: AbilityDefinition
): AbilityExecutionResult {
  // Calcular redução de dano = Focus / 2 (arredondado para baixo)
  const damageReduction = Math.floor(caster.focus / 2);

  // Aplicar condição ARCANE_SHIELD
  if (!caster.conditions.includes("ARCANE_SHIELD")) {
    caster.conditions.push("ARCANE_SHIELD");
  }

  // Armazenar o valor da redução no damageReduction da unidade
  // Nota: A condição ARCANE_SHIELD será processada no sistema de dano
  caster.damageReduction = (caster.damageReduction || 0) + damageReduction;

  return {
    success: true,
    conditionApplied: "ARCANE_SHIELD",
    healAmount: damageReduction, // Usar healAmount para indicar o valor da redução
  };
}
