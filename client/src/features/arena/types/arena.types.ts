// Arena Types - Sistema de combate PvP independente de partidas

export type ArenaLobbyStatus = "WAITING" | "READY" | "BATTLING" | "ENDED";

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

export interface ArenaUnit {
  id: string; // ID da unidade na arena
  dbId: string; // ID original no banco (Unit)
  ownerId: string; // UserId do dono
  ownerKingdomId: string;
  name: string;
  category: string;
  troopSlot?: number; // Para TROOP: índice do template (0-4)
  level: number;
  classId?: string; // ID da classe do herói/regente
  classFeatures: string[]; // Skills aprendidas
  equipment: string[]; // Itens equipados
  // Stats
  combat: number;
  acuity: number;
  focus: number;
  armor: number;
  vitality: number;
  damageReduction: number; // Redução de dano fixa
  currentHp: number;
  maxHp: number; // HP máximo = vitality * 2
  // Battle state
  posX: number;
  posY: number;
  initiative: number;
  movesLeft: number;
  actionsLeft: number;
  isAlive: boolean;
  actionMarks: number;
  protection: number;
  protectionBroken: boolean;
  conditions: string[];
  hasStartedAction?: boolean; // Se a unidade já iniciou ação neste turno
  actions?: string[]; // Ações disponíveis: ["attack", "move", ...]
}

export interface ArenaGrid {
  width: number;
  height: number;
}

export interface ArenaKingdom {
  id: string;
  name: string;
  ownerId: string;
}

export interface ArenaBattle {
  battleId: string;
  grid: ArenaGrid;
  round: number;
  status: "ACTIVE" | "ENDED";
  currentTurnIndex: number;
  currentPlayerId: string;
  actionOrder: string[];
  initiativeOrder: string[];
  units: ArenaUnit[];
  hostKingdom: ArenaKingdom;
  guestKingdom: ArenaKingdom;
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

export interface ArenaState {
  lobbies: ArenaLobby[];
  currentLobby: ArenaLobby | null;
  battle: ArenaBattle | null;
  battleResult: ArenaBattleResult | null;
  units: ArenaUnit[];
  logs: ArenaLog[];
  isHost: boolean;
  isLoading: boolean;
  error: string | null;
  rematchPending: boolean;
  opponentWantsRematch: boolean;
}

// Socket Event Payloads
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

// Socket Response Types
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
  grid: ArenaGrid;
  units: ArenaUnit[];
  initiativeOrder: string[];
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
  diceCount: number;
  rolls: number[];
  damage: number;
  damageType: string;
  targetHpAfter: number;
  targetProtection: number;
  attackerActionsLeft: number;
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

export interface ArenaContextType {
  state: ArenaState;
  createLobby: (kingdomId: string) => void;
  listLobbies: () => void;
  joinLobby: (lobbyId: string, kingdomId: string) => void;
  leaveLobby: () => void;
  startBattle: () => void;
  beginAction: (unitId: string) => void;
  moveUnit: (unitId: string, toX: number, toY: number) => void;
  attackUnit: (attackerUnitId: string, targetUnitId: string) => void;
  endAction: (unitId: string) => void;
  executeAction: (
    actionName: string,
    unitId: string,
    params?: Record<string, unknown>
  ) => void;
  surrender: () => void;
  requestRematch: () => void;
  dismissBattleResult: () => void;
  clearError: () => void;
}

export type ArenaAction =
  | { type: "SET_LOBBIES"; payload: ArenaLobby[] }
  | { type: "SET_CURRENT_LOBBY"; payload: ArenaLobby | null }
  | {
      type: "UPDATE_LOBBY_STATUS";
      payload: { lobbyId: string; status: ArenaLobbyStatus };
    }
  | { type: "SET_BATTLE"; payload: ArenaBattle | null }
  | { type: "SET_BATTLE_RESULT"; payload: ArenaBattleResult | null }
  | { type: "SET_UNITS"; payload: ArenaUnit[] }
  | { type: "UPDATE_UNIT"; payload: Partial<ArenaUnit> & { id: string } }
  | { type: "ADD_LOG"; payload: ArenaLog }
  | { type: "SET_LOGS"; payload: ArenaLog[] }
  | { type: "SET_IS_HOST"; payload: boolean }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_REMATCH_PENDING"; payload: boolean }
  | { type: "SET_OPPONENT_WANTS_REMATCH"; payload: boolean }
  | { type: "RESET" };
