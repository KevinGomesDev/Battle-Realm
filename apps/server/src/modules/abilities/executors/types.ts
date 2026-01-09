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
  /** Flag para pular QTE (usado após QTE falhar) */
  skipQTE?: boolean;
  /** Ponto de impacto forçado (quando definido pelo QTE) */
  forcedImpactPoint?: { x: number; y: number };
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
  dodged?: boolean;
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
  dodgeChance?: number;
  dodgeRoll?: number;
  damageTransferredToEidolon?: boolean;
  eidolonDefeated?: boolean;
  killedSummonIds?: string[];
  // QTE modifiers applied (for logging/events)
  attackModifier?: number;
  defenseModifier?: number;
  // Esquiva com movimento (para QTE)
  newDefenderPosition?: { x: number; y: number };
  // Buff aplicado por esquiva perfeita
  perfectDodgeBuff?: string;
}

/**
 * Contexto preparado para iniciar QTE de ataque
 * Gerado pelo executor, usado pelo QTEManager
 */
export interface AttackContext {
  /** Dano base calculado (combat + bonusDamage) */
  baseDamage: number;
  /** Bônus de dano de condições */
  bonusDamage: number;
  /** Se o ataque é mágico (MAGIC_WEAPON) */
  isMagicAttack: boolean;
  /** Tipo de dano efetivo */
  damageType: "FISICO" | "MAGICO";
  /** Se o atacante pode realizar o ataque */
  canAttack: boolean;
  /** Motivo se não pode atacar */
  blockReason?: string;
}

/**
 * Resultado do QTE passado para o executor
 * Unifica os dados necessários do QTECombatResult
 */
export interface QTEResultForExecutor {
  /** Se a esquiva foi bem-sucedida */
  dodged: boolean;
  /** Modificador de dano do atacante (1.0 = normal) */
  attackerDamageModifier: number;
  /** Modificador de defesa do defensor (1.0 = normal) */
  defenderDamageModifier: number;
  /** Nova posição do defensor após esquiva */
  newDefenderPosition?: { x: number; y: number };
  /** Grade da esquiva (para buff de esquiva perfeita) */
  defenderGrade?: "PERFECT" | "GREAT" | "GOOD" | "OK" | "MISS" | "FAIL" | "HIT";
}

// =============================================================================
// EXECUTOR REGISTRY TYPE
// =============================================================================

export type AbilityExecutorFn = SkillExecutorFn | SpellExecutorFn;

export type ExecutorRegistry = Record<string, AbilityExecutorFn>;
