// shared/qte/index.ts
// Barrel exports para o sistema QTE

// Tipos principais
export type {
  QTEActionType,
  QTEResultGrade,
  DodgeDirection,
  QTEInput,
  QTEConfig,
  QTEResponse,
  QTEResult,
  QTEClientState,
} from "./qte.types";

// Tipos de Chain QTE
export type {
  ChainQTEType,
  ChainFailMode,
  ChainStepDifficulty,
  ChainQTEStep,
  ChainQTEConfig,
  ChainQTEStepResponse,
  ChainQTEBatchResponse,
  ChainQTEStepResult,
  ChainQTEResult,
  ChainQTEClientState,
  // Eventos
  ChainQTEStartEvent,
  ChainQTEStepResponseEvent,
  ChainQTEBatchResponseEvent,
  ChainQTEStepResolvedEvent,
  ChainQTECompleteEvent,
  ChainQTEBrokenEvent,
} from "./qte-chain.types";

export {
  CHAIN_DIFFICULTY_CONFIG,
  CHAIN_COMBO_MULTIPLIERS,
} from "./qte-chain.types";

// Tipos de eventos
export type {
  QTEStartEvent,
  QTEResponseEvent,
  QTEResolvedEvent,
  QTEExpiredEvent,
  QTECascadeEvent,
  QTEInitiatedEvent,
  QTEEvent,
  QTEClientToServerEvent,
  QTEServerToClientEvent,
} from "./qte-events.types";

// Configurações e constantes
export type { QTECalculationConfig, QTEDamageMultipliers } from "./qte-config";

export {
  QTE_FUTURE_DELAY,
  QTE_TOLERANCE_MS,
  QTE_TIMEOUT_BUFFER,
  QTE_DEFAULT_CONFIG,
  QTE_DAMAGE_MULTIPLIERS,
  QTE_FEEDBACK_COLORS,
  QTE_FEEDBACK_MESSAGES,
  INPUT_TO_DIRECTION,
  DIRECTION_DELTAS,
  OPPOSITE_DIRECTION,
  PERFECT_DODGE_BUFF,
} from "./qte-config";
