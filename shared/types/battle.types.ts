// shared/types/battle.types.ts
// Tipos para Batalha - Clima, Terreno e Obstáculos
// NOTA: As definições de configuração estão centralizadas em global.config.ts
// Este arquivo re-exporta para compatibilidade

// Re-exportar tipos e configurações de global.config.ts
export type {
  TerritorySize,
  WeatherType,
  BattleTerrainType,
  WeatherDefinition,
  BattleTerrainDefinition,
} from "../config/global.config";

export {
  // Clima
  WEATHER_CONFIG,
  WEATHER_DEFINITIONS,
  ALL_WEATHER_TYPES,
  getWeatherDefinition,
  getRandomWeather,
  // Terreno
  TERRAIN_CONFIG,
  BATTLE_TERRAIN_DEFINITIONS,
  ALL_TERRAIN_TYPES,
  getTerrainDefinition,
  getRandomTerrain,
  // Tamanho de território
  TERRITORY_SIZE_CONFIG,
  ALL_TERRITORY_SIZES,
  getRandomTerritorySize,
  // Obstáculos
  OBSTACLE_CONFIG,
  getObstacleCount,
  // Grid
  GRID_CONFIG,
  getGridDimensions,
  getRandomArenaSize,
} from "../config/global.config";

// =============================================================================
// OBSTÁCULOS - Interface (mantida aqui por ser tipo de dados)
// =============================================================================

/**
 * Obstáculo no grid de batalha
 */
export interface BattleObstacle {
  id: string;
  posX: number;
  posY: number;
  emoji: string;
  hp?: number; // HP do obstáculo (default: 5)
  maxHp?: number; // HP máximo (default: 5)
  destroyed?: boolean; // Se foi destruído
}

// =============================================================================
// CONFIGURAÇÃO DE BATALHA - Interface (mantida aqui por ser tipo de dados)
// =============================================================================

import type {
  WeatherType,
  BattleTerrainType,
  TerritorySize,
} from "../config/global.config";

/**
 * Configuração de mapa de batalha
 */
export interface BattleMapConfig {
  weather: WeatherType;
  terrainType: BattleTerrainType;
  territorySize: TerritorySize;
  obstacles: BattleObstacle[];
}
