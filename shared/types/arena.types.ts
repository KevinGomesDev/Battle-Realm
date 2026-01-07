// shared/types/arena.types.ts
// Tipos compartilhados para o sistema de Arena/Batalha PvP

import type { ArenaLobbyStatus } from "./session.types";

// =============================================================================
// LOBBY TYPES
// =============================================================================

// ArenaLobbyStatus é importado de session.types.ts para evitar duplicação
export type { ArenaLobbyStatus, ArenaLobbyPlayer } from "./session.types";

export interface ArenaLobbyPlayerInfo {
  userId: string;
  username: string;
  kingdomId: string;
  kingdomName: string;
  playerIndex: number;
  isReady: boolean;
}

export interface ArenaLobby {
  lobbyId: string;
  hostUserId: string;
  maxPlayers: number;
  players: ArenaLobbyPlayerInfo[];
  status: ArenaLobbyStatus;
  createdAt: Date;
}

import type {
  TerrainType,
  TerritorySize,
  BattleObstacle,
  TerrainColor,
  BattleUnit,
} from "./battle.types";

export interface ArenaGrid {
  width: number;
  height: number;
}

export interface ArenaMapConfig {
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

export interface ArenaConfig {
  grid: ArenaGrid;
  map: ArenaMapConfig;
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

export interface ArenaKingdom {
  id: string;
  name: string;
  ownerId: string;
  playerIndex: number;
  playerColor: string;
}

export interface ArenaBattle {
  battleId: string;
  lobbyId: string;
  config: ArenaConfig;
  maxPlayers: number;
  kingdoms: ArenaKingdom[];
  round: number;
  status: "ACTIVE" | "ENDED";
  currentTurnIndex: number;
  currentPlayerId: string;
  activeUnitId?: string; // Unidade ativa escolhida pelo jogador neste turno
  actionOrder: string[];
  units: BattleUnit[];
  turnTimer: number;
}

export interface ArenaLog {
  id: string;
  battleId: string;
  message: string;
  timestamp: Date;
}

export interface ArenaBattleResult {
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
  status: ArenaLobbyStatus;
}

export interface LobbiesListResponse {
  lobbies: ArenaLobby[];
}

export interface PlayerJoinedResponse {
  lobbyId: string;
  players: ArenaLobbyPlayerInfo[];
  status: ArenaLobbyStatus;
}

export interface BattleStartedResponse {
  battleId: string;
  lobbyId: string;
  config: ArenaConfig;
  maxPlayers?: number;
  kingdoms: ArenaKingdom[];
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
