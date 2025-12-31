// server/src/data/skills.data.ts
// Definições estáticas de todas as skills do jogo
// FONTE DE VERDADE para habilidades de classes

import type { SkillDefinition } from "../../../shared/types/skills.types";

// =============================================================================
// BÁRBARO - Skills (PHYSICAL / FOOD)
// =============================================================================

export const BARBARIAN_WILD_FURY: SkillDefinition = {
  code: "BARBARIAN_WILD_FURY",
  name: "Fúria Selvagem",
  description:
    "Todo dano recebido reduzido em 1. Ataques têm mínimo 2 de acertos. Duplicado sem Proteção.",
  category: "PASSIVE",
  conditionApplied: "WILD_FURY",
};

export const BARBARIAN_RECKLESS_ATTACK: SkillDefinition = {
  code: "BARBARIAN_RECKLESS_ATTACK",
  name: "Ataque Descuidado",
  description: "Sem Proteção: Pode atacar 2x quando usa Ação de Ataque.",
  category: "PASSIVE",
  conditionApplied: "RECKLESS_ATTACK",
};

export const BARBARIAN_TOTAL_DESTRUCTION: SkillDefinition = {
  code: "BARBARIAN_TOTAL_DESTRUCTION",
  name: "Destruição Total",
  description:
    "Escolha dano de 1 até seu Combate em alvo adjacente. Você recebe o mesmo dano.",
  category: "ACTIVE",
  costTier: "LOW",
  range: "ADJACENT",
  targetType: "ENEMY",
  functionName: "executeTotalDestruction",
};

export const BARBARIAN_SKILLS: SkillDefinition[] = [
  BARBARIAN_WILD_FURY,
  BARBARIAN_RECKLESS_ATTACK,
  BARBARIAN_TOTAL_DESTRUCTION,
];

// =============================================================================
// GUERREIRO - Skills (PHYSICAL / FOOD)
// =============================================================================

export const WARRIOR_EXTRA_ATTACK: SkillDefinition = {
  code: "WARRIOR_EXTRA_ATTACK",
  name: "Ataque Extra",
  description:
    "Quando usa a Ação de Ataque, você pode realizar um ataque a mais.",
  category: "PASSIVE",
  conditionApplied: "EXTRA_ATTACK",
};

export const WARRIOR_SECOND_WIND: SkillDefinition = {
  code: "WARRIOR_SECOND_WIND",
  name: "Retomar Fôlego",
  description:
    "Recupera HP igual à sua Vitalidade. Pode ser usado uma vez por batalha.",
  category: "ACTIVE",
  costTier: "LOW",
  range: "SELF",
  functionName: "executeSecondWind",
};

export const WARRIOR_ACTION_SURGE: SkillDefinition = {
  code: "WARRIOR_ACTION_SURGE",
  name: "Surto de Ação",
  description: "Você recebe uma ação extra em seu turno.",
  category: "ACTIVE",
  costTier: "MEDIUM",
  range: "SELF",
  functionName: "executeActionSurge",
};

export const WARRIOR_SKILLS: SkillDefinition[] = [
  WARRIOR_EXTRA_ATTACK,
  WARRIOR_SECOND_WIND,
  WARRIOR_ACTION_SURGE,
];

// =============================================================================
// LADINO - Skills (PHYSICAL / FOOD)
// =============================================================================

export const ROGUE_SNEAK_ATTACK: SkillDefinition = {
  code: "ROGUE_SNEAK_ATTACK",
  name: "Ataque Furtivo",
  description:
    "Causa +3 de dano ao atacar um inimigo que não te viu ou que está flanqueado.",
  category: "PASSIVE",
  conditionApplied: "SNEAK_ATTACK",
};

export const ROGUE_CUNNING_ACTION: SkillDefinition = {
  code: "ROGUE_CUNNING_ACTION",
  name: "Ação Ardilosa",
  description: "Pode usar Dash, Disengage ou Hide como ação bônus.",
  category: "PASSIVE",
  conditionApplied: "CUNNING_ACTION",
};

export const ROGUE_ASSASSINATE: SkillDefinition = {
  code: "ROGUE_ASSASSINATE",
  name: "Assassinar",
  description:
    "Primeiro ataque em combate contra alvo que não agiu causa dano dobrado.",
  category: "PASSIVE",
  conditionApplied: "ASSASSINATE",
};

export const ROGUE_SKILLS: SkillDefinition[] = [
  ROGUE_SNEAK_ATTACK,
  ROGUE_CUNNING_ACTION,
  ROGUE_ASSASSINATE,
];

// =============================================================================
// PATRULHEIRO - Skills (PHYSICAL / FOOD)
// =============================================================================

export const RANGER_HUNTERS_MARK: SkillDefinition = {
  code: "RANGER_HUNTERS_MARK",
  name: "Marca do Caçador",
  description:
    "Marca um inimigo. Todos os seus ataques contra ele causam +2 de dano.",
  category: "ACTIVE",
  costTier: "LOW",
  range: "RANGED",
  rangeValue: 6,
  targetType: "ENEMY",
  functionName: "executeHuntersMark",
};

export const RANGER_NATURAL_EXPLORER: SkillDefinition = {
  code: "RANGER_NATURAL_EXPLORER",
  name: "Explorador Natural",
  description:
    "+2 de movimento em terrenos naturais. Não sofre penalidades de terreno difícil.",
  category: "PASSIVE",
  conditionApplied: "NATURAL_EXPLORER",
};

export const RANGER_VOLLEY: SkillDefinition = {
  code: "RANGER_VOLLEY",
  name: "Rajada",
  description: "Ataca todos os inimigos em uma área com metade do dano normal.",
  category: "ACTIVE",
  costTier: "MEDIUM",
  range: "AREA",
  rangeValue: 2,
  targetType: "ENEMY",
  functionName: "executeVolley",
};

export const RANGER_SKILLS: SkillDefinition[] = [
  RANGER_HUNTERS_MARK,
  RANGER_NATURAL_EXPLORER,
  RANGER_VOLLEY,
];

// =============================================================================
// CLÉRIGO - Skills (SPIRITUAL / DEVOTION)
// =============================================================================

export const CLERIC_HEAL: SkillDefinition = {
  code: "CLERIC_HEAL",
  name: "Curar",
  description: "Cura um aliado adjacente em 1d6 + Foco de HP.",
  category: "ACTIVE",
  costTier: "LOW",
  range: "ADJACENT",
  targetType: "ALLY",
  functionName: "executeHeal",
};

export const CLERIC_CELESTIAL_EXPULSION: SkillDefinition = {
  code: "CLERIC_CELESTIAL_EXPULSION",
  name: "Expulsão Celestial",
  description:
    "Você e aliados adjacentes não podem ser afetados por Maldições.",
  category: "PASSIVE",
  conditionApplied: "CELESTIAL_EXPULSION",
};

export const CLERIC_BLESS: SkillDefinition = {
  code: "CLERIC_BLESS",
  name: "Abençoar",
  description: "Aliados em área ganham +1 em todos os testes por 3 turnos.",
  category: "ACTIVE",
  costTier: "MEDIUM",
  range: "AREA",
  rangeValue: 2,
  targetType: "ALLY",
  functionName: "executeBless",
};

export const CLERIC_SKILLS: SkillDefinition[] = [
  CLERIC_HEAL,
  CLERIC_CELESTIAL_EXPULSION,
  CLERIC_BLESS,
];

// =============================================================================
// MAGO - Skills (ARCANE / ARCANA)
// =============================================================================

export const WIZARD_ARCANE_MASTERY: SkillDefinition = {
  code: "WIZARD_ARCANE_MASTERY",
  name: "Maestria Arcana",
  description:
    "Pode conjurar qualquer magia arcana. +1 dado em todos os testes de Foco.",
  category: "PASSIVE",
  conditionApplied: "ARCANE_MASTERY",
};

export const WIZARD_FIREBALL: SkillDefinition = {
  code: "WIZARD_FIREBALL",
  name: "Bola de Fogo",
  description: "Causa 2d6 de dano de fogo em todos os alvos em uma área.",
  category: "ACTIVE",
  costTier: "MEDIUM",
  range: "AREA",
  rangeValue: 3,
  targetType: "ALL",
  functionName: "executeFireball",
};

export const WIZARD_TELEPORT: SkillDefinition = {
  code: "WIZARD_TELEPORT",
  name: "Teleportar",
  description: "Teleporta para qualquer posição dentro do alcance.",
  category: "ACTIVE",
  costTier: "HIGH",
  range: "RANGED",
  rangeValue: 6,
  targetType: "SELF",
  functionName: "executeTeleport",
};

export const WIZARD_SKILLS: SkillDefinition[] = [
  WIZARD_ARCANE_MASTERY,
  WIZARD_FIREBALL,
  WIZARD_TELEPORT,
];

// =============================================================================
// TODAS AS SKILLS (para busca rápida)
// =============================================================================

export const ALL_SKILLS: SkillDefinition[] = [
  ...BARBARIAN_SKILLS,
  ...WARRIOR_SKILLS,
  ...ROGUE_SKILLS,
  ...RANGER_SKILLS,
  ...CLERIC_SKILLS,
  ...WIZARD_SKILLS,
];

/**
 * Busca uma skill pelo código
 */
export function findSkillByCode(code: string): SkillDefinition | undefined {
  return ALL_SKILLS.find((s) => s.code === code);
}

/**
 * Lista todas as skills passivas (que aplicam condições)
 */
export function getPassiveSkills(): SkillDefinition[] {
  return ALL_SKILLS.filter((s) => s.category === "PASSIVE");
}

/**
 * Lista todas as skills ativas (que são ações)
 */
export function getActiveSkills(): SkillDefinition[] {
  return ALL_SKILLS.filter((s) => s.category === "ACTIVE");
}
