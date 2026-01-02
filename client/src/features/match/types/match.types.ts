// Match Types - Re-exports shared types and adds frontend-specific types
// FONTE DE VERDADE: shared/types/match.types.ts

// ============ RE-EXPORT SHARED TYPES ============
export type {
  MatchStatus,
  TurnType,
  Match,
  OpenMatch,
  PlayerResources,
  MatchPlayer,
  CompleteMatchState,
  MatchMapData,
  PreparationData,
} from "../../../../../shared/types/match.types";

// Re-export Territory from map.types for backwards compatibility
export type { Territory } from "../../../../../shared/types/map.types";

// ============ FRONTEND-SPECIFIC STATE ============

import type {
  Match,
  OpenMatch,
  PreparationData,
  MatchMapData,
  CompleteMatchState,
} from "../../../../../shared/types/match.types";

export interface MatchState {
  currentMatch: Match | null;
  openMatches: OpenMatch[];
  preparationData: PreparationData | null;
  matchMapData: MatchMapData | null;
  completeMatchState: CompleteMatchState | null;
  myPlayerId: string | null;
  isMyTurn: boolean;
  waitingForPlayers: string[];
  isLoading: boolean;
  error: string | null;
}

export interface MatchContextType {
  state: MatchState;
  listOpenMatches: () => Promise<OpenMatch[]>;
  createMatch: (kingdomId: string) => Promise<{ matchId: string }>;
  joinMatch: (matchId: string, kingdomId: string) => Promise<void>;
  leaveMatch: (matchId: string) => Promise<void>;
  getPreparationData: (matchId: string) => Promise<PreparationData>;
  requestMapData: (matchId?: string) => Promise<MatchMapData>;
  requestMatchState: (matchId: string) => Promise<void>;
  setPlayerReady: (matchId: string) => Promise<void>;
  finishTurn: (matchId: string, playerId: string) => Promise<void>;
  startMatch: (playerIds: string[]) => Promise<void>;
  loadMatch: (matchId: string) => Promise<void>;
  setMatchMapData: (data: MatchMapData | null) => void;
  setPreparationData: (data: PreparationData | null) => void;
}

export type MatchAction =
  | { type: "SET_MATCH"; payload: Match | null }
  | { type: "SET_OPEN_MATCHES"; payload: OpenMatch[] }
  | { type: "SET_PREPARATION_DATA"; payload: PreparationData | null }
  | { type: "SET_MATCH_MAP_DATA"; payload: MatchMapData | null }
  | { type: "SET_COMPLETE_MATCH_STATE"; payload: CompleteMatchState | null }
  | { type: "SET_MY_PLAYER_ID"; payload: string | null }
  | { type: "SET_IS_MY_TURN"; payload: boolean }
  | { type: "SET_WAITING_FOR_PLAYERS"; payload: string[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "RESET" };
