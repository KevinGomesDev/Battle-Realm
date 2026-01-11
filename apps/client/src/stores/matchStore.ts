// client/src/stores/matchStore.ts
// Store Zustand para Match/Partidas

import { create } from "zustand";
import {
  colyseusService,
  type MatchStateData,
} from "../services/colyseus.service";
import { useKingdomStore } from "./kingdomStore";

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

interface MatchState {
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

interface MatchActions {
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

  // State setters
  setMatchId: (matchId: string, isHost: boolean) => void;
  setState: (state: Partial<MatchState>) => void;
  setPlayers: (players: MatchPlayerData[]) => void;
  setTerritories: (territories: TerritoryData[]) => void;
  setActivePlayer: (playerId: string | null) => void;
  setMyPlayerId: (playerId: string | null) => void;
  setIsMyTurn: (isMyTurn: boolean) => void;
  setCrisis: (crisis: CrisisData | null) => void;
  setOpenMatches: (matches: OpenMatchData[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  initializeListeners: (userId: string | undefined) => () => void;
}

const initialState: MatchState = {
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

export const useMatchStore = create<MatchState & MatchActions>((set, get) => ({
  ...initialState,

  // State setters
  setMatchId: (matchId, isHost) => set({ matchId, isHost }),

  setState: (state) => set((prev) => ({ ...prev, ...state })),

  setPlayers: (players) => set({ players }),

  setTerritories: (territories) => set({ territories }),

  setActivePlayer: (activePlayerId) => set({ activePlayerId }),

  setMyPlayerId: (myPlayerId) => set({ myPlayerId }),

  setIsMyTurn: (isMyTurn) => set({ isMyTurn }),

  setCrisis: (activeCrisis) => set({ activeCrisis }),

  setOpenMatches: (openMatches) => set({ openMatches }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  reset: () => {
    sessionStorage.removeItem("currentMatchId");
    set(initialState);
  },

  clearError: () => set({ error: null }),

  // Room Management
  createMatch: async (kingdomId, options) => {
    set({ isLoading: true, error: null });

    try {
      const room = await colyseusService.createMatch({
        kingdomId,
        maxPlayers: options?.maxPlayers,
      });

      set({ matchId: room.id, isHost: true, isLoading: false });
      sessionStorage.setItem("currentMatchId", room.id);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error creating match";
      set({ error: message, isLoading: false });
    }
  },

  joinMatch: async (roomId, kingdomId) => {
    set({ isLoading: true, error: null });

    try {
      const room = await colyseusService.joinMatch(roomId, kingdomId);
      set({ matchId: room.id, isHost: false, isLoading: false });
      sessionStorage.setItem("currentMatchId", room.id);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error joining match";
      set({ error: message, isLoading: false });
    }
  },

  leaveMatch: async () => {
    await colyseusService.leaveMatch();
    get().reset();
  },

  // Open Matches (Lobby)
  listOpenMatches: async () => {
    set({ isLoading: true });

    try {
      const matches = await colyseusService.waitForResponse<OpenMatchData[]>(
        "match:list",
        {},
        "match:list_result",
        "match:error",
        5000
      );

      set({ openMatches: matches || [], isLoading: false });
      return matches || [];
    } catch (err: unknown) {
      console.error("[Match] Erro ao listar partidas:", err);
      set({ openMatches: [], isLoading: false });
      return [];
    }
  },

  // Preparation Phase
  setReady: () => {
    colyseusService.sendToMatch("player:ready", {});
  },

  placeUnit: (unitTemplateId, hexId) => {
    colyseusService.sendToMatch("player:place_unit", { unitTemplateId, hexId });
  },

  // Turn Actions
  startTurn: () => {
    colyseusService.sendToMatch("turn:start", {});
  },

  endTurn: () => {
    colyseusService.sendToMatch("turn:end", {});
  },

  moveArmy: (fromHexId, toHexId, units) => {
    colyseusService.sendToMatch("action:move_army", {
      fromHexId,
      toHexId,
      units,
    });
  },

  attackTerritory: (fromHexId, toHexId) => {
    colyseusService.sendToMatch("action:attack", { fromHexId, toHexId });
  },

  buildStructure: (hexId, structureType) => {
    colyseusService.sendToMatch("action:build", { hexId, structureType });
  },

  recruitUnit: (hexId, unitTemplateId) => {
    colyseusService.sendToMatch("action:recruit", { hexId, unitTemplateId });
  },

  collectResources: () => {
    colyseusService.sendToMatch("action:collect_resources", {});
  },

  // Utilities
  getTerritory: (hexId) => {
    return get().territories.find((t) => t.hexId === hexId);
  },

  getMyTerritories: () => {
    const { territories, myPlayerId } = get();
    if (!myPlayerId) return [];
    return territories.filter((t) => t.ownerId === myPlayerId);
  },

  getPlayer: (playerId) => {
    return get().players.find((p) => p.odataId === playerId);
  },

  getMyPlayer: () => {
    const { players, myPlayerId } = get();
    if (!myPlayerId) return undefined;
    return players.find((p) => p.odataId === myPlayerId);
  },

  initializeListeners: (userId) => {
    const handleStateChanged = (colyseusState: MatchStateData) => {
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

      let myPlayerId: string | null = null;
      if (userId) {
        const myPlayer = playersArray.find((p) => p.odataUserId === userId);
        if (myPlayer) {
          myPlayerId = myPlayer.odataId;
        }
      }

      const isMyTurn = myPlayerId
        ? colyseusState.activePlayerId === myPlayerId
        : false;

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

      set({
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
        players: playersArray,
        territories: territoriesArray,
        activeCrisis: crisisData,
      });
    };

    const handleLeft = () => {
      get().reset();
    };

    const handleError = (data: { message?: string }) => {
      set({ error: data.message || "Erro na partida" });
    };

    const handleSessionActive = async (data: {
      type: string;
      roomId?: string;
      matchId?: string;
      kingdomId?: string;
      status?: string;
      source?: "memory" | "database";
      needsRestore?: boolean;
    }) => {
      if (data.type !== "MATCH") {
        return;
      }

      const roomId = data.roomId || data.matchId;
      if (!roomId) {
        console.warn(
          "[Match] Sessão ativa sem roomId, não é possível reconectar"
        );
        return;
      }

      if (colyseusService.isInMatch()) {
        const currentRoom = colyseusService.getMatchRoom();
        if (currentRoom?.id === roomId) {
          return;
        }
      }

      set({ isLoading: true });

      try {
        let kingdomId = data.kingdomId;

        if (!kingdomId) {
          // Obter kingdomId do store Zustand
          const kingdomFromStore = useKingdomStore.getState().kingdom;
          kingdomId = kingdomFromStore?.id;
        }

        if (!kingdomId) {
          console.error("[Match] Could not find kingdomId for reconnection");
          set({
            error: "Kingdom not found for reconnection",
            isLoading: false,
          });
          return;
        }

        await colyseusService.joinMatch(roomId, kingdomId);

        set({ matchId: roomId, isHost: false, isLoading: false });
      } catch (err: any) {
        console.error("[Match] Error reconnecting:", err);
        set({ error: err.message || "Error reconnecting", isLoading: false });
      }
    };

    colyseusService.on("match:state_changed", handleStateChanged);
    colyseusService.on("match:left", handleLeft);
    colyseusService.on("match:error", handleError);
    colyseusService.on("session:active", handleSessionActive);

    // Check if already in match
    if (colyseusService.isInMatch()) {
      const matchState = colyseusService.getMatchState();
      if (matchState) {
        handleStateChanged(matchState as unknown as MatchStateData);
      }
    }

    return () => {
      colyseusService.off("match:state_changed", handleStateChanged);
      colyseusService.off("match:left", handleLeft);
      colyseusService.off("match:error", handleError);
      colyseusService.off("session:active", handleSessionActive);
    };
  },
}));
