// shared/config/obstacle.config.ts
// Configuração de obstáculos para batalha

import type { TerrainType, TerritorySize } from "./terrain.config";

// =============================================================================
// TAMANHO DE OBSTÁCULOS
// =============================================================================

export type ObstacleSize = "SMALL" | "MEDIUM" | "LARGE" | "HUGE";

export interface ObstacleSizeDefinition {
  key: ObstacleSize;
  name: string;
  /** Dimensão em blocos (NxN) */
  dimension: number;
  /** Número total de células ocupadas */
  cells: number;
  /** HP base para este tamanho */
  baseHp: number;
  /** Peso para spawn aleatório (maior = mais comum) */
  spawnWeight: number;
  /** Descrição para UI */
  description: string;
}

export const OBSTACLE_SIZE_CONFIG: Record<
  ObstacleSize,
  ObstacleSizeDefinition
> = {
  SMALL: {
    key: "SMALL",
    name: "Pequeno",
    dimension: 1,
    cells: 1,
    baseHp: 3,
    spawnWeight: 50,
    description: "Obstáculo pequeno (1x1)",
  },
  MEDIUM: {
    key: "MEDIUM",
    name: "Médio",
    dimension: 2,
    cells: 4,
    baseHp: 8,
    spawnWeight: 30,
    description: "Obstáculo médio (2x2)",
  },
  LARGE: {
    key: "LARGE",
    name: "Grande",
    dimension: 3,
    cells: 9,
    baseHp: 15,
    spawnWeight: 15,
    description: "Obstáculo grande (3x3)",
  },
  HUGE: {
    key: "HUGE",
    name: "Enorme",
    dimension: 4,
    cells: 16,
    baseHp: 25,
    spawnWeight: 5,
    description: "Obstáculo enorme (4x4)",
  },
};

export const ALL_OBSTACLE_SIZES: ObstacleSize[] = [
  "SMALL",
  "MEDIUM",
  "LARGE",
  "HUGE",
];

/**
 * Retorna a definição de tamanho do obstáculo
 */
export function getObstacleSizeDefinition(
  size: ObstacleSize
): ObstacleSizeDefinition {
  return OBSTACLE_SIZE_CONFIG[size];
}

/**
 * Retorna a dimensão de um obstáculo baseado no tamanho
 */
export function getObstacleDimension(size: ObstacleSize = "SMALL"): number {
  return OBSTACLE_SIZE_CONFIG[size].dimension;
}

/**
 * Retorna todas as células ocupadas por um obstáculo baseado em sua posição e tamanho
 */
export function getObstacleOccupiedCells(
  posX: number,
  posY: number,
  size: ObstacleSize
): { x: number; y: number }[] {
  const dimension = OBSTACLE_SIZE_CONFIG[size].dimension;
  const cells: { x: number; y: number }[] = [];

  for (let dx = 0; dx < dimension; dx++) {
    for (let dy = 0; dy < dimension; dy++) {
      cells.push({ x: posX + dx, y: posY + dy });
    }
  }

  return cells;
}

/**
 * Retorna um tamanho de obstáculo aleatório baseado nos pesos de spawn
 */
export function getRandomObstacleSize(): ObstacleSize {
  const totalWeight = ALL_OBSTACLE_SIZES.reduce(
    (sum, size) => sum + OBSTACLE_SIZE_CONFIG[size].spawnWeight,
    0
  );

  let random = Math.random() * totalWeight;

  for (const size of ALL_OBSTACLE_SIZES) {
    random -= OBSTACLE_SIZE_CONFIG[size].spawnWeight;
    if (random <= 0) {
      return size;
    }
  }

  return "SMALL"; // Fallback
}

// =============================================================================
// CONFIGURAÇÃO GERAL DE OBSTÁCULOS
// =============================================================================

export const OBSTACLE_CONFIG = {
  defaultHp: 5,
  corpseHp: 5,
  corpseBlocksMovement: true,

  ranges: {
    SMALL: { min: 1, max: 8 },
    MEDIUM: { min: 1, max: 16 },
    LARGE: { min: 1, max: 32 },
  } as Record<TerritorySize, { min: number; max: number }>,
} as const;

export function getObstacleCount(size: TerritorySize): number {
  const range = OBSTACLE_CONFIG.ranges[size];
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

// =============================================================================
// TIPOS DE OBSTÁCULOS (2.5D VISUAL)
// =============================================================================

export type ObstacleType =
  | "ROCK"
  | "TREE"
  | "PILLAR"
  | "CRATE"
  | "CRYSTAL"
  | "RUINS"
  | "ICE_SPIKE"
  | "CACTUS"
  | "MUSHROOM"
  | "TOMBSTONE";

export interface ObstacleVisualConfig {
  type: ObstacleType;
  name: string;
  topColor: string;
  sideXColor: string;
  sideYColor: string;
  heightScale: number;
  highlightColor?: string;
  shape?: "block" | "cylinder" | "pyramid";
}

// =============================================================================
// MAPEAMENTO TERRENO → OBSTÁCULOS
// =============================================================================

export const TERRAIN_OBSTACLE_TYPES: Record<TerrainType, ObstacleType[]> = {
  FOREST: ["TREE", "ROCK", "MUSHROOM"],
  PLAINS: ["ROCK", "CRATE"],
  MOUNTAIN: ["ROCK", "PILLAR"],
  DESERT: ["CACTUS", "ROCK", "RUINS"],
  ICE: ["ICE_SPIKE", "ROCK", "CRYSTAL"],
  WASTELAND: ["TOMBSTONE", "RUINS", "ROCK"],
  SWAMP: ["MUSHROOM", "TREE", "ROCK"],
  RUINS: ["RUINS", "PILLAR", "TOMBSTONE"],
  OCEAN: ["ROCK"],
};

// =============================================================================
// CONFIGURAÇÕES VISUAIS
// =============================================================================

export const OBSTACLE_VISUAL_CONFIG: Record<
  ObstacleType,
  ObstacleVisualConfig
> = {
  ROCK: {
    type: "ROCK",
    name: "Rocha",
    topColor: "#7f8c8d",
    sideXColor: "#5d6d7e",
    sideYColor: "#4d5d6e",
    heightScale: 0.4,
    highlightColor: "#95a5a6",
    shape: "block",
  },
  TREE: {
    type: "TREE",
    name: "Árvore",
    topColor: "#27ae60",
    sideXColor: "#1e8449",
    sideYColor: "#145a32",
    heightScale: 1.2,
    highlightColor: "#2ecc71",
    shape: "cylinder",
  },
  PILLAR: {
    type: "PILLAR",
    name: "Pilar",
    topColor: "#bdc3c7",
    sideXColor: "#95a5a6",
    sideYColor: "#7f8c8d",
    heightScale: 1.5,
    highlightColor: "#ecf0f1",
    shape: "block",
  },
  CRATE: {
    type: "CRATE",
    name: "Caixa",
    topColor: "#d35400",
    sideXColor: "#ba4a00",
    sideYColor: "#a04000",
    heightScale: 0.6,
    highlightColor: "#e67e22",
    shape: "block",
  },
  CRYSTAL: {
    type: "CRYSTAL",
    name: "Cristal",
    topColor: "#9b59b6",
    sideXColor: "#8e44ad",
    sideYColor: "#7d3c98",
    heightScale: 0.8,
    highlightColor: "#bb8fce",
    shape: "pyramid",
  },
  RUINS: {
    type: "RUINS",
    name: "Ruínas",
    topColor: "#5d6d7e",
    sideXColor: "#4a5a6a",
    sideYColor: "#3a4a5a",
    heightScale: 0.5,
    highlightColor: "#85929e",
    shape: "block",
  },
  ICE_SPIKE: {
    type: "ICE_SPIKE",
    name: "Espinho de Gelo",
    topColor: "#85c1e9",
    sideXColor: "#5dade2",
    sideYColor: "#3498db",
    heightScale: 1.0,
    highlightColor: "#aed6f1",
    shape: "pyramid",
  },
  CACTUS: {
    type: "CACTUS",
    name: "Cacto",
    topColor: "#58d68d",
    sideXColor: "#28b463",
    sideYColor: "#1d8348",
    heightScale: 0.9,
    highlightColor: "#82e0aa",
    shape: "cylinder",
  },
  MUSHROOM: {
    type: "MUSHROOM",
    name: "Cogumelo",
    topColor: "#e74c3c",
    sideXColor: "#f5b7b1",
    sideYColor: "#fadbd8",
    heightScale: 0.5,
    highlightColor: "#f1948a",
    shape: "cylinder",
  },
  TOMBSTONE: {
    type: "TOMBSTONE",
    name: "Lápide",
    topColor: "#566573",
    sideXColor: "#2c3e50",
    sideYColor: "#1c2833",
    heightScale: 0.7,
    highlightColor: "#aab7b8",
    shape: "block",
  },
};

// =============================================================================
// HELPERS
// =============================================================================

export function getRandomObstacleType(terrain: TerrainType): ObstacleType {
  const types = TERRAIN_OBSTACLE_TYPES[terrain] || ["ROCK"];
  return types[Math.floor(Math.random() * types.length)];
}

export function getObstacleVisualConfig(
  type: ObstacleType
): ObstacleVisualConfig {
  return OBSTACLE_VISUAL_CONFIG[type] || OBSTACLE_VISUAL_CONFIG.ROCK;
}
