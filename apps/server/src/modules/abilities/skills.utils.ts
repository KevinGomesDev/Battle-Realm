// src/modules/abilities/skills.utils.ts
// Utilitários para o sistema de habilidades - usando dados estáticos
// Todas as habilidades usam Mana (da unidade) como recurso

import type { AbilityDefinition } from "@boundless/shared/types/ability.types";
import { getAbilityCost } from "@boundless/shared/types/ability.types";
import { getAbilityMaxRange } from "@boundless/shared/utils/ability-validation";
import {
  HERO_CLASSES,
  getClassByCode,
  getAbilityByCode,
  getAbilitiesForClass,
  getAllClassesSummary,
} from "@boundless/shared/data/abilities.data";

// ================
// Ability Functions (usando dados estáticos)
// ================

/**
 * Obtém detalhes completos de uma habilidade
 */
export function getAbilityDefinition(
  abilityCode: string
): AbilityDefinition | null {
  const result = getAbilityByCode(abilityCode);
  return result ? result.ability : null;
}

/**
 * Obtém o custo de mana de uma habilidade
 */
export function getManaCost(ability: AbilityDefinition): number {
  return getAbilityCost(ability);
}

// Re-exportar funções de dados para conveniência
export {
  getClassByCode,
  getAbilityByCode,
  getAbilitiesForClass,
  getAllClassesSummary,
  getAbilityMaxRange,
};
