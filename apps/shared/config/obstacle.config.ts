// shared/config/obstacle.config.ts
// Configuração de obstáculos para batalha

import type { TerrainType, TerritorySize } from "./terrain.config";

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
