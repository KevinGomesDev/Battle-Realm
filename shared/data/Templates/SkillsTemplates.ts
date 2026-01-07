// shared/data/Templates/SkillsTemplates.ts
// Templates raw de todas as skills do jogo

import type { SkillDefinition } from "../../types/skills.types";

// =============================================================================
// BÁRBARO - Skills (PHYSICAL / FOOD)
// =============================================================================

export const WILD_FURY: SkillDefinition = {
  code: "WILD_FURY",
  name: "Fúria Selvagem",
  description:
    "Todo dano recebido reduzido em 1. Ataques têm mínimo 2 de acertos. Duplicado sem Proteção.",
  category: "PASSIVE",
  conditionApplied: "WILD_FURY",
};

export const RECKLESS_ATTACK: SkillDefinition = {
  code: "RECKLESS_ATTACK",
  name: "Ataque Descuidado",
  description: "Sem Proteção: Pode atacar 2x quando usa Ação de Ataque.",
  category: "PASSIVE",
  conditionApplied: "RECKLESS_ATTACK",
};

export const TOTAL_DESTRUCTION: SkillDefinition = {
  code: "TOTAL_DESTRUCTION",
  name: "Destruição Total",
  description:
    "Escolha dano de 1 até seu Combate em alvo adjacente. Você recebe o mesmo dano.",
  category: "ACTIVE",
  effectType: "OFFENSIVE",
  costTier: "LOW",
  range: "ADJACENT",
  targetType: "UNIT",
  functionName: "executeTotalDestruction",
  consumesAction: true,
  cooldown: 0,
};

export const BARBARIAN_SKILLS: SkillDefinition[] = [
  WILD_FURY,
  RECKLESS_ATTACK,
  TOTAL_DESTRUCTION,
];

// =============================================================================
// GUERREIRO - Skills (PHYSICAL / FOOD)
// =============================================================================

export const EXTRA_ATTACK: SkillDefinition = {
  code: "EXTRA_ATTACK",
  name: "Ataque Extra",
  description:
    "Quando usa a Ação de Ataque, você pode realizar um ataque a mais.",
  category: "PASSIVE",
  conditionApplied: "EXTRA_ATTACK",
};

export const SECOND_WIND: SkillDefinition = {
  code: "SECOND_WIND",
  name: "Retomar Fôlego",
  description:
    "Recupera HP igual à sua Vitalidade. Pode ser usado uma vez por batalha.",
  category: "ACTIVE",
  effectType: "HEALING",
  costTier: "LOW",
  range: "SELF",
  functionName: "executeSecondWind",
  consumesAction: true,
  cooldown: 999, // Uma vez por batalha
};

export const ACTION_SURGE: SkillDefinition = {
  code: "ACTION_SURGE",
  name: "Surto de Ação",
  description: "Você recebe uma ação extra em seu turno.",
  category: "ACTIVE",
  effectType: "BUFF",
  costTier: "MEDIUM",
  range: "SELF",
  functionName: "executeActionSurge",
  consumesAction: false, // NÃO consome ação!
  cooldown: 3,
};

export const WARRIOR_SKILLS: SkillDefinition[] = [
  EXTRA_ATTACK,
  SECOND_WIND,
  ACTION_SURGE,
];

// =============================================================================
// LADINO - Skills (PHYSICAL / FOOD)
// =============================================================================

export const SNEAK_ATTACK: SkillDefinition = {
  code: "SNEAK_ATTACK",
  name: "Ataque Furtivo",
  description:
    "Causa +3 de dano ao atacar um inimigo que não te viu ou que está flanqueado.",
  category: "PASSIVE",
  conditionApplied: "SNEAK_ATTACK",
};

export const CUNNING_ACTION: SkillDefinition = {
  code: "CUNNING_ACTION",
  name: "Ação Ardilosa",
  description: "Pode usar Dash, Disengage ou Hide como ação bônus.",
  category: "PASSIVE",
  conditionApplied: "CUNNING_ACTION",
};

export const ASSASSINATE: SkillDefinition = {
  code: "ASSASSINATE",
  name: "Assassinar",
  description:
    "Primeiro ataque em combate contra alvo que não agiu causa dano dobrado.",
  category: "PASSIVE",
  conditionApplied: "ASSASSINATE",
};

export const ROGUE_SKILLS: SkillDefinition[] = [
  SNEAK_ATTACK,
  CUNNING_ACTION,
  ASSASSINATE,
];

// =============================================================================
// PATRULHEIRO - Skills (PHYSICAL / FOOD)
// =============================================================================

export const HUNTERS_MARK: SkillDefinition = {
  code: "HUNTERS_MARK",
  name: "Marca do Caçador",
  description:
    "Marca um inimigo. Todos os seus ataques contra ele causam +2 de dano.",
  category: "ACTIVE",
  effectType: "DEBUFF",
  costTier: "LOW",
  range: "RANGED",
  rangeValue: 6,
  targetType: "UNIT",
  functionName: "executeHuntersMark",
  consumesAction: true,
  cooldown: 0,
};

export const NATURAL_EXPLORER: SkillDefinition = {
  code: "NATURAL_EXPLORER",
  name: "Explorador Natural",
  description:
    "+2 de movimento em terrenos naturais. Não sofre penalidades de terreno difícil.",
  category: "PASSIVE",
  conditionApplied: "NATURAL_EXPLORER",
};

export const VOLLEY: SkillDefinition = {
  code: "VOLLEY",
  name: "Rajada",
  description: "Ataca todos os inimigos em uma área com metade do dano normal.",
  category: "ACTIVE",
  effectType: "OFFENSIVE",
  costTier: "MEDIUM",
  range: "AREA",
  rangeValue: 2,
  areaSize: 3, // 3x3 área de efeito
  targetType: "UNIT",
  functionName: "executeVolley",
  consumesAction: true,
  cooldown: 2,
  icon: "🏹",
  color: "green",
};

export const RANGER_SKILLS: SkillDefinition[] = [
  HUNTERS_MARK,
  NATURAL_EXPLORER,
  VOLLEY,
];

// =============================================================================
// CLÉRIGO - Skills (SPIRITUAL / DEVOTION)
// =============================================================================

export const HEAL: SkillDefinition = {
  code: "HEAL",
  name: "Curar",
  description: "Cura um aliado adjacente em Foco de HP.",
  category: "ACTIVE",
  effectType: "HEALING",
  costTier: "LOW",
  range: "ADJACENT",
  targetType: "UNIT",
  functionName: "executeHeal",
  consumesAction: true,
  cooldown: 1,
};

export const CELESTIAL_EXPULSION: SkillDefinition = {
  code: "CELESTIAL_EXPULSION",
  name: "Expulsão Celestial",
  description: "Remove condições negativas do alvo.",
  category: "ACTIVE",
  effectType: "HEALING",
  costTier: "MEDIUM",
  range: "ADJACENT",
  targetType: "UNIT",
  functionName: "executeCelestialExpulsion",
  consumesAction: true,
  cooldown: 2,
};

export const BLESS: SkillDefinition = {
  code: "BLESS",
  name: "Abençoar",
  description: "Aliados em área ganham +1 em todos os testes por 3 turnos.",
  category: "ACTIVE",
  effectType: "BUFF",
  costTier: "MEDIUM",
  range: "AREA",
  rangeValue: 2,
  areaSize: 3, // 3x3 área de efeito
  targetType: "UNIT",
  functionName: "executeBless",
  consumesAction: true,
  cooldown: 3,
  icon: "✨",
  color: "gold",
};

export const CLERIC_SKILLS: SkillDefinition[] = [
  HEAL,
  CELESTIAL_EXPULSION,
  BLESS,
];

// =============================================================================
// MAGO - Skills (ARCANE / ARCANA)
// =============================================================================

export const GRIMOIRE: SkillDefinition = {
  code: "GRIMOIRE",
  name: "Grimório",
  description:
    "Você possui um Livro de Magias que ocupa todos seus Slots de Equipamentos. Sempre que uma Unidade conjurar uma magia visível, você a aprende permanentemente.",
  category: "PASSIVE",
  conditionApplied: "GRIMOIRE",
};

export const MAGIC_WEAPON: SkillDefinition = {
  code: "MAGIC_WEAPON",
  name: "Arma Mágica",
  description:
    "Imbuí a arma de uma Unidade adjacente com Magia. Até o fim do Combate, os Ataques dessa Unidade causam dano Mágico ao invés de Físico.",
  category: "ACTIVE",
  effectType: "BUFF",
  costTier: "MEDIUM",
  range: "ADJACENT",
  targetType: "UNIT",
  functionName: "executeMagicWeapon",
  consumesAction: true,
};

export const ARCANE_SHIELD: SkillDefinition = {
  code: "ARCANE_SHIELD",
  name: "Escudo Arcano",
  description:
    "Até o começo do seu próximo turno, sempre que receberia dano no HP, sua Mana é reduzida no lugar.",
  category: "ACTIVE",
  effectType: "BUFF",
  costTier: "MEDIUM",
  range: "SELF",
  targetType: "SELF",
  functionName: "executeArcaneShield",
  consumesAction: false, // Não gasta ação
};

export const WIZARD_SKILLS: SkillDefinition[] = [
  GRIMOIRE,
  MAGIC_WEAPON,
  ARCANE_SHIELD,
];

// =============================================================================
// INVOCADOR - Skills (SPIRITUAL / DEVOTION)
// =============================================================================

export const EIDOLON_CHARGE: SkillDefinition = {
  code: "EIDOLON_CHARGE",
  name: "Carga Eidolon",
  description:
    "No começo de toda Batalha, INVOCA seu Eidolon adjacente a você. Sempre que o Eidolon mata uma Unidade, ele ganha +1 em todos os atributos (permanente na Partida). Se o Eidolon morrer, perde todos os acúmulos.",
  category: "PASSIVE",
  conditionApplied: "EIDOLON_CHARGE",
  metadata: {
    summonCode: "EIDOLON",
    summonOnBattleStart: true,
  },
};

export const EIDOLON_PROTECTION: SkillDefinition = {
  code: "EIDOLON_PROTECTION",
  name: "Proteção de Eidolon",
  description:
    "Caso você esteja adjacente ao seu Eidolon e receber dano, você converte em Dano Verdadeiro e o transfere para seu Eidolon.",
  category: "PASSIVE",
  conditionApplied: "EIDOLON_PROTECTION",
  metadata: {
    requiresAdjacentSummon: "EIDOLON",
    transferDamageToSummon: true,
    convertToTrueDamage: true,
  },
};

export const EIDOLON_RESISTANCE: SkillDefinition = {
  code: "EIDOLON_RESISTANCE",
  name: "Resistência Eidolon",
  description:
    "Caso seu Eidolon tenha 1 ou mais de Proteção, você recupera [FOCO] de Proteção dele.",
  category: "ACTIVE",
  effectType: "HEALING",
  costTier: "HIGH",
  range: "ADJACENT",
  targetType: "UNIT",
  functionName: "executeEidolonResistance",
  consumesAction: true,
  cooldown: 2,
  metadata: {
    targetMustBeSummon: "EIDOLON",
    requiresSummonProtection: 1,
    drainProtectionAmount: "FOCUS",
  },
};

export const SUMMONER_SKILLS: SkillDefinition[] = [
  EIDOLON_CHARGE,
  EIDOLON_PROTECTION,
  EIDOLON_RESISTANCE,
];

// =============================================================================
// TROPAS - Passivas selecionáveis em templates
// =============================================================================

export const TROOP_SKILLS: SkillDefinition[] = [
  {
    code: "ESCUDO_PROTETOR",
    name: "Escudo Protetor",
    description:
      "Quando um aliado adjacente recebe dano, 2 desse dano é automaticamente transferido para você.",
    category: "PASSIVE",
    availableForTroops: true,
    conditionApplied: "ESCUDO_PROTETOR",
  },
  {
    code: "INVESTIDA",
    name: "Investida",
    description:
      "Ao se mover em linha reta por pelo menos 2 casas antes de atacar, causa +2 de dano.",
    category: "PASSIVE",
    availableForTroops: true,
    conditionApplied: "INVESTIDA",
  },
  {
    code: "EMBOSCADA",
    name: "Emboscada",
    description:
      "Caso ataque uma unidade que ainda não agiu neste turno, causa +3 de dano.",
    category: "PASSIVE",
    availableForTroops: true,
    conditionApplied: "EMBOSCADA",
  },
  {
    code: "FURTIVIDADE",
    name: "Furtividade",
    description:
      "Não pode ser alvo de ataques à distância enquanto estiver adjacente a outra unidade aliada.",
    category: "PASSIVE",
    availableForTroops: true,
    conditionApplied: "FURTIVIDADE",
  },
  {
    code: "TIRO_RAPIDO",
    name: "Tiro Rápido",
    description:
      "Pode realizar dois ataques à distância por turno, mas cada ataque causa -1 de dano.",
    category: "PASSIVE",
    availableForTroops: true,
    conditionApplied: "TIRO_RAPIDO",
  },
];

// =============================================================================
// AÇÕES COMUNS (disponíveis para todas as unidades)
// =============================================================================

export const COMMON_ACTION_ATTACK: SkillDefinition = {
  code: "ATTACK",
  name: "Atacar",
  description: "Ataca um inimigo adjacente",
  category: "ACTIVE",
  effectType: "OFFENSIVE",
  commonAction: true,
  range: "ADJACENT",
  targetType: "UNIT",
  functionName: "executeAttackSkill",
  consumesAction: true,
  cooldown: 0,
};

export const COMMON_ACTION_DASH: SkillDefinition = {
  code: "DASH",
  name: "Disparada",
  description: "Gasta uma ação para dobrar o movimento neste turno",
  category: "ACTIVE",
  effectType: "UTILITY",
  commonAction: true,
  range: "SELF",
  functionName: "executeDash",
  consumesAction: true,
  cooldown: 0,
};

export const COMMON_ACTION_DODGE: SkillDefinition = {
  code: "DODGE",
  name: "Esquiva",
  description: "Aumenta a chance de esquiva até o próximo turno",
  category: "ACTIVE",
  effectType: "BUFF",
  commonAction: true,
  range: "SELF",
  functionName: "executeDodge",
  consumesAction: true,
  cooldown: 0,
  conditionApplied: "DODGING",
};

export const COMMON_ACTIONS: SkillDefinition[] = [
  COMMON_ACTION_ATTACK,
  COMMON_ACTION_DASH,
  COMMON_ACTION_DODGE,
];

// =============================================================================
// ARRAY CONSOLIDADO DE TODAS AS SKILLS
// =============================================================================

export const ALL_SKILL_TEMPLATES: SkillDefinition[] = [
  ...COMMON_ACTIONS,
  ...BARBARIAN_SKILLS,
  ...WARRIOR_SKILLS,
  ...ROGUE_SKILLS,
  ...RANGER_SKILLS,
  ...CLERIC_SKILLS,
  ...WIZARD_SKILLS,
  ...SUMMONER_SKILLS,
  ...TROOP_SKILLS,
];
