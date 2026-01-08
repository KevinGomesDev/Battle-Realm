// shared/types/map.types.ts
// Tipos de Mapa compartilhados entre Frontend e Backend

import type { TerritorySize, TerrainType } from "../config";

// Re-export TerrainType e TerritorySize for convenience
export type { TerritorySize, TerrainType };

// Alias legado para compatibilidade
export type TerrainName = TerrainType;

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
  terrainType: TerrainType;
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
