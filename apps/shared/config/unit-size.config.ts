// shared/config/unit-size.config.ts
// Configuração de tamanho de unidades para batalha

// =============================================================================
// TIPOS E DEFINIÇÕES
// =============================================================================

export type UnitSize = "NORMAL" | "LARGE" | "HUGE" | "GARGANTUAN";

export interface UnitSizeDefinition {
  key: UnitSize;
  name: string;
  /** Dimensão em blocos (NxN) */
  dimension: number;
  /** Número total de células ocupadas */
  cells: number;
  /** Descrição para UI */
  description: string;
  /** Emoji para representação rápida */
  icon: string;
}

// =============================================================================
// CONFIGURAÇÃO DE TAMANHOS
// =============================================================================

export const UNIT_SIZE_CONFIG: Record<UnitSize, UnitSizeDefinition> = {
  NORMAL: {
    key: "NORMAL",
    name: "Normal",
    dimension: 1,
    cells: 1,
    description: "Unidade de tamanho padrão (1x1)",
    icon: "👤",
  },
  LARGE: {
    key: "LARGE",
    name: "Grande",
    dimension: 2,
    cells: 4,
    description: "Unidade grande (2x2)",
    icon: "🦁",
  },
  HUGE: {
    key: "HUGE",
    name: "Enorme",
    dimension: 4,
    cells: 16,
    description: "Unidade enorme (4x4)",
    icon: "🐘",
  },
  GARGANTUAN: {
    key: "GARGANTUAN",
    name: "Colossal",
    dimension: 8,
    cells: 64,
    description: "Unidade colossal (8x8)",
    icon: "🐉",
  },
};

export const ALL_UNIT_SIZES: UnitSize[] = [
  "NORMAL",
  "LARGE",
  "HUGE",
  "GARGANTUAN",
];

// =============================================================================
// HELPERS
// =============================================================================

export function getUnitSizeDefinition(size: UnitSize): UnitSizeDefinition {
  return UNIT_SIZE_CONFIG[size];
}

/**
 * Retorna todas as células ocupadas por uma unidade baseado em sua posição e tamanho
 */
export function getOccupiedCells(
  posX: number,
  posY: number,
  size: UnitSize
): { x: number; y: number }[] {
  const dimension = UNIT_SIZE_CONFIG[size].dimension;
  const cells: { x: number; y: number }[] = [];

  for (let dx = 0; dx < dimension; dx++) {
    for (let dy = 0; dy < dimension; dy++) {
      cells.push({ x: posX + dx, y: posY + dy });
    }
  }

  return cells;
}

/**
 * Verifica se uma célula está ocupada por uma unidade de tamanho grande
 */
export function isCellOccupiedByUnit(
  cellX: number,
  cellY: number,
  unitPosX: number,
  unitPosY: number,
  unitSize: UnitSize
): boolean {
  const dimension = UNIT_SIZE_CONFIG[unitSize].dimension;
  return (
    cellX >= unitPosX &&
    cellX < unitPosX + dimension &&
    cellY >= unitPosY &&
    cellY < unitPosY + dimension
  );
}
