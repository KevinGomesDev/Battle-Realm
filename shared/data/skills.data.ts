// shared/data/skills.data.ts
// Definições estáticas de todas as skills do jogo
// FONTE DE VERDADE para habilidades de classes
// Re-exporta templates e fornece funções utilitárias

import type {
  SkillDefinition,
  SkillTargetType,
  SkillRange,
} from "../types/skills.types";

// Re-exportar todos os templates de skills
export {
  // Barbarian
  WILD_FURY,
  RECKLESS_ATTACK,
  TOTAL_DESTRUCTION,
  BARBARIAN_SKILLS,
  // Warrior
  EXTRA_ATTACK,
  SECOND_WIND,
  ACTION_SURGE,
  WARRIOR_SKILLS,
  // Rogue
  SNEAK_ATTACK,
  CUNNING_ACTION,
  ASSASSINATE,
  ROGUE_SKILLS,
  // Ranger
  HUNTERS_MARK,
  NATURAL_EXPLORER,
  VOLLEY,
  RANGER_SKILLS,
  // Cleric
  HEAL,
  CELESTIAL_EXPULSION,
  BLESS,
  CLERIC_SKILLS,
  // Wizard
  GRIMOIRE,
  MAGIC_WEAPON,
  ARCANE_SHIELD,
  WIZARD_SKILLS,
  // Summoner
  EIDOLON_CHARGE,
  EIDOLON_PROTECTION,
  EIDOLON_RESISTANCE,
  SUMMONER_SKILLS,
  // Troops
  TROOP_SKILLS,
  // Common Actions
  COMMON_ACTION_ATTACK,
  COMMON_ACTION_DASH,
  COMMON_ACTION_DODGE,
  COMMON_ACTIONS,
} from "./Templates/SkillsTemplates";

import {
  BARBARIAN_SKILLS,
  WARRIOR_SKILLS,
  ROGUE_SKILLS,
  RANGER_SKILLS,
  CLERIC_SKILLS,
  WIZARD_SKILLS,
  SUMMONER_SKILLS,
  TROOP_SKILLS,
  COMMON_ACTIONS,
} from "./Templates/SkillsTemplates";

// =============================================================================
// TODAS AS SKILLS (para busca rápida) - Todas as classes + Tropas + Ações Comuns
// =============================================================================

export const ALL_SKILLS: SkillDefinition[] = [
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
 * Verifica se é uma ação comum (disponível para todas as unidades)
 */
export function isCommonAction(code: string): boolean {
  return COMMON_ACTIONS.some((s) => s.code === code.toUpperCase());
}

/**
 * Retorna todas as ações comuns
 */
export function getCommonActions(): SkillDefinition[] {
  return COMMON_ACTIONS;
}

/**
 * Retorna códigos das ações comuns (para inicialização de unidades)
 */
export function getCommonActionCodes(): string[] {
  return COMMON_ACTIONS.map((s) => s.code);
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
  // Ações Comuns
  ATTACK: "⚔️",
  DASH: "💨",
  DODGE: "🌀",
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
  // Ações Comuns
  ATTACK: "red",
  DASH: "blue",
  DODGE: "cyan",
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
  targetType?: SkillTargetType;
  range?: SkillRange;
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
    features: string[];
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
  } else if (!unit.features.includes(skill.code)) {
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
