// shared/utils/index.ts
// Barrel export para utilitários compartilhados

// Funções de distância (fonte de verdade)
export * from "./distance.utils";

// Engagement
export * from "./engagement.utils";

// Line of sight
export * from "./line-of-sight.utils";

// Ability validation - export selectivo para evitar re-export de distance functions
export {
  type AbilityValidationResult,
  type AbilityValidationErrorCode,
  unitHasAbility,
  getAbilityMaxRange,
  validateAbilityUse,
  validateAbilityRange,
  validateAbilityTargetType,
  canUseAbility,
  isValidAbilityTarget,
  getValidAbilityTargets,
  isValidAbilityPosition,
  // Aliases para compatibilidade
  validateSkillUse,
  validateSpellUse,
  canUseSkill,
  canUseSpell,
  isValidSkillTarget,
  isValidSpellTarget,
  getValidSkillTargets,
  getValidSpellTargets,
  getSkillMaxRange,
  getSpellMaxRange,
} from "./ability-validation";

// Targeting - export seletivo para evitar re-export de distance functions
export {
  type TargetingConfig,
  type TargetingCell,
  type TargetingPreview,
  type GridContext,
  type TargetingDirection,
  type TargetingShape,
  isInBounds,
  isCellBlocked,
  isCellOccupied,
  getDiamondCells,
  getSquareCells,
  getLineCells,
  getCrossCells,
  getRingCells,
  getDirectionDelta,
  getDirectionBetweenPoints,
  calculateSelectableCells,
  calculateAffectedCells,
  calculateTargetingPreview,
  getBasicAttackTargeting,
  // Projectile system
  type ProjectileUnit,
  type ProjectileConfig,
  type ProjectileFilterResult,
  sortUnitsByDistance,
  filterCellsByProjectile,
  getProjectileTargets,
  abilityToProjectileConfig,
} from "./targeting.utils";
