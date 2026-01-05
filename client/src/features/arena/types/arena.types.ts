// FONTE DE VERDADE: shared/types/arena.types.ts

// Re-exportar todos os tipos do shared
export type {
  ArenaLobby,
  ArenaLobbyStatus,
  ArenaLobbyPlayerInfo,
  ArenaGrid,
  ArenaMapConfig,
  ArenaConfig,
  ArenaBattle,
  ArenaBattleResult,
  ArenaKingdom,
  CreateLobbyPayload,
  JoinLobbyPayload,
  LeaveLobbyPayload,
  StartBattlePayload,
  BeginActionPayload,
  MovePayload,
  AttackPayload,
  SurrenderPayload,
  LobbyCreatedResponse,
  LobbiesListResponse,
  PlayerJoinedResponse,
  BattleStartedResponse,
  UnitMovedResponse,
  UnitAttackedResponse,
  BattleEndedResponse,
} from "../../../../../shared/types/arena.types";

export type { BattleUnit } from "../../../../../shared/types/battle.types";

// =============================================================================
// TIPOS ESPECÍFICOS DO CLIENTE
// =============================================================================

import type {
  ArenaLobby,
  ArenaLobbyStatus,
  ArenaBattle,
  ArenaBattleResult,
} from "../../../../../shared/types/arena.types";
import type { BattleUnit } from "../../../../../shared/types/battle.types";

/**
 * Estado global do contexto Arena
 */
export interface ArenaState {
  lobbies: ArenaLobby[];
  currentLobby: ArenaLobby | null;
  battle: ArenaBattle | null;
  battleResult: ArenaBattleResult | null;
  units: BattleUnit[];
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
  createLobby: (kingdomId: string, vsBot?: boolean) => void;
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
  castSpell: (
    unitId: string,
    spellCode: string,
    targetId?: string,
    targetPosition?: { x: number; y: number }
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
  | { type: "SET_UNITS"; payload: BattleUnit[] }
  | { type: "UPDATE_UNIT"; payload: Partial<BattleUnit> & { id: string } }
  | { type: "SET_IS_HOST"; payload: boolean }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_REMATCH_PENDING"; payload: boolean }
  | { type: "SET_OPPONENT_WANTS_REMATCH"; payload: boolean }
  | { type: "DESTROY_OBSTACLE"; payload: { obstacleId: string } }
  | { type: "RESET" };
