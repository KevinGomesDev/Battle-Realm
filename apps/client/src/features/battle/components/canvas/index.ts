// Canvas Utilities (exported first to avoid circular imports)
export {
  HERO_IDS,
  TOTAL_HEROES,
  ANIMATION_CONFIGS,
  FRAME_SIZE,
  getHeroSpriteConfig,
  getAnimationPath,
  getHeroThumbnailPath,
  parseAvatarToHeroId,
  heroIdToAvatarString,
  getRandomHeroId,
  isValidHeroId,
  getHeroIdForUnit,
  CLASS_CODE_TO_HERO_ID,
  COMBAT_STATE_TO_ANIMATION,
} from "./sprite.config";
export type {
  SpriteAnimation,
  CombatAnimationState,
  SpriteDirection,
  HeroSpriteConfig,
  AnimationConfig,
} from "./sprite.config";
export {
  useSprites,
  useUnitAnimationStates,
  updateSpriteFrame,
} from "./useSprites";
export type { UnitAnimationState } from "./useSprites";
export { useUnitAnimations } from "./useUnitAnimations";
export { UI_COLORS, UNIT_RENDER_CONFIG } from "./canvas.constants";

// Main Canvas Component
export { BattleCanvas } from "./BattleCanvas";
export type { BattleCanvasRef } from "./BattleCanvas";
