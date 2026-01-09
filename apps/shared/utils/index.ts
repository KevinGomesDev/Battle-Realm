// shared/utils/index.ts
// Barrel export para utilitários compartilhados

// Blocking - FONTE DE VERDADE para verificação de bloqueio (visão e movimento)
export * from "./blocking.utils";

// Funções de distância (fonte de verdade)
export * from "./distance.utils";

// Engagement
export * from "./engagement.utils";

// Line of sight - export seletivo para evitar re-export de unitsToBlockers
export {
  hasLineOfSight,
  hasLineOfSightFull,
  hasLineOfSightFromUnit,
  hasLineOfSightFromUnitFull,
  isCellVisibleWithLoS,
  getBresenhamLine,
} from "./line-of-sight.utils";

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

// Targeting - export seletivo (novo sistema baseado em CoordinatePattern)
export {
  type TargetingCell,
  type TargetingPreview,
  type GridContext,
  type UnitStats,
  type TargetingDirection,
  type CoordinatePattern,
  type PatternCoordinate,
  // Funções utilitárias
  isInBounds,
  isCellBlocked,
  isCellOccupied,
  getDirectionDelta,
  getDirectionBetweenPoints,
  // Sistema de CoordinatePattern
  calculatePatternCells,
  calculateSelectableCells,
  calculateAffectedCells,
  calculateTargetingPreview,
  // Sistema de projétil
  type ProjectileUnit,
  type ProjectileTrajectory,
  type ProjectileProcessResult,
  orderCoordinatesForProjectile,
  calculateProjectileTrajectory,
  findNextProjectileTarget,
  continueProjectileAfterDodge,
  processProjectileForPattern,
  // Sistema de viagem + explosão
  type TravelObstacle,
  type TravelResult,
  type AreaAbilityResult,
  calculateProjectileTravel,
  processAreaAbility,
  getTargetsInArea,
  // QTE
  handleQTE,
} from "./targeting.utils";
