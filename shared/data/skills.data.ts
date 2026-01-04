// shared/data/skills.data.ts
// Definições estáticas de todas as skills do jogo
// FONTE DE VERDADE para habilidades de classes

import type { SkillDefinition } from "../types/skills.types";

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
  costTier: "LOW",
  range: "ADJACENT",
  targetType: "ENEMY",
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
  costTier: "LOW",
  range: "RANGED",
  rangeValue: 6,
  targetType: "ENEMY",
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
  costTier: "MEDIUM",
  range: "AREA",
  rangeValue: 2,
  targetType: "ENEMY",
  functionName: "executeVolley",
  consumesAction: true,
  cooldown: 2,
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
  costTier: "LOW",
  range: "ADJACENT",
  targetType: "ALLY",
  functionName: "executeHeal",
  consumesAction: true,
  cooldown: 1,
};

export const CELESTIAL_EXPULSION: SkillDefinition = {
  code: "CELESTIAL_EXPULSION",
  name: "Expulsão Celestial",
  description: "Remove condições negativas do alvo.",
  category: "ACTIVE",
  costTier: "MEDIUM",
  range: "ADJACENT",
  targetType: "ALLY",
  functionName: "executeCelestialExpulsion",
  consumesAction: true,
  cooldown: 2,
};

export const BLESS: SkillDefinition = {
  code: "BLESS",
  name: "Abençoar",
  description: "Aliados em área ganham +1 em todos os testes por 3 turnos.",
  category: "ACTIVE",
  costTier: "MEDIUM",
  range: "AREA",
  rangeValue: 2,
  targetType: "ALLY",
  functionName: "executeBless",
  consumesAction: true,
  cooldown: 3,
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
  costTier: "MEDIUM",
  range: "ADJACENT",
  targetType: "ALLY",
  functionName: "executeMagicWeapon",
  consumesAction: true,
};

export const ARCANE_SHIELD: SkillDefinition = {
  code: "ARCANE_SHIELD",
  name: "Escudo Arcano",
  description:
    "Você recebe Redução de Dano igual à metade do seu Foco, até o fim do seu próximo turno.",
  category: "ACTIVE",
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
  costTier: "HIGH",
  range: "ADJACENT",
  targetType: "ALLY",
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
// TODAS AS SKILLS (para busca rápida) - Todas as classes + Tropas
// =============================================================================

export const ALL_SKILLS: SkillDefinition[] = [
  ...BARBARIAN_SKILLS,
  ...WARRIOR_SKILLS,
  ...ROGUE_SKILLS,
  ...RANGER_SKILLS,
  ...CLERIC_SKILLS,
  ...WIZARD_SKILLS,
  ...SUMMONER_SKILLS,
  ...TROOP_SKILLS,
];

export const TROOP_SKILLS_MAP: Record<string, SkillDefinition> = {};
for (const skill of TROOP_SKILLS) {
  TROOP_SKILLS_MAP[skill.code] = skill;
}

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

/**
 * Lista skills liberadas para tropas (templates)
 */
export function getTroopSkills(): SkillDefinition[] {
  return TROOP_SKILLS;
}

// =============================================================================
// INFORMAÇÕES VISUAIS DE SKILLS (para frontend)
// =============================================================================

/**
 * Mapeamento de ícones para cada skill (baseado no tipo/range)
 */
const SKILL_ICONS: Record<string, string> = {
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
  EIDOLON_RESISTANCE: "💠",
};

/**
 * Mapeamento de cores para cada tipo de skill
 */
const SKILL_COLORS: Record<string, string> = {
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
};

/**
 * Informações visuais de uma skill para UI
 */
export interface SkillInfo {
  icon: string;
  name: string;
  description: string;
  color: string;
  requiresTarget: boolean;
  // Novas propriedades para melhorar UX
  targetType?: "SELF" | "ALLY" | "ENEMY" | "ALL";
  range?: "SELF" | "ADJACENT" | "RANGED" | "AREA";
  cooldown?: number;
  consumesAction?: boolean;
}

/**
 * Informações completas de uma skill com estado atual da unidade
 */
export interface SkillInfoWithState extends SkillInfo {
  canUse: boolean;
  reason?: string;
  cooldownRemaining: number;
}

/**
 * Obtém informações visuais de uma skill pelo código
 * Retorna fallback se a skill não for encontrada
 */
export function getSkillInfo(skillCode: string): SkillInfo | null {
  const skill = findSkillByCode(skillCode);
  if (!skill) return null;

  // Determina se requer target baseado no range/targetType
  const requiresTarget =
    skill.range === "ADJACENT" ||
    skill.range === "RANGED" ||
    skill.range === "AREA";

  return {
    icon: SKILL_ICONS[skillCode] || "✨",
    name: skill.name,
    description: skill.description,
    color: SKILL_COLORS[skillCode] || "purple",
    requiresTarget,
    targetType: skill.targetType,
    range: skill.range,
    cooldown: skill.cooldown,
    consumesAction: skill.consumesAction !== false,
  };
}

/**
 * Obtém informações de uma skill COM estado atual da unidade
 * Útil para UI que precisa saber se a skill pode ser usada
 * @note Usa a mesma lógica de canUseSkill() para consistência
 */
export function getSkillInfoWithState(
  skillCode: string,
  unit: {
    actionsLeft: number;
    isAlive: boolean;
    actions: string[];
    unitCooldowns?: Record<string, number>;
  }
): SkillInfoWithState | null {
  const baseInfo = getSkillInfo(skillCode);
  if (!baseInfo) return null;

  const skill = findSkillByCode(skillCode);
  if (!skill) return null;

  const cooldownRemaining = unit.unitCooldowns?.[skillCode] ?? 0;

  // Usar lógica inline equivalente a canUseSkill para evitar dependência circular
  // A lógica aqui é identica à de canUseSkill() em skill-validation.ts
  let canUse = true;
  let reason: string | undefined;

  if (skill.category !== "ACTIVE") {
    canUse = false;
    reason = "Passiva";
  } else if (!unit.actions.includes(skill.code)) {
    canUse = false;
    reason = "Não possui";
  } else if (!unit.isAlive) {
    canUse = false;
    reason = "Morto";
  } else if (unit.actionsLeft <= 0 && skill.consumesAction !== false) {
    canUse = false;
    reason = "Sem ações";
  } else if (cooldownRemaining > 0) {
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
