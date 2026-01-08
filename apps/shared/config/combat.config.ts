// shared/config/combat.config.ts
// Configuração do sistema de combate

import type { UnitAttributes } from "./attributes.config";
import { getAttributeValue } from "./attributes.config";
import { type UnitCategory } from "../types/units.types";

// =============================================================================
// CONFIGURAÇÃO DE ATAQUE
// =============================================================================

export const ATTACK_CONFIG = {
  attribute: "combat" as const,
  damageMultiplier: 0,
  minDice: 1,
} as const;

// =============================================================================
// CONFIGURAÇÃO DE DEFESA
// =============================================================================

export const DEFENSE_CONFIG = {
  attribute: "speed" as const,
  dodgeMultiplier: 1,
  maxDodgeChance: 75,
} as const;

// =============================================================================
// CONFIGURAÇÃO DE PROTEÇÕES
// =============================================================================

export const PHYSICAL_PROTECTION_CONFIG = {
  attribute: "resistance" as const,
  multiplier: 2,
  absorbsDamageTypes: ["FISICO"] as const,
} as const;

export const MAGICAL_PROTECTION_CONFIG = {
  attribute: "will" as const,
  multiplier: 2,
  absorbsDamageTypes: ["MAGICO"] as const,
} as const;

// =============================================================================
// CONFIGURAÇÃO DE MANA
// =============================================================================

export const MANA_CONFIG = {
  attribute: "will" as const,
  multiplier: 1,
} as const;

// =============================================================================
// CONFIGURAÇÃO DE HP
// =============================================================================

export const HP_CONFIG = {
  attribute: "vitality" as const,
  multiplier: 1,
} as const;

// =============================================================================
// CONFIGURAÇÃO DE MOVIMENTO
// =============================================================================

export const MOVEMENT_CONFIG = {
  attribute: "speed" as const,
  divisor: 1,
  minMovement: 1,
} as const;

// =============================================================================
// DANO DE MAGIA
// =============================================================================

export type MagicDamageTier = "LOW" | "MEDIUM" | "HIGH";

export const MAGIC_DAMAGE_CONFIG: Record<MagicDamageTier, number> = {
  LOW: 2,
  MEDIUM: 2,
  HIGH: 2,
} as const;

export function calculateMagicDamage(
  focus: number,
  tier: MagicDamageTier
): number {
  return Math.floor(focus * MAGIC_DAMAGE_CONFIG[tier]);
}

// =============================================================================
// ACTION MARKS (EXAUSTÃO)
// =============================================================================

export const ACTION_MARKS_CONFIG: Record<UnitCategory, number> = {
  TROOP: 1,
  HERO: 2,
  REGENT: 3,
  SUMMON: 1,
  MONSTER: 2,
} as const;

export function getMaxMarksByCategory(category: string): number {
  return ACTION_MARKS_CONFIG[category as UnitCategory] ?? 1;
}

// =============================================================================
// TIPOS DE DANO
// =============================================================================

export const DAMAGE_TYPES = {
  FISICO: {
    name: "Físico",
    usesProtection: "physical" as const,
  },
  MAGICO: {
    name: "Mágico",
    usesProtection: "magical" as const,
  },
  VERDADEIRO: {
    name: "Verdadeiro",
    usesProtection: null,
  },
} as const;

export type DamageTypeName = keyof typeof DAMAGE_TYPES;

// =============================================================================
// CONFIGURAÇÃO DE TURNO
// =============================================================================

export const TURN_CONFIG = {
  timerSeconds: 1200,
} as const;

// =============================================================================
// HELPERS DE CÁLCULO
// =============================================================================

export function getDodgeChance(unit: UnitAttributes): number {
  const speed = getAttributeValue(unit, "speed");
  return Math.min(
    DEFENSE_CONFIG.maxDodgeChance,
    speed * DEFENSE_CONFIG.dodgeMultiplier
  );
}

export function calculateDamage(unit: UnitAttributes): number {
  const attrValue = getAttributeValue(unit, ATTACK_CONFIG.attribute);
  return Math.max(1, attrValue);
}

export function calculatePhysicalProtection(unit: UnitAttributes): number {
  const attrValue = getAttributeValue(
    unit,
    PHYSICAL_PROTECTION_CONFIG.attribute
  );
  return Math.max(0, attrValue * PHYSICAL_PROTECTION_CONFIG.multiplier);
}

export function calculateMagicalProtection(unit: UnitAttributes): number {
  const attrValue = getAttributeValue(
    unit,
    MAGICAL_PROTECTION_CONFIG.attribute
  );
  return Math.max(0, attrValue * MAGICAL_PROTECTION_CONFIG.multiplier);
}

export function calculateMaxHp(unit: UnitAttributes): number {
  const attrValue = getAttributeValue(unit, HP_CONFIG.attribute);
  return Math.max(1, attrValue * HP_CONFIG.multiplier);
}

export function calculateMovement(unit: UnitAttributes): number {
  const attrValue = getAttributeValue(unit, MOVEMENT_CONFIG.attribute);
  const movement = Math.floor(attrValue / MOVEMENT_CONFIG.divisor);
  return Math.max(MOVEMENT_CONFIG.minMovement, movement);
}

export function calculateMaxMana(unit: UnitAttributes): number {
  const attrValue = getAttributeValue(unit, MANA_CONFIG.attribute);
  return Math.max(0, attrValue * MANA_CONFIG.multiplier);
}
