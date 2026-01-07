// client/src/features/arena/context/ArenaColyseusContext.tsx
// Contexto de Arena usando Colyseus (novo)

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import {
  colyseusService,
  type ArenaBattleState,
  type BattleUnitState,
  type BattlePlayerState,
  type BattleObstacleState,
} from "../../../services/colyseus.service";
import { useAuth } from "../../auth";

// ============================================
// Types
// ============================================

interface ArenaState {
  // Lobby
  lobbyId: string | null;
  isHost: boolean;

  // Available lobbies (for listing)
  lobbies: ArenaLobbyData[];

  // Battle
  battleId: string | null;
  isInBattle: boolean;
  status: string;
  round: number;
  turnTimer: number;
  gridWidth: number;
  gridHeight: number;

  // Players
  players: BattlePlayerState[];

  // Units
  units: BattleUnitState[];
  activeUnitId: string | null;
  currentPlayerId: string | null; // Vem do servidor - quem controla a unidade ativa

  // Obstacles
  obstacles: BattleObstacleState[];

  // Result
  winnerId: string | null;
  winReason: string | null;
  rematchRequests: string[];

  // UI State
  isLoading: boolean;
  error: string | null;

  // Computed battle object for compatibility with ArenaBattleView
  battle: ArenaBattleComputed | null;
  battleResult: { winnerId: string; winReason: string } | null;
  rematchPending: boolean;
  opponentWantsRematch: boolean;
}

// Battle object compatible with ArenaBattleView
interface ArenaBattleComputed {
  battleId: string;
  round: number;
  activeUnitId: string | null;
  currentPlayerId: string | null;
  kingdoms: Array<{
    ownerId: string;
    kingdomId: string;
    kingdomName: string;
    playerIndex: number;
    playerColor: string;
  }>;
  config: {
    grid: {
      width: number;
      height: number;
    };
    map: {
      obstacles: BattleObstacleState[];
      terrainType?: string;
    };
  };
}

// Lobby data for listing
interface ArenaLobbyData {
  lobbyId: string;
  hostUserId: string;
  hostUsername: string;
  hostKingdomId: string;
  hostKingdomName: string;
  maxPlayers: number;
  currentPlayers: number;
  vsBot: boolean;
  status: string;
  createdAt: string;
}

type ArenaAction =
  | { type: "SET_LOBBY"; payload: { lobbyId: string; isHost: boolean } }
  | { type: "SET_LOBBIES"; payload: ArenaLobbyData[] }
  | { type: "SET_BATTLE_STATE"; payload: Partial<ArenaState> }
  | { type: "SET_UNITS"; payload: BattleUnitState[] }
  | { type: "UPDATE_UNIT"; payload: BattleUnitState }
  | { type: "SET_PLAYERS"; payload: BattlePlayerState[] }
  | { type: "SET_OBSTACLES"; payload: BattleObstacleState[] }
  | { type: "SET_ACTIVE_UNIT"; payload: string | null }
  | { type: "SET_RESULT"; payload: { winnerId: string; winReason: string } }
  | { type: "ADD_REMATCH_REQUEST"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "RESET" };

interface ArenaContextType {
  state: ArenaState;

  // Lobby listing
  listLobbies: () => Promise<ArenaLobbyData[]>;

  // Lobby
  createLobby: (
    kingdomId: string,
    options?: { maxPlayers?: number; vsBot?: boolean }
  ) => Promise<void>;
  joinLobby: (roomId: string, kingdomId: string) => Promise<void>;
  leaveLobby: () => Promise<void>;
  setReady: () => void;
  startBattle: () => void;

  // Battle
  beginAction: (unitId: string) => void;
  moveUnit: (unitId: string, toX: number, toY: number) => void;
  attackUnit: (
    attackerId: string,
    targetId?: string,
    targetObstacleId?: string
  ) => void;
  endAction: (unitId: string) => void;
  executeAction: (
    actionName: string,
    unitId: string,
    params?: Record<string, unknown>
  ) => void;
  castSpell: (
    unitId: string,
    spellCode: string,
    targetId?: string,
    targetPosition?: { x: number; y: number }
  ) => void;
  surrender: () => void;
  requestRematch: () => void;

  // Utilities
  getUnit: (unitId: string) => BattleUnitState | undefined;
  getMyUnits: () => BattleUnitState[];
  clearError: () => void;
  dismissBattleResult: () => void;
}

// ============================================
// Initial State & Reducer
// ============================================

const initialState: ArenaState = {
  lobbyId: null,
  isHost: false,
  lobbies: [],
  battleId: null,
  isInBattle: false,
  status: "IDLE",
  round: 0,
  turnTimer: 0,
  gridWidth: 12,
  gridHeight: 8,
  players: [],
  units: [],
  activeUnitId: null,
  currentPlayerId: null,
  obstacles: [],
  winnerId: null,
  winReason: null,
  rematchRequests: [],
  isLoading: false,
  error: null,
  battle: null,
  battleResult: null,
  rematchPending: false,
  opponentWantsRematch: false,
};

function arenaReducer(state: ArenaState, action: ArenaAction): ArenaState {
  switch (action.type) {
    case "SET_LOBBY":
      return {
        ...state,
        lobbyId: action.payload.lobbyId,
        isHost: action.payload.isHost,
      };
    case "SET_BATTLE_STATE":
      return { ...state, ...action.payload };
    case "SET_UNITS":
      return { ...state, units: action.payload };
    case "UPDATE_UNIT":
      return {
        ...state,
        units: state.units.map((u) =>
          u.id === action.payload.id ? action.payload : u
        ),
      };
    case "SET_PLAYERS":
      return { ...state, players: action.payload };
    case "SET_OBSTACLES":
      return { ...state, obstacles: action.payload };
    case "SET_ACTIVE_UNIT":
      return { ...state, activeUnitId: action.payload };
    case "SET_RESULT":
      return {
        ...state,
        winnerId: action.payload.winnerId,
        winReason: action.payload.winReason,
      };
    case "ADD_REMATCH_REQUEST":
      return {
        ...state,
        rematchRequests: [...state.rematchRequests, action.payload],
      };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_LOBBIES":
      return { ...state, lobbies: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, isLoading: false };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

// ============================================
// Context
// ============================================

export const ArenaColyseusContext = createContext<ArenaContextType | null>(
  null
);

// ============================================
// Provider
// ============================================

export function ArenaColyseusProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(arenaReducer, initialState);
  const { user } = useAuth();
  const mountedRef = useRef(true);

  // Compute battle object for compatibility with ArenaBattleView
  const computedState = useMemo((): ArenaState => {
    // Build battle object only if in battle
    const battle: ArenaBattleComputed | null =
      state.isInBattle && state.battleId
        ? {
            battleId: state.battleId,
            round: state.round,
            activeUnitId: state.activeUnitId,
            currentPlayerId: state.currentPlayerId, // Vem do servidor
            kingdoms: state.players.map((p) => ({
              ownerId: p.oderId,
              kingdomId: p.kingdomId,
              kingdomName: p.kingdomName,
              playerIndex: p.playerIndex,
              playerColor: p.playerColor,
            })),
            config: {
              grid: {
                width: state.gridWidth,
                height: state.gridHeight,
              },
              map: {
                obstacles: state.obstacles,
              },
            },
          }
        : null;

    // Compute battle result
    const battleResult =
      state.winnerId && state.winReason
        ? { winnerId: state.winnerId, winReason: state.winReason }
        : null;

    // Compute rematch status
    const rematchPending = user?.id
      ? state.rematchRequests.includes(user.id)
      : false;
    const opponentWantsRematch = user?.id
      ? state.rematchRequests.some((id) => id !== user.id)
      : false;

    return {
      ...state,
      battle,
      battleResult,
      rematchPending,
      opponentWantsRematch,
    };
  }, [state, user?.id]);

  // Sync state from Colyseus
  useEffect(() => {
    mountedRef.current = true;

    const handleStateChanged = (colyseusState: ArenaBattleState) => {
      if (!mountedRef.current) return;

      // Convert MapSchema to arrays
      const unitsArray: BattleUnitState[] = [];
      if (colyseusState.units) {
        colyseusState.units.forEach((unit: BattleUnitState) => {
          unitsArray.push(unit);
        });
      }

      const playersArray: BattlePlayerState[] = [];
      if (colyseusState.players) {
        colyseusState.players.forEach((player: BattlePlayerState) => {
          playersArray.push(player);
        });
      }

      const obstaclesArray: BattleObstacleState[] = [];
      if (colyseusState.obstacles) {
        colyseusState.obstacles.forEach((obs: BattleObstacleState) => {
          obstaclesArray.push(obs);
        });
      }

      dispatch({
        type: "SET_BATTLE_STATE",
        payload: {
          battleId: colyseusState.battleId,
          lobbyId: colyseusState.lobbyId,
          isInBattle: colyseusState.status === "ACTIVE",
          status: colyseusState.status,
          round: colyseusState.round,
          turnTimer: colyseusState.turnTimer,
          gridWidth: colyseusState.gridWidth,
          gridHeight: colyseusState.gridHeight,
          activeUnitId: colyseusState.activeUnitId || null,
          currentPlayerId: colyseusState.currentPlayerId || null,
          winnerId: colyseusState.winnerId || null,
          winReason: colyseusState.winReason || null,
          rematchRequests: Array.from(colyseusState.rematchRequests || []),
        },
      });

      dispatch({ type: "SET_UNITS", payload: unitsArray });
      dispatch({ type: "SET_PLAYERS", payload: playersArray });
      dispatch({ type: "SET_OBSTACLES", payload: obstaclesArray });
    };

    const handleLeft = () => {
      if (mountedRef.current) {
        dispatch({ type: "RESET" });
      }
    };

    const handleError = (data: { message?: string }) => {
      if (mountedRef.current) {
        dispatch({
          type: "SET_ERROR",
          payload: data.message || "Erro na arena",
        });
      }
    };

    colyseusService.on("arena:state_changed", handleStateChanged);
    colyseusService.on("arena:left", handleLeft);
    colyseusService.on("arena:error", handleError);

    // Check if already in arena
    if (colyseusService.isInArena()) {
      const arenaState = colyseusService.getArenaState();
      if (arenaState) {
        handleStateChanged(arenaState);
      }
    }

    return () => {
      mountedRef.current = false;
      colyseusService.off("arena:state_changed", handleStateChanged);
      colyseusService.off("arena:left", handleLeft);
      colyseusService.off("arena:error", handleError);
    };
  }, []);

  // =========================================
  // Lobby Actions
  // =========================================

  const listLobbies = useCallback(async (): Promise<ArenaLobbyData[]> => {
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const lobbies = await colyseusService.waitForResponse<ArenaLobbyData[]>(
        "arena:list_lobbies",
        {},
        "arena:lobbies_list",
        "arena:error",
        5000
      );

      dispatch({ type: "SET_LOBBIES", payload: lobbies || [] });
      return lobbies || [];
    } catch (err: unknown) {
      console.error("[Arena] Erro ao listar lobbies:", err);
      dispatch({ type: "SET_LOBBIES", payload: [] });
      return [];
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  const createLobby = useCallback(
    async (
      kingdomId: string,
      options?: { maxPlayers?: number; vsBot?: boolean }
    ) => {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        const room = await colyseusService.createArenaLobby({
          kingdomId,
          maxPlayers: options?.maxPlayers,
          vsBot: options?.vsBot,
        });

        dispatch({
          type: "SET_LOBBY",
          payload: { lobbyId: room.id, isHost: true },
        });
      } catch (err: any) {
        dispatch({ type: "SET_ERROR", payload: err.message });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    []
  );

  const joinLobby = useCallback(async (roomId: string, kingdomId: string) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const room = await colyseusService.joinArenaLobby(roomId, kingdomId);
      dispatch({
        type: "SET_LOBBY",
        payload: { lobbyId: room.id, isHost: false },
      });
    } catch (err: any) {
      dispatch({ type: "SET_ERROR", payload: err.message });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  const leaveLobby = useCallback(async () => {
    await colyseusService.leaveArena();
    dispatch({ type: "RESET" });
  }, []);

  const setReady = useCallback(() => {
    colyseusService.sendToArena("lobby:ready", {});
  }, []);

  const startBattle = useCallback(() => {
    colyseusService.sendToArena("lobby:start", {});
  }, []);

  // =========================================
  // Battle Actions
  // =========================================

  const beginAction = useCallback((unitId: string) => {
    colyseusService.sendToArena("battle:begin_action", { unitId });
  }, []);

  const moveUnit = useCallback((unitId: string, toX: number, toY: number) => {
    colyseusService.sendToArena("battle:move", { unitId, toX, toY });
  }, []);

  const attackUnit = useCallback(
    (attackerId: string, targetId?: string, targetObstacleId?: string) => {
      colyseusService.sendToArena("battle:attack", {
        attackerId,
        targetId,
        targetObstacleId,
      });
    },
    []
  );

  const endAction = useCallback((unitId: string) => {
    colyseusService.sendToArena("battle:end_action", { unitId });
  }, []);

  const executeAction = useCallback(
    (actionName: string, unitId: string, params?: Record<string, unknown>) => {
      colyseusService.sendToArena("battle:execute_action", {
        actionName,
        unitId,
        params,
      });
    },
    []
  );

  const castSpell = useCallback(
    (
      unitId: string,
      spellCode: string,
      targetId?: string,
      targetPosition?: { x: number; y: number }
    ) => {
      colyseusService.sendToArena("battle:cast_spell", {
        unitId,
        spellCode,
        targetId,
        targetPosition,
      });
    },
    []
  );

  const surrender = useCallback(() => {
    colyseusService.sendToArena("battle:surrender", {});
  }, []);

  const requestRematch = useCallback(() => {
    colyseusService.sendToArena("battle:request_rematch", {});
  }, []);

  // =========================================
  // Utilities
  // =========================================

  const getUnit = useCallback(
    (unitId: string): BattleUnitState | undefined => {
      return state.units.find((u) => u.id === unitId);
    },
    [state.units]
  );

  const getMyUnits = useCallback((): BattleUnitState[] => {
    if (!user?.id) return [];
    return state.units.filter((u) => u.ownerId === user.id);
  }, [state.units, user?.id]);

  const clearError = useCallback(() => {
    dispatch({ type: "SET_ERROR", payload: null });
  }, []);

  const dismissBattleResult = useCallback(() => {
    dispatch({
      type: "SET_RESULT",
      payload: { winnerId: "", winReason: "" },
    });
  }, []);

  return (
    <ArenaColyseusContext.Provider
      value={{
        state: computedState,
        listLobbies,
        createLobby,
        joinLobby,
        leaveLobby,
        setReady,
        startBattle,
        beginAction,
        moveUnit,
        attackUnit,
        endAction,
        executeAction,
        castSpell,
        surrender,
        requestRematch,
        getUnit,
        getMyUnits,
        clearError,
        dismissBattleResult,
      }}
    >
      {children}
    </ArenaColyseusContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useArenaColyseus(): ArenaContextType {
  const context = useContext(ArenaColyseusContext);
  if (!context) {
    throw new Error(
      "useArenaColyseus must be used within ArenaColyseusProvider"
    );
  }
  return context;
}
