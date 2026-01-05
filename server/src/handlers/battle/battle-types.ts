import type { Socket } from "socket.io";
import { TURN_CONFIG } from "../../../../shared/config/global.config";
import type { ArenaConfig } from "../../../../shared/types/arena.types";
import type {
  ArenaLobbyData,
  BattlePlayer,
} from "../../../../shared/types/session.types";
import type { BattleUnit } from "../../utils/battle-unit.factory";

export type BattleLobby = ArenaLobbyData;

export interface Battle {
  id: string;
  lobbyId: string;
  matchId?: string;
  isArena: boolean;
  maxPlayers: number;
  players: BattlePlayer[];
  gridWidth: number;
  gridHeight: number;
  round: number;
  currentTurnIndex: number;
  status: "ACTIVE" | "ENDED";
  turnTimer: number;
  actionOrder: string[];
  units: BattleUnit[];
  createdAt: Date;
  config: ArenaConfig;
  activeUnitId?: string;
  roundActionsCount: Map<string, number>;
  ransomPrice?: number;
  ransomResource?: string;
}

// Cores dos jogadores (até 8)
export const BATTLE_PLAYER_COLORS = [
  { primary: "#e63946", secondary: "#ff6b6b" }, // Vermelho
  { primary: "#457b9d", secondary: "#78a5c5" }, // Azul
  { primary: "#2a9d8f", secondary: "#56c4b7" }, // Verde
  { primary: "#f4a261", secondary: "#ffc08a" }, // Laranja
  { primary: "#9b59b6", secondary: "#c27ce6" }, // Roxo
  { primary: "#1abc9c", secondary: "#48e0c0" }, // Turquesa
  { primary: "#e74c3c", secondary: "#ff7b6b" }, // Vermelho escuro
  { primary: "#3498db", secondary: "#5eb3f0" }, // Azul claro
];

export function getPlayerColors(playerIndex: number): {
  primary: string;
  secondary: string;
} {
  return BATTLE_PLAYER_COLORS[playerIndex % BATTLE_PLAYER_COLORS.length];
}

export const TURN_TIMER_SECONDS = TURN_CONFIG.timerSeconds;

export function generateId(): string {
  return `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateBattleId(): string {
  return generateId();
}

export function generateUnitId(): string {
  return `bunit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export interface BattleHandlerContext {
  io: Socket["server"];
}
