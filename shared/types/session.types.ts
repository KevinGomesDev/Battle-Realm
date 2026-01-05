// Session Types - Shared between Frontend and Backend
// Gerenciamento de sessões ativas (Match, Arena Lobby, Arena Battle)

import type { BattleUnit } from "./battle.types";

/**
 * Tipos de sessão suportados pelo sistema
 */
export type SessionType = "MATCH" | "ARENA_LOBBY" | "ARENA_BATTLE";

/**
 * Status do lobby de Arena
 */
export type ArenaLobbyStatus = "WAITING" | "READY" | "BATTLING" | "ENDED";

/**
 * Status da batalha de Arena
 */
export type ArenaBattleStatus = "ACTIVE" | "ENDED";

/**
 * Representa uma sessão ativa do usuário
 */
export interface ActiveSession {
  type: SessionType | null;
  sessionId: string | null;
  matchId?: string;
  lobbyId?: string;
  battleId?: string;
  matchStatus?: string;
  arenaStatus?: ArenaLobbyStatus | ArenaBattleStatus;
  playerId?: string;
}

/**
 * Jogador em um lobby de arena
 */
export interface ArenaLobbyPlayer {
  userId: string;
  socketId: string;
  kingdomId: string;
  playerIndex: number;
  isReady: boolean;
}

/**
 * Dados do lobby de arena em memória (Backend)
 * Suporta de 2 a 8 jogadores
 */
export interface ArenaLobbyData {
  lobbyId: string;
  hostUserId: string; // Criador do lobby (sempre players[0])
  maxPlayers: number; // Máximo de jogadores (2-8)
  players: ArenaLobbyPlayer[];
  status: ArenaLobbyStatus;
  createdAt: Date;
  /** Se true, preenche vagas restantes com BOTs */
  vsBot?: boolean;
}

/**
 * Jogador em uma batalha
 */
export interface BattlePlayer {
  userId: string;
  kingdomId: string;
  kingdomName: string;
  playerIndex: number;
  playerColor: string;
}

/**
 * Dados da batalha de arena em memória (Backend)
 * Suporta de 2 a 8 jogadores
 */
export interface ArenaBattleData {
  id: string; // battleId
  lobbyId: string;
  status: string; // "ACTIVE" | "ENDED"
  maxPlayers: number;
  players: BattlePlayer[];
  round: number;
  currentTurnIndex: number;
  activeUnitId?: string; // Unidade ativa escolhida pelo jogador neste turno
  gridWidth: number;
  gridHeight: number;
  units: BattleUnit[];
  actionOrder: string[];
  turnTimer: number;
  config: any; // ArenaConfig com mapa, clima e obstáculos
  isArena?: boolean;
  matchId?: string;
  logs?: any[];
  createdAt?: Date;
  ransomPrice?: number;
  ransomResource?: string;
}

// ============================================
// Socket Events - Request/Response Types
// ============================================

/**
 * Request: session:check
 */
export interface SessionCheckRequest {
  userId: string;
}

/**
 * Response: session:active (Match)
 */
export interface SessionActiveMatchResponse {
  type: "MATCH";
  matchId: string;
  matchStatus: string;
  currentRound: number;
  currentTurn: number;
  playerId: string;
  playerIndex: number;
  players: Array<{
    id: string;
    username: string;
    kingdomName: string;
    playerIndex: number;
    playerColor: string;
  }>;
}

/**
 * Response: session:active (Arena Lobby)
 */
export interface SessionActiveLobbyResponse {
  type: "ARENA_LOBBY";
  lobbyId: string;
  lobbyStatus: ArenaLobbyStatus;
  isHost: boolean;
  hostUserId: string;
  maxPlayers: number;
  players: {
    userId: string;
    username: string;
    kingdomId: string;
    kingdomName: string;
    playerIndex: number;
    isReady: boolean;
  }[];
}

/**
 * Response: session:active (Arena Battle)
 */
export interface SessionActiveBattleResponse {
  type: "ARENA_BATTLE";
  battleId: string;
  lobbyId: string;
  battleStatus: ArenaBattleStatus;
  round: number;
  currentTurnIndex: number;
  activeUnitId?: string;
  units: any[];
  actionOrder: string[];
  gridWidth: number;
  gridHeight: number;
}

/**
 * Response: session:none
 */
export interface SessionNoneResponse {
  message: string;
}

/**
 * Request: session:can_join
 */
export interface SessionCanJoinRequest {
  userId: string;
}

/**
 * Response: session:can_join_result
 */
export interface SessionCanJoinResponse {
  canJoin: boolean;
  reason?: string;
}

/**
 * Response: battle:session_restored (Lobby)
 */
export interface BattleSessionRestoredResponse {
  lobbyId: string;
  hostUserId: string;
  maxPlayers: number;
  players: {
    userId: string;
    username: string;
    kingdomId: string;
    kingdomName: string;
    playerIndex: number;
    isReady: boolean;
  }[];
  status: ArenaLobbyStatus;
  isHost: boolean;
  createdAt: string;
}

/**
 * Response: battle:battle_restored (Battle)
 */
export interface BattleBattleRestoredResponse {
  battleId: string;
  lobbyId: string;
  config: any; // ArenaConfig
  round: number;
  status: ArenaBattleStatus;
  currentTurnIndex: number;
  currentPlayerId: string;
  activeUnitId?: string;
  turnTimer?: number;
  units: any[];
  actionOrder: string[];
  maxPlayers: number;
  kingdoms: {
    id: string;
    name: string;
    ownerId: string;
    playerIndex: number;
    playerColor: string;
  }[];
}

// ============================================
// Frontend State Types
// ============================================

/**
 * Estado da sessão no frontend (simplificado)
 */
export interface SessionState {
  activeSession: ActiveSessionFrontend | null;
  isChecking: boolean;
  canJoin: boolean;
  canJoinReason: string | null;
}

/**
 * Sessão ativa no frontend (formato simplificado)
 */
export interface ActiveSessionFrontend {
  type: SessionType | null;
  matchId?: string;
  battleId?: string;
  lobbyId?: string;
  data?: any;
}

/**
 * Ações do reducer de sessão
 */
export type SessionAction =
  | { type: "SET_ACTIVE_SESSION"; payload: ActiveSessionFrontend | null }
  | { type: "SET_CHECKING"; payload: boolean }
  | {
      type: "SET_CAN_JOIN";
      payload: { canJoin: boolean; reason: string | null };
    }
  | { type: "CLEAR_SESSION" };

/**
 * Estados do fluxo de verificação de sessão
 */
export type SessionGuardState =
  | "idle"
  | "checking"
  | "restoring"
  | "ready"
  | "error";
