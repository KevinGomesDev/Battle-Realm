// shared/types/skills.types.ts
// Tipos e constantes do sistema de habilidades - Compartilhado entre Frontend e Backend

import {
  type AbilityRange,
  type AbilityTargetType,
  type AbilityEffectType,
  type DynamicValue,
  DEFAULT_RANGE_DISTANCE,
} from "./ability.types";

// Re-exportar tipos de ability para compatibilidade
export type {
  AbilityRange,
  AbilityTargetType,
  AbilityEffectType,
  DynamicValue,
};
export { DEFAULT_RANGE_DISTANCE };

// =============================================================================
// ENUMS E TIPOS BASE
// =============================================================================

export type SkillCategory = "PASSIVE" | "ACTIVE";
export type SkillCostTier = "LOW" | "MEDIUM" | "HIGH";
// Tipos legados (mantidos para compatibilidade)
export type SkillRange = AbilityRange | "ADJACENT"; // ADJACENT é legado, usar MELEE
export type SkillTargetType = AbilityTargetType;
export type Archetype = "PHYSICAL" | "SPIRITUAL" | "ARCANE";
export type SkillResourceType = "FOOD" | "DEVOTION" | "ARCANA";

// =============================================================================
// CONSTANTES DE CUSTO E ALCANCE
// =============================================================================

/**
 * Valores numéricos para cada tier de custo (recurso gasto)
 */
export const COST_VALUES: Record<SkillCostTier, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

/**
 * @deprecated Use DEFAULT_RANGE_DISTANCE de ability.types.ts
 * Valores base de alcance (em tiles Manhattan)
 */
export const DEFAULT_RANGE_VALUES: Record<SkillRange, number> = {
  SELF: 0,
  MELEE: 1,
  ADJACENT: 1, // Legado
  RANGED: 5,
  AREA: 5,
};

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Resultado da execução de uma skill
 */
export interface SkillExecutionResult {
  success: boolean;
  error?: string;
  skillCode?: string;
  // Dados da execução
  healAmount?: number;
  damageDealt?: number;
  conditionApplied?: string;
  conditionRemoved?: string;
  actionsGained?: number;
  movementGained?: number;
  // Dados de rolagem (se aplicável)
  rolls?: number[];
  successes?: number;
  // Estado após execução
  casterActionsLeft?: number;
  targetHpAfter?: number;
  targetDefeated?: boolean;
  // Posição (para teleporte)
  newPosX?: number;
  newPosY?: number;
}

export interface SkillDefinition {
  code: string;
  name: string;
  description: string;
  category: SkillCategory;

  // Tipo de efeito da skill (usado pela IA para decisões)
  effectType?: AbilityEffectType;

  // Ação comum disponível para todas unidades por padrão
  commonAction?: boolean;

  // Disponível para tropas (criação de templates). Default: false/undefined
  availableForTroops?: boolean;

  // Custo (apenas para ACTIVE)
  costTier?: SkillCostTier;

  // Alcance (apenas para ACTIVE)
  range?: SkillRange;
  rangeValue?: number; // Valor customizado para RANGED/AREA
  rangeDistance?: DynamicValue; // Distância máxima de seleção de alvo (tiles Manhattan)
  areaSize?: DynamicValue; // Tamanho da área de efeito (ex: 3 = 3x3)

  // Alvo (para ACTIVE com AREA)
  targetType?: SkillTargetType;

  // Visual
  icon?: string;
  color?: string;

  // Execução (apenas para ACTIVE)
  functionName?: string; // Nome da função que executa a skill
  consumesAction?: boolean; // Se consome ação ao usar. Default: true
  cooldown?: number; // Rodadas de espera após uso. Default: 0

  // Atributos dinâmicos (podem ser números ou bindings de atributo)
  baseDamage?: DynamicValue; // Dano base da skill
  healing?: DynamicValue; // Cura base da skill
  conditionDuration?: DynamicValue; // Duração da condição em turnos

  // Condição aplicada (para PASSIVE ou algumas ACTIVE)
  conditionApplied?: string;

  // Extras
  metadata?: Record<string, any>;
}

/**
 * Definição de uma classe de herói/regente
 */
export interface HeroClassDefinition {
  code: string;
  name: string;
  description: string;
  archetype: Archetype;
  resourceUsed: SkillResourceType;
  skills: SkillDefinition[];
}

/**
 * Informações resumidas de uma classe (para listagem)
 */
export interface HeroClassSummary {
  code: string;
  name: string;
  description: string;
  archetype: Archetype;
  resourceUsed: SkillResourceType;
  skillCount: number;
}

/**
 * Skill com informações de custo calculado
 */
export interface SkillWithCost extends SkillDefinition {
  cost: number; // Custo numérico calculado
  effectiveRange: number; // Alcance numérico calculado
}

// =============================================================================
// HELPERS - CUSTO
// =============================================================================

/**
 * Calcula o custo numérico de uma skill (baseado no recurso da classe)
 * Em Arena, skills não têm custo
 */
export function getSkillCost(
  skill: SkillDefinition,
  isArena: boolean = false
): number {
  if (isArena) return 0;
  if (skill.category === "PASSIVE" || !skill.costTier) return 0;
  return COST_VALUES[skill.costTier];
}

/**
 * Mapeia Archetype para SkillResourceType
 */
export function getArchetypeResource(archetype: Archetype): SkillResourceType {
  const map: Record<Archetype, SkillResourceType> = {
    PHYSICAL: "FOOD",
    SPIRITUAL: "DEVOTION",
    ARCANE: "ARCANA",
  };
  return map[archetype];
}

// =============================================================================
// HELPERS - ALCANCE E DISTÂNCIA
// =============================================================================

// Import para uso local
import { getManhattanDistance as _getManhattanDistance } from "../utils/spell-validation";

// Re-export das funções de distância do módulo centralizado
export {
  getManhattanDistance,
  isAdjacent,
  isAdjacentOmnidirectional,
  getChebyshevDistance,
  isWithinRange,
} from "../utils/spell-validation";

// Alias local para uso interno
const getManhattanDistance = _getManhattanDistance;

/**
 * Obtém o alcance efetivo de uma skill
 */
export function getSkillEffectiveRange(skill: SkillDefinition): number {
  if (!skill.range) return 0;
  // Se tem rangeValue customizado, usa ele
  if (skill.rangeValue !== undefined) return skill.rangeValue;
  // Senão usa o valor padrão
  return DEFAULT_RANGE_VALUES[skill.range];
}

/**
 * Verifica se uma posição está dentro do alcance de uma skill
 */
export function isInSkillRange(
  skill: SkillDefinition,
  userX: number,
  userY: number,
  targetX: number,
  targetY: number
): boolean {
  if (!skill.range) return false;

  const distance = getManhattanDistance(userX, userY, targetX, targetY);
  const range = getSkillEffectiveRange(skill);

  switch (skill.range) {
    case "SELF":
      // Apenas o próprio usuário (distância 0)
      return distance === 0;

    case "ADJACENT":
      // Exatamente 1 bloco de distância
      return distance === 1;

    case "RANGED":
      // De 1 até o valor do range (não pode ser em si mesmo)
      return distance >= 1 && distance <= range;

    case "AREA":
      // Tudo dentro do raio (incluindo a si mesmo)
      return distance <= range;

    default:
      return false;
  }
}

/**
 * Obtém todas as posições adjacentes a um ponto (4 direções - Manhattan)
 */
export function getAdjacentPositions(
  x: number,
  y: number,
  gridWidth: number,
  gridHeight: number
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  const deltas = [
    { dx: 0, dy: -1 }, // cima
    { dx: 0, dy: 1 }, // baixo
    { dx: -1, dy: 0 }, // esquerda
    { dx: 1, dy: 0 }, // direita
  ];

  for (const { dx, dy } of deltas) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
      positions.push({ x: nx, y: ny });
    }
  }

  return positions;
}

/**
 * Obtém todas as posições adjacentes incluindo diagonais (8 direções)
 */
export function getAdjacentPositionsOmnidirectional(
  x: number,
  y: number,
  gridWidth: number,
  gridHeight: number
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  const deltas = [
    { dx: 0, dy: -1 }, // cima
    { dx: 0, dy: 1 }, // baixo
    { dx: -1, dy: 0 }, // esquerda
    { dx: 1, dy: 0 }, // direita
    { dx: -1, dy: -1 }, // diagonal superior esquerda
    { dx: 1, dy: -1 }, // diagonal superior direita
    { dx: -1, dy: 1 }, // diagonal inferior esquerda
    { dx: 1, dy: 1 }, // diagonal inferior direita
  ];

  for (const { dx, dy } of deltas) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
      positions.push({ x: nx, y: ny });
    }
  }

  return positions;
}

/**
 * Obtém todas as posições dentro de um raio (para AREA)
 */
export function getPositionsInRadius(
  centerX: number,
  centerY: number,
  radius: number,
  gridWidth: number,
  gridHeight: number,
  includeSelf: boolean = true
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const distance = Math.abs(dx) + Math.abs(dy);
      if (distance > radius) continue;
      if (!includeSelf && dx === 0 && dy === 0) continue;

      const nx = centerX + dx;
      const ny = centerY + dy;
      if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
        positions.push({ x: nx, y: ny });
      }
    }
  }

  return positions;
}

/**
 * Obtém posições válidas para uma skill RANGED
 */
export function getPositionsInRange(
  centerX: number,
  centerY: number,
  range: number,
  gridWidth: number,
  gridHeight: number
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];

  for (let dx = -range; dx <= range; dx++) {
    for (let dy = -range; dy <= range; dy++) {
      const distance = Math.abs(dx) + Math.abs(dy);
      // RANGED: mínimo 1, máximo range
      if (distance < 1 || distance > range) continue;

      const nx = centerX + dx;
      const ny = centerY + dy;
      if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
        positions.push({ x: nx, y: ny });
      }
    }
  }

  return positions;
}

// =============================================================================
// HELPERS - LABELS
// =============================================================================

/**
 * Traduz categoria para português
 */
export function getCategoryLabel(category: SkillCategory): string {
  const labels: Record<SkillCategory, string> = {
    PASSIVE: "Passiva",
    ACTIVE: "Ativa",
  };
  return labels[category];
}

/**
 * Traduz alcance para português
 */
export function getRangeLabel(range: SkillRange): string {
  const labels: Record<SkillRange, string> = {
    SELF: "Pessoal",
    MELEE: "Corpo-a-corpo",
    ADJACENT: "Adjacente", // Legado
    RANGED: "À Distância",
    AREA: "Área",
  };
  return labels[range];
}

/**
 * Traduz tipo de alvo para português
 */
export function getTargetTypeLabel(targetType: SkillTargetType): string {
  const labels: Record<SkillTargetType, string> = {
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
 * Traduz recurso de skill para português
 * Mapeia SkillResourceType para ResourceKey e usa getResourceName do config global
 */
export function getResourceLabel(resource: SkillResourceType): string {
  // Importação inline para evitar dependência circular
  // Mapeia SkillResourceType para ResourceKey
  const skillToResourceMap: Record<SkillResourceType, string> = {
    FOOD: "Suprimentos", // supplies
    DEVOTION: "Devoção", // devotion
    ARCANA: "Arcano", // arcane
  };
  return skillToResourceMap[resource];
}
