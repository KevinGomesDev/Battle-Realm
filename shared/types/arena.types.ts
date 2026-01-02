// shared/types/arena.types.ts
// Tipos compartilhados para o sistema de Arena/Batalha PvP

import type { ArenaLobbyStatus } from "./session.types";

// =============================================================================
// LOBBY TYPES
// =============================================================================

// ArenaLobbyStatus é importado de session.types.ts para evitar duplicação
export type { ArenaLobbyStatus } from "./session.types";

export interface ArenaLobby {
  lobbyId: string;
  hostUserId: string;
  hostUsername: string;
  hostKingdomName: string;
  guestUserId?: string;
  guestUsername?: string;
  guestKingdomName?: string;
  status: ArenaLobbyStatus;
  createdAt: Date;
}

// =============================================================================
// UNIT TYPES
// =============================================================================

import type { UnitSize } from "../config/global.config";

export interface ArenaUnit {
  id: string;
  dbId: string;
  ownerId: string;
  ownerKingdomId: string;
  name: string;
  avatar?: string; // ID do sprite (ex: "[1].png")
  category: string;
  troopSlot?: number;
  level: number;
  classCode?: string;
  classFeatures: string[];
  equipment: string[];
  // Stats
  combat: number;
  acuity: number;
  focus: number;
  armor: number;
  vitality: number;
  damageReduction: number;
  currentHp: number;
  maxHp: number;
  // Battle state
  posX: number;
  posY: number;
  movesLeft: number;
  actionsLeft: number;
  isAlive: boolean;
  actionMarks: number;
  // Proteção Física - ver shared/config/balance.config.ts
  physicalProtection: number;
  maxPhysicalProtection: number;
  // Proteção Mágica - ver shared/config/balance.config.ts
  magicalProtection: number;
  maxMagicalProtection: number;
  conditions: string[];
  hasStartedAction?: boolean;
  actions?: string[];
  // Tamanho da unidade (células ocupadas) - default NORMAL (1x1)
  size?: UnitSize;
  // Alcance de visão calculado (max(10, focus)) - calculado no servidor
  visionRange?: number;
}

// =============================================================================
// CONFIG TYPES
// =============================================================================

import type {
  WeatherType,
  BattleTerrainType,
  TerritorySize,
  BattleObstacle,
} from "./battle.types";

export interface ArenaGrid {
  width: number;
  height: number;
}

export interface ArenaMapConfig {
  weather: WeatherType;
  weatherEmoji: string;
  weatherName: string;
  weatherEffect: string;
  weatherCssFilter: string;
  terrainType: BattleTerrainType;
  terrainName: string;
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
    hostPrimary: string;
    hostSecondary: string;
    guestPrimary: string;
    guestSecondary: string;
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
}

export interface ArenaBattle {
  battleId: string;
  lobbyId: string;
  config: ArenaConfig;
  round: number;
  status: "ACTIVE" | "ENDED";
  currentTurnIndex: number;
  currentPlayerId: string;
  activeUnitId?: string; // Unidade ativa escolhida pelo jogador neste turno
  actionOrder: string[];
  units: ArenaUnit[];
  hostKingdom: ArenaKingdom;
  guestKingdom: ArenaKingdom;
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
  finalUnits: ArenaUnit[];
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
  status: ArenaLobbyStatus;
}

export interface LobbiesListResponse {
  lobbies: ArenaLobby[];
}

export interface PlayerJoinedResponse {
  lobbyId: string;
  guestUserId: string;
  guestUsername: string;
  guestKingdomName: string;
  status: ArenaLobbyStatus;
}

export interface BattleStartedResponse {
  battleId: string;
  lobbyId: string;
  config: ArenaConfig;
  units: ArenaUnit[];
  actionOrder: string[];
  hostKingdom: ArenaKingdom;
  guestKingdom: ArenaKingdom;
}

export interface UnitMovedResponse {
  battleId: string;
  unitId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  movesLeft: number;
}

export interface UnitAttackedResponse {
  battleId: string;
  attackerUnitId: string;
  targetUnitId: string;
  // Legado (manter para compatibilidade)
  diceCount: number;
  rolls: number[];
  damage: number;
  damageType: string;
  targetHpAfter: number;
  targetProtection: number;
  attackerActionsLeft: number;
  // Dados detalhados de rolagem
  missed?: boolean;
  attackDiceCount: number;
  attackRolls: number[];
  attackSuccesses: number;
  rawDamage: number;
  defenseDiceCount: number;
  defenseRolls: number[];
  defenseSuccesses: number;
  damageReduction: number;
  finalDamage: number;
  targetPhysicalProtection: number;
  targetMagicalProtection: number;
  targetDefeated: boolean;
  // Dados do atacante para o painel visual
  attackerName: string;
  attackerIcon: string;
  attackerCombat: number;
  // Dados do defensor para o painel visual
  targetName: string;
  targetIcon: string;
  targetCombat: number;
  targetAcuity: number; // Acuity é usado para defesa
}

export interface BattleEndedResponse {
  battleId: string;
  winnerId: string | null;
  winnerKingdomId: string | null;
  reason: string;
  surrenderedBy?: string;
  disconnectedBy?: string;
  abandonedBy?: string;
  finalUnits?: ArenaUnit[];
}
