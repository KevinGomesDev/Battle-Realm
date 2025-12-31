// Arena Configuration - Single source of truth for arena GRID/MAP visual settings
// This is sent to clients to ensure consistent rendering

import { getConditionColorsMap } from "../logic/conditions";
import { generateBattleMap } from "../logic/battle-map";
import type { ArenaConfig } from "../../../shared/types/arena.types";
import type {
  WeatherType,
  BattleTerrainType,
  TerritorySize,
  BattleObstacle,
} from "../../../shared/types/battle.types";

/**
 * Configuração base do arena (sem mapa dinâmico)
 */
export const ARENA_BASE_CONFIG = {
  grid: {
    width: 10,
    height: 5,
  },
  colors: {
    // Grid/Mapa
    gridBackground: "#1a1a2e",
    gridLine: "#16213e",
    gridDot: "#0f3460",
    cellLight: "#2d2d44",
    cellDark: "#1f1f33",
    cellHover: "#3d3d5c",
    cellMovable: "#2a4a2a",
    cellAttackable: "#4a2a2a",
    // Spawn areas
    hostPrimary: "#4a90d9",
    hostSecondary: "#2d5a8a",
    guestPrimary: "#d94a4a",
    guestSecondary: "#8a2d2d",
  },
  conditionColors: getConditionColorsMap(),
};

/**
 * Gera uma configuração completa do arena com mapa dinâmico
 * @param unitPositions Posições das unidades para evitar gerar obstáculos nelas
 */
export function generateArenaConfig(
  unitPositions: Array<{ x: number; y: number }> = []
): ArenaConfig {
  const { grid } = ARENA_BASE_CONFIG;
  const mapConfig = generateBattleMap(grid.width, grid.height, unitPositions);

  return {
    ...ARENA_BASE_CONFIG,
    map: {
      weather: mapConfig.weather,
      weatherEmoji: mapConfig.weatherEmoji,
      weatherName: mapConfig.weatherName,
      weatherEffect: mapConfig.weatherEffect,
      weatherCssFilter: mapConfig.weatherCssFilter,
      terrainType: mapConfig.terrainType,
      terrainName: mapConfig.terrainName,
      territorySize: mapConfig.territorySize,
      obstacles: mapConfig.obstacles,
    },
  };
}

/**
 * @deprecated Use generateArenaConfig para novo código
 * Mantido para compatibilidade
 */
export const ARENA_CONFIG = {
  ...ARENA_BASE_CONFIG,
  map: {
    weather: "SUNNY" as WeatherType,
    weatherEmoji: "☀️",
    weatherName: "Ensolarado",
    weatherEffect: "Nenhum efeito.",
    weatherCssFilter: "",
    terrainType: "PLAINS" as BattleTerrainType,
    terrainName: "Planície",
    territorySize: "MEDIUM" as TerritorySize,
    obstacles: [] as BattleObstacle[],
  },
};

export type { ArenaConfig };
