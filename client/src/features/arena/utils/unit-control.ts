import type { BattleUnit } from "../../../../../shared/types";

/**
 * Categorias de unidades controladas por IA (não pelo jogador)
 */
const AI_CONTROLLED_CATEGORIES = ["SUMMON", "MONSTER"];

/**
 * Verifica se uma unidade é controlada por IA
 * Unidades SUMMON e MONSTER são controladas pela IA do servidor
 */
export function isAIControlledUnit(unit: BattleUnit): boolean {
  const category = unit.category?.toUpperCase() || "";
  return AI_CONTROLLED_CATEGORIES.includes(category);
}

/**
 * Verifica se uma unidade pode ser controlada pelo jogador
 * Retorna true apenas se a unidade:
 * 1. Pertence ao jogador (ownerId === userId)
 * 2. NÃO é controlada por IA (não é SUMMON/MONSTER)
 */
export function isPlayerControllable(
  unit: BattleUnit,
  userId: string
): boolean {
  return unit.ownerId === userId && !isAIControlledUnit(unit);
}

/**
 * Filtra unidades que o jogador pode controlar
 */
export function getControllableUnits(
  units: BattleUnit[],
  userId: string
): BattleUnit[] {
  return units.filter((u) => isPlayerControllable(u, userId) && u.isAlive);
}
