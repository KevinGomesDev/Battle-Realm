// types.ts - Tipos e interfaces para handlers do BattleRoom
import type { Client, Delayed, Room } from "@colyseus/core";
import type {
  BattleSessionState,
  BattlePlayerSchema,
  BattleUnitSchema,
  BattleObstacleSchema,
} from "../../schemas";
import type { BattleUnit } from "@boundless/shared/types/battle.types";
import type { QTEManager } from "../../../../../qte";

// =========================================
// Interfaces
// =========================================

export interface BattleRoomOptions {
  userId: string;
  kingdomId: string;
  maxPlayers?: number;
  vsBot?: boolean;
  restoreBattleId?: string;
}

export interface JoinOptions {
  userId: string;
  kingdomId: string;
}

export interface UserData {
  userId: string;
  kingdomId: string;
}

export interface DisconnectedPlayer {
  timeout: Delayed;
  data: UserData;
}

// =========================================
// Contexto dos Handlers
// =========================================

export interface BattleHandlerContext {
  room: Room<BattleSessionState>;
  state: BattleSessionState;
  roomId: string;
  metadata: Record<string, any>;
  clock: Room<BattleSessionState>["clock"];
  clients: Room<BattleSessionState>["clients"];
  broadcast: Room<BattleSessionState>["broadcast"];
  setMetadata: Room<BattleSessionState>["setMetadata"];

  // Estado interno
  lobbyPhase: boolean;
  setLobbyPhase: (value: boolean) => void;
  readyPlayers: Set<string>;
  disconnectedPlayers: Map<string, DisconnectedPlayer>;
  rematchRequests: Set<string>;

  // Timers
  turnTimer: Delayed | null;
  setTurnTimer: (timer: Delayed | null) => void;
  persistenceTimer: Delayed | null;
  setPersistenceTimer: (timer: Delayed | null) => void;
  allDisconnectedSince: number | null;
  setAllDisconnectedSince: (value: number | null) => void;

  // QTE
  qteManager: QTEManager | null;
  setQteManager: (manager: QTEManager | null) => void;

  // Callbacks para outros handlers
  startBattle: () => Promise<void>;
  advanceToNextUnit: () => void;
  checkBattleEnd: () => void;
  executeAITurn: (unit: BattleUnitSchema) => void;
  persistBattleToDb: () => Promise<void>;
  cancelPersistence: () => void;
  getPlayersInfo: () => PlayerInfo[];
  isValidPosition: (x: number, y: number) => boolean;
  schemaUnitToBattleUnit: (schema: BattleUnitSchema) => BattleUnit;
  getAllUnitsAsBattleUnits: () => BattleUnit[];
}

export interface PlayerInfo {
  oderId: string;
  username: string;
  kingdomName: string;
  playerIndex: number;
  playerColor: string;
  isBot: boolean;
}

// =========================================
// Cores dos Jogadores
// =========================================

export const PLAYER_COLORS = [
  "#e63946",
  "#457b9d",
  "#2a9d8f",
  "#f4a261",
  "#9b59b6",
  "#1abc9c",
  "#e74c3c",
  "#3498db",
];

// =========================================
// Helpers
// =========================================

export function getUserData(client: Client): UserData | undefined {
  return client.userData as UserData | undefined;
}

export function sendError(client: Client, message: string): void {
  client.send("error", { message });
}
