// Session Types - Shared between Frontend and Backend
// Gerenciamento de sessões ativas (Match, Battle Lobby, Battle Session)

import type { BattleUnit } from "./battle.types";

/**
 * Tipos de sessão suportados pelo sistema
 */
export type SessionType = "MATCH" | "BATTLE_LOBBY" | "BATTLE_SESSION";

/**
 * Status do lobby de Batalha
 */
export type BattleLobbyStatus = "WAITING" | "READY" | "BATTLING" | "ENDED";

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
  battleStatus?: BattleLobbyStatus | BattleLobbyStatus;
  playerId?: string;
}

/**
 * Jogador em um lobby de Batalha
 */
export interface BattleLobbyPlayer {
  userId: string;
  socketId: string;
  kingdomId: string;
  playerIndex: number;
  isReady: boolean;
}

/**
 * Dados do lobby de Batalha em memória (Backend)
 * Suporta de 2 a 8 jogadores
 */
export interface BattleLobbyData {
  lobbyId: string;
  hostUserId: string; // Criador do lobby (sempre players[0])
  maxPlayers: number; // Máximo de jogadores (2-8)
  players: BattleLobbyPlayer[];
  status: BattleLobbyStatus;
  createdAt: Date;
}

/**
 * Jogador em uma batalha (sync com BattlePlayerSchema do servidor)
 */
export interface BattlePlayer {
  oderId: string; // ID do owner (userId)
  kingdomId: string;
  kingdomName: string;
  username: string;
  playerIndex: number;
  playerColor: string;
  isConnected: boolean;
  surrendered: boolean;
}

/**
 * Dados da sess�o de batalha em memória (Backend)
 * Suporta de 2 a 8 jogadores
 */
export interface BattleSessionData {
  id: string; // battleId
  lobbyId: string;
  status: string; // "ACTIVE" | "ENDED"
  maxPlayers: number;
  players: BattlePlayer[];
  round: number;
  currentTurnIndex: number;
  currentPlayerId?: string; // ID do jogador que controla o turno atual
  activeUnitId?: string; // Unidade ativa (travada após mover/agir)
  selectedUnitId?: string; // Unidade selecionada (ainda pode mudar)
  unitLocked?: boolean; // Se true, não pode mais mudar a unidade selecionada
  gridWidth: number;
  gridHeight: number;
  units: BattleUnit[];
  actionOrder: string[]; // IDs dos jogadores (não das unidades)
  turnTimer: number;
  config: any; // BattleConfig com mapa, clima e obstáculos
  isBattle?: boolean;
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
 * Response: session:active (Battle Lobby)
 */
export interface SessionActiveLobbyResponse {
  type: "BATTLE_LOBBY";
  lobbyId: string;
  lobbyStatus: BattleLobbyStatus;
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
 * Response: session:active (Battle Session)
 */
export interface SessionActiveBattleResponse {
  type: "BATTLE_SESSION";
  battleId: string;
  lobbyId: string;
  battleStatus: BattleLobbyStatus;
  round: number;
  currentTurnIndex: number;
  currentPlayerId?: string;
  activeUnitId?: string;
  selectedUnitId?: string;
  unitLocked?: boolean;
  units: any[];
  actionOrder: string[]; // IDs dos jogadores
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
  status: BattleLobbyStatus;
  isHost: boolean;
  createdAt: string;
}

/**
 * Response: battle:battle_restored (Battle)
 */
export interface BattleBattleRestoredResponse {
  battleId: string;
  lobbyId: string;
  config: any; // BattleConfig
  round: number;
  status: BattleLobbyStatus;
  currentTurnIndex: number;
  currentPlayerId: string;
  activeUnitId?: string;
  selectedUnitId?: string;
  unitLocked?: boolean;
  turnTimer?: number;
  units: any[];
  actionOrder: string[]; // IDs dos jogadores
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
