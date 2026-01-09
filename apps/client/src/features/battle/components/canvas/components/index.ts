// Canvas UI Components
export { MovementTooltip } from "./MovementTooltip";
export { HoverTooltip } from "./HoverTooltip";

// Projectile System
export {
  ProjectileTrajectory,
  useProjectileAnimations,
  type ProjectileConfig,
  type ProjectileType,
  type ActiveProjectile,
} from "./ProjectileTrajectory";
export {
  getProjectileType,
  getProjectileConfig,
  calculateProjectileDuration,
  PROJECTILE_CONFIGS,
  ABILITY_TO_PROJECTILE,
} from "./ProjectileTrajectory/projectile.config";
