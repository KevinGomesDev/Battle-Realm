// server/src/modules/abilities/executors/types.ts
// Tipos compartilhados para executores de abilities

import type {
  AbilityDefinition,
  AbilityExecutionResult,
} from "@boundless/shared/types/ability.types";
import type {
  BattleObstacle,
  BattleUnit,
} from "@boundless/shared/types/battle.types";

// =============================================================================
// SKILL TYPES
// =============================================================================

/** Contexto opcional para execução de skills */
export interface SkillExecutionContext {
  targetPosition?: { x: number; y: number };
  obstacles?: BattleObstacle[];
  /** ID da batalha (para eventos) */
  battleId?: string;
  /** Largura do grid de batalha */
  gridWidth?: number;
  /** Altura do grid de batalha */
  gridHeight?: number;
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

/** Contexto para execução de spells */
export interface SpellExecutionContext {
  targetPosition?: { x: number; y: number };
  obstacles?: BattleObstacle[];
  battleId?: string;
  /** Largura do grid de batalha */
  gridWidth?: number;
  /** Altura do grid de batalha */
  gridHeight?: number;
}

export type SpellExecutorFn = (
  caster: BattleUnit,
  target: BattleUnit | { x: number; y: number } | null,
  allUnits: BattleUnit[],
  spell: AbilityDefinition,
  context?: SpellExecutionContext
) => AbilityExecutionResult;

// =============================================================================
// UNIFIED EXECUTION CONTEXT
// =============================================================================

export interface AbilityExecutionContext {
  targetPosition?: { x: number; y: number };
  obstacles?: Array<{
    id?: string;
    x?: number;
    y?: number;
    posX?: number;
    posY?: number;
    hp?: number;
    destroyed?: boolean;
    type?: string;
  }>;
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
  targetType?: "unit" | "corpse" | "obstacle";
  rawDamage?: number;
  bonusDamage?: number;
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
  damageTransferredToEidolon?: boolean;
  eidolonDefeated?: boolean;
  killedSummonIds?: string[];
}

// =============================================================================
// EXECUTOR REGISTRY TYPE
// =============================================================================

export type AbilityExecutorFn = SkillExecutorFn | SpellExecutorFn;

export type ExecutorRegistry = Record<string, AbilityExecutorFn>;
