// shared/types/map.types.ts
// Tipos de Mapa compartilhados entre Frontend e Backend

import type { TerritorySize } from "../config/global.config";

/**
 * Tipos de terreno do mapa mundial
 */
export type TerrainName =
  | "ICE"
  | "MOUNTAIN"
  | "FOREST"
  | "PLAINS"
  | "WASTELAND"
  | "DESERT"
  | "OCEAN";

// Re-export TerritorySize for convenience
export type { TerritorySize };

/**
 * Tipo do território (terra ou água)
 */
export type TerritoryType = "LAND" | "WATER";

/**
 * Representa um território no mapa
 */
export interface Territory {
  id: string;
  matchId: string;
  mapIndex: number;
  centerX: number;
  centerY: number;
  type: TerritoryType;
  terrainType: TerrainName;
  polygonData: string;
  size: TerritorySize;
  areaSlots: number;
  usedSlots: number;
  ownerId: string | null;
  isCapital: boolean;
  hasCrisisIntel: boolean;
  constructionCount: number;
  fortressCount: number;
  isDisabled: boolean;
  // Legacy fields (deprecated, use structures array instead)
  name?: string;
  structures?: unknown[];
  units?: unknown[];
  resources?: Record<string, number>;
}

/**
 * Configuração visual de um tipo de terreno
 */
export interface TerrainTypeConfig {
  id: string;
  name: string;
  color: string;
  movementCost: number;
  defenseBonus: number;
}

/**
 * Informações de uma estrutura no território
 */
export interface StructureInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
  maxHp: number;
  resourceGenerated?: { type: string; amount: number };
  specialEffect?: string;
}
