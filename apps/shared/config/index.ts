// shared/config/index.ts
// Barrel exports de todas as configurações

// =============================================================================
// ATRIBUTOS
// =============================================================================
export {
  type AttributeId,
  type AttributeKey,
  type AttributeName,
  type AttributeStyle,
  type AttributeDefinition,
  type UnitAttributes,
  ATTRIBUTES,
  ATTRIBUTE_NAMES,
  ATTRIBUTE_ID_BY_KEY,
  ATTRIBUTE_KEY_BY_ID,
  ALL_ATTRIBUTE_IDS,
  ALL_ATTRIBUTE_KEYS,
  getAttributeById,
  getAttributeByKey,
  getAttributeName,
  getAttributeNameById,
  getAttributeDefinition,
  getAttributeValue,
  getAttributeValueById,
} from "./attributes.config";

// =============================================================================
// RECURSOS
// =============================================================================
export {
  type ResourceId,
  type ResourceKey,
  type ResourceDefinition,
  RESOURCES,
  RESOURCE_NAMES,
  RESOURCE_ID_BY_KEY,
  RESOURCE_KEY_BY_ID,
  ALL_RESOURCE_IDS,
  ALL_RESOURCE_KEYS,
  getResourceById,
  getResourceByKey,
  getResourceName,
  getResourceNameById,
  getResourceDefinition,
} from "./resources.config";

// =============================================================================
// TAMANHO DE UNIDADES
// =============================================================================
export {
  type UnitSize,
  type UnitSizeDefinition,
  UNIT_SIZE_CONFIG,
  ALL_UNIT_SIZES,
  getUnitSizeDefinition,
  getOccupiedCells,
  isCellOccupiedByUnit,
} from "./unit-size.config";

// =============================================================================
// VISÃO
// =============================================================================
export {
  VISION_CONFIG,
  calculateUnitVision,
  isCellVisible,
  isCellVisibleByUnit,
  isCellVisibleWithLoS,
  isCellVisibleByUnitWithLoS,
  type ObstacleForLoS,
  type UnitForLoS,
} from "./vision.config";

// =============================================================================
// TERRENO
// =============================================================================
export {
  type TerrainType,
  type TerritorySize,
  type BattleTerrainType,
  type TerrainColor,
  type TerrainDefinition,
  TERRAIN_CONFIG,
  TERRAIN_DEFINITIONS,
  BATTLE_TERRAIN_DEFINITIONS,
  ALL_TERRAIN_TYPES,
  BATTLE_TERRAIN_TYPES,
  TERRITORY_SIZE_CONFIG,
  ALL_TERRITORY_SIZES,
  getTerrainDefinition,
  getRandomTerrain,
  getTerrainColors,
  getRandomTerritorySize,
} from "./terrain.config";

// =============================================================================
// COMBATE
// =============================================================================
export {
  ATTACK_CONFIG,
  DEFENSE_CONFIG,
  PHYSICAL_PROTECTION_CONFIG,
  MAGICAL_PROTECTION_CONFIG,
  MANA_CONFIG,
  HP_CONFIG,
  MOVEMENT_CONFIG,
  type MagicDamageTier,
  MAGIC_DAMAGE_CONFIG,
  calculateMagicDamage,
  ACTION_MARKS_CONFIG,
  getMaxMarksByCategory,
  DAMAGE_TYPES,
  type DamageTypeName,
  TURN_CONFIG,
  getDodgeChance,
  calculateDamage,
  calculatePhysicalProtection,
  calculateMagicalProtection,
  calculateMaxHp,
  calculateMovement,
  calculateMaxMana,
} from "./combat.config";

// =============================================================================
// OBSTÁCULOS
// =============================================================================
export {
  OBSTACLE_CONFIG,
  getObstacleCount,
  type ObstacleType,
  type ObstacleVisualConfig,
  TERRAIN_OBSTACLE_TYPES,
  OBSTACLE_VISUAL_CONFIG,
  getRandomObstacleType,
  getObstacleVisualConfig,
} from "./obstacle.config";

// =============================================================================
// GRID / BATTLE
// =============================================================================
export {
  GRID_CONFIG,
  getGridDimensions,
  getRandomBattleSize,
  BATTLE_COLORS,
} from "./grid.config";

// =============================================================================
// DADOS
// =============================================================================
export { DICE_CONFIG } from "./dice.config";

// =============================================================================
// EXPORT CONSOLIDADO (COMPATIBILIDADE)
// =============================================================================
import { ATTACK_CONFIG } from "./combat.config";
import { DEFENSE_CONFIG } from "./combat.config";
import { PHYSICAL_PROTECTION_CONFIG } from "./combat.config";
import { MAGICAL_PROTECTION_CONFIG } from "./combat.config";
import { MANA_CONFIG } from "./combat.config";
import { HP_CONFIG } from "./combat.config";
import { TURN_CONFIG } from "./combat.config";
import { MOVEMENT_CONFIG } from "./combat.config";
import { DAMAGE_TYPES } from "./combat.config";
import { OBSTACLE_CONFIG } from "./obstacle.config";
import { GRID_CONFIG } from "./grid.config";
import { BATTLE_COLORS } from "./grid.config";
import { DICE_CONFIG } from "./dice.config";
import { TERRAIN_CONFIG } from "./terrain.config";
import { TERRITORY_SIZE_CONFIG } from "./terrain.config";

export const GLOBAL_CONFIG = {
  attack: ATTACK_CONFIG,
  defense: DEFENSE_CONFIG,
  physicalProtection: PHYSICAL_PROTECTION_CONFIG,
  magicalProtection: MAGICAL_PROTECTION_CONFIG,
  mana: MANA_CONFIG,
  hp: HP_CONFIG,
  turn: TURN_CONFIG,
  obstacle: OBSTACLE_CONFIG,
  grid: GRID_CONFIG,
  battleColors: BATTLE_COLORS,
  movement: MOVEMENT_CONFIG,
  damageTypes: DAMAGE_TYPES,
  dice: DICE_CONFIG,
  terrain: TERRAIN_CONFIG,
  territorySize: TERRITORY_SIZE_CONFIG,
} as const;

export default GLOBAL_CONFIG;
