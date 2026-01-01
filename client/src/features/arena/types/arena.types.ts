// Arena Types - Re-exporta tipos do shared e adiciona tipos específicos do cliente
// FONTE DE VERDADE: shared/types/arena.types.ts

// Re-exportar todos os tipos compartilhados
export type {
  ArenaLobbyStatus,
  ArenaLobby,
  ArenaUnit,
  ArenaGrid,
  ArenaConfig,
  ArenaKingdom,
  ArenaBattle,
  ArenaLog,
  ArenaBattleResult,
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
} from "../../../../../shared/types/arena.types";

// Re-exportar tipos de condições
export type {
  ConditionInfo,
  ConditionId,
} from "../../../../../shared/types/conditions.types";

// Importar para uso nos tipos do cliente
import type {
  ArenaLobby,
  ArenaLobbyStatus,
  ArenaBattle,
  ArenaBattleResult,
  ArenaUnit,
  ArenaLog,
} from "../../../../../shared/types/arena.types";

// =============================================================================
// TIPOS ESPECÍFICOS DO CLIENTE
// =============================================================================

/**
 * Estado global do contexto Arena
 */
export interface ArenaState {
  lobbies: ArenaLobby[];
  currentLobby: ArenaLobby | null;
  battle: ArenaBattle | null;
  battleResult: ArenaBattleResult | null;
  units: ArenaUnit[];
  logs: ArenaLog[];
  isHost: boolean;
  isLoading: boolean;
  error: string | null;
  rematchPending: boolean;
  opponentWantsRematch: boolean;
}

/**
 * Tipo do contexto Arena
 */
export interface ArenaContextType {
  state: ArenaState;
  createLobby: (kingdomId: string) => void;
  listLobbies: () => void;
  joinLobby: (lobbyId: string, kingdomId: string) => void;
  leaveLobby: () => void;
  startBattle: () => void;
  beginAction: (unitId: string) => void;
  moveUnit: (unitId: string, toX: number, toY: number) => void;
  attackUnit: (
    attackerUnitId: string,
    targetUnitId?: string,
    targetObstacleId?: string
  ) => void;
  endAction: (unitId: string) => void;
  executeAction: (
    actionName: string,
    unitId: string,
    params?: Record<string, unknown>
  ) => void;
  surrender: () => void;
  requestRematch: () => void;
  dismissBattleResult: () => void;
  clearError: () => void;
}

/**
 * Ações do reducer
 */
export type ArenaAction =
  | { type: "SET_LOBBIES"; payload: ArenaLobby[] }
  | { type: "SET_CURRENT_LOBBY"; payload: ArenaLobby | null }
  | {
      type: "UPDATE_LOBBY_STATUS";
      payload: { lobbyId: string; status: ArenaLobbyStatus };
    }
  | { type: "SET_BATTLE"; payload: ArenaBattle | null }
  | { type: "SET_BATTLE_RESULT"; payload: ArenaBattleResult | null }
  | { type: "SET_UNITS"; payload: ArenaUnit[] }
  | { type: "UPDATE_UNIT"; payload: Partial<ArenaUnit> & { id: string } }
  | { type: "ADD_LOG"; payload: ArenaLog }
  | { type: "SET_LOGS"; payload: ArenaLog[] }
  | { type: "SET_IS_HOST"; payload: boolean }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_REMATCH_PENDING"; payload: boolean }
  | { type: "SET_OPPONENT_WANTS_REMATCH"; payload: boolean }
  | { type: "DESTROY_OBSTACLE"; payload: { obstacleId: string } }
  | { type: "RESET" };
