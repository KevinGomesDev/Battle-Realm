// FONTE DE VERDADE: shared/types/battle-lobby.types.ts

// Re-exportar todos os tipos do shared
export type {
  BattleLobby,
  BattleLobbyStatus,
  BattleLobbyPlayerInfo,
  BattleGrid,
  BattleMapConfig,
  BattleConfig,
  BattleSession,
  BattleSessionResult,
  BattleKingdom,
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
} from "@boundless/shared/types/battle-lobby.types";

export type { BattleUnit } from "@boundless/shared/types/battle.types";

// =============================================================================
// TIPOS ESPECÍFICOS DO CLIENTE
// =============================================================================

import type {
  BattleLobby,
  BattleLobbyStatus,
  BattleSession,
  BattleSessionResult,
} from "@boundless/shared/types/battle-lobby.types";
import type { BattleUnit } from "@boundless/shared/types/battle.types";

/**
 * Estado global do contexto Battle
 */
export interface BattleState {
  lobbies: BattleLobby[];
  currentLobby: BattleLobby | null;
  battle: BattleSession | null;
  battleResult: BattleSessionResult | null;
  units: BattleUnit[];
  isHost: boolean;
  isLoading: boolean;
  error: string | null;
  rematchPending: boolean;
  opponentWantsRematch: boolean;
}

/**
 * Tipo do contexto Battle
 */
export interface BattleContextType {
  state: BattleState;
  createLobby: (kingdomId: string) => void;
  listLobbies: () => void;
  joinLobby: (lobbyId: string, kingdomId: string) => void;
  leaveLobby: () => void;
  startBattle: () => void;
  beginAction: (unitId: string) => void;
  moveUnit: (unitId: string, toX: number, toY: number) => void;
  attackUnit: (
    attackerId: string,
    targetPosition: { x: number; y: number }
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
export type BattleAction =
  | { type: "SET_LOBBIES"; payload: BattleLobby[] }
  | { type: "SET_CURRENT_LOBBY"; payload: BattleLobby | null }
  | {
      type: "UPDATE_LOBBY_STATUS";
      payload: { lobbyId: string; status: BattleLobbyStatus };
    }
  | { type: "SET_BATTLE"; payload: BattleSession | null }
  | { type: "SET_BATTLE_RESULT"; payload: BattleSessionResult | null }
  | { type: "SET_UNITS"; payload: BattleUnit[] }
  | { type: "UPDATE_UNIT"; payload: Partial<BattleUnit> & { id: string } }
  | { type: "SET_IS_HOST"; payload: boolean }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_REMATCH_PENDING"; payload: boolean }
  | { type: "SET_OPPONENT_WANTS_REMATCH"; payload: boolean }
  | { type: "DESTROY_OBSTACLE"; payload: { obstacleId: string } }
  | { type: "RESET" };
