// shared/config/terrain.config.ts
// Configuração unificada de terrenos (WorldMap e Batalhas)

// =============================================================================
// TIPOS
// =============================================================================

export type TerrainType =
  | "FOREST"
  | "PLAINS"
  | "MOUNTAIN"
  | "DESERT"
  | "ICE"
  | "WASTELAND"
  | "SWAMP"
  | "RUINS"
  | "OCEAN";

export type TerritorySize = "SMALL" | "MEDIUM" | "LARGE";

// Alias para compatibilidade
export type BattleTerrainType = TerrainType;

export interface TerrainColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
}

export interface TerrainDefinition {
  code: TerrainType;
  name: string;
  emoji: string;
  obstacleEmoji: string;
  obstacleAlt: string;
  /** Cores para o grid de batalha (variações para padrão xadrez) */
  colors: {
    primary: TerrainColor;
    secondary: TerrainColor;
    accent: TerrainColor;
  };
  /** Cor para o WorldMap (hex) */
  worldMapColor: number;
  /** Se pode ter batalhas neste terreno */
  allowsBattle: boolean;
}

// =============================================================================
// DEFINIÇÕES DE TERRENO
// =============================================================================

export const TERRAIN_CONFIG = {
  definitions: {
    FOREST: {
      code: "FOREST" as TerrainType,
      name: "Floresta",
      emoji: "🌲",
      obstacleEmoji: "🌲",
      obstacleAlt: "🌳",
      colors: {
        primary: { hex: "#2d5a3f", rgb: { r: 45, g: 90, b: 63 } },
        secondary: { hex: "#1e3d2a", rgb: { r: 30, g: 61, b: 42 } },
        accent: { hex: "#3d7a52", rgb: { r: 61, g: 122, b: 82 } },
      },
      worldMapColor: 0x2d6a4f,
      allowsBattle: true,
    },
    PLAINS: {
      code: "PLAINS" as TerrainType,
      name: "Planície",
      emoji: "🌾",
      obstacleEmoji: "🪨",
      obstacleAlt: "🌾",
      colors: {
        primary: { hex: "#7cb668", rgb: { r: 124, g: 182, b: 104 } },
        secondary: { hex: "#5a9a47", rgb: { r: 90, g: 154, b: 71 } },
        accent: { hex: "#95d5b2", rgb: { r: 149, g: 213, b: 178 } },
      },
      worldMapColor: 0x95d5b2,
      allowsBattle: true,
    },
    MOUNTAIN: {
      code: "MOUNTAIN" as TerrainType,
      name: "Montanha",
      emoji: "⛰️",
      obstacleEmoji: "🗻",
      obstacleAlt: "⛰️",
      colors: {
        primary: { hex: "#6b7b8a", rgb: { r: 107, g: 123, b: 138 } },
        secondary: { hex: "#4a5a68", rgb: { r: 74, g: 90, b: 104 } },
        accent: { hex: "#8a9aaa", rgb: { r: 138, g: 154, b: 170 } },
      },
      worldMapColor: 0x778da9,
      allowsBattle: true,
    },
    DESERT: {
      code: "DESERT" as TerrainType,
      name: "Deserto",
      emoji: "🏜️",
      obstacleEmoji: "🌵",
      obstacleAlt: "🏜️",
      colors: {
        primary: { hex: "#d4a855", rgb: { r: 212, g: 168, b: 85 } },
        secondary: { hex: "#b8923d", rgb: { r: 184, g: 146, b: 61 } },
        accent: { hex: "#e9c46a", rgb: { r: 233, g: 196, b: 106 } },
      },
      worldMapColor: 0xe9c46a,
      allowsBattle: true,
    },
    ICE: {
      code: "ICE" as TerrainType,
      name: "Gelo",
      emoji: "❄️",
      obstacleEmoji: "🧊",
      obstacleAlt: "❄️",
      colors: {
        primary: { hex: "#c5d8f0", rgb: { r: 197, g: 216, b: 240 } },
        secondary: { hex: "#a8c4e8", rgb: { r: 168, g: 196, b: 232 } },
        accent: { hex: "#dbe7ff", rgb: { r: 219, g: 231, b: 255 } },
      },
      worldMapColor: 0xdbe7ff,
      allowsBattle: true,
    },
    WASTELAND: {
      code: "WASTELAND" as TerrainType,
      name: "Terra Devastada",
      emoji: "💀",
      obstacleEmoji: "💀",
      obstacleAlt: "🦴",
      colors: {
        primary: { hex: "#5c4a3d", rgb: { r: 92, g: 74, b: 61 } },
        secondary: { hex: "#3d3229", rgb: { r: 61, g: 50, b: 41 } },
        accent: { hex: "#6c584c", rgb: { r: 108, g: 88, b: 76 } },
      },
      worldMapColor: 0x6c584c,
      allowsBattle: true,
    },
    SWAMP: {
      code: "SWAMP" as TerrainType,
      name: "Pântano",
      emoji: "🐸",
      obstacleEmoji: "🐸",
      obstacleAlt: "🌿",
      colors: {
        primary: { hex: "#4a5d4a", rgb: { r: 74, g: 93, b: 74 } },
        secondary: { hex: "#3a4d3a", rgb: { r: 58, g: 77, b: 58 } },
        accent: { hex: "#5a6d5a", rgb: { r: 90, g: 109, b: 90 } },
      },
      worldMapColor: 0x4a5d4a,
      allowsBattle: true,
    },
    RUINS: {
      code: "RUINS" as TerrainType,
      name: "Ruínas",
      emoji: "🏚️",
      obstacleEmoji: "🏚️",
      obstacleAlt: "🪦",
      colors: {
        primary: { hex: "#5a5a5a", rgb: { r: 90, g: 90, b: 90 } },
        secondary: { hex: "#3a3a3a", rgb: { r: 58, g: 58, b: 58 } },
        accent: { hex: "#7a7a7a", rgb: { r: 122, g: 122, b: 122 } },
      },
      worldMapColor: 0x5a5a5a,
      allowsBattle: true,
    },
    OCEAN: {
      code: "OCEAN" as TerrainType,
      name: "Oceano",
      emoji: "🌊",
      obstacleEmoji: "🌊",
      obstacleAlt: "🐚",
      colors: {
        primary: { hex: "#3d6a8a", rgb: { r: 61, g: 106, b: 138 } },
        secondary: { hex: "#2d5a7a", rgb: { r: 45, g: 90, b: 122 } },
        accent: { hex: "#457b9d", rgb: { r: 69, g: 123, b: 157 } },
      },
      worldMapColor: 0x457b9d,
      allowsBattle: false,
    },
  } as Record<TerrainType, TerrainDefinition>,
} as const;

// Aliases
export const TERRAIN_DEFINITIONS = TERRAIN_CONFIG.definitions;
export const BATTLE_TERRAIN_DEFINITIONS = TERRAIN_DEFINITIONS;

export const ALL_TERRAIN_TYPES: TerrainType[] = Object.keys(
  TERRAIN_CONFIG.definitions
) as TerrainType[];

export const BATTLE_TERRAIN_TYPES: TerrainType[] = ALL_TERRAIN_TYPES.filter(
  (t) => TERRAIN_CONFIG.definitions[t].allowsBattle
);

// =============================================================================
// CONFIGURAÇÃO DE TAMANHO DE TERRITÓRIO
// =============================================================================

export const TERRITORY_SIZE_CONFIG = {
  allSizes: ["SMALL", "MEDIUM", "LARGE"] as TerritorySize[],
} as const;

export const ALL_TERRITORY_SIZES = TERRITORY_SIZE_CONFIG.allSizes;

// =============================================================================
// HELPERS
// =============================================================================

export function getTerrainDefinition(terrain: TerrainType): TerrainDefinition {
  return TERRAIN_CONFIG.definitions[terrain];
}

export function getRandomTerrain(): TerrainType {
  const index = Math.floor(Math.random() * BATTLE_TERRAIN_TYPES.length);
  return BATTLE_TERRAIN_TYPES[index];
}

export function getTerrainColors(
  terrain: TerrainType
): TerrainDefinition["colors"] {
  return TERRAIN_CONFIG.definitions[terrain].colors;
}

export function getRandomTerritorySize(): TerritorySize {
  const index = Math.floor(Math.random() * ALL_TERRITORY_SIZES.length);
  return ALL_TERRITORY_SIZES[index];
}
