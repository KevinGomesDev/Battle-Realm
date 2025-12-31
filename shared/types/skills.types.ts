// shared/types/skills.types.ts
// Tipos e constantes do sistema de habilidades - Compartilhado entre Frontend e Backend

// =============================================================================
// ENUMS E TIPOS BASE
// =============================================================================

export type SkillCategory = "PASSIVE" | "ACTIVE";
export type SkillCostTier = "LOW" | "MEDIUM" | "HIGH";
export type SkillRange = "SELF" | "ADJACENT" | "RANGED" | "AREA";
export type SkillTargetType = "SELF" | "ALLY" | "ENEMY" | "ALL";
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
 * Valores base de alcance (em tiles Manhattan)
 * SELF = 0 (apenas usuário)
 * ADJACENT = 1 (1 bloco qualquer direção)
 * RANGED = valor customizável (padrão 4)
 * AREA = raio de efeito (padrão 2)
 */
export const DEFAULT_RANGE_VALUES: Record<SkillRange, number> = {
  SELF: 0,
  ADJACENT: 1,
  RANGED: 4,
  AREA: 2,
};

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Definição de uma skill/habilidade
 */
export interface SkillDefinition {
  code: string;
  name: string;
  description: string;
  category: SkillCategory;

  // Custo (apenas para ACTIVE)
  costTier?: SkillCostTier;

  // Alcance (apenas para ACTIVE)
  range?: SkillRange;
  rangeValue?: number; // Valor customizado para RANGED/AREA

  // Alvo (para ACTIVE com AREA)
  targetType?: SkillTargetType;

  // Execução
  functionName?: string; // Nome da função que executa a skill
  conditionApplied?: string; // Para PASSIVE: condição que aplica

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

/**
 * Calcula distância Manhattan entre dois pontos
 */
export function getManhattanDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

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
 * Verifica se um alvo adjacente (1 bloco) é válido
 */
export function isAdjacent(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): boolean {
  return getManhattanDistance(x1, y1, x2, y2) === 1;
}

/**
 * Obtém todas as posições adjacentes a um ponto
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
    ADJACENT: "Adjacente",
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
    ALLY: "Aliados",
    ENEMY: "Inimigos",
    ALL: "Todos",
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
export function getResourceLabel(resource: SkillResourceType): string {
  const labels: Record<SkillResourceType, string> = {
    FOOD: "Suprimentos",
    DEVOTION: "Devoção",
    ARCANA: "Arcana",
  };
  return labels[resource];
}
