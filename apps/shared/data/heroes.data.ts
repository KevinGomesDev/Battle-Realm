// shared/data/heroes.data.ts
// Definições de Heróis pré-criados (recrutáveis durante partidas)
// Heróis NÃO são criados pelo jogador - são templates fixos como reinos
// Re-exporta templates e fornece funções utilitárias

// Re-exportar tipos e templates
export type { HeroTemplate } from "../types/units.types";
export { HERO_TEMPLATES } from "./Templates/HeroesTemplates";

import { HERO_TEMPLATES } from "./Templates/HeroesTemplates";
import type { HeroTemplate } from "../types/units.types";

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Busca um herói pelo código
 */
export function getHeroTemplate(code: string): HeroTemplate | undefined {
  return HERO_TEMPLATES.find((h) => h.code === code);
}

/**
 * Lista heróis por classe
 */
export function getHeroesByClass(classCode: string): HeroTemplate[] {
  return HERO_TEMPLATES.filter((h) => h.classCode === classCode);
}

/**
 * Calcula o custo total de recrutamento de um herói
 */
export function getHeroTotalCost(hero: HeroTemplate): number {
  const cost = hero.recruitCost;
  return (
    (cost.ore || 0) +
    (cost.supplies || 0) +
    (cost.arcane || 0) +
    (cost.devotion || 0)
  );
}

/**
 * Retorna os atributos totais do herói (soma)
 */
export function getHeroTotalAttributes(hero: HeroTemplate): number {
  return (
    hero.combat +
    hero.speed +
    hero.focus +
    hero.resistance +
    hero.will +
    hero.vitality
  );
}

// =============================================================================
// CONFIGURAÇÕES DE XP E LEVEL UP
// =============================================================================

/**
 * Thresholds de XP para cada nível (XP necessário para ATINGIR o nível)
 * Nível 1 = 0 XP (inicial)
 * Nível 2 = 100 XP
 * etc.
 */
export const XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 100,
  3: 250,
  4: 450,
  5: 700,
  6: 1000,
  7: 1400,
  8: 1900,
  9: 2500,
  10: 3200,
};

/**
 * XP ganho por tipo de ação em batalha
 */
export const XP_REWARDS = {
  KILL_TROOP: 25, // Matar uma tropa inimiga
  KILL_HERO: 50, // Matar um herói inimigo
  KILL_REGENT: 100, // Matar o regente inimigo
  SURVIVE_BATTLE: 10, // Sobreviver à batalha
  WIN_BATTLE: 30, // Bônus por vencer a batalha
  DEAL_DAMAGE: 1, // Por ponto de dano causado
  HEAL_ALLY: 2, // Por ponto de cura em aliado
};

/**
 * Pontos de atributo ganhos por level up (por categoria de unidade)
 */
export const ATTRIBUTE_POINTS_PER_LEVEL: Record<string, number> = {
  TROOP: 2,
  HERO: 4,
  REGENT: 6,
};

/**
 * Calcula o nível baseado no XP atual
 */
export function calculateLevelFromXP(experience: number): number {
  let level = 1;
  for (const [lvl, threshold] of Object.entries(XP_THRESHOLDS)) {
    if (experience >= threshold) {
      level = parseInt(lvl);
    } else {
      break;
    }
  }
  return Math.min(level, 10); // Cap no nível 10
}

/**
 * Calcula XP restante para o próximo nível
 */
export function getXPToNextLevel(experience: number): number {
  const currentLevel = calculateLevelFromXP(experience);
  if (currentLevel >= 10) return 0; // Já no máximo

  const nextThreshold = XP_THRESHOLDS[currentLevel + 1] || 0;
  return Math.max(0, nextThreshold - experience);
}

/**
 * Verifica se uma unidade deve subir de nível
 */
export function shouldLevelUp(
  currentLevel: number,
  experience: number
): boolean {
  const calculatedLevel = calculateLevelFromXP(experience);
  return calculatedLevel > currentLevel;
}
