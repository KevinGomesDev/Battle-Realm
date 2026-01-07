// shared/types/battle.types.ts
// Tipos para Batalha - Terreno e Obstáculos
// NOTA: As definições de configuração estão centralizadas em global.config.ts
// Este arquivo re-exporta para compatibilidade

// Re-exportar tipos e configurações de global.config.ts
export type {
  TerritorySize,
  TerrainType,
  BattleTerrainType, // Alias legado
  TerrainDefinition,
  TerrainColor,
  ObstacleType,
  ObstacleVisualConfig,
} from "../config/global.config";

export {
  // Terreno
  TERRAIN_CONFIG,
  TERRAIN_DEFINITIONS,
  BATTLE_TERRAIN_DEFINITIONS, // Alias legado
  ALL_TERRAIN_TYPES,
  BATTLE_TERRAIN_TYPES,
  getTerrainDefinition,
  getRandomTerrain,
  getTerrainColors,
  // Tamanho de território
  TERRITORY_SIZE_CONFIG,
  ALL_TERRITORY_SIZES,
  getRandomTerritorySize,
  // Obstáculos
  OBSTACLE_CONFIG,
  getObstacleCount,
  OBSTACLE_VISUAL_CONFIG,
  TERRAIN_OBSTACLE_TYPES,
  getRandomObstacleType,
  getObstacleVisualConfig,
  // Grid
  GRID_CONFIG,
  getGridDimensions,
  getRandomArenaSize,
} from "../config/global.config";

// =============================================================================
// OBSTÁCULOS - Interface (mantida aqui por ser tipo de dados)
// =============================================================================

import type { ObstacleType } from "../config/global.config";

/**
 * Obstáculo no grid de batalha
 * Usa sistema visual 2.5D com tipos ao invés de emojis
 */
export interface BattleObstacle {
  id: string;
  posX: number;
  posY: number;
  /** Tipo do obstáculo para renderização 2.5D */
  type: ObstacleType;
  /** @deprecated Use 'type' - mantido apenas para compatibilidade */
  emoji?: string;
  hp?: number; // HP do obstáculo (default: 5)
  maxHp?: number; // HP máximo (default: 5)
  destroyed?: boolean; // Se foi destruído
}

// =============================================================================
// CONFIGURAÇÃO DE BATALHA - Interface (mantida aqui por ser tipo de dados)
// =============================================================================

import type {
  TerrainType,
  TerritorySize,
  UnitSize,
} from "../config/global.config";

import type { ActiveEffectsMap } from "./conditions.types";

/**
 * Configuração de mapa de batalha
 */
export interface BattleMapConfig {
  terrainType: TerrainType;
  territorySize: TerritorySize;
  obstacles: BattleObstacle[];
}

// =============================================================================
// BATTLE UNIT - Tipo principal de unidade em batalha
// =============================================================================

/**
 * Unidade em batalha - tipo principal usado em todo o sistema de combate
 */
export interface BattleUnit {
  id: string;
  sourceUnitId: string;
  ownerId: string;
  ownerKingdomId: string;
  name: string;
  avatar?: string;
  category: string;
  troopSlot?: number;
  level: number;
  race: string;
  classCode?: string;
  /** Skills disponíveis: ações comuns (ATTACK, DASH, DODGE) + skills de classe */
  features: string[];
  equipment: string[];
  combat: number;
  speed: number;
  focus: number;
  resistance: number;
  will: number;
  vitality: number;
  damageReduction: number;
  currentHp: number;
  maxHp: number;
  currentMana: number;
  maxMana: number;
  posX: number;
  posY: number;
  movesLeft: number;
  actionsLeft: number;
  attacksLeftThisTurn: number;
  isAlive: boolean;
  actionMarks: number;
  physicalProtection: number;
  maxPhysicalProtection: number;
  magicalProtection: number;
  maxMagicalProtection: number;
  conditions: string[];
  spells: string[]; // Lista de códigos de spells disponíveis
  hasStartedAction: boolean;
  grabbedByUnitId?: string;
  size: UnitSize;
  visionRange: number;
  unitCooldowns: Record<string, number>;
  isAIControlled: boolean;
  /** Comportamento de IA para summons/monsters (default: AGGRESSIVE) */
  aiBehavior?: "AGGRESSIVE" | "TACTICAL" | "DEFENSIVE" | "SUPPORT" | "RANGED";
  /**
   * Efeitos ativos calculados a partir das condições
   * Agregados pelo servidor e enviados ao cliente para exibição dinâmica
   */
  activeEffects?: ActiveEffectsMap;
}
