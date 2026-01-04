// server/src/ai/index.ts
// Módulo de Inteligência Artificial para Batalhas
//
// Este módulo controla unidades SUMMON e MONSTER durante batalhas.
// A IA age após todos os jogadores terem agido na rodada.
//
// Estrutura:
// - types/       : Tipos e interfaces da IA
// - core/        : Lógica principal (pathfinding, decisões, controller)
// - behaviors/   : Comportamentos específicos (agressivo, tático, etc)
//
// Uso básico:
//   import { processAITurn, isAITurn, AI_PLAYER_ID } from '../ai';
//
//   if (isAITurn(battle)) {
//     const result = await processAITurn(battle);
//     // Executar decisões...
//   }

// Types
export type {
  AIBehaviorType,
  AISkillPriority,
  AIProfile,
  AIDecision,
  AIBattleContext,
  AITurnResult,
  AISelfAssessment,
  AITimeoutConfig,
} from "./types/ai.types";

export { DEFAULT_AI_PROFILES, DEFAULT_AI_TIMEOUT } from "./types/ai.types";

// Core - Controller (principais funções exportadas)
export {
  AI_PLAYER_ID,
  isAIControlledUnit,
  getAIUnits,
  hasActiveAIUnits,
  isAITurn,
  processAITurn,
  processAIUnit,
  processBotUnitDecision,
  checkVictoryIgnoringAI,
  aiActionDelay,
  logAIDecision,
} from "./core/ai-controller";

// Core - Action Executor
export {
  executeAIDecision,
  executeFullAITurn,
  type AIExecutionResult,
} from "./core/action-executor";

// Core - Pathfinding
export {
  manhattanDistance,
  chebyshevDistance,
  findPath,
  findBestMoveTowards,
  findBestRetreatPosition,
  findPositionAtRange,
} from "./core/pathfinding";

// Core - Target Selection
export {
  getVisionRange,
  isInVision,
  getEnemies,
  getVisibleEnemies,
  getAllies,
  filterVisibleUnits,
  evaluateThreatLevel,
  canDefeatTarget,
  calculateTargetScore,
  selectBestTarget,
  shouldExplore,
  getExplorationTarget,
  selectBestAllyForSupport,
  findNearestEnemy,
  findNearestAlly,
  isUnitInDanger,
  countThreatsAtPosition,
} from "./core/target-selection";

// Core - Skill Evaluator
export {
  getSkillEffectiveRange,
  canUseSkillOnTarget,
  getValidTargetsForSkill,
  evaluateSkill,
  selectBestSkill,
} from "./core/skill-evaluator";

// Core - Decision Maker
export {
  getUnitAIProfile,
  makeDecision,
  validateDecision,
  makeFallbackDecision,
  processUnit,
  processUnitWithTimeout,
} from "./core/decision-maker";

// Core - Self Assessment
export {
  assessSelf,
  getAggressionModifier,
  canAffordToAttack,
  shouldUseDefensiveSkill,
  getRetreatPriority,
} from "./core/self-assessment";

// Core - Safety Guards
export {
  getFallbackDecision,
  withTimeout,
  safeExecute,
  SafeIterator,
  limitArray,
  clampValue,
  isValidPosition,
  validateDecision as validateDecisionSafety,
  safetyLogger,
} from "./core/safety-guards";

// Behaviors
export { makeAggressiveDecision } from "./behaviors/aggressive.behavior";
export { makeTacticalDecision } from "./behaviors/tactical.behavior";
export { makeRangedDecision } from "./behaviors/ranged.behavior";
export { makeSupportDecision } from "./behaviors/support.behavior";
export { makeDefensiveDecision } from "./behaviors/defensive.behavior";
