import type { Socket } from "socket.io";
import { TURN_CONFIG } from "../../../../shared/config/global.config";
import type { ArenaConfig } from "../../../../shared/types/arena.types";
import type { ArenaLobbyData } from "../../../../shared/types/session.types";
import type { BattleUnit } from "../../utils/battle-unit.factory";

export type BattleLobby = ArenaLobbyData;

export interface Battle {
  id: string;
  lobbyId: string;
  matchId?: string;
  isArena: boolean;
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
  hostUserId: string;
  guestUserId: string;
  hostKingdomId: string;
  guestKingdomId: string;
  ransomPrice?: number;
  ransomResource?: string;
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
