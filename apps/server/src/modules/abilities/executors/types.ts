// server/src/modules/abilities/executors/types.ts
// Tipos compartilhados para executores de abilities

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "../../../../../shared/types/ability.types";
import type {
  BattleObstacle,
  BattleUnit,
} from "../../../../../shared/types/battle.types";

// =============================================================================
// SKILL TYPES
// =============================================================================

/** Contexto opcional para execução de skills */
export interface SkillExecutionContext {
  targetPosition?: { x: number; y: number };
  obstacles?: BattleObstacle[];
  /** ID da batalha (para eventos) */
  battleId?: string;
}

export type SkillExecutorFn = (
  caster: BattleUnit,
  target: BattleUnit | null,
  allUnits: BattleUnit[],
  skill: AbilityDefinition,
  context?: SkillExecutionContext
) => AbilityExecutionResult;

// =============================================================================
// SPELL TYPES
// =============================================================================

export type SpellExecutorFn = (
  caster: BattleUnit,
  target: BattleUnit | { x: number; y: number } | null,
  allUnits: BattleUnit[],
  spell: AbilityDefinition,
  context?: AbilityExecutionContext
) => AbilityExecutionResult;

// =============================================================================
// UNIFIED EXECUTION CONTEXT
// =============================================================================

export interface AbilityExecutionContext {
  targetPosition?: { x: number; y: number };
  obstacles?: Array<{ x: number; y: number; type: string }>;
  battleId?: string;
  isBattle?: boolean;
}

// =============================================================================
// ATTACK ACTION TYPES
// =============================================================================

/**
 * Resultado de ação de ataque
 */
export interface AttackActionResult {
  success: boolean;
  error?: string;
  missed?: boolean;
  dodged?: boolean;
  targetType?: "unit" | "corpse" | "obstacle";
  rawDamage?: number;
  damageReduction?: number;
  finalDamage?: number;
  damageType?: string;
  targetHpAfter?: number;
  targetPhysicalProtection?: number;
  targetMagicalProtection?: number;
  targetDefeated?: boolean;
  obstacleDestroyed?: boolean;
  obstacleId?: string;
  attacksLeftThisTurn?: number;
  dodgeChance?: number;
  dodgeRoll?: number;
  damageTransferredToEidolon?: boolean;
  eidolonDefeated?: boolean;
  killedSummonIds?: string[];
}

// =============================================================================
// EXECUTOR REGISTRY TYPE
// =============================================================================

export type AbilityExecutorFn = SkillExecutorFn | SpellExecutorFn;

export type ExecutorRegistry = Record<string, AbilityExecutorFn>;
