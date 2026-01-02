// Arena Feature - Public API

// Context
export { ArenaProvider, ArenaContext } from "./context/ArenaContext";
export {
  arenaReducer,
  initialArenaState,
  arenaActions,
} from "./context/arenaReducer";

// Hooks
export {
  useArena,
  useArenaState,
  useArenaLobby,
  useArenaBattle,
} from "./hooks/useArena";
export { useBattleKeyboard } from "./hooks/useBattleKeyboard";

// Components - Main View
export { ArenaBattleView } from "./components";

// Components - Lobby
export { ArenaList, ArenaLobbyView } from "./components/lobby";

// Components - Battle
export {
  BattleHeader,
  UnitPanel,
  InitiativePanel,
  BattleResultModal,
} from "./components/battle";

// Components - Canvas
export { ArenaBattleCanvas } from "./components/canvas";

// Components - Shared
export {
  CircularProgress,
  MovementDots,
  ActionSquares,
  ScarMarks,
  ConditionBadge,
  AttributeTooltip,
} from "./components/shared";

// Utils
export { arenaLog, battleLog, lobbyLog } from "./utils";

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
  ArenaLobby,
  ArenaLobbyStatus,
  ArenaUnit,
  ArenaGrid,
  ArenaKingdom,
  ArenaBattle,
  ArenaBattleResult,
  ArenaState,
  ArenaContextType,
  ArenaAction,
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
} from "./types/arena.types";
