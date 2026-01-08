// shared/data/summons.data.ts
// Templates de Invocações (Summons) - Criaturas invocadas por classes
// Re-exporta templates e fornece funções utilitárias

import { getCommonActionCodes } from "./abilities.data";
import type { SummonAIBehavior, SummonTemplate } from "../types/units.types";

// Re-exportar tipos e templates
export type { SummonAIBehavior, SummonTemplate } from "../types/units.types";
export { EIDOLON } from "./Templates/SummonsTemplates";

import { EIDOLON } from "./Templates/SummonsTemplates";

// =============================================================================
// REGISTRO DE TODOS OS SUMMONS
// =============================================================================

export const ALL_SUMMONS: SummonTemplate[] = [EIDOLON];

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Busca um template de invocação pelo código
 */
export function getSummonByCode(code: string): SummonTemplate | undefined {
  return ALL_SUMMONS.find((s) => s.code === code);
}

/**
 * Busca templates de invocação por classe invocadora
 */
export function getSummonsBySummoner(summonerClass: string): SummonTemplate[] {
  return ALL_SUMMONS.filter((s) => s.summoner === summonerClass);
}

/**
 * Cria stats base para uma invocação (usado ao criar BattleUnit)
 */
export function createSummonStats(
  code: string,
  bonusStats: number = 0
): {
  combat: number;
  speed: number;
  focus: number;
  resistance: number;
  will: number;
  vitality: number;
  damageReduction: number;
} | null {
  const template = getSummonByCode(code);
  if (!template) return null;

  return {
    combat: template.combat + bonusStats,
    speed: template.speed + bonusStats,
    focus: template.focus + bonusStats,
    resistance: template.resistance + bonusStats,
    will: template.will + bonusStats,
    vitality: template.vitality + bonusStats,
    damageReduction: template.damageReduction,
  };
}

/**
 * Obtém as ações de um summon (resolvendo os códigos)
 */
export function getSummonActions(code: string): string[] {
  const template = getSummonByCode(code);
  if (!template) return getCommonActionCodes();
  return template.actionCodes || getCommonActionCodes();
}
