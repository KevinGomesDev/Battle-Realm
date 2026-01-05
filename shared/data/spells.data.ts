import type { SpellDefinition } from "../types/spells.types";

/**
 * 🌀 TELEPORT
 * Move instantaneamente para uma posição no alcance
 */
export const TELEPORT: SpellDefinition = {
  code: "TELEPORT",
  name: "Teleporte",
  description:
    "Move-se instantaneamente para uma posição dentro do alcance, ignorando obstáculos e unidades.",
  range: "RANGED",
  targetType: "POSITION",
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
    "Lança uma bola de fogo em uma posição, causando dano mágico a todas as unidades na área (3x3). Dano baseado no Focus do conjurador.",
  range: "RANGED",
  targetType: "POSITION",
  functionName: "executeFire",
  icon: "🔥",
  color: "red",
  cooldown: 2,
  manaCost: 8,
};

/**
 * ⚡ EMPOWER
 * Potencializa unidade adjacente temporariamente
 */
export const EMPOWER: SpellDefinition = {
  code: "EMPOWER",
  name: "Potencializar",
  description:
    "Potencializa uma unidade adjacente, aumentando todos os seus atributos em 50% do seu Focus até o começo do próximo turno. Após o efeito, aplica penalidade pela mesma duração.",
  range: "ADJACENT",
  targetType: "ALLY",
  functionName: "executeEmpower",
  icon: "⚡",
  color: "yellow",
  cooldown: 4,
  manaCost: 6,
};

/**
 * Lista completa de spells disponíveis no sistema
 */
export const ALL_SPELLS: SpellDefinition[] = [TELEPORT, FIRE, EMPOWER];

/**
 * Mapa de spells por código para acesso rápido
 */
export const SPELL_MAP: Record<string, SpellDefinition> = ALL_SPELLS.reduce(
  (acc, spell) => {
    acc[spell.code] = spell;
    return acc;
  },
  {} as Record<string, SpellDefinition>
);

/**
 * Obtém uma spell pelo código
 */
export function getSpellByCode(code: string): SpellDefinition | undefined {
  return SPELL_MAP[code];
}

/**
 * Ícones das spells para visualização
 */
export const SPELL_ICONS: Record<string, string> = {
  TELEPORT: "🌀",
  FIRE: "🔥",
  EMPOWER: "⚡",
};

/**
 * Cores das spells para UI
 */
export const SPELL_COLORS: Record<string, string> = {
  TELEPORT: "cyan",
  FIRE: "red",
  EMPOWER: "yellow",
};
