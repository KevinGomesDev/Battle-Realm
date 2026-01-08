// server/src/modules/abilities/executors/helpers.ts
// Funções auxiliares compartilhadas entre executores

import type { BattleUnit } from "@boundless/shared/types/battle.types";
import {
  resolveDynamicValue,
  type DynamicValue,
} from "@boundless/shared/types/ability.types";
import { isAdjacentOmnidirectional } from "@boundless/shared/utils/distance.utils";

// =============================================================================
// SPELL HELPERS
// =============================================================================

/**
 * Resolve um valor dinâmico de spell com fallback
 */
export function resolveSpellValue(
  value: DynamicValue | undefined,
  caster: BattleUnit,
  fallback: number
): number {
  if (value === undefined) return fallback;
  return resolveDynamicValue(value, caster);
}

// =============================================================================
// EIDOLON HELPERS
// =============================================================================

/**
 * Verifica se uma unidade é o Eidolon de um invocador
 */
export function isEidolonOf(unit: BattleUnit, summoner: BattleUnit): boolean {
  return (
    unit.ownerId === summoner.ownerId &&
    unit.category === "SUMMON" &&
    unit.conditions.includes("EIDOLON_GROWTH")
  );
}

/**
 * Encontra o Eidolon de um invocador
 */
export function findEidolon(
  summoner: BattleUnit,
  allUnits: BattleUnit[]
): BattleUnit | undefined {
  return allUnits.find((u) => isEidolonOf(u, summoner) && u.isAlive);
}

/**
 * Verifica se um invocador está adjacente ao seu Eidolon
 */
export function isAdjacentToEidolon(
  summoner: BattleUnit,
  allUnits: BattleUnit[]
): boolean {
  const eidolon = findEidolon(summoner, allUnits);
  if (!eidolon) return false;

  return isAdjacentOmnidirectional(
    summoner.posX,
    summoner.posY,
    eidolon.posX,
    eidolon.posY
  );
}

/**
 * Processa o crescimento do Eidolon quando ele mata uma unidade
 * Retorna os novos stats bonus (para persistir na partida)
 */
export function processEidolonKill(
  eidolon: BattleUnit,
  currentBonus: number = 0
): { newBonus: number; statsGained: number } {
  // Import configs inline to avoid circular dependencies
  const {
    HP_CONFIG,
    MANA_CONFIG,
    PHYSICAL_PROTECTION_CONFIG,
    MAGICAL_PROTECTION_CONFIG,
  } = require("../../../../../shared/config");

  const statsGained = 1; // +1 em cada stat por kill
  const newBonus = currentBonus + statsGained;

  // Aplicar bônus imediatamente aos stats do Eidolon
  eidolon.combat += statsGained;
  eidolon.speed += statsGained;
  eidolon.focus += statsGained;
  eidolon.resistance += statsGained;
  eidolon.will += statsGained;
  eidolon.vitality += statsGained;

  // Aumentar HP máximo e atual usando configs
  const hpGain = statsGained * HP_CONFIG.multiplier;
  eidolon.maxHp += hpGain;
  eidolon.currentHp += hpGain;

  // Aumentar Mana máxima usando config
  const manaGain = statsGained * MANA_CONFIG.multiplier;
  eidolon.maxMana += manaGain;

  // Recalcular proteções máximas usando configs
  eidolon.maxPhysicalProtection =
    eidolon.resistance * PHYSICAL_PROTECTION_CONFIG.multiplier;
  eidolon.maxMagicalProtection =
    eidolon.will * MAGICAL_PROTECTION_CONFIG.multiplier;

  return { newBonus, statsGained };
}

/**
 * Reseta o Eidolon para stats base quando morre
 * Retorna os stats base para uso na próxima batalha
 */
export function resetEidolonOnDeath(): {
  combat: number;
  speed: number;
  focus: number;
  resistance: number;
  will: number;
  vitality: number;
} {
  // Stats base do Eidolon (de summons.data.ts)
  return {
    combat: 3,
    speed: 3,
    focus: 3,
    resistance: 3,
    will: 1,
    vitality: 3,
  };
}
