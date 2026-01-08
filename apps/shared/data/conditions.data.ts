// shared/data/conditions.data.ts
// FONTE DE VERDADE para todas as definições de condições do jogo
// Este arquivo é compartilhado entre Frontend e Backend
// Re-exporta templates e fornece funções utilitárias

import type {
  ConditionDefinition,
  ConditionInfo,
} from "../types/conditions.types";

// Re-exportar todos os templates de condições
export {
  COMBAT_CONDITIONS,
  SKILL_CONDITIONS,
  SPELL_CONDITIONS,
  RACE_CONDITIONS,
} from "./Templates/ConditionsTemplates";

import {
  COMBAT_CONDITIONS,
  SKILL_CONDITIONS,
  SPELL_CONDITIONS,
  RACE_CONDITIONS,
} from "./Templates/ConditionsTemplates";

// =============================================================================
// TODAS AS CONDIÇÕES UNIFICADAS
// =============================================================================

/**
 * Mapa completo de todas as condições do jogo
 * Esta é a ÚNICA fonte de verdade para definições de condições
 */
export const CONDITIONS: Record<string, ConditionDefinition> = {
  ...COMBAT_CONDITIONS,
  ...SKILL_CONDITIONS,
  ...SPELL_CONDITIONS,
  ...RACE_CONDITIONS,
};

// =============================================================================
// FUNÇÕES HELPER
// =============================================================================

/**
 * Gera as informações visuais de todas as condições para o frontend
 */
export function getConditionsInfo(): Record<string, ConditionInfo> {
  const info: Record<string, ConditionInfo> = {};
  for (const [key, value] of Object.entries(CONDITIONS)) {
    info[key] = {
      icon: value.icon || "❓",
      name: value.name,
      description: value.description,
      color: value.color || "#6b7280",
    };
  }
  return info;
}

/**
 * Obtém informação visual de uma condição específica
 */
export function getConditionInfo(conditionId: string): ConditionInfo {
  const cond = CONDITIONS[conditionId];
  if (!cond) {
    return {
      icon: "❓",
      name: conditionId,
      description: "Condição desconhecida",
      color: "#6b7280",
    };
  }
  return {
    icon: cond.icon || "❓",
    name: cond.name,
    description: cond.description,
    color: cond.color || "#6b7280",
  };
}

/**
 * Obtém uma definição de condição por ID
 */
export function getCondition(
  conditionId: string
): ConditionDefinition | undefined {
  return CONDITIONS[conditionId];
}

/**
 * Verifica se uma condição existe
 */
export function hasConditionDefinition(conditionId: string): boolean {
  return conditionId in CONDITIONS;
}

/**
 * Helper para obter mapa de cores das condições
 */
export function getConditionColorsMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [key, value] of Object.entries(CONDITIONS)) {
    if (value.color) {
      map[key] = value.color;
    }
  }
  return map;
}

/**
 * Constante legada mantida para compatibilidade - gerada a partir de CONDITIONS
 */
export const CONDITIONS_INFO: Record<string, ConditionInfo> =
  getConditionsInfo();

// =============================================================================
// FUNÇÕES ESPECÍFICAS DE SKILL CONDITIONS
// =============================================================================

/**
 * Obtém uma condição de skill pelo ID
 */
export function getSkillCondition(
  conditionId: string
): ConditionDefinition | undefined {
  return SKILL_CONDITIONS[conditionId];
}

/**
 * Verifica se uma condição é de skill passiva
 */
export function isSkillCondition(conditionId: string): boolean {
  return conditionId in SKILL_CONDITIONS;
}

/**
 * Lista todas as condições permanentes (de passivas)
 */
export function getPermanentSkillConditions(): ConditionDefinition[] {
  return Object.values(SKILL_CONDITIONS).filter(
    (c) => c.expiry === "permanent"
  );
}

/**
 * Obtém os efeitos de uma condição de skill
 */
export function getSkillConditionEffects(
  conditionId: string
): ConditionDefinition["effects"] | undefined {
  return SKILL_CONDITIONS[conditionId]?.effects;
}
