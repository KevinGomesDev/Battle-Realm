// Ações padrão importadas do shared (fonte de verdade)
import {
  findSkillByCode,
  getCommonActionCodes,
} from "@boundless/shared/data/abilities.data";

// Ações comuns disponíveis para todas unidades
const COMMON_ACTION_CODES = getCommonActionCodes();

// Re-exportar para compatibilidade com código existente
export { COMMON_ACTION_CODES as DEFAULT_UNIT_ACTIONS };

export interface UnitActionContext {
  battleType?: "battle" | "match";
  modifiers?: string[]; // Modificadores que podem alterar ações (futuro)
}

export interface UnitStats {
  combat: number;
  speed: number;
  focus: number;
  resistance: number;
  will: number;
  vitality: number;
  category?: string;
  features?: string[]; // IDs das skills aprendidas (do DB)
}

/**
 * Determina as features (skills) disponíveis para uma unidade
 * Inclui ações padrão (ATTACK, DASH, DODGE) + skills de classe
 */
export function determineUnitFeatures(
  unit: UnitStats,
  context?: UnitActionContext
): string[] {
  const features = [...COMMON_ACTION_CODES];

  // Adicionar skills de classe (ativas e passivas)
  if (unit.features && unit.features.length > 0) {
    for (const skillCode of unit.features) {
      if (!features.includes(skillCode)) {
        features.push(skillCode);
      }
    }
  }

  // Futuro: Modificadores podem adicionar ou remover features
  // Exemplo:
  // if (context?.modifiers?.includes("IMOBILIZADO")) {
  //   features = features.filter(a => a !== "DASH");
  // }

  return features;
}

// Alias para compatibilidade
export const determineUnitActions = determineUnitFeatures;
