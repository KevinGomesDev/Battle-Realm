/**
 * Battle Canvas Module
 *
 * Estrutura organizada:
 * - /types      - Tipos e interfaces compartilhados
 * - /hooks      - Hooks de cálculos e interações
 * - /renderers  - Funções de renderização do canvas
 * - /components - Componentes React (tooltips, etc)
 */

// ============================================
// SPRITE CONFIG
// ============================================
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

// ============================================
// SPRITE HOOKS
// ============================================
export {
  useSprites,
  useUnitAnimationStates,
  updateSpriteFrame,
} from "./useSprites";
export type { UnitAnimationState } from "./useSprites";
export { useUnitAnimations } from "./useUnitAnimations";

// ============================================
// CONSTANTS
// ============================================
export { UI_COLORS, UNIT_RENDER_CONFIG } from "./canvas.constants";

// ============================================
// TYPES
// ============================================
export type {
  ActiveBubble,
  Position,
  AbilityAreaPreview,
  SpellAreaPreview,
  SingleTargetLinePreview,
  TeleportLinePreview,
  MovementTooltipInfo,
  HoverTooltipInfo,
  UnitDirectionInfo,
  BattleCanvasProps,
  BattleCanvasRef,
  RenderContext,
  GridColors,
  TerrainColors,
} from "./types";

// ============================================
// HOOKS
// ============================================
export {
  useVisibleCells,
  useMovableCells,
  useAttackableCells,
  usePositionMaps,
  useCanvasMouse,
  useTooltipInfo,
  useAnimationLoop,
  useGridCache,
} from "./hooks";

// ============================================
// RENDERERS
// ============================================
export {
  drawStaticGrid,
  drawCellHighlights,
  drawObstacle3D,
  drawAllObstacles,
  calculatePerspectivePosition,
  drawUnit,
  drawConditions,
  drawSpeechBubble,
  drawTurnIndicator,
  drawFogOfWar,
  drawTargetingPreview,
  drawAbilityRangeIndicator,
  drawAbilityAreaPreview,
  calculateAreaPreviewCenter,
  drawSingleTargetLine,
} from "./renderers";

// ============================================
// COMPONENTS
// ============================================
export { MovementTooltip, HoverTooltip } from "./components";

// ============================================
// MAIN CANVAS COMPONENT
// ============================================
export { BattleCanvas } from "./BattleCanvas";
