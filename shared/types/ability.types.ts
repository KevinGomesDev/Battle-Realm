// shared/types/ability.types.ts
// Tipos compartilhados entre Skills e Spells
// Define alcance, binding de atributos e valores dinâmicos

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
 * Constante para referenciar atributos em definições de skills/spells
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
// TIPOS DE ALCANCE (UNIFICADO PARA SKILLS E SPELLS)
// =============================================================================

/**
 * Tipos de alcance para skills e spells
 * SELF = apenas o próprio usuário (distância 0)
 * MELEE = adjacente (distância 1)
 * RANGED = à distância (distância customizável)
 * AREA = afeta área (requer areaSize)
 */
export type AbilityRange = "SELF" | "MELEE" | "RANGED" | "AREA";

/**
 * Tipos de alvo para skills e spells
 * SELF = apenas si mesmo
 * UNIT = qualquer unidade (incluindo si mesmo)
 * ALL = todas as unidades
 * POSITION = posição no grid
 * GROUND = terreno/chão
 */
export type AbilityTargetType = "SELF" | "UNIT" | "ALL" | "POSITION" | "GROUND";

/**
 * Tipo de efeito da skill/spell (usado pela IA para decisões)
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
