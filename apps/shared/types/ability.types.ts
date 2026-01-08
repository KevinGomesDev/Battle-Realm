// shared/types/ability.types.ts
// FONTE DE VERDADE - Sistema UNIFICADO de Habilidades (Skills + Spells)
// Todas as habilidades do jogo são AbilityDefinition com categoria diferenciadora

import type { BattleUnit } from "./battle.types";

// =============================================================================
// CATEGORIA DE HABILIDADE (DIFERENCIADOR SKILL vs SPELL)
// =============================================================================

/**
 * Categoria principal da habilidade
 * SKILL = Habilidades de classe/passivas (usam features da unidade)
 * SPELL = Magias aprendidas (usam array spells da unidade, custam mana)
 */
export type AbilityCategory = "SKILL" | "SPELL";

/**
 * Subcategoria para skills
 * PASSIVE = Sempre ativa, não precisa usar
 * ACTIVE = Precisa ser ativada, pode consumir ação
 */
export type AbilityActivationType = "PASSIVE" | "ACTIVE";

// =============================================================================
// ATRIBUTOS PARA BINDING DINÂMICO
// =============================================================================

/**
 * Atributos de unidade que podem ser usados como valores dinâmicos
 */
export type UnitAttribute =
  | "COMBAT"
  | "SPEED"
  | "FOCUS"
  | "RESISTANCE"
  | "WILL"
  | "VITALITY"
  | "LEVEL";

/**
 * Constante para referenciar atributos em definições de habilidades
 * Uso: baseDamage: ATTRIBUTE.FOCUS ou areaSize: ATTRIBUTE.SPEED
 */
export const ATTRIBUTE = {
  COMBAT: "ATTR:COMBAT" as const,
  SPEED: "ATTR:SPEED" as const,
  FOCUS: "ATTR:FOCUS" as const,
  RESISTANCE: "ATTR:RESISTANCE" as const,
  WILL: "ATTR:WILL" as const,
  VITALITY: "ATTR:VITALITY" as const,
  LEVEL: "ATTR:LEVEL" as const,
} as const;

export type AttributeBinding = (typeof ATTRIBUTE)[keyof typeof ATTRIBUTE];

/**
 * Valor que pode ser um número fixo OU uma referência a atributo
 */
export type DynamicValue = number | AttributeBinding;

/**
 * Verifica se um valor é uma referência a atributo
 */
export function isAttributeBinding(
  value: DynamicValue
): value is AttributeBinding {
  return typeof value === "string" && value.startsWith("ATTR:");
}

/**
 * Extrai o nome do atributo de uma binding
 */
export function getAttributeFromBinding(
  binding: AttributeBinding
): UnitAttribute {
  return binding.replace("ATTR:", "") as UnitAttribute;
}

/**
 * Resolve um valor dinâmico para um número usando os atributos da unidade
 */
export function resolveDynamicValue(
  value: DynamicValue,
  unitAttributes: {
    combat: number;
    speed: number;
    focus: number;
    resistance: number;
    will: number;
    vitality: number;
    level: number;
  }
): number {
  if (typeof value === "number") {
    return value;
  }

  const attr = getAttributeFromBinding(value);
  switch (attr) {
    case "COMBAT":
      return unitAttributes.combat;
    case "SPEED":
      return unitAttributes.speed;
    case "FOCUS":
      return unitAttributes.focus;
    case "RESISTANCE":
      return unitAttributes.resistance;
    case "WILL":
      return unitAttributes.will;
    case "VITALITY":
      return unitAttributes.vitality;
    case "LEVEL":
      return unitAttributes.level;
    default:
      return 0;
  }
}

// =============================================================================
// TIPOS DE ALCANCE
// =============================================================================

/**
 * Tipos de alcance para habilidades
 * SELF = apenas o próprio usuário (distância 0)
 * MELEE = adjacente (distância 1)
 * RANGED = à distância (distância customizável)
 * AREA = afeta área (requer areaSize)
 */
export type AbilityRange = "SELF" | "MELEE" | "RANGED" | "AREA";

/**
 * Tipos de alvo para habilidades
 * SELF = apenas si mesmo
 * UNIT = qualquer unidade (incluindo si mesmo)
 * ALL = todas as unidades
 * POSITION = posição no grid
 * GROUND = terreno/chão
 */
export type AbilityTargetType = "SELF" | "UNIT" | "ALL" | "POSITION" | "GROUND";

/**
 * Tipo de efeito da habilidade (usado pela IA para decisões)
 * OFFENSIVE = causa dano ou debuff em inimigos
 * HEALING = restaura HP
 * BUFF = aplica efeito positivo
 * DEBUFF = aplica efeito negativo
 * UTILITY = movimento, teleporte, etc.
 */
export type AbilityEffectType =
  | "OFFENSIVE"
  | "HEALING"
  | "BUFF"
  | "DEBUFF"
  | "UTILITY";

/**
 * Valores padrão de distância para cada tipo de alcance
 */
export const DEFAULT_RANGE_DISTANCE: Record<AbilityRange, number> = {
  SELF: 0,
  MELEE: 1,
  RANGED: 5,
  AREA: 5,
};

/**
 * Mapeia tipos de alcance legados para o novo sistema
 */
export function mapLegacyRange(range: string | AbilityRange): AbilityRange {
  switch (range) {
    case "ADJACENT":
      return "MELEE";
    case "SELF":
    case "MELEE":
    case "RANGED":
    case "AREA":
      return range as AbilityRange;
    default:
      return "MELEE";
  }
}

// =============================================================================
// TARGETING SHAPES (FORMAS DE ÁREA DE EFEITO)
// =============================================================================

/**
 * Forma do padrão de targeting/área de efeito
 * - SINGLE: Uma única célula (ataque básico, single target spells)
 * - LINE: Linha reta em uma direção
 * - CONE: Cone que se expande (ex: breath attacks)
 * - CROSS: Cruz/+ shape (ex: explosões cardinais)
 * - DIAMOND: Diamante/Losango (distância Manhattan, mais comum)
 * - SQUARE: Quadrado/Área (distância Chebyshev)
 * - RING: Anel ao redor (ex: shockwave)
 */
export type TargetingShape =
  | "SINGLE"
  | "LINE"
  | "CONE"
  | "CROSS"
  | "DIAMOND"
  | "SQUARE"
  | "RING";

/**
 * Direção do targeting (para shapes direcionais)
 */
export type TargetingDirection =
  | "NORTH"
  | "SOUTH"
  | "EAST"
  | "WEST"
  | "NORTHEAST"
  | "NORTHWEST"
  | "SOUTHEAST"
  | "SOUTHWEST";

// =============================================================================
// CUSTO E RECURSOS
// =============================================================================

export type AbilityCostTier = "LOW" | "MEDIUM" | "HIGH";
export type Archetype = "PHYSICAL" | "SPIRITUAL" | "ARCANE";
export type AbilityResourceType = "FOOD" | "DEVOTION" | "ARCANA" | "MANA";

/**
 * Valores numéricos para cada tier de custo (recurso gasto)
 */
export const COST_VALUES: Record<AbilityCostTier, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

// =============================================================================
// DEFINIÇÃO UNIFICADA DE HABILIDADE
// =============================================================================

/**
 * Definição UNIFICADA de uma habilidade (Skill ou Spell)
 * A propriedade `category` diferencia entre SKILL e SPELL
 */
export interface AbilityDefinition {
  // === IDENTIFICAÇÃO ===
  code: string;
  name: string;
  description: string;

  // === CATEGORIA (DIFERENCIADOR PRINCIPAL) ===
  /** SKILL = Habilidade de classe | SPELL = Magia aprendida */
  category: AbilityCategory;
  /** PASSIVE = Sempre ativa | ACTIVE = Precisa usar (apenas para SKILL) */
  activationType?: AbilityActivationType;

  // === TIPO DE EFEITO (para IA) ===
  effectType?: AbilityEffectType;

  // === FLAGS ESPECIAIS ===
  /** Ação comum disponível para todas unidades por padrão */
  commonAction?: boolean;
  /** Disponível para tropas (criação de templates). Default: false */
  availableForTroops?: boolean;

  // === CUSTO ===
  /** Tier de custo para skills de classe */
  costTier?: AbilityCostTier;
  /** Custo de mana para spells */
  manaCost?: number;

  // === ALCANCE ===
  range?: AbilityRange;
  /** Valor customizado para RANGED/AREA (pode ser número ou atributo) */
  rangeDistance?: DynamicValue;

  // === ÁREA DE EFEITO ===
  /** Tamanho da área de efeito (ex: 3 = 3x3) */
  areaSize?: DynamicValue;
  /** Forma do targeting/área de efeito */
  targetingShape?: TargetingShape;

  // === ALVO ===
  targetType?: AbilityTargetType;

  // === EXECUÇÃO ===
  /** Nome da função que executa a habilidade */
  functionName?: string;
  /** Se consome ação ao usar. Default: true */
  consumesAction?: boolean;
  /** Rodadas de espera após uso. Default: 0 */
  cooldown?: number;

  // === PROJÉTIL ===
  /** Se o projétil atravessa unidades (não para no primeiro alvo). Default: false */
  piercing?: boolean;
  /** Número máximo de alvos afetados em sequência (do mais próximo ao mais distante) */
  maxTargets?: number;

  // === ATRIBUTOS DINÂMICOS ===
  /** Dano base (pode ser número ou atributo) */
  baseDamage?: DynamicValue;
  /** Multiplicador de dano (ex: 0.5 = +50% do atributo) */
  damageMultiplier?: number;
  /** Cura base */
  healing?: DynamicValue;
  /** Duração da condição em turnos */
  conditionDuration?: DynamicValue;

  // === CONDIÇÃO ===
  /** Condição aplicada pela habilidade */
  conditionApplied?: string;

  // === VISUAL ===
  icon?: string;
  color?: string;

  // === EXTRAS ===
  metadata?: Record<string, unknown>;
}

// =============================================================================
// RESULTADO DE EXECUÇÃO (UNIFICADO)
// =============================================================================

/**
 * Resultado da execução de uma habilidade (Skill ou Spell)
 */
export interface AbilityExecutionResult {
  success: boolean;
  error?: string;
  abilityCode?: string;

  // === DANO/CURA ===
  damageDealt?: number;
  rawDamage?: number;
  damageReduction?: number;
  healAmount?: number;

  // === ALVOS ===
  targetIds?: string[];
  targetHpAfter?: number;
  targetDefeated?: boolean;

  // === CONDIÇÕES ===
  conditionApplied?: string;
  conditionRemoved?: string;
  conditionsApplied?: Array<{ targetId: string; conditionId: string }>;
  conditionsRemoved?: Array<{ targetId: string; conditionId: string }>;

  // === AÇÕES/MOVIMENTO ===
  actionsGained?: number;
  movementGained?: number;
  casterActionsLeft?: number;

  // === POSIÇÃO (teleporte) ===
  newPosX?: number;
  newPosY?: number;
  unitsMoved?: Array<{
    unitId: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
  }>;

  // === ROLAGENS (se aplicável) ===
  rolls?: number[];
  successes?: number;

  // === ESQUIVA ===
  dodgeResults?: Array<{
    targetId: string;
    targetName: string;
    dodged: boolean;
    dodgeChance: number;
    dodgeRoll: number;
  }>;

  // === OBSTÁCULOS ===
  obstacleDestroyed?: boolean;
  obstacleId?: string;

  // === ATAQUES EXTRAS ===
  attacksLeftThisTurn?: number;
  dodgeChance?: number;
  dodgeRoll?: number;

  // === EIDOLON (INVOCADOR) ===
  damageTransferredToEidolon?: boolean;
  eidolonDefeated?: boolean;
  killedSummonIds?: string[];
}

/**
 * Tipo da função executora de habilidade
 */
export type AbilityExecutorFn = (
  caster: BattleUnit,
  target: BattleUnit | { x: number; y: number } | null,
  allUnits: BattleUnit[],
  ability: AbilityDefinition,
  context?: AbilityExecutionContext
) => AbilityExecutionResult;

/**
 * Contexto opcional para execução de habilidades
 */
export interface AbilityExecutionContext {
  targetPosition?: { x: number; y: number };
  obstacles?: Array<{
    id: string;
    posX: number;
    posY: number;
    hp?: number;
    destroyed?: boolean;
  }>;
  battleId?: string;
}

// =============================================================================
// DEFINIÇÃO DE CLASSE DE HERÓI
// =============================================================================

/**
 * Definição de uma classe de herói/regente
 */
export interface HeroClassDefinition {
  code: string;
  name: string;
  description: string;
  archetype: Archetype;
  resourceUsed: AbilityResourceType;
  abilities: AbilityDefinition[];
}

/**
 * Informações resumidas de uma classe (para listagem)
 */
export interface HeroClassSummary {
  code: string;
  name: string;
  description: string;
  archetype: Archetype;
  resourceUsed: AbilityResourceType;
  abilityCount: number;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Verifica se uma habilidade é uma Skill
 */
export function isSkill(ability: AbilityDefinition): boolean {
  return ability.category === "SKILL";
}

/**
 * Verifica se uma habilidade é uma Spell
 */
export function isSpell(ability: AbilityDefinition): boolean {
  return ability.category === "SPELL";
}

/**
 * Verifica se uma habilidade é passiva
 */
export function isPassive(ability: AbilityDefinition): boolean {
  return ability.activationType === "PASSIVE";
}

/**
 * Verifica se uma habilidade é ativa (pode ser usada)
 */
export function isActive(ability: AbilityDefinition): boolean {
  // Spells são sempre ativas
  if (ability.category === "SPELL") return true;
  // Skills dependem do activationType
  return ability.activationType === "ACTIVE";
}

/**
 * Calcula o custo numérico de uma habilidade
 * @param isBattle - Se true, skills não têm custo em Battle
 */
export function getAbilityCost(
  ability: AbilityDefinition,
  isBattle: boolean = false
): number {
  // Spells usam manaCost
  if (ability.category === "SPELL") {
    return ability.manaCost ?? 0;
  }

  // Skills em Battle não têm custo
  if (isBattle) return 0;

  // Skills passivas não têm custo
  if (ability.activationType === "PASSIVE" || !ability.costTier) return 0;

  return COST_VALUES[ability.costTier];
}

/**
 * Obtém o alcance efetivo de uma habilidade
 */
export function getAbilityEffectiveRange(ability: AbilityDefinition): number {
  if (!ability.range) return 0;

  // Se tem rangeDistance definido como número, usa ele
  if (
    ability.rangeDistance !== undefined &&
    typeof ability.rangeDistance === "number"
  ) {
    return ability.rangeDistance;
  }

  // Senão usa o valor padrão
  return DEFAULT_RANGE_DISTANCE[ability.range];
}

/**
 * Mapeia Archetype para AbilityResourceType
 */
export function getArchetypeResource(
  archetype: Archetype
): AbilityResourceType {
  const map: Record<Archetype, AbilityResourceType> = {
    PHYSICAL: "FOOD",
    SPIRITUAL: "DEVOTION",
    ARCANE: "ARCANA",
  };
  return map[archetype];
}

// =============================================================================
// LABELS (TRADUÇÃO PARA PT-BR)
// =============================================================================

/**
 * Traduz categoria para português
 */
export function getCategoryLabel(category: AbilityCategory): string {
  const labels: Record<AbilityCategory, string> = {
    SKILL: "Habilidade",
    SPELL: "Magia",
  };
  return labels[category];
}

/**
 * Traduz tipo de ativação para português
 */
export function getActivationTypeLabel(type: AbilityActivationType): string {
  const labels: Record<AbilityActivationType, string> = {
    PASSIVE: "Passiva",
    ACTIVE: "Ativa",
  };
  return labels[type];
}

/**
 * Traduz alcance para português
 */
export function getRangeLabel(range: AbilityRange): string {
  const labels: Record<AbilityRange, string> = {
    SELF: "Pessoal",
    MELEE: "Corpo-a-corpo",
    RANGED: "À Distância",
    AREA: "Área",
  };
  return labels[range];
}

/**
 * Traduz tipo de alvo para português
 */
export function getTargetTypeLabel(targetType: AbilityTargetType): string {
  const labels: Record<AbilityTargetType, string> = {
    SELF: "Você",
    UNIT: "Unidade",
    ALL: "Todos",
    POSITION: "Posição",
    GROUND: "Terreno",
  };
  return labels[targetType];
}

/**
 * Traduz archetype para português
 */
export function getArchetypeLabel(archetype: Archetype): string {
  const labels: Record<Archetype, string> = {
    PHYSICAL: "Físico",
    SPIRITUAL: "Espiritual",
    ARCANE: "Arcano",
  };
  return labels[archetype];
}

/**
 * Traduz recurso para português
 */
export function getResourceLabel(resource: AbilityResourceType): string {
  const labels: Record<AbilityResourceType, string> = {
    FOOD: "Suprimentos",
    DEVOTION: "Devoção",
    ARCANA: "Arcano",
    MANA: "Mana",
  };
  return labels[resource];
}

// =============================================================================
// ALIASES PARA COMPATIBILIDADE (DEPRECADOS)
// =============================================================================

/** @deprecated Use AbilityDefinition */
export type SkillDefinition = AbilityDefinition;
/** @deprecated Use AbilityDefinition */
export type SpellDefinition = AbilityDefinition;
/** @deprecated Use AbilityExecutionResult */
export type SkillExecutionResult = AbilityExecutionResult;
/** @deprecated Use AbilityExecutionResult */
export type SpellExecutionResult = AbilityExecutionResult;
/** @deprecated Use AbilityActivationType */
export type SkillCategory = AbilityActivationType;
/** @deprecated Use AbilityCostTier */
export type SkillCostTier = AbilityCostTier;
/** @deprecated Use AbilityRange */
export type SkillRange = AbilityRange | "ADJACENT";
/** @deprecated Use AbilityRange */
export type SpellRange = AbilityRange | "ADJACENT";
/** @deprecated Use AbilityTargetType */
export type SkillTargetType = AbilityTargetType;
/** @deprecated Use AbilityTargetType */
export type SpellTargetType = AbilityTargetType;
/** @deprecated Use AbilityResourceType */
export type SkillResourceType = AbilityResourceType;
/** @deprecated Use getAbilityCost */
export const getSkillCost = getAbilityCost;
/** @deprecated Use getAbilityEffectiveRange */
export const getSkillEffectiveRange = getAbilityEffectiveRange;

/**
 * @deprecated Use DEFAULT_RANGE_DISTANCE
 */
export const DEFAULT_RANGE_VALUES: Record<string, number> = {
  SELF: 0,
  MELEE: 1,
  ADJACENT: 1,
  RANGED: 5,
  AREA: 5,
};
