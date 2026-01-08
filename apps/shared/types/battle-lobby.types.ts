// shared/types/battle-lobby.types.ts
// Tipos compartilhados para o sistema de Batalha PvP

import type { BattleLobbyStatus } from "./session.types";

// =============================================================================
// LOBBY TYPES
// =============================================================================

// BattleLobbyStatus é importado de session.types.ts para evitar duplicação
export type { BattleLobbyStatus, BattleLobbyPlayer } from "./session.types";

export interface BattleLobbyPlayerInfo {
  userId: string;
  username: string;
  kingdomId: string;
  kingdomName: string;
  playerIndex: number;
  isReady: boolean;
}

export interface BattleLobby {
  lobbyId: string;
  hostUserId: string;
  maxPlayers: number;
  players: BattleLobbyPlayerInfo[];
  status: BattleLobbyStatus;
  createdAt: Date;
}

import type {
  TerrainType,
  TerritorySize,
  BattleObstacle,
  TerrainColor,
  BattleUnit,
} from "./battle.types";

export interface BattleGrid {
  width: number;
  height: number;
}

export interface BattleMapConfig {
  terrainType: TerrainType;
  terrainName: string;
  terrainEmoji: string;
  terrainColors: {
    primary: TerrainColor;
    secondary: TerrainColor;
    accent: TerrainColor;
  };
  territorySize: TerritorySize;
  obstacles: BattleObstacle[];
}

export interface BattleConfig {
  grid: BattleGrid;
  map: BattleMapConfig;
  colors: {
    gridBackground: string;
    gridLine: string;
    gridDot: string;
    cellLight: string;
    cellDark: string;
    cellHover: string;
    cellMovable: string;
    cellAttackable: string;
    // Células de movimento
    cellMovableNormal: string;
    cellMovableNormalBorder: string;
    cellMovableEngagement: string;
    cellMovableEngagementBorder: string;
    cellMovableBlocked: string;
    cellMovableBlockedBorder: string;
    // Cores de preview de área (spells/skills)
    areaPreviewEmpty: string;
    areaPreviewEmptyBorder: string;
    areaPreviewTarget: string;
    areaPreviewTargetBorder: string;
    areaPreviewOutOfRange: string;
    areaPreviewOutOfRangeBorder: string;
    areaPreviewCenter: string;
    // Cores dos jogadores (até 8)
    playerColors: { primary: string; secondary: string }[];
  };
  conditionColors: Record<string, string>;
}

// =============================================================================
// BATTLE TYPES
// =============================================================================

export interface BattleKingdom {
  id: string;
  name: string;
  ownerId: string;
  playerIndex: number;
  playerColor: string;
}

export interface BattleSession {
  battleId: string;
  lobbyId: string;
  config: BattleConfig;
  maxPlayers: number;
  kingdoms: BattleKingdom[];
  round: number;
  status: "ACTIVE" | "ENDED";
  currentTurnIndex: number;
  currentPlayerId: string;
  activeUnitId?: string; // Unidade ativa (travada após mover/agir)
  selectedUnitId?: string; // Unidade selecionada (ainda pode mudar)
  unitLocked?: boolean; // Se true, não pode mais mudar a unidade selecionada
  actionOrder: string[]; // IDs dos jogadores (não das unidades)
  units: BattleUnit[];
  turnTimer: number;
}

export interface BattleLog {
  id: string;
  battleId: string;
  message: string;
  timestamp: Date;
}

export interface BattleSessionResult {
  battleId: string;
  winnerId: string | null;
  winnerKingdomId: string | null;
  reason: string;
  surrenderedBy?: string;
  disconnectedBy?: string;
  finalUnits: BattleUnit[];
  vsBot?: boolean;
}

// =============================================================================
// SOCKET PAYLOADS
// =============================================================================

export interface CreateLobbyPayload {
  userId: string;
  kingdomId: string;
}

export interface JoinLobbyPayload {
  lobbyId: string;
  userId: string;
  kingdomId: string;
}

export interface LeaveLobbyPayload {
  userId: string;
}

export interface StartBattlePayload {
  lobbyId: string;
  userId: string;
}

export interface BeginActionPayload {
  battleId: string;
  unitId: string;
  userId: string;
}

export interface MovePayload {
  battleId: string;
  unitId: string;
  toX: number;
  toY: number;
}

export interface AttackPayload {
  battleId: string;
  attackerUnitId: string;
  targetUnitId: string;
  damageType?: "FISICO" | "VERDADEIRO";
}

export interface SurrenderPayload {
  battleId: string;
  userId: string;
}

// =============================================================================
// SOCKET RESPONSES
// =============================================================================

export interface LobbyCreatedResponse {
  lobbyId: string;
  hostUserId: string;
  hostKingdomName: string;
  maxPlayers?: number;
  status: BattleLobbyStatus;
}

export interface LobbiesListResponse {
  lobbies: BattleLobby[];
}

export interface PlayerJoinedResponse {
  lobbyId: string;
  players: BattleLobbyPlayerInfo[];
  status: BattleLobbyStatus;
}

export interface BattleStartedResponse {
  battleId: string;
  lobbyId: string;
  config: BattleConfig;
  maxPlayers?: number;
  kingdoms: BattleKingdom[];
  units: BattleUnit[];
  actionOrder: string[];
}

export interface UnitMovedResponse {
  battleId: string;
  unitId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  movesLeft: number;
  hasStartedAction?: boolean;
}

export interface UnitAttackedResponse {
  battleId: string;
  attackerUnitId: string;
  targetUnitId: string;
  targetObstacleId?: string;
  targetType: "unit" | "corpse" | "obstacle";
  // Dano e resultado
  damage: number;
  damageType: string;
  targetHpAfter: number;
  attackerActionsLeft: number;
  attackerAttacksLeftThisTurn: number;
  attackerHasStartedAction?: boolean;
  missed: boolean;
  rawDamage: number;
  damageReduction: number;
  finalDamage: number;
  targetPhysicalProtection: number;
  targetMagicalProtection: number;
  targetDefeated: boolean;
  obstacleDestroyed?: boolean;
  obstacleId?: string;
  // Dados de esquiva (novo sistema)
  dodgeChance?: number;
  dodgeRoll?: number;
  // Dados do atacante para exibição
  attackerName: string;
  attackerIcon: string;
  attackerCombat: number;
  // Dados do defensor para exibição
  targetName: string;
  targetIcon: string;
  targetCombat: number;
  targetSpeed: number;
  // Invocações mortas (quando o invocador morre)
  killedSummonIds?: string[];
}

export interface BattleEndedResponse {
  battleId: string;
  winnerId: string | null;
  winnerKingdomId: string | null;
  reason: string;
  surrenderedBy?: string;
  disconnectedBy?: string;
  abandonedBy?: string;
  finalUnits?: BattleUnit[];
  vsBot?: boolean;
}
