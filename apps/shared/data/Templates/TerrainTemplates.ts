// shared/data/Templates/TerrainTemplates.ts
// Templates de configuração de terrenos
// NOTA: As definições principais de terreno estão em shared/config/global.config.ts
// Este arquivo re-exporta e fornece formatos auxiliares

import {
  TERRAIN_CONFIG,
  TERRAIN_DEFINITIONS,
  type TerrainType,
  type TerrainDefinition,
} from "../../config";
import type { TerrainTypeConfig } from "../../types/map.types";

// Formato legado para compatibilidade com worldmap (cores hex number)
export interface WorldMapTerrainInfo {
  color: number;
  name: string;
}

// Converter TERRAIN_DEFINITIONS para formato legado (worldmap)
const _terrainTypesRecord: { [key: string]: WorldMapTerrainInfo } =
  Object.fromEntries(
    Object.entries(TERRAIN_DEFINITIONS).map(([key, def]) => [
      key,
      { color: def.worldMapColor, name: def.name },
    ])
  );

export const TERRAIN_TYPES = _terrainTypesRecord;

// Formato para o frontend (TerrainTypeConfig)
// Usado pelo GameDataContext para renderizar mapa do mundo
const _terrainConfigsRecord: Record<string, TerrainTypeConfig> =
  Object.fromEntries(
    Object.entries(TERRAIN_DEFINITIONS).map(([key, def]) => [
      key,
      {
        id: key,
        name: def.name,
        color: def.colors.primary.hex, // Usar cor primária como string hex
        movementCost: 1, // Padrão, pode ser customizado no futuro
        defenseBonus: 0, // Padrão, pode ser customizado no futuro
      } as TerrainTypeConfig,
    ])
  );

export const TERRAIN_CONFIGS = _terrainConfigsRecord;

// Re-exportar tipos e configs do global
export { TERRAIN_CONFIG, TERRAIN_DEFINITIONS };
export type { TerrainType, TerrainDefinition };
