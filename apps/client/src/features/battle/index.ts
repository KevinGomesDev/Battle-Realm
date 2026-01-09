// Battle Feature - Public API
// Migrado para Zustand - Context removido

// Hooks
export {
  useBattle,
  useBattleOptional,
  useBattleState,
  useBattleSession,
} from "./hooks/useBattle";
export { useBattleKeyboard } from "./hooks/useBattleKeyboard";

// Components - Main View
export { BattleView } from "./components";

// Components - Battle
export {
  BattleHeader,
  UnitPanel,
  BattleResultModal,
} from "./components/battle";

// Components - Canvas
export { BattleCanvas } from "./components/canvas";

// Components - Shared
export {
  CircularProgress,
  MovementDots,
  ActionSquares,
  ScarMarks,
  ConditionBadge,
  AttributeTooltip,
} from "./components/shared";

// Components - QTE
export { QTEOverlay } from "./components/QTEOverlay";

// Utils
export { BattleLog, lobbyLog } from "./utils";

// Constants
export {
  CONDITIONS_INFO,
  getConditionInfo,
  ACTIONS_INFO,
  ATTRIBUTE_TOOLTIPS,
  UI_COLORS,
  TIMER_THRESHOLDS,
} from "./constants";

// Types
export type {
  BattleLobby,
  BattleLobbyStatus,
  BattleGrid,
  BattleKingdom,
  BattleSession,
  BattleSessionResult,
  BattleState,
  BattleContextType,
  BattleAction,
  // Payloads
  CreateLobbyPayload,
  JoinLobbyPayload,
  LeaveLobbyPayload,
  StartBattlePayload,
  BeginActionPayload,
  MovePayload,
  AttackPayload,
  SurrenderPayload,
  // Responses
  LobbyCreatedResponse,
  LobbiesListResponse,
  PlayerJoinedResponse,
  BattleStartedResponse,
  UnitMovedResponse,
  UnitAttackedResponse,
  BattleEndedResponse,
} from "./types/battle.types";
