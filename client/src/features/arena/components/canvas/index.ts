// Canvas Utilities (exported first to avoid circular imports)
export {
  SPRITE_SHEETS,
  getSpriteConfig,
  DEFAULT_SPRITE,
  SPRITE_IDS,
  TOTAL_SPRITES,
  isValidSpriteId,
  getRandomSpriteId,
} from "./sprite.config";
export type { SpriteConfig, SpriteDirection } from "./sprite.config";
export { useSprites } from "./useSprites";
export { useUnitAnimations } from "./useUnitAnimations";
export { UI_COLORS, UNIT_RENDER_CONFIG } from "./canvas.constants";

// Main Canvas Component
export { ArenaBattleCanvas } from "./ArenaBattleCanvas";
export type { ArenaBattleCanvasRef } from "./ArenaBattleCanvas";
