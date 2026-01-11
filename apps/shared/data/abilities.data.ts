// shared/data/abilities.data.ts
// FONTE DE VERDADE - Definições de TODAS as habilidades do jogo
// Todas as habilidades usam Mana como recurso

import {
  type AbilityDefinition,
  type HeroClassDefinition,
  ATTRIBUTE,
} from "../types/ability.types";
import { isSelfAbility } from "../utils/ability-validation";
import { PATTERNS } from "./targeting-patterns.data";

// =============================================================================
// AÇÕES COMUNS (disponíveis para todas as unidades)
// =============================================================================

export const COMMON_ACTION_ATTACK: AbilityDefinition = {
  code: "ATTACK",
  name: "Atacar",
  description: "Ataca um inimigo adjacente",
  activationType: "ACTIVE",
  effectType: "OFFENSIVE",
  commonAction: true,
  targetingPattern: { ...PATTERNS.SINGLE, maxRange: 1 },
  functionName: "executeAttackSkill",
  consumesAction: true,
  cooldown: 0,
};

export const COMMON_ACTION_DASH: AbilityDefinition = {
  code: "DASH",
  name: "Disparada",
  description: "Gasta uma ação para dobrar o movimento neste turno",
  activationType: "ACTIVE",
  effectType: "UTILITY",
  commonAction: true,
  targetingPattern: PATTERNS.SELF,
  functionName: "executeDash",
  consumesAction: true,
  cooldown: 0,
  conditionApplied: "DASHING",
};

export const COMMON_ACTIONS: AbilityDefinition[] = [
  COMMON_ACTION_ATTACK,
  COMMON_ACTION_DASH,
];

// =============================================================================
// BÁRBARO - Skills (PHYSICAL / FOOD)
// =============================================================================

export const WILD_FURY: AbilityDefinition = {
  code: "WILD_FURY",
  name: "Fúria Selvagem",
  description:
    "Todo dano recebido reduzido em 1. Ataques têm mínimo 2 de acertos. Duplicado sem Proteção.",
  activationType: "PASSIVE",
  conditionApplied: "WILD_FURY",
};

export const RECKLESS_ATTACK: AbilityDefinition = {
  code: "RECKLESS_ATTACK",
  name: "Ataque Descuidado",
  description: "Sem Proteção: Pode atacar 2x quando usa Ação de Ataque.",
  activationType: "PASSIVE",
  conditionApplied: "RECKLESS_ATTACK",
};

export const TOTAL_DESTRUCTION: AbilityDefinition = {
  code: "TOTAL_DESTRUCTION",
  name: "Destruição Total",
  description:
    "Escolha dano de 1 até seu Combate em alvo adjacente. Você recebe o mesmo dano.",
  activationType: "ACTIVE",
  effectType: "OFFENSIVE",
  manaCost: 1,
  targetingPattern: { ...PATTERNS.SINGLE, maxRange: 1 },
  functionName: "executeTotalDestruction",
  consumesAction: true,
  cooldown: 0,
};

/**
 * INTIMIDATING_ROAR - Skill de DEBUFF CONTESTADA
 * Exemplo de ability que requer QTE para ser resistida
 * O alvo pode resistir através de um duelo de COMBAT vs WILL
 */
export const INTIMIDATING_ROAR: AbilityDefinition = {
  code: "INTIMIDATING_ROAR",
  name: "Rugido Intimidador",
  description:
    "Solta um rugido aterrorizante. O alvo deve resistir (WILL vs COMBAT) ou ficará Amedrontado por 2 turnos, sofrendo -2 em todos os atributos.",
  activationType: "ACTIVE",
  effectType: "DEBUFF",
  manaCost: 2,
  targetingPattern: { ...PATTERNS.SINGLE, maxRange: 2 },
  functionName: "executeIntimidatingRoar",
  consumesAction: true,
  cooldown: 3,
  // === QTE CONTESTADO ===
  contested: true,
  contestedAttackerAttribute: "COMBAT",
  contestedDefenderAttribute: "WILL",
  // === CONDIÇÃO ===
  conditionApplied: "FRIGHTENED",
  conditionDuration: 2,
  // === VISUAL ===
  icon: "😱",
  color: "red",
};

export const BARBARIAN_ABILITIES: AbilityDefinition[] = [
  WILD_FURY,
  RECKLESS_ATTACK,
  TOTAL_DESTRUCTION,
  INTIMIDATING_ROAR,
];

// =============================================================================
// GUERREIRO - Skills (PHYSICAL / FOOD)
// =============================================================================

export const EXTRA_ATTACK: AbilityDefinition = {
  code: "EXTRA_ATTACK",
  name: "Ataque Extra",
  description:
    "Quando usa a Ação de Ataque, você pode realizar um ataque a mais.",
  activationType: "PASSIVE",
  conditionApplied: "EXTRA_ATTACK",
};

export const SECOND_WIND: AbilityDefinition = {
  code: "SECOND_WIND",
  name: "Retomar Fôlego",
  description:
    "Recupera HP igual à sua Vitalidade. Pode ser usado uma vez por batalha.",
  activationType: "ACTIVE",
  effectType: "HEALING",
  manaCost: 1,
  targetingPattern: PATTERNS.SELF,
  functionName: "executeSecondWind",
  consumesAction: true,
  cooldown: 999, // Uma vez por batalha
};

export const ACTION_SURGE: AbilityDefinition = {
  code: "ACTION_SURGE",
  name: "Surto de Ação",
  description: "Você recebe uma ação extra em seu turno.",
  activationType: "ACTIVE",
  effectType: "BUFF",
  manaCost: 2,
  targetingPattern: PATTERNS.SELF,
  functionName: "executeActionSurge",
  consumesAction: false, // NÃO consome ação!
  cooldown: 3,
};

export const WARRIOR_ABILITIES: AbilityDefinition[] = [
  EXTRA_ATTACK,
  SECOND_WIND,
  ACTION_SURGE,
];

// =============================================================================
// LADINO - Skills (PHYSICAL / FOOD)
// =============================================================================

export const SNEAK_ATTACK: AbilityDefinition = {
  code: "SNEAK_ATTACK",
  name: "Ataque Furtivo",
  description:
    "Causa +3 de dano ao atacar um inimigo que não te viu ou que está flanqueado.",
  activationType: "PASSIVE",
  conditionApplied: "SNEAK_ATTACK",
};

export const CUNNING_ACTION: AbilityDefinition = {
  code: "CUNNING_ACTION",
  name: "Ação Ardilosa",
  description: "Pode usar Dash, Disengage ou Hide como ação bônus.",
  activationType: "PASSIVE",
  conditionApplied: "CUNNING_ACTION",
};

export const ASSASSINATE: AbilityDefinition = {
  code: "ASSASSINATE",
  name: "Assassinar",
  description:
    "Primeiro ataque em combate contra alvo que não agiu causa dano dobrado.",
  activationType: "PASSIVE",
  conditionApplied: "ASSASSINATE",
};

export const ROGUE_ABILITIES: AbilityDefinition[] = [
  SNEAK_ATTACK,
  CUNNING_ACTION,
  ASSASSINATE,
];

// =============================================================================
// PATRULHEIRO - Skills (PHYSICAL / FOOD)
// =============================================================================

export const HUNTERS_MARK: AbilityDefinition = {
  code: "HUNTERS_MARK",
  name: "Marca do Caçador",
  description:
    "Marca um inimigo. Todos os seus ataques contra ele causam +2 de dano.",
  activationType: "ACTIVE",
  effectType: "DEBUFF",
  manaCost: 1,
  targetingPattern: { ...PATTERNS.SINGLE, maxRange: 6 },
  functionName: "executeHuntersMark",
  consumesAction: true,
  cooldown: 0,
};

export const NATURAL_EXPLORER: AbilityDefinition = {
  code: "NATURAL_EXPLORER",
  name: "Explorador Natural",
  description:
    "+2 de movimento em terrenos naturais. Não sofre penalidades de terreno difícil.",
  activationType: "PASSIVE",
  conditionApplied: "NATURAL_EXPLORER",
};

export const VOLLEY: AbilityDefinition = {
  code: "VOLLEY",
  name: "Rajada",
  description: "Ataca todos os inimigos em uma área com metade do dano normal.",
  activationType: "ACTIVE",
  effectType: "OFFENSIVE",
  manaCost: 2,
  targetingPattern: { ...PATTERNS.DIAMOND_2, maxRange: 5 },
  functionName: "executeVolley",
  consumesAction: true,
  cooldown: 2,
  icon: "🏹",
  color: "green",
};

export const RANGER_ABILITIES: AbilityDefinition[] = [
  HUNTERS_MARK,
  NATURAL_EXPLORER,
  VOLLEY,
];

// =============================================================================
// CLÉRIGO - Skills (SPIRITUAL / DEVOTION)
// =============================================================================

export const HEAL: AbilityDefinition = {
  code: "HEAL",
  name: "Curar",
  description: "Cura um aliado adjacente em Foco de HP.",
  activationType: "ACTIVE",
  effectType: "HEALING",
  manaCost: 1,
  targetingPattern: { ...PATTERNS.SINGLE, maxRange: 1 },
  functionName: "executeHeal",
  consumesAction: true,
  cooldown: 1,
};

export const CELESTIAL_EXPULSION: AbilityDefinition = {
  code: "CELESTIAL_EXPULSION",
  name: "Expulsão Celestial",
  description: "Remove condições negativas do alvo.",
  activationType: "ACTIVE",
  effectType: "HEALING",
  manaCost: 2,
  targetingPattern: { ...PATTERNS.SINGLE, maxRange: 1 },
  functionName: "executeCelestialExpulsion",
  consumesAction: true,
  cooldown: 2,
};

export const BLESS: AbilityDefinition = {
  code: "BLESS",
  name: "Abençoar",
  description: "Aliados em área ganham +1 em todos os testes por 3 turnos.",
  activationType: "ACTIVE",
  effectType: "BUFF",
  manaCost: 2,
  targetingPattern: { ...PATTERNS.DIAMOND_2, maxRange: 3 },
  functionName: "executeBless",
  consumesAction: true,
  cooldown: 3,
  icon: "✨",
  color: "gold",
};

export const CLERIC_ABILITIES: AbilityDefinition[] = [
  HEAL,
  CELESTIAL_EXPULSION,
  BLESS,
];

// =============================================================================
// MAGO - Skills (ARCANE / ARCANA)
// =============================================================================

export const GRIMOIRE: AbilityDefinition = {
  code: "GRIMOIRE",
  name: "Grimório",
  description:
    "Você possui um Livro de Magias que ocupa todos seus Slots de Equipamentos. Sempre que uma Unidade conjurar uma magia visível, você a aprende permanentemente.",
  activationType: "PASSIVE",
  conditionApplied: "GRIMOIRE",
};

export const MAGIC_WEAPON: AbilityDefinition = {
  code: "MAGIC_WEAPON",
  name: "Arma Mágica",
  description:
    "Imbuí a arma de uma Unidade adjacente com Magia. Até o fim do Combate, os Ataques dessa Unidade causam dano Mágico ao invés de Físico.",
  activationType: "ACTIVE",
  effectType: "BUFF",
  manaCost: 2,
  targetingPattern: { ...PATTERNS.SINGLE, maxRange: 1 },
  functionName: "executeMagicWeapon",
  consumesAction: true,
};

export const ARCANE_SHIELD: AbilityDefinition = {
  code: "ARCANE_SHIELD",
  name: "Escudo Arcano",
  description:
    "Até o começo do seu próximo turno, sempre que receberia dano no HP, sua Mana é reduzida no lugar.",
  activationType: "ACTIVE",
  effectType: "BUFF",
  manaCost: 2,
  targetingPattern: PATTERNS.SELF,
  functionName: "executeArcaneShield",
  consumesAction: false,
};

export const WIZARD_ABILITIES: AbilityDefinition[] = [
  GRIMOIRE,
  MAGIC_WEAPON,
  ARCANE_SHIELD,
];

// =============================================================================
// INVOCADOR - Skills (SPIRITUAL / DEVOTION)
// =============================================================================

export const EIDOLON_CHARGE: AbilityDefinition = {
  code: "EIDOLON_CHARGE",
  name: "Carga Eidolon",
  description:
    "No começo de toda Batalha, INVOCA seu Eidolon adjacente a você. Sempre que o Eidolon mata uma Unidade, ele ganha +1 em todos os atributos (permanente na Partida). Se o Eidolon morrer, perde todos os acúmulos.",
  activationType: "PASSIVE",
  conditionApplied: "EIDOLON_CHARGE",
  metadata: {
    summonCode: "EIDOLON",
    summonOnBattleStart: true,
  },
};

export const EIDOLON_PROTECTION: AbilityDefinition = {
  code: "EIDOLON_PROTECTION",
  name: "Proteção de Eidolon",
  description:
    "Caso você esteja adjacente ao seu Eidolon e receber dano, você converte em Dano Verdadeiro e o transfere para seu Eidolon.",
  activationType: "PASSIVE",
  conditionApplied: "EIDOLON_PROTECTION",
  metadata: {
    requiresAdjacentSummon: "EIDOLON",
    transferDamageToSummon: true,
    convertToTrueDamage: true,
  },
};

export const EIDOLON_RESISTANCE: AbilityDefinition = {
  code: "EIDOLON_RESISTANCE",
  name: "Resistência Eidolon",
  description:
    "Caso seu Eidolon tenha 1 ou mais de Proteção, você recupera [FOCO] de Proteção dele.",
  activationType: "ACTIVE",
  effectType: "HEALING",
  manaCost: 3,
  targetingPattern: { ...PATTERNS.SINGLE, maxRange: 1 },
  functionName: "executeEidolonResistance",
  consumesAction: true,
  cooldown: 2,
  metadata: {
    targetMustBeSummon: "EIDOLON",
    requiresSummonProtection: 1,
    drainProtectionAmount: "FOCUS",
  },
};

export const SUMMONER_ABILITIES: AbilityDefinition[] = [
  EIDOLON_CHARGE,
  EIDOLON_PROTECTION,
  EIDOLON_RESISTANCE,
];

// =============================================================================
// TROPAS - Passivas selecionáveis em templates
// =============================================================================

export const TROOP_ABILITIES: AbilityDefinition[] = [
  {
    code: "ESCUDO_PROTETOR",
    name: "Escudo Protetor",
    description:
      "Quando um aliado adjacente recebe dano, 2 desse dano é automaticamente transferido para você.",
    activationType: "PASSIVE",
    availableForTroops: true,
    conditionApplied: "ESCUDO_PROTETOR",
  },
  {
    code: "INVESTIDA",
    name: "Investida",
    description:
      "Ao se mover em linha reta por pelo menos 2 casas antes de atacar, causa +2 de dano.",
    activationType: "PASSIVE",
    availableForTroops: true,
    conditionApplied: "INVESTIDA",
  },
  {
    code: "EMBOSCADA",
    name: "Emboscada",
    description:
      "Caso ataque uma unidade que ainda não agiu neste turno, causa +3 de dano.",
    activationType: "PASSIVE",
    availableForTroops: true,
    conditionApplied: "EMBOSCADA",
  },
  {
    code: "FURTIVIDADE",
    name: "Furtividade",
    description:
      "Não pode ser alvo de ataques à distância enquanto estiver adjacente a outra unidade aliada.",
    activationType: "PASSIVE",
    availableForTroops: true,
    conditionApplied: "FURTIVIDADE",
  },
  {
    code: "TIRO_RAPIDO",
    name: "Tiro Rápido",
    description:
      "Pode realizar dois ataques à distância por turno, mas cada ataque causa -1 de dano.",
    activationType: "PASSIVE",
    availableForTroops: true,
    conditionApplied: "TIRO_RAPIDO",
  },
];

// =============================================================================
// SPELLS (Magias aprendidas)
// =============================================================================

export const TELEPORT: AbilityDefinition = {
  code: "TELEPORT",
  name: "Teleporte",
  description:
    "Move-se instantaneamente para uma posição dentro do alcance (baseado em Focus), ignorando obstáculos e unidades.",
  activationType: "ACTIVE",
  effectType: "UTILITY",
  targetingPattern: { ...PATTERNS.SINGLE, maxRange: ATTRIBUTE.FOCUS },
  functionName: "executeTeleport",
  icon: "🌀",
  color: "cyan",
  cooldown: 3,
  manaCost: 5,
};

export const FIRE: AbilityDefinition = {
  code: "FIRE",
  name: "Fogo",
  description:
    "Lança uma bola de fogo que viaja até o alvo e explode, causando dano mágico a todas as unidades na área (3x3). Se algo interceptar no caminho, explode nesse ponto. O impacto empurra as unidades atingidas.",
  activationType: "ACTIVE",
  effectType: "OFFENSIVE",
  targetingPattern: { ...PATTERNS.FIREBALL, maxRange: 5, travelDistance: 5 },
  functionName: "executeFire",
  icon: "🔥",
  color: "red",
  cooldown: 2,
  manaCost: 8,
  baseDamage: ATTRIBUTE.FOCUS,
  damageMultiplier: 0.5,
  impact: {
    distance: 1,
    collisionDamage: true,
    collisionDamagePercent: 0.5,
    stopsAtUnits: true,
    stopsAtObstacles: true,
  },
};

export const EMPOWER: AbilityDefinition = {
  code: "EMPOWER",
  name: "Potencializar",
  description:
    "Potencializa uma unidade adjacente, aumentando todos os seus atributos em 50% do seu Focus até o começo do próximo turno.",
  activationType: "ACTIVE",
  effectType: "BUFF",
  targetingPattern: { ...PATTERNS.SINGLE, maxRange: 1 },
  functionName: "executeEmpower",
  icon: "⚡",
  color: "yellow",
  cooldown: 4,
  manaCost: 6,
  conditionApplied: "EMPOWERED",
  conditionDuration: 1,
};

export const ALL_SPELLS: AbilityDefinition[] = [TELEPORT, FIRE, EMPOWER];

// =============================================================================
// CLASSES DE HERÓIS
// =============================================================================

export const HERO_CLASSES: HeroClassDefinition[] = [
  {
    code: "WARRIOR",
    name: "Guerreiro",
    description:
      "Soldado disciplinado e experiente. Mestre em ataques múltiplos e em recuperação tática.",
    abilities: WARRIOR_ABILITIES,
  },
  {
    code: "CLERIC",
    name: "Clérigo",
    description:
      "Escolhido divino com poderes sagrados. Protege aliados e expele maldições.",
    abilities: CLERIC_ABILITIES,
  },
  {
    code: "WIZARD",
    name: "Mago",
    description:
      "Estudioso das artes arcanas que manipula a realidade através de feitiços poderosos.",
    abilities: WIZARD_ABILITIES,
  },
  {
    code: "SUMMONER",
    name: "Invocador",
    description:
      "Mestre espiritual que canaliza seu poder através de um Eidolon - uma manifestação espiritual que cresce ao consumir as almas de seus inimigos.",
    abilities: SUMMONER_ABILITIES,
  },
];

// =============================================================================
// ARRAY CONSOLIDADO DE TODAS AS HABILIDADES
// =============================================================================

export const ALL_ABILITIES: AbilityDefinition[] = [
  ...COMMON_ACTIONS,
  ...BARBARIAN_ABILITIES,
  ...WARRIOR_ABILITIES,
  ...ROGUE_ABILITIES,
  ...RANGER_ABILITIES,
  ...CLERIC_ABILITIES,
  ...WIZARD_ABILITIES,
  ...SUMMONER_ABILITIES,
  ...TROOP_ABILITIES,
  ...ALL_SPELLS,
];

// =============================================================================
// MAPS PARA ACESSO RÁPIDO
// =============================================================================

/** Mapa de todas as habilidades por código */
export const ABILITY_MAP: Record<string, AbilityDefinition> =
  ALL_ABILITIES.reduce((acc, ability) => {
    acc[ability.code] = ability;
    return acc;
  }, {} as Record<string, AbilityDefinition>);

/** Mapa de skills de tropas por código */
export const TROOP_ABILITY_MAP: Record<string, AbilityDefinition> =
  TROOP_ABILITIES.reduce((acc, ability) => {
    acc[ability.code] = ability;
    return acc;
  }, {} as Record<string, AbilityDefinition>);

/** Mapa de spells por código */
export const SPELL_MAP: Record<string, AbilityDefinition> = ALL_SPELLS.reduce(
  (acc, spell) => {
    acc[spell.code] = spell;
    return acc;
  },
  {} as Record<string, AbilityDefinition>
);

// =============================================================================
// FUNÇÕES UTILITÁRIAS
// =============================================================================

/**
 * Busca uma habilidade pelo código
 */
export function findAbilityByCode(code: string): AbilityDefinition | undefined {
  return ABILITY_MAP[code];
}

/**
 * Busca uma classe pelo código
 */
export function getClassByCode(code: string): HeroClassDefinition | undefined {
  return HERO_CLASSES.find((c) => c.code === code);
}

/**
 * Busca uma habilidade pelo código (retorna também a classe)
 */
export function getAbilityByCode(
  code: string
): { ability: AbilityDefinition; classCode?: string } | undefined {
  // Primeiro tenta ações comuns
  const commonAction = COMMON_ACTIONS.find((a) => a.code === code);
  if (commonAction) {
    return { ability: commonAction };
  }

  // Tenta spells
  const spell = ALL_SPELLS.find((s) => s.code === code);
  if (spell) {
    return { ability: spell };
  }

  // Tenta tropas
  const troopAbility = TROOP_ABILITIES.find((a) => a.code === code);
  if (troopAbility) {
    return { ability: troopAbility };
  }

  // Procura nas classes
  for (const heroClass of HERO_CLASSES) {
    const ability = heroClass.abilities.find((a) => a.code === code);
    if (ability) {
      return { ability, classCode: heroClass.code };
    }
  }

  return undefined;
}

/**
 * Lista todas as habilidades de uma classe
 */
export function getAbilitiesForClass(classCode: string): AbilityDefinition[] {
  const heroClass = getClassByCode(classCode);
  return heroClass?.abilities || [];
}

/**
 * Verifica se é uma ação comum (disponível para todas as unidades)
 */
export function isCommonAction(code: string): boolean {
  return COMMON_ACTIONS.some((a) => a.code === code.toUpperCase());
}

/**
 * Retorna todas as ações comuns
 */
export function getCommonActions(): AbilityDefinition[] {
  return COMMON_ACTIONS;
}

/**
 * Retorna códigos das ações comuns (para inicialização de unidades)
 */
export function getCommonActionCodes(): string[] {
  return COMMON_ACTIONS.map((a) => a.code);
}

/**
 * Lista todas as habilidades passivas
 */
export function getPassiveAbilities(): AbilityDefinition[] {
  return ALL_ABILITIES.filter((a) => a.activationType === "PASSIVE");
}

/**
 * Lista todas as habilidades ativas
 */
export function getActiveAbilities(): AbilityDefinition[] {
  return ALL_ABILITIES.filter((a) => a.activationType === "ACTIVE");
}

/**
 * Lista habilidades liberadas para tropas (templates)
 */
export function getTroopAbilities(): AbilityDefinition[] {
  return TROOP_ABILITIES;
}

/**
 * Retorna resumo de todas as classes para listagem
 */
export function getAllClassesSummary(): Array<{
  code: string;
  name: string;
  description: string;
  abilityCount: number;
}> {
  return HERO_CLASSES.map((c) => ({
    code: c.code,
    name: c.name,
    description: c.description,
    abilityCount: c.abilities.length,
  }));
}

/**
 * Obtém uma spell pelo código
 */
export function getSpellByCode(code: string): AbilityDefinition | undefined {
  return SPELL_MAP[code];
}

// =============================================================================
// INFORMAÇÕES VISUAIS (para frontend)
// =============================================================================

/** Ícones das habilidades */
export const ABILITY_ICONS: Record<string, string> = {
  // Ações Comuns
  ATTACK: "⚔️",
  DASH: "💨",
  // Warrior
  EXTRA_ATTACK: "⚔️",
  SECOND_WIND: "💨",
  ACTION_SURGE: "⚡",
  // Cleric
  HEAL: "💚",
  CELESTIAL_EXPULSION: "✨",
  BLESS: "🙏",
  // Wizard
  GRIMOIRE: "📖",
  MAGIC_WEAPON: "✨",
  ARCANE_SHIELD: "🛡️",
  // Barbarian
  WILD_FURY: "😡",
  RECKLESS_ATTACK: "💥",
  TOTAL_DESTRUCTION: "💀",
  INTIMIDATING_ROAR: "😱",
  // Rogue
  SNEAK_ATTACK: "🗡️",
  CUNNING_ACTION: "🎭",
  ASSASSINATE: "☠️",
  // Ranger
  HUNTERS_MARK: "🎯",
  NATURAL_EXPLORER: "🌲",
  VOLLEY: "🏹",
  // Summoner
  EIDOLON_CHARGE: "👻",
  EIDOLON_PROTECTION: "🛡️",
  EIDOLON_RESISTANCE: "👠",
  // Spells
  TELEPORT: "🌀",
  FIRE: "🔥",
  EMPOWER: "⚡",
};

/** Cores das habilidades */
export const ABILITY_COLORS: Record<string, string> = {
  // Ações Comuns
  ATTACK: "red",
  DASH: "blue",
  // Warrior - amber
  EXTRA_ATTACK: "amber",
  SECOND_WIND: "emerald",
  ACTION_SURGE: "yellow",
  // Cleric - emerald
  HEAL: "emerald",
  CELESTIAL_EXPULSION: "cyan",
  BLESS: "sky",
  // Wizard - purple
  GRIMOIRE: "purple",
  MAGIC_WEAPON: "violet",
  ARCANE_SHIELD: "indigo",
  // Barbarian - red
  WILD_FURY: "red",
  RECKLESS_ATTACK: "red",
  INTIMIDATING_ROAR: "red",
  TOTAL_DESTRUCTION: "red",
  // Rogue - gray
  SNEAK_ATTACK: "gray",
  CUNNING_ACTION: "gray",
  ASSASSINATE: "gray",
  // Ranger - green
  HUNTERS_MARK: "emerald",
  NATURAL_EXPLORER: "emerald",
  VOLLEY: "emerald",
  // Summoner - violet
  EIDOLON_CHARGE: "violet",
  EIDOLON_PROTECTION: "violet",
  EIDOLON_RESISTANCE: "fuchsia",
  // Spells
  TELEPORT: "cyan",
  FIRE: "red",
  EMPOWER: "yellow",
};

/**
 * Informações visuais de uma habilidade para UI
 */
export interface AbilityInfo {
  icon: string;
  name: string;
  description: string;
  color: string;
  requiresTarget: boolean;
  activationType?: "PASSIVE" | "ACTIVE";
  cooldown?: number;
  consumesAction?: boolean;
  manaCost?: number;
}

/**
 * Informações completas de uma habilidade com estado atual da unidade
 */
export interface AbilityInfoWithState extends AbilityInfo {
  canUse: boolean;
  reason?: string;
  cooldownRemaining: number;
}

/**
 * Obtém informações visuais de uma habilidade pelo código
 */
export function getAbilityInfo(abilityCode: string): AbilityInfo | null {
  const ability = findAbilityByCode(abilityCode);
  if (!ability) return null;

  // Requer target se não for SELF
  const requiresTarget = !isSelfAbility(ability);

  return {
    icon: ABILITY_ICONS[abilityCode] || "✨",
    name: ability.name,
    description: ability.description,
    color: ABILITY_COLORS[abilityCode] || "purple",
    requiresTarget,
    activationType: ability.activationType,
    cooldown: ability.cooldown,
    consumesAction: ability.consumesAction !== false,
    manaCost: ability.manaCost,
  };
}

/**
 * Obtém informações de uma habilidade COM estado atual da unidade
 */
export function getAbilityInfoWithState(
  abilityCode: string,
  unit: {
    actionsLeft: number;
    isAlive: boolean;
    features: string[];
    spells?: string[];
    unitCooldowns?: Record<string, number>;
    currentMana?: number;
  }
): AbilityInfoWithState | null {
  const baseInfo = getAbilityInfo(abilityCode);
  if (!baseInfo) return null;

  const ability = findAbilityByCode(abilityCode);
  if (!ability) return null;

  const cooldownRemaining = unit.unitCooldowns?.[abilityCode] ?? 0;

  // Lógica para determinar se pode usar
  let canUse = true;
  let reason: string | undefined;

  // Verificar se é passiva
  if (ability.activationType === "PASSIVE") {
    canUse = false;
    reason = "Passiva";
  }
  // Verificar se possui a habilidade
  else if (!unit.features.includes(ability.code)) {
    canUse = false;
    reason = "Não possui";
  }
  // Verificar se está vivo
  else if (!unit.isAlive) {
    canUse = false;
    reason = "Morto";
  }
  // Verificar ações
  else if (unit.actionsLeft <= 0 && ability.consumesAction !== false) {
    canUse = false;
    reason = "Sem ações";
  }
  // Verificar mana
  else if (ability.manaCost) {
    const currentMana = unit.currentMana ?? 0;
    if (currentMana < ability.manaCost) {
      canUse = false;
      reason = `Mana: ${currentMana}/${ability.manaCost}`;
    }
  }
  // Verificar cooldown
  else if (cooldownRemaining > 0) {
    canUse = false;
    reason = `CD: ${cooldownRemaining}`;
  }

  return {
    ...baseInfo,
    canUse,
    reason,
    cooldownRemaining,
  };
}
