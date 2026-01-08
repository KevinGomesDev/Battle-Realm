// shared/types/match.types.ts
// Tipos de Partida compartilhados entre Frontend e Backend

import type { Territory } from "./map.types";

/**
 * Status possíveis de uma partida
 */
export type MatchStatus = "WAITING" | "PREPARATION" | "ACTIVE" | "FINISHED";

/**
 * Tipos de Crise (eventos de ameaça global)
 */
export type CrisisType = "KAIJU" | "WALKERS" | "AMORPHOUS";

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
 * Reino em uma partida
 */
export interface MatchKingdom {
  id: string;
  userId: string;
  username: string;
  kingdomId: string;
  playerIndex: number;
  playerColor: string;
  kingdomName: string;
  capitalTerritoryId: string | null;
  isReady: boolean;
  locationIndex?: number;
  raceMetadata?: string;
  inventory: string;
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
  players: MatchKingdom[];
  crisisState: object | null;
  updatedAt: Date;
}

/**
 * Dados do mapa de uma partida
 */
export interface MatchMapData {
  territories: Territory[];
  players: MatchKingdom[];
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

/**
 * Submissão de tributo de um jogador
 */
export interface TributeSubmission {
  playerId: string;
  decision: "CONTRIBUIR" | "SABOTAR" | "NAOINTERVIER";
  amount: number;
}

/**
 * Resultado da pilha de tributo
 */
export interface TributePileResult {
  totalValue: number;
  contributionAmount: number;
  sabotageAmount: number;
  topContributor?: string;
  topSaboteur?: string;
  topContributionAmount: number;
  topSabotageAmount: number;
}
