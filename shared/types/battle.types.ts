// shared/types/battle.types.ts
// Tipos para Batalha - Clima, Terreno e Obstáculos

// =============================================================================
// CLIMA (WEATHER)
// =============================================================================

/**
 * Tipos de clima disponíveis
 */
export type WeatherType =
  | "SUNNY" // Ensolarado - sem efeito
  | "RAIN" // Chuva - derrubada
  | "STORM" // Tempestade - derrubada + gasta ação
  | "SNOW" // Neve - 2 dano verdadeiro
  | "BLIZZARD" // Nevasca - 4 dano verdadeiro
  | "FALLING_LEAVES"; // Folhas Caindo - teleporte aleatório

/**
 * Definição de um clima
 */
export interface WeatherDefinition {
  code: WeatherType;
  name: string;
  description: string;
  emoji: string;
  effect: string;
  cssFilter: string; // Filtro CSS para aplicar no grid
}

/**
 * Todos os climas disponíveis
 */
export const WEATHER_DEFINITIONS: Record<WeatherType, WeatherDefinition> = {
  SUNNY: {
    code: "SUNNY",
    name: "Ensolarado",
    description: "Um dia claro e agradável.",
    emoji: "☀️",
    effect: "Nenhum efeito.",
    cssFilter: "",
  },
  RAIN: {
    code: "RAIN",
    name: "Chuva",
    description: "O chão fica escorregadio.",
    emoji: "🌧️",
    effect: "Ao falhar uma ação, a unidade fica Derrubada.",
    cssFilter: "brightness(0.85) saturate(0.9) hue-rotate(200deg)",
  },
  STORM: {
    code: "STORM",
    name: "Tempestade",
    description: "Ventos poderosos e chão escorregadio.",
    emoji: "⛈️",
    effect:
      "Ao falhar uma ação, a unidade fica Derrubada e precisa gastar uma ação para se levantar.",
    cssFilter: "brightness(0.7) saturate(0.8) contrast(1.1)",
  },
  SNOW: {
    code: "SNOW",
    name: "Neve",
    description: "A neve traz um frio ancestral.",
    emoji: "🌨️",
    effect: "Ao falhar uma ação, a unidade recebe 2 de Dano Verdadeiro.",
    cssFilter: "brightness(1.1) saturate(0.7) hue-rotate(180deg)",
  },
  BLIZZARD: {
    code: "BLIZZARD",
    name: "Nevasca",
    description: "A nevasca é tão poderosa quanto o mais temido dos Generais.",
    emoji: "❄️",
    effect: "Ao falhar uma ação, a unidade recebe 4 de Dano Verdadeiro.",
    cssFilter: "brightness(1.2) saturate(0.5) contrast(0.9)",
  },
  FALLING_LEAVES: {
    code: "FALLING_LEAVES",
    name: "Folhas Caindo",
    description: "Uma misteriosa força está afetando a batalha.",
    emoji: "🍂",
    effect:
      "Ao falhar uma ação, a unidade é movida para um lugar aleatório do campo de batalha.",
    cssFilter: "sepia(0.3) brightness(0.95)",
  },
};

/**
 * Lista de todos os climas para sorteio
 */
export const ALL_WEATHER_TYPES: WeatherType[] = Object.keys(
  WEATHER_DEFINITIONS
) as WeatherType[];

/**
 * Obtém definição de clima
 */
export function getWeatherDefinition(
  weather: WeatherType
): WeatherDefinition | undefined {
  return WEATHER_DEFINITIONS[weather];
}

/**
 * Sorteia um clima aleatório
 */
export function getRandomWeather(): WeatherType {
  const index = Math.floor(Math.random() * ALL_WEATHER_TYPES.length);
  return ALL_WEATHER_TYPES[index];
}

// =============================================================================
// TERRENO (TERRAIN)
// =============================================================================

/**
 * Tipos de terreno para batalha
 */
export type BattleTerrainType =
  | "FOREST"
  | "PLAINS"
  | "MOUNTAIN"
  | "DESERT"
  | "ICE"
  | "WASTELAND"
  | "SWAMP"
  | "RUINS";

/**
 * Tamanho do território
 */
export type TerritorySize = "SMALL" | "MEDIUM" | "LARGE";

/**
 * Definição de terreno para batalha
 */
export interface BattleTerrainDefinition {
  code: BattleTerrainType;
  name: string;
  obstacleEmoji: string;
  obstacleAlt: string; // Emoji alternativo
}

/**
 * Todos os terrenos disponíveis
 */
export const BATTLE_TERRAIN_DEFINITIONS: Record<
  BattleTerrainType,
  BattleTerrainDefinition
> = {
  FOREST: {
    code: "FOREST",
    name: "Floresta",
    obstacleEmoji: "🌲",
    obstacleAlt: "🌳",
  },
  PLAINS: {
    code: "PLAINS",
    name: "Planície",
    obstacleEmoji: "🪨",
    obstacleAlt: "🌾",
  },
  MOUNTAIN: {
    code: "MOUNTAIN",
    name: "Montanha",
    obstacleEmoji: "🗻",
    obstacleAlt: "⛰️",
  },
  DESERT: {
    code: "DESERT",
    name: "Deserto",
    obstacleEmoji: "🌵",
    obstacleAlt: "🏜️",
  },
  ICE: {
    code: "ICE",
    name: "Gelo",
    obstacleEmoji: "🧊",
    obstacleAlt: "❄️",
  },
  WASTELAND: {
    code: "WASTELAND",
    name: "Terra Devastada",
    obstacleEmoji: "💀",
    obstacleAlt: "🦴",
  },
  SWAMP: {
    code: "SWAMP",
    name: "Pântano",
    obstacleEmoji: "🐸",
    obstacleAlt: "🌿",
  },
  RUINS: {
    code: "RUINS",
    name: "Ruínas",
    obstacleEmoji: "🏚️",
    obstacleAlt: "🪦",
  },
};

/**
 * Lista de todos os terrenos para sorteio
 */
export const ALL_TERRAIN_TYPES: BattleTerrainType[] = Object.keys(
  BATTLE_TERRAIN_DEFINITIONS
) as BattleTerrainType[];

/**
 * Sorteia um terreno aleatório
 */
export function getRandomTerrain(): BattleTerrainType {
  const index = Math.floor(Math.random() * ALL_TERRAIN_TYPES.length);
  return ALL_TERRAIN_TYPES[index];
}

// =============================================================================
// OBSTÁCULOS
// =============================================================================

/**
 * Range de obstáculos por tamanho de território
 */
export const OBSTACLE_RANGES: Record<
  TerritorySize,
  { min: number; max: number }
> = {
  SMALL: { min: 1, max: 6 },
  MEDIUM: { min: 1, max: 12 },
  LARGE: { min: 1, max: 18 },
};

/**
 * Lista de tamanhos de território para sorteio
 */
export const ALL_TERRITORY_SIZES: TerritorySize[] = [
  "SMALL",
  "MEDIUM",
  "LARGE",
];

/**
 * Sorteia um tamanho de território aleatório
 */
export function getRandomTerritorySize(): TerritorySize {
  const index = Math.floor(Math.random() * ALL_TERRITORY_SIZES.length);
  return ALL_TERRITORY_SIZES[index];
}

/**
 * Obstáculo no grid de batalha
 */
export interface BattleObstacle {
  id: string;
  posX: number;
  posY: number;
  emoji: string;
}

/**
 * Gera quantidade aleatória de obstáculos baseado no tamanho
 */
export function getObstacleCount(size: TerritorySize): number {
  const range = OBSTACLE_RANGES[size];
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

// =============================================================================
// CONFIGURAÇÃO DE BATALHA
// =============================================================================

/**
 * Configuração de mapa de batalha
 */
export interface BattleMapConfig {
  weather: WeatherType;
  terrainType: BattleTerrainType;
  territorySize: TerritorySize;
  obstacles: BattleObstacle[];
}
