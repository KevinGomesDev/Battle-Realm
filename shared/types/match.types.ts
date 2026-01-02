// shared/types/match.types.ts
// Tipos de Partida compartilhados entre Frontend e Backend

import type { Territory } from "./map.types";

/**
 * Status possíveis de uma partida
 */
export type MatchStatus = "WAITING" | "PREPARATION" | "ACTIVE" | "FINISHED";

/**
 * Tipos de turno na partida
 */
export type TurnType =
  | "ADMINISTRACAO"
  | "EXERCITOS"
  | "MOVIMENTACAO"
  | "CRISE"
  | "ACAO"
  | "BATALHA";

/**
 * Representa uma partida
 */
export interface Match {
  id: string;
  status: MatchStatus;
  startDate: string;
  turnCount: number;
  maxPlayers: number;
}

/**
 * Partida aberta para entrar
 */
export interface OpenMatch {
  id: string;
  hostName: string;
  kingdomName: string;
  createdAt: Date;
}

/**
 * Recursos de um jogador
 */
export interface PlayerResources {
  ore: number;
  supplies: number;
  arcane: number;
  experience: number;
  devotion: number;
}

/**
 * Jogador em uma partida
 */
export interface MatchPlayer {
  id: string;
  userId: string;
  username: string;
  playerIndex: number;
  playerColor: string;
  kingdomName: string;
  capitalTerritoryId: string | null;
  isReady: boolean;
  resources: PlayerResources;
  hasFinishedCurrentTurn: boolean;
}

/**
 * Estado completo de uma partida (vindo do servidor)
 */
export interface CompleteMatchState {
  matchId: string;
  status: MatchStatus;
  currentRound: number;
  currentTurn: TurnType;
  activePlayerIds: string[];
  players: MatchPlayer[];
  crisisState: object | null;
  updatedAt: Date;
}

/**
 * Dados do mapa de uma partida
 */
export interface MatchMapData {
  territories: Territory[];
  players: MatchPlayer[];
  status: MatchStatus;
}

/**
 * Dados de preparação de um jogador
 */
export interface PreparationData {
  playerId: string;
  playerIndex: number;
  playerColor: string;
  kingdomName: string;
  capital: Territory | null;
  isReady: boolean;
  freeBuildingsRemaining: number;
}
