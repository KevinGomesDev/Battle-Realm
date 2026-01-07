// shared/data/Templates/SpellsTemplates.ts
// Templates raw de todas as spells do jogo

import type { SpellDefinition } from "../../types/spells.types";
import { ATTRIBUTE, DEFAULT_RANGE_DISTANCE } from "../../types/ability.types";

// =============================================================================
// SPELLS INDIVIDUAIS (para export nomeado)
// =============================================================================

/**
 * 🌀 TELEPORT
 * Move instantaneamente para uma posição no alcance
 * rangeDistance usa SPEED da unidade (valor dinâmico)
 */
export const TELEPORT: SpellDefinition = {
  code: "TELEPORT",
  name: "Teleporte",
  description:
    "Move-se instantaneamente para uma posição dentro do alcance (baseado em Speed), ignorando obstáculos e unidades.",
  range: "RANGED",
  rangeDistance: ATTRIBUTE.SPEED, // Alcance = Speed da unidade
  targetType: "POSITION",
  effectType: "UTILITY",
  functionName: "executeTeleport",
  icon: "🌀",
  color: "cyan",
  cooldown: 3,
  manaCost: 5,
};

/**
 * 🔥 FIRE
 * Causa dano mágico em área
 */
export const FIRE: SpellDefinition = {
  code: "FIRE",
  name: "Fogo",
  description:
    "Lança uma bola de fogo em uma posição, causando dano mágico a todas as unidades na área (3x3).",
  range: "RANGED",
  rangeDistance: DEFAULT_RANGE_DISTANCE.RANGED,
  targetType: "POSITION",
  effectType: "OFFENSIVE",
  functionName: "executeFire",
  icon: "🔥",
  color: "red",
  cooldown: 2,
  manaCost: 8,
  areaSize: 3,
  baseDamage: ATTRIBUTE.FOCUS, // Dano base = Focus do caster
  damageMultiplier: 0.5, // +50% do Focus adicional
};

/**
 * ⚡ EMPOWER
 * Potencializa unidade adjacente temporariamente
 */
export const EMPOWER: SpellDefinition = {
  code: "EMPOWER",
  name: "Potencializar",
  description:
    "Potencializa uma unidade adjacente, aumentando todos os seus atributos em 50% do seu Focus até o começo do próximo turno.",
  range: "MELEE",
  rangeDistance: DEFAULT_RANGE_DISTANCE.MELEE,
  targetType: "UNIT",
  effectType: "BUFF",
  functionName: "executeEmpower",
  icon: "⚡",
  color: "yellow",
  cooldown: 4,
  manaCost: 6,
  conditionApplied: "EMPOWERED",
  conditionDuration: 1,
};

// =============================================================================
// ARRAY DE TODAS AS SPELLS
// =============================================================================

export const SPELL_TEMPLATES: SpellDefinition[] = [TELEPORT, FIRE, EMPOWER];
