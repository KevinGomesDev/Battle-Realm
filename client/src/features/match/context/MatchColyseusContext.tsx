// client/src/features/match/context/MatchColyseusContext.tsx
// Contexto de Match usando Colyseus (novo)

import React, {
  createContext,
  useReducer,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import {
  colyseusService,
  type MatchStateData,
} from "../../../services/colyseus.service";
import { useAuth } from "../../auth";

// ============================================
// Types
// ============================================

interface TerritoryData {
  id: string;
  hexId: string;
  name: string;
  ownerId: string | null;
  terrainType: string;
  resourceType: string | null;
  hasCapital: boolean;
  hasStructure: boolean;
  structureType: string | null;
  armyStrength: number;
}

interface MatchPlayerData {
  odataId: string;
  odataUserId: string;
  username: string;
  kingdomId: string;
  kingdomName: string;
  color: string;
  isReady: boolean;
  hasFinishedTurn: boolean;
  gold: number;
  mana: number;
  influence: number;
  victoryPoints: number;
}

interface CrisisData {
  id: string;
  name: string;
  description: string;
  severity: string;
  effects: string[];
}

interface MatchColyseusState {
  // Room info
  matchId: string | null;
  isHost: boolean;

  // Match status
  status: string;
  phase: string;
  currentTurn: number;
  maxTurns: number;
  turnTimer: number;
  turnTimeLimit: number;

  // Active player
  activePlayerId: string | null;
  isMyTurn: boolean;

  // Players
  players: MatchPlayerData[];
  myPlayerId: string | null;

  // Map
  territories: TerritoryData[];
  mapWidth: number;
  mapHeight: number;

  // Crisis
  activeCrisis: CrisisData | null;

  // Winner
  winnerId: string | null;
  winReason: string | null;

  // Open matches (lobby list)
  openMatches: OpenMatchData[];

  // UI State
  isLoading: boolean;
  error: string | null;
}

// OpenMatch type for lobby listing
interface OpenMatchData {
  id: string;
  hostName: string;
  hostUserId: string;
  kingdomId: string;
  kingdomName: string;
  maxPlayers: number;
  currentPlayers: number;
  status: string;
  createdAt: string;
}

type MatchAction =
  | { type: "SET_MATCH_ID"; payload: { matchId: string; isHost: boolean } }
  | { type: "SET_STATE"; payload: Partial<MatchColyseusState> }
  | { type: "SET_PLAYERS"; payload: MatchPlayerData[] }
  | { type: "SET_TERRITORIES"; payload: TerritoryData[] }
  | { type: "SET_ACTIVE_PLAYER"; payload: string | null }
  | { type: "SET_MY_PLAYER_ID"; payload: string | null }
  | { type: "SET_IS_MY_TURN"; payload: boolean }
  | { type: "SET_CRISIS"; payload: CrisisData | null }
  | { type: "SET_OPEN_MATCHES"; payload: OpenMatchData[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "RESET" };

interface MatchContextValue {
  state: MatchColyseusState;

  // Room management
  createMatch: (
    kingdomId: string,
    options?: { maxPlayers?: number }
  ) => Promise<void>;
  joinMatch: (roomId: string, kingdomId: string) => Promise<void>;
  leaveMatch: () => Promise<void>;

  // Lobby
  listOpenMatches: () => Promise<OpenMatchData[]>;

  // Preparation phase
  setReady: () => void;
  placeUnit: (unitTemplateId: string, hexId: string) => void;

  // Turn actions
  startTurn: () => void;
  endTurn: () => void;
  moveArmy: (fromHexId: string, toHexId: string, units: number) => void;
  attackTerritory: (fromHexId: string, toHexId: string) => void;
  buildStructure: (hexId: string, structureType: string) => void;
  recruitUnit: (hexId: string, unitTemplateId: string) => void;
  collectResources: () => void;

  // Utilities
  getTerritory: (hexId: string) => TerritoryData | undefined;
  getMyTerritories: () => TerritoryData[];
  getPlayer: (playerId: string) => MatchPlayerData | undefined;
  getMyPlayer: () => MatchPlayerData | undefined;
  clearError: () => void;
}

// ============================================
// Initial State & Reducer
// ============================================

const initialState: MatchColyseusState = {
  matchId: null,
  isHost: false,
  status: "IDLE",
  phase: "LOBBY",
  currentTurn: 0,
  maxTurns: 50,
  turnTimer: 0,
  turnTimeLimit: 120,
  activePlayerId: null,
  isMyTurn: false,
  players: [],
  myPlayerId: null,
  territories: [],
  mapWidth: 0,
  mapHeight: 0,
  activeCrisis: null,
  winnerId: null,
  winReason: null,
  openMatches: [],
  isLoading: false,
  error: null,
};

function matchReducer(
  state: MatchColyseusState,
  action: MatchAction
): MatchColyseusState {
  switch (action.type) {
    case "SET_MATCH_ID":
      return {
        ...state,
        matchId: action.payload.matchId,
        isHost: action.payload.isHost,
      };
    case "SET_STATE":
      return { ...state, ...action.payload };
    case "SET_PLAYERS":
      return { ...state, players: action.payload };
    case "SET_TERRITORIES":
      return { ...state, territories: action.payload };
    case "SET_ACTIVE_PLAYER":
      return { ...state, activePlayerId: action.payload };
    case "SET_MY_PLAYER_ID":
      return { ...state, myPlayerId: action.payload };
    case "SET_IS_MY_TURN":
      return { ...state, isMyTurn: action.payload };
    case "SET_CRISIS":
      return { ...state, activeCrisis: action.payload };
    case "SET_OPEN_MATCHES":
      return { ...state, openMatches: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, isLoading: false };
    case "RESET":
      sessionStorage.removeItem("currentMatchId");
      return initialState;
    default:
      return state;
  }
}

// ============================================
// Context
// ============================================

const MatchColyseusContext = createContext<MatchContextValue | null>(null);

// ============================================
// Provider
// ============================================

export function MatchColyseusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(matchReducer, initialState);
  const { user } = useAuth();
  const mountedRef = useRef(true);

  // Sync state from Colyseus
  useEffect(() => {
    mountedRef.current = true;

    const handleStateChanged = (colyseusState: MatchStateData) => {
      if (!mountedRef.current) return;

      // Convert MapSchema to arrays
      const playersArray: MatchPlayerData[] = [];
      if (colyseusState.players) {
        colyseusState.players.forEach((player: MatchPlayerData) => {
          playersArray.push({
            odataId: player.odataId,
            odataUserId: player.odataUserId,
            username: player.username,
            kingdomId: player.kingdomId,
            kingdomName: player.kingdomName,
            color: player.color,
            isReady: player.isReady,
            hasFinishedTurn: player.hasFinishedTurn,
            gold: player.gold,
            mana: player.mana,
            influence: player.influence,
            victoryPoints: player.victoryPoints,
          });
        });
      }

      const territoriesArray: TerritoryData[] = [];
      if (colyseusState.territories) {
        colyseusState.territories.forEach((territory: TerritoryData) => {
          territoriesArray.push({
            id: territory.id,
            hexId: territory.hexId,
            name: territory.name,
            ownerId: territory.ownerId,
            terrainType: territory.terrainType,
            resourceType: territory.resourceType,
            hasCapital: territory.hasCapital,
            hasStructure: territory.hasStructure,
            structureType: territory.structureType,
            armyStrength: territory.armyStrength,
          });
        });
      }

      // Find my player id
      let myPlayerId: string | null = null;
      if (user?.id) {
        const myPlayer = playersArray.find((p) => p.odataUserId === user.id);
        if (myPlayer) {
          myPlayerId = myPlayer.odataId;
        }
      }

      // Check if it's my turn
      const isMyTurn = myPlayerId
        ? colyseusState.activePlayerId === myPlayerId
        : false;

      // Crisis data
      let crisisData: CrisisData | null = null;
      if (colyseusState.activeCrisis) {
        const effects: string[] = [];
        colyseusState.activeCrisis.effects?.forEach((effect: string) => {
          effects.push(effect);
        });
        crisisData = {
          id: colyseusState.activeCrisis.id,
          name: colyseusState.activeCrisis.name,
          description: colyseusState.activeCrisis.description,
          severity: colyseusState.activeCrisis.severity,
          effects,
        };
      }

      dispatch({
        type: "SET_STATE",
        payload: {
          matchId: colyseusState.matchId,
          status: colyseusState.status,
          phase: colyseusState.phase,
          currentTurn: colyseusState.currentTurn,
          maxTurns: colyseusState.maxTurns,
          turnTimer: colyseusState.turnTimer,
          turnTimeLimit: colyseusState.turnTimeLimit,
          activePlayerId: colyseusState.activePlayerId || null,
          mapWidth: colyseusState.mapWidth,
          mapHeight: colyseusState.mapHeight,
          winnerId: colyseusState.winnerId || null,
          winReason: colyseusState.winReason || null,
          myPlayerId,
          isMyTurn,
        },
      });

      dispatch({ type: "SET_PLAYERS", payload: playersArray });
      dispatch({ type: "SET_TERRITORIES", payload: territoriesArray });
      dispatch({ type: "SET_CRISIS", payload: crisisData });
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
          payload: data.message || "Erro na partida",
        });
      }
    };

    colyseusService.on("match:state_changed", handleStateChanged);
    colyseusService.on("match:left", handleLeft);
    colyseusService.on("match:error", handleError);

    // Check if already in match
    if (colyseusService.isInMatch()) {
      const matchState = colyseusService.getMatchState();
      if (matchState) {
        // Cast to expected type - state from room is MatchState, we need MatchStateData
        handleStateChanged(matchState as unknown as MatchStateData);
      }
    }

    return () => {
      mountedRef.current = false;
      colyseusService.off("match:state_changed", handleStateChanged);
      colyseusService.off("match:left", handleLeft);
      colyseusService.off("match:error", handleError);
    };
  }, [user?.id]);

  // =========================================
  // Room Management
  // =========================================

  const createMatch = useCallback(
    async (kingdomId: string, options?: { maxPlayers?: number }) => {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        const room = await colyseusService.createMatch({
          kingdomId,
          maxPlayers: options?.maxPlayers,
        });

        dispatch({
          type: "SET_MATCH_ID",
          payload: { matchId: room.id, isHost: true },
        });
        sessionStorage.setItem("currentMatchId", room.id);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Erro ao criar partida";
        dispatch({ type: "SET_ERROR", payload: message });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    []
  );

  const joinMatch = useCallback(async (roomId: string, kingdomId: string) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const room = await colyseusService.joinMatch(roomId, kingdomId);
      dispatch({
        type: "SET_MATCH_ID",
        payload: { matchId: room.id, isHost: false },
      });
      sessionStorage.setItem("currentMatchId", room.id);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao entrar na partida";
      dispatch({ type: "SET_ERROR", payload: message });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  const leaveMatch = useCallback(async () => {
    await colyseusService.leaveMatch();
    dispatch({ type: "RESET" });
  }, []);

  // =========================================
  // Open Matches (Lobby)
  // =========================================

  const listOpenMatches = useCallback(async (): Promise<OpenMatchData[]> => {
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const matches = await colyseusService.waitForResponse<OpenMatchData[]>(
        "match:list",
        {},
        "match:list_result",
        "match:error",
        5000
      );

      dispatch({ type: "SET_OPEN_MATCHES", payload: matches || [] });
      return matches || [];
    } catch (err: unknown) {
      console.error("[Match] Erro ao listar partidas:", err);
      dispatch({ type: "SET_OPEN_MATCHES", payload: [] });
      return [];
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  // =========================================
  // Preparation Phase
  // =========================================

  const setReady = useCallback(() => {
    colyseusService.sendToMatch("player:ready", {});
  }, []);

  const placeUnit = useCallback((unitTemplateId: string, hexId: string) => {
    colyseusService.sendToMatch("player:place_unit", { unitTemplateId, hexId });
  }, []);

  // =========================================
  // Turn Actions
  // =========================================

  const startTurn = useCallback(() => {
    colyseusService.sendToMatch("turn:start", {});
  }, []);

  const endTurn = useCallback(() => {
    colyseusService.sendToMatch("turn:end", {});
  }, []);

  const moveArmy = useCallback(
    (fromHexId: string, toHexId: string, units: number) => {
      colyseusService.sendToMatch("action:move_army", {
        fromHexId,
        toHexId,
        units,
      });
    },
    []
  );

  const attackTerritory = useCallback((fromHexId: string, toHexId: string) => {
    colyseusService.sendToMatch("action:attack", { fromHexId, toHexId });
  }, []);

  const buildStructure = useCallback((hexId: string, structureType: string) => {
    colyseusService.sendToMatch("action:build", { hexId, structureType });
  }, []);

  const recruitUnit = useCallback((hexId: string, unitTemplateId: string) => {
    colyseusService.sendToMatch("action:recruit", { hexId, unitTemplateId });
  }, []);

  const collectResources = useCallback(() => {
    colyseusService.sendToMatch("action:collect_resources", {});
  }, []);

  // =========================================
  // Utilities
  // =========================================

  const getTerritory = useCallback(
    (hexId: string): TerritoryData | undefined => {
      return state.territories.find((t) => t.hexId === hexId);
    },
    [state.territories]
  );

  const getMyTerritories = useCallback((): TerritoryData[] => {
    if (!state.myPlayerId) return [];
    return state.territories.filter((t) => t.ownerId === state.myPlayerId);
  }, [state.territories, state.myPlayerId]);

  const getPlayer = useCallback(
    (playerId: string): MatchPlayerData | undefined => {
      return state.players.find((p) => p.odataId === playerId);
    },
    [state.players]
  );

  const getMyPlayer = useCallback((): MatchPlayerData | undefined => {
    if (!state.myPlayerId) return undefined;
    return state.players.find((p) => p.odataId === state.myPlayerId);
  }, [state.players, state.myPlayerId]);

  const clearError = useCallback(() => {
    dispatch({ type: "SET_ERROR", payload: null });
  }, []);

  const contextValue: MatchContextValue = {
    state,
    createMatch,
    joinMatch,
    leaveMatch,
    listOpenMatches,
    setReady,
    placeUnit,
    startTurn,
    endTurn,
    moveArmy,
    attackTerritory,
    buildStructure,
    recruitUnit,
    collectResources,
    getTerritory,
    getMyTerritories,
    getPlayer,
    getMyPlayer,
    clearError,
  };

  return (
    <MatchColyseusContext.Provider value={contextValue}>
      {children}
    </MatchColyseusContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useMatchColyseus(): MatchContextValue {
  const context = useContext(MatchColyseusContext);
  if (!context) {
    throw new Error(
      "useMatchColyseus must be used within MatchColyseusProvider"
    );
  }
  return context;
}
